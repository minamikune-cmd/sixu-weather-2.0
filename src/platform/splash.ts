// 平台适配层 · 启动屏（仅原生生效，Web 端为 no-op）。
// capacitor.config 中关闭自动隐藏，待 React 完成首帧渲染后调用 hideSplash 淡出。
import { SplashScreen } from '@capacitor/splash-screen'
import { isNative } from './native'

export async function hideSplash(): Promise<void> {
  if (!isNative) return
  await SplashScreen.hide({ fadeOutDuration: 350 }).catch(() => { /* 忽略 */ })
}
