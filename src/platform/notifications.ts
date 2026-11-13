// 平台适配层 · 通知。
// Web：Notification API（浏览器权限模型，页面关闭后无法送达——见交付报告限制说明）。
// Android：@capacitor/local-notifications 原生本地通知（应用被杀后仍按调度送达），
//   并按用途分渠道（每日天气 / 降雨提醒 / 天气预警），用户可在系统设置中分类管理。
// 远程推送：FCM（firebase-messaging）在原生层接收，见 android/ 与 docs/android/notifications.md；
//   服务器密钥永不进前端，推送需走后端服务（报告附示例）。
import { LocalNotifications } from '@capacitor/local-notifications'
import type { City } from '../types/weather'
import type { NotificationCandidate } from '../types/subscription'
import { isNative } from './native'

export { isNative } from './native'

export type NotificationPermission = 'granted' | 'denied' | 'default' | 'unsupported'

// 通知渠道：与原生层 NotificationChannels.java 保持一致。
// daily 每日天气（默认重要性，静默）；reminder 降雨等提醒（默认，振动）；
// warning 天气预警（高重要性，弹出+振动，用户可在系统设置中分别关闭）。
export type NotificationChannelId = 'daily' | 'reminder' | 'warning'

const CHANNEL_DEFINITIONS = [
  { id: 'daily', name: '每日天气', description: '订阅城市的每日天气摘要', importance: 3, vibration: false },
  { id: 'reminder', name: '天气提醒', description: '降雨、高温、大风等提醒', importance: 3, vibration: true },
  { id: 'warning', name: '天气预警', description: '中央气象台官方预警与强天气提醒', importance: 4, vibration: true },
] as const

export interface LocalNotificationInput {
  title: string
  body: string
  level: 'info' | 'warning'
  channelId?: NotificationChannelId
}

export function notificationsSupported(): boolean {
  if (isNative) return true
  return typeof window !== 'undefined' && 'Notification' in window
}

export async function getNotificationPermission(): Promise<NotificationPermission> {
  if (isNative) {
    const { display } = await LocalNotifications.checkPermissions()
    // Capacitor 的 prompt / prompt-with-rationale 统一映射为 Web 习惯的 'default'。
    return display === 'granted' || display === 'denied' ? display : 'default'
  }
  if (!('Notification' in window)) return 'unsupported'
  return Notification.permission
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (isNative) {
    const { display } = await LocalNotifications.requestPermissions()
    return display === 'granted'
  }
  if (!('Notification' in window)) return false
  return (await Notification.requestPermission()) === 'granted'
}

// 幂等注册通知渠道（重复调用安全）。应用启动时调用一次。
export async function ensureNotificationChannels(): Promise<void> {
  if (!isNative) return
  for (const channel of CHANNEL_DEFINITIONS) {
    await LocalNotifications.createChannel({
      id: channel.id,
      name: channel.name,
      description: channel.description,
      importance: channel.importance,
      vibration: channel.vibration,
    })
  }
}

// 通知点击携带的数据（extra 载荷）。
export interface NotificationTapPayload {
  subscriptionId?: string
  cityId?: string
  level?: 'info' | 'warning'
}

type TapHandler = (payload: NotificationTapPayload) => void

// 注册通知点击监听（Android 原生本地通知与 FCM 通知统一在此回到 JS）。
// 返回取消注册函数。重复调用会叠加监听，调用方负责在卸载时清理。
export function onNotificationTap(handler: TapHandler): () => void {
  if (!isNative) return () => { /* Web 端无通知点击事件 */ }
  const handle = LocalNotifications.addListener(
    'localNotificationActionPerformed',
    (action) => handler((action.notification.extra ?? {}) as NotificationTapPayload),
  )
  return () => { void handle.then((h) => h.remove()) }
}

// 立即展示一条通知。返回是否真正发出（权限拒绝/不支持时为 false）。
export async function deliverNotification(input: LocalNotificationInput): Promise<boolean> {
  const permission = await getNotificationPermission()
  if (permission !== 'granted') return false
  if (isNative) {
    await LocalNotifications.schedule({
      notifications: [{
        id: Date.now() % 2147483647,
        title: input.title,
        body: input.body,
        channelId: input.channelId ?? (input.level === 'warning' ? 'warning' : 'reminder'),
        extra: { level: input.level },
      }],
    })
    return true
  }
  new Notification(input.title, { body: input.body, tag: `sixu-${Date.now()}` })
  return true
}

// Android：按订阅的通知时间（城市当地时间）注册每日重复的本地通知。
// 每次调用先取消该订阅旧的调度，避免重复叠加；body 使用最近一次评估内容。
export async function scheduleDailyReminder(subscription: {
  id: string
  city: City
  notifyTime: string
  body: string
}): Promise<void> {
  if (!isNative) return
  const [hour, minute] = subscription.notifyTime.split(':').map(Number)
  if (Number.isNaN(hour) || Number.isNaN(minute)) return
  // 用订阅 id 的散列做通知 id，保证同一订阅只有一个每日调度。
  const hash = subscriptionHash(subscription.id)
  await LocalNotifications.cancel({ notifications: [{ id: hash }] })
  await LocalNotifications.schedule({
    notifications: [{
      id: hash,
      title: `${subscription.city.name} · 每日天气`,
      body: subscription.body,
      schedule: { on: { hour, minute } },
      channelId: 'daily',
      extra: { subscriptionId: subscription.id, cityId: subscription.city.id, level: 'info' },
    }],
  })
}

export async function cancelDailyReminder(subscriptionId: string): Promise<void> {
  if (!isNative) return
  await LocalNotifications.cancel({ notifications: [{ id: subscriptionHash(subscriptionId) }] })
}

function subscriptionHash(subscriptionId: string): number {
  let hash = 0
  for (const char of subscriptionId) hash = (hash * 31 + char.charCodeAt(0)) % 100000
  return hash
}

// 由通知候选推导所属渠道：官方预警与强天气提醒走高重要性预警渠道，
// 降雨提醒走提醒渠道，每日摘要走每日渠道。
export function channelForCandidate(candidate: NotificationCandidate): NotificationChannelId {
  if (candidate.level === 'warning') return 'warning'
  if (candidate.dedupeKey.includes(':rain')) return 'reminder'
  return 'daily'
}

// 类型重导出，方便调度层统一引用。
export type { NotificationCandidate }
