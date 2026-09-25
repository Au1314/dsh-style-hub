# Changelog

All notable changes to this package are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versions follow
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] — 2026-09-25

First release.

### Added

- **Eight bundled styles** (`nord`, `dracula`, `mocha`, `tokyo-night`,
  `gruvbox-dark`, `solarized-light`, `github-light`, `latte`), registered as
  themes under an `sh:` prefix with a token directory derived from twelve
  swatches each. No preset emits a `--dsw-static-*` value.
- **Fine-tuning** — a brand accent and a panel-opacity slider, stacked as a
  single fingerprinted override layer so an unchanged pass writes nothing.
- **Wallpaper library** — host-side storage under the plugin's data directory,
  one prefix route (`/api/style-hub/wallpapers`), magic-byte type detection,
  a 15 MB ceiling, and same-host origin checks on writes.
- **Boot layer** — the Host injects the wallpaper element and rule into every
  index render, so the first paint already shows the selected picture.
- **Settings card** under **Plugins → Plugin configuration**, keyed by the
  `style-hub` namespace, with zh/en dictionaries.
- **Switch-off contract** — the preference held before the plugin engaged is
  captured and restored rather than replaced with a fixed default; `stock`
  never writes to the built-in Appearance preference.

### Design notes

- **No `menuBlur`.** The design system exposes no stable hook for blurring the
  menus (`--dsw-mask-blur` is declared but never consumed), so the equivalent
  effect is delivered with surfaces this plugin owns: panel translucency and
  wallpaper blur. See [README.md](README.md#design-decisions).
- **The canvas is held at `0.85` alpha while a wallpaper shows**, because
  `ui-layout` paints the frame with an opaque `--dsw-alias-bg-base`.
