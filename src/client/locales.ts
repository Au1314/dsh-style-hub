/**
 * `settings.style-hub` dictionaries and the namespace declaration that puts a
 * typed `t` seat on the card's props.
 *
 * Chinese is the key-set source of truth — `en` is declared as
 * `Record<StyleHubKey, string>`, so a key added to one dictionary and missed
 * in the other is a compile error rather than an untranslated label discovered
 * in the wild.
 */
import type {} from '@deepseek-ai/dsh-client-ui-slots'

/** Simplified Chinese dictionary (the key-set source of truth). */
export const zh = {
  'card.title': '风格中心',
  'card.description': '选择界面风格、微调配色，并上传自己的壁纸。',
  'enable.label': '启用自定义外观',
  'enable.hint': '关闭后恢复 DSH 自带外观',
  'style.label': '界面风格',
  'style.hint': '选择一套内置配色',
  'style.stock': '跟随系统外观',
  'preset.nord': 'Nord',
  'preset.dracula': 'Dracula',
  'preset.mocha': 'Catppuccin Mocha',
  'preset.tokyo-night': 'Tokyo Night',
  'preset.gruvbox-dark': 'Gruvbox Dark',
  'preset.solarized-light': 'Solarized Light',
  'preset.github-light': 'GitHub Light',
  'preset.latte': 'Catppuccin Latte',
  'scheme.light': '浅色',
  'scheme.dark': '深色',
  'accent.label': '强调色',
  'accent.hint': '留空则沿用当前风格自带的强调色',
  'accent.reset': '沿用风格',
  'panel.label': '面板透明度',
  'panel.hint': '调低后可透过面板看到壁纸',
  'wallpaper.label': '壁纸',
  'wallpaper.hint': '图片保存在 DSH 主机上，换浏览器、换设备都不会丢',
  'wallpaper.none': '不使用壁纸',
  'wallpaper.empty': '还没有上传过图片',
  'wallpaper.upload': '上传图片',
  'wallpaper.uploading': '上传中…',
  'wallpaper.failed': '上传失败',
  'wallpaper.delete': '删除',
  'wallpaper.deleteConfirm': '删除这张壁纸？',
  'wallpaper.selected': '使用中',
  'wallpaper.fit': '填充方式',
  'wallpaper.fit.cover': '裁剪填满',
  'wallpaper.fit.contain': '完整显示',
  'wallpaper.opacity': '壁纸不透明度',
  'wallpaper.blur': '壁纸模糊',
  'wallpaper.dim': '暗色遮罩',
  'wallpaper.tooLarge': '图片不能超过 15 MB',
  'glass.label': '壁纸引擎的玻璃颜色',
  'glass.hint': '当前是深色玻璃，会把浅色风格的设置弹窗洗成一片平灰',
  'glass.fix': '改为白色玻璃',
  'glass.fixing': '修改中…',
  'glass.failed': '没能修改壁纸引擎的玻璃颜色',
  'unit.percent': '%',
  'unit.px': 'px',
  'status.unavailable': '设置暂不可用',
  'status.readonly': '当前配置为只读',
} as const

/** The settings.style-hub namespace key union. */
export type StyleHubKey = keyof typeof zh

/** English dictionary, checked complete against the zh key set. */
export const en: Record<StyleHubKey, string> = {
  'card.title': 'Style Hub',
  'card.description': 'Pick an interface style, fine-tune the palette, and upload your own wallpaper.',
  'enable.label': 'Enable custom appearance',
  'enable.hint': 'Turn off to return to the stock DSH appearance',
  'style.label': 'Interface style',
  'style.hint': 'Choose one of the bundled palettes',
  'style.stock': 'Follow system appearance',
  'preset.nord': 'Nord',
  'preset.dracula': 'Dracula',
  'preset.mocha': 'Catppuccin Mocha',
  'preset.tokyo-night': 'Tokyo Night',
  'preset.gruvbox-dark': 'Gruvbox Dark',
  'preset.solarized-light': 'Solarized Light',
  'preset.github-light': 'GitHub Light',
  'preset.latte': 'Catppuccin Latte',
  'scheme.light': 'Light',
  'scheme.dark': 'Dark',
  'accent.label': 'Accent colour',
  'accent.hint': 'Leave empty to keep the accent of the selected style',
  'accent.reset': "Style's own",
  'panel.label': 'Panel opacity',
  'panel.hint': 'Lower it to let the wallpaper show through panels',
  'wallpaper.label': 'Wallpaper',
  'wallpaper.hint': 'Images are stored on the DSH Host, so they survive a new browser or device',
  'wallpaper.none': 'No wallpaper',
  'wallpaper.empty': 'No images uploaded yet',
  'wallpaper.upload': 'Upload image',
  'wallpaper.uploading': 'Uploading…',
  'wallpaper.failed': 'Upload failed',
  'wallpaper.delete': 'Delete',
  'wallpaper.deleteConfirm': 'Delete this wallpaper?',
  'wallpaper.selected': 'In use',
  'wallpaper.fit': 'Fit',
  'wallpaper.fit.cover': 'Fill (crop)',
  'wallpaper.fit.contain': 'Fit (letterbox)',
  'wallpaper.opacity': 'Wallpaper opacity',
  'wallpaper.blur': 'Wallpaper blur',
  'wallpaper.dim': 'Dark veil',
  'wallpaper.tooLarge': 'Images must be 15 MB or smaller',
  'glass.label': 'Wallpaper-engine glass colour',
  'glass.hint': 'It is dark right now, which washes the settings dialog of a light style to flat grey',
  'glass.fix': 'Switch to white glass',
  'glass.fixing': 'Switching…',
  'glass.failed': "Could not change wallpaper-engine's glass colour",
  'unit.percent': '%',
  'unit.px': 'px',
  'status.unavailable': 'Settings unavailable',
  'status.readonly': 'This configuration is read-only',
}

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** The Style Hub settings card's copy. */
    'settings.style-hub': StyleHubKey
  }
}
