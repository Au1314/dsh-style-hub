/**
 * The card's stylesheet.
 *
 * One idempotent `<style>` element rather than a CSS module: a plugin
 * published outside this repository owns no build-time class-name hash, so it
 * names its own classes under a prefix and installs them once per document.
 * Every colour comes from the `--dsw-*` tokens, so the card restyles itself
 * with whatever theme is active instead of carrying its own palette.
 */

/** Id of the installed stylesheet element. */
export const STYLE_ELEMENT_ID = 'dsh-style-hub-card'

/** Card styles, written against the active theme's tokens. */
const CARD_CSS = `
.dshsh-card{display:flex;flex-direction:column;gap:24px;padding:4px 0}
.dshsh-head{display:flex;flex-direction:column;gap:4px}
.dshsh-title{font-size:15px;font-weight:600;line-height:22px;color:var(--dsw-alias-label-primary)}
.dshsh-desc{font-size:13px;line-height:20px;color:var(--dsw-alias-label-tertiary)}
.dshsh-group{display:flex;flex-direction:column;gap:10px}
.dshsh-label{font-size:13px;font-weight:500;line-height:20px;color:var(--dsw-alias-label-secondary)}
.dshsh-hint{font-size:12px;line-height:18px;color:var(--dsw-alias-label-caption)}
.dshsh-error{font-size:12px;line-height:18px;color:var(--dsw-alias-state-error-primary)}
.dshsh-row{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.dshsh-field{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:6px 0}
.dshsh-fieldText{display:flex;flex-direction:column;gap:2px;min-width:0}
.dshsh-switch{width:40px;height:22px;accent-color:var(--dsw-alias-brand-primary);cursor:pointer;flex:none}
.dshsh-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(156px,1fr));gap:8px}
.dshsh-chip{display:flex;flex-direction:column;gap:8px;align-items:flex-start;padding:12px;border-radius:12px;border:.5px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);font:inherit;text-align:left;cursor:pointer}
.dshsh-chip:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover)}
.dshsh-chip:disabled{opacity:.5;cursor:default}
.dshsh-chipOn{border-color:var(--dsw-alias-brand-primary);box-shadow:0 0 0 .5px var(--dsw-alias-brand-primary)}
.dshsh-dots{display:flex;gap:4px}
.dshsh-dot{width:14px;height:14px;border-radius:50%;border:.5px solid var(--dsw-alias-border-l2)}
.dshsh-chipName{font-size:13px;line-height:18px}
.dshsh-chipScheme{font-size:11px;line-height:16px;color:var(--dsw-alias-label-caption)}
.dshsh-btn{font:inherit;font-size:13px;line-height:20px;padding:7px 14px;border-radius:999px;border:.5px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);cursor:pointer}
.dshsh-btn:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover)}
.dshsh-btn:disabled{opacity:.5;cursor:default}
.dshsh-range{flex:1;min-width:140px;accent-color:var(--dsw-alias-brand-primary);cursor:pointer}
.dshsh-value{font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary);min-width:52px;text-align:right;font-variant-numeric:tabular-nums}
.dshsh-color{width:44px;height:30px;padding:2px;border-radius:8px;border:.5px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1);cursor:pointer;flex:none}
.dshsh-select{font:inherit;font-size:13px;padding:6px 10px;border-radius:8px;border:.5px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary)}
.dshsh-thumbs{display:grid;grid-template-columns:repeat(auto-fill,minmax(132px,1fr));gap:8px}
.dshsh-thumb{position:relative;aspect-ratio:16/10;padding:0;border-radius:12px;overflow:hidden;border:.5px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-2);cursor:pointer}
.dshsh-thumbOn{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:-2px}
.dshsh-thumbBtn{display:block;width:100%;height:100%;padding:0;border:0;background:none;cursor:pointer}
.dshsh-thumbBtn:disabled{cursor:default}
.dshsh-thumbImg{width:100%;height:100%;object-fit:cover;display:block}
.dshsh-thumbBar{position:absolute;left:0;right:0;bottom:0;display:flex;align-items:center;justify-content:space-between;gap:6px;padding:4px 6px;background:rgba(0,0,0,.55);color:#fff}
.dshsh-thumbName{font-size:11px;line-height:16px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0}
.dshsh-badge{font-size:10px;line-height:14px;padding:1px 6px;border-radius:999px;background:rgba(255,255,255,.22);flex:none}
.dshsh-thumbDel{font:inherit;font-size:11px;line-height:14px;padding:2px 6px;border-radius:6px;border:0;background:rgba(255,255,255,.18);color:#fff;cursor:pointer;flex:none}
.dshsh-thumbDel:hover{background:rgba(239,68,68,.85)}
.dshsh-empty{font-size:12px;line-height:18px;color:var(--dsw-alias-label-caption)}
`

/**
 * Install the card stylesheet once per document.
 * @returns true when this call added the element, false when one was already there.
 */
export function installCardStyles(): boolean {
  if (typeof document === 'undefined') return false
  if (document.getElementById(STYLE_ELEMENT_ID)) return false
  const tag = document.createElement('style')
  tag.id = STYLE_ELEMENT_ID
  tag.textContent = CARD_CSS
  document.head.append(tag)
  return true
}
