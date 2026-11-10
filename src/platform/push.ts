// 平台适配层 · 远程推送（FCM）。
// 原生侧由 SixuFirebaseMessagingService 接收下行消息并直接发布系统通知；
// 本模块只负责读取 FCM 注册令牌，供用户复制到自己的推送后端（或经后端绑定订阅）。
// 未配置 google-services.json 时原生插件不可用，全部接口安全降级为 null/false。
import { registerPlugin } from '@capacitor/core'
import { isNative } from './native'

interface PushTokenPlugin {
  isAvailable(): Promise<{ available: boolean }>
  getToken(): Promise<{ token: string | null }>
  consumeTapPayload(): Promise<{ subscriptionId?: string; cityId?: string }>
}

const PushToken = registerPlugin<PushTokenPlugin>('PushToken', {
  web: {
    isAvailable: async () => ({ available: false }),
    getToken: async () => ({ token: null }),
    consumeTapPayload: async () => ({}),
  },
})

export async function isPushAvailable(): Promise<boolean> {
  if (!isNative) return false
  try {
    const { available } = await PushToken.isAvailable()
    return available
  } catch {
    return false
  }
}

// 读取 FCM 令牌；未集成推送（无 google-services.json）或获取失败时返回 null。
export async function getPushToken(): Promise<string | null> {
  if (!isNative) return null
  try {
    const { token } = await PushToken.getToken()
    return token
  } catch {
    return null
  }
}

// 消费一次 FCM 通知点击载荷（应用被推送唤起时原生侧暂存的 subscriptionId/cityId）。
export async function consumePushTapPayload(): Promise<{ subscriptionId?: string; cityId?: string }> {
  if (!isNative) return {}
  try {
    return await PushToken.consumeTapPayload()
  } catch {
    return {}
  }
}
