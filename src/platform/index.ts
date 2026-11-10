// 平台适配层入口：统一暴露当前运行平台与初始化流程。
// Web 端全部能力直接降级为浏览器 API；Android 端走 Capacitor 插件。
import { initStorage } from './storage'
import { configureStatusBar } from './statusBar'
import { registerBackHandler } from './backButton'
import { ensureNotificationChannels } from './notifications'
import { isNative } from './native'

export { isNative, isAndroid, isWeb, platformName } from './native'

// 在渲染 React 之前完成原生平台初始化（存储预热、状态栏、返回键、启动屏）。
// Web 端是几个空操作，保持同一调用点，业务代码无需关心平台差异。
export async function initPlatform(): Promise<void> {
  await initStorage()
  if (isNative) {
    configureStatusBar()
    registerBackHandler()
    // 幂等注册通知渠道（每日天气/天气提醒/天气预警），供本地通知与 FCM 共用。
    void ensureNotificationChannels()
  }
}
