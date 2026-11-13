// 平台适配层 · 状态栏（仅原生生效，Web 端为 no-op）。
// 状态栏透明叠加在 WebView 上，让应用的场景背景延伸到屏幕顶部；
// 内容由页面通过 viewport-fit=cover + env(safe-area-inset-*) 自己避让。
import { StatusBar, Style } from '@capacitor/status-bar'
import { isNative } from './native'

export function configureStatusBar(): void {
  if (!isNative) return
  void StatusBar.setOverlaysWebView({ overlay: true }).catch(() => { /* 不支持时忽略 */ })
  void StatusBar.setStyle({ style: Style.Light }).catch(() => { /* 忽略 */ })
}

// 深色场景（夜色/深色风格）下把状态栏图标切换为浅色。
export function setStatusBarDark(dark: boolean): void {
  if (!isNative) return
  void StatusBar.setStyle({ style: dark ? Style.Dark : Style.Light }).catch(() => { /* 忽略 */ })
}
