# Architecture

`dsh-style-hub` is one package with two halves that never import from each other's DSH surface: the Host half runs in the composition's Node process, the browser half runs in the page, and the only thing they share is the durable `style-hub` section plus the wallpaper wire contract.

```
src/
  shared/            settings.ts · wallpaper-css.ts · wallpapers.ts   ← both halves import these
  index.ts           Host half: schema, storage, route, boot rule
  routes.ts          the prefix route's dispatch
  storage.ts         the on-disk library
  client/
    index.ts         browser half: registration + reconciliation
    controller.ts    section reads/writes for the card
    StyleHubCard.tsx the card itself
    palettes · tokens · color · tweaks        ← style derivation
    api · locales · styles                    ← transport, copy, chrome
```

## Contracts with the composition

| What the plugin needs | How it arrives | Why |
| --- | --- | --- |
| carrier for the wallpaper route | `inject = ['webServer']` | routes must be registered before the server accepts requests |
| settings namespace | `ctx.inject(['settings'], …)` | graceful degradation: without a settings provider the routes still stand |
| slot to contribute the card | `ctx.slots.inject('settings.plugin.item', …)` | the tab dispatches one key per *served* namespace |
| theme registry | `ctx.theme.register` / `setTheme` / `overrideTokens` | the design system owns palette composition |
| copy | `ctx.locale.register(LOCALE_NS, { zh, en })` | the card renders through the locale service |

Bundle purity holds throughout: **no cross-plugin value imports**. DSH packages appear only as `import type …/client` side-effect imports (which is what augments the shared `Context` type), and every runtime service is reached through `ctx`.

## Host half

`apply(ctx)` does three things:

1. Registers the `style-hub` namespace with `StyleHubSchema` (defaults for every field) plus `validateSettings`, which owns the ranges and the shape checks so a stored document can be re-judged without a schema upgrade.
2. Opens an `ImageStore` and registers **one** prefix route (`/api/style-hub/wallpapers`). Everything else is dispatched on the route's own sub-path, so there is exactly one registration to reason about.
3. Subscribes to `webserver/index-inject` and pushes two rows per render: the wallpaper `<div>` (so the first paint has a plane to paint on) and the boot `<style>` row derived from the *current* section.

`bootWallpaperCss` refuses an id the storage layer would not have issued (`ID_PATTERN`, 32 hex chars), which is why a stale or hand-edited section paints nothing instead of a broken URL.

### Storage

```
$DSH_HOME/dsh-style-hub/
  images/<id>.<ext>     bytes, named by the id the API issued
  catalogue.json        the index: id, display name, size, ext, mime, addedAt
```

Every public method serializes on one internal promise chain, so callers may fire uploads and deletes without ordering them themselves. Type detection is magic-byte only; a text file renamed `.png` is refused with `400` before anything touches disk.

## Browser half

`apply(ctx)` runs four registrations and one reconciliation loop.

**Registrations.** Each preset becomes a theme registered under `sh:<id>` with its derived token directory; the dictionaries are registered under `settings.style-hub`; the card stylesheet is installed once per document; and the card itself is injected into `settings.plugin.item` under `key: 'style-hub'` — the settings namespace, which is the join key the tab dispatches on.

**Reconciliation.** `sync()` reads the section and makes the page match it, in dependency order:

```
scope snapshot
  ├─ status !== 'ready'  → no-op (the boot layer is already painting; a reset
  │                        here would strip it while the first read is in flight)
  └─ syncTheme   select sh:<id>, or hand the preference back to the stock one
     syncTweak   accent + panel translucency as ONE override layer, fingerprinted
     syncWallpaper  install/restyle/remove the plugin's own <style> + plane
```

`applying` guards re-entry, because `setTheme` and `overrideTokens` both emit `theme/change`, and a pipeline that re-entered itself would chase its own tail.

### Where the state lives

| State | Owner | Why not in the section |
| --- | --- | --- |
| selected style | `style-hub.themeId` | durable by design |
| the preference held *before* us | a closure variable, seeded at start and updated on every non-`sh:` `theme/change` | `setTheme` persists only stock values, so a sh: value would erase it |
| whether the last pass engaged | closure | purely a "did I change something just now" flag |
| the tweak layer's disposer + fingerprint | closure | process-local; a fingerprint that matched means "write nothing" |

### The card

`StyleHubController` owns an immutable `StyleHubCardState` plus a `subscribe`/`snapshot` pair (consumed with `useSyncExternalStore`), a `patch` that writes one field per gesture through `scope.set`, and the upload/remove calls. The card itself is presentational: it renders `status === 'ready'` snapshots and never touches `ctx`.

Errors that are this plugin's own are written with a `@` prefix (`@wallpaper.tooLarge`), so the component can resolve them against the dictionary while server messages pass through verbatim.

## Tests

`npm test` runs the bundled `test/build/*.test.js`:

- `settings.test.mjs` — the section shape, the ranges, and the boot rule.
- `tokens.test.mjs` — required-token coverage (names extracted from the installed design-system stylesheet), no `--dsw-static-*` leakage, tweak-layer contents, fingerprints.
- `storage.test.mjs` / `routes.test.mjs` — sniffing, round trips, origin and method refusal, `413`.
- `client.test.mjs` — the built `lib/client.js` is loaded the way the composition loads it (`window.__ModuleLoader__.load`), driven against a stand-in `ctx` and document, and asserted on: what it registers, what it selects, what it restores, and what DOM it owns.

The last one is the reason the build also emits a client bundle: the tests exercise the artifact that ships, not the source.
