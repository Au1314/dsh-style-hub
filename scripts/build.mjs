/**
 * Build the publishable package.
 *
 * Three products, each shaped for how it is consumed:
 *
 * - `lib/index.js` — the Host half, an ESM module the Host's cordis loader
 *   imports. Bare specifiers stay external: the Host owns the dependency
 *   versions, this package only names them.
 * - `lib/client.js` — the browser half, wrapped in the module-loader shell the
 *   composition expects (`window.__ModuleLoader__.load({ id, factory })`), so
 *   the file is a plain script that hands its exports back to whoever loads it
 *   rather than a module with opinions about `import`/`export`.
 * - `lib/types/**` — the declaration tree, emitted separately because the
 *   source uses `.ts` extension imports (which the shipped declarations keep,
 *   matching the rest of the ecosystem).
 *
 * Test bundles are built too: the tests import TypeScript sources directly and
 * are only runnable once those sources are bundled for Node.
 */
import { build } from 'esbuild'
import { execFileSync } from 'node:child_process'
import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const lib = join(root, 'lib')
const pkg = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'))

/** Packages the composition provides; never bundle what the loader resolves. */
const browserExternal = ['react', 'react/jsx-runtime', 'react/jsx-dev-runtime', '@deepseek-ai/*']

await rm(lib, { recursive: true, force: true })
await rm(join(root, 'test', 'build'), { recursive: true, force: true })

// ── Host half ────────────────────────────────────────────────────────────────
await build({
  entryPoints: [join(root, 'src', 'index.ts')],
  outfile: join(lib, 'index.js'),
  bundle: true,
  format: 'esm',
  platform: 'node',
  target: 'node22',
  packages: 'external',
  sourcemap: true,
  logLevel: 'warning',
})

// ── Browser half ─────────────────────────────────────────────────────────────
const client = await build({
  entryPoints: [join(root, 'src', 'client', 'index.ts')],
  bundle: true,
  write: false,
  format: 'cjs',
  platform: 'browser',
  target: 'es2022',
  external: browserExternal,
  sourcemap: false,
  logLevel: 'warning',
})

const body = client.outputFiles[0].text.replace(/^"use strict";\n?/, '')
await mkdir(lib, { recursive: true })
await writeFile(
  join(lib, 'client.js'),
  [
    'window.__ModuleLoader__.load({',
    `\tid: ${JSON.stringify(pkg.name)},`,
    '\tfactory: (require) => {',
    '\t\tvar module = { exports: {} };',
    '\t\tvar exports = module.exports;',
    '\t\tObject.defineProperty(exports, Symbol.toStringTag, { value: "Module" });',
    body
      .split('\n')
      .map(line => (line ? `\t\t${line}` : line))
      .join('\n'),
    '\t\treturn module.exports;',
    '\t}',
    '});',
    '',
  ].join('\n'),
)

// ── Declarations ─────────────────────────────────────────────────────────────
const tsc = join(root, 'node_modules', 'typescript', 'lib', 'tsc.js')
execFileSync(process.execPath, [tsc, '-p', join(root, 'tsconfig.build.json')], {
  cwd: root,
  stdio: 'inherit',
})

// ── Test bundles ─────────────────────────────────────────────────────────────
const testDir = join(root, 'test')
const entries = (await readdir(testDir, { withFileTypes: true }))
  .filter(entry => entry.isFile() && entry.name.endsWith('.test.mjs'))
  .map(entry => join(testDir, entry.name))

if (entries.length > 0) {
  await build({
    entryPoints: entries,
    outdir: join(testDir, 'build'),
    bundle: true,
    format: 'esm',
    platform: 'node',
    target: 'node22',
    packages: 'external',
    sourcemap: true,
    logLevel: 'warning',
  })
  for (const entry of entries) {
    console.log(`built ${relative(root, join(testDir, 'build', entry.split(/[\\/]/).pop()))}`)
  }
}

console.log(`built ${relative(root, join(lib, 'index.js'))} (${pkg.name} host)`)
console.log(`built ${relative(root, join(lib, 'client.js'))} (${pkg.name} browser)`)
