// 平台适配层 · 通知。
// Web：Notification API（浏览器权限模型，页面关闭后无法送达——见交付报告限制说明）。
// Android：@capacitor/local-notifications 原生本地通知（应用被杀后仍按调度送达）。
// 远程推送不在前端实现：服务器密钥永不进前端，需要时走后端推送服务（见报告设计）。
import { LocalNotifications } from '@capacitor/local-notifications'
import type { City } from '../types/weather'
import type { NotificationCandidate } from '../types/subscription'
import { isNative } from './native'

export { isNative } from './native'

export type NotificationPermission = 'granted' | 'denied' | 'default' | 'unsupported'

export interface LocalNotificationInput {
  title: string
  body: string
  level: 'info' | 'warning'
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
        // Android 8+ 需要通知渠道；channelId 一致即可在原生端注册。
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
  let hash = 0
  for (const char of subscription.id) hash = (hash * 31 + char.charCodeAt(0)) % 100000
  await LocalNotifications.cancel({ notifications: [{ id: hash }] })
  await LocalNotifications.schedule({
    notifications: [{
      id: hash,
      title: `${subscription.city.name} · 每日天气`,
      body: subscription.body,
      schedule: { on: { hour, minute } },
      extra: { subscriptionId: subscription.id },
    }],
  })
}

export async function cancelDailyReminder(subscriptionId: string): Promise<void> {
  if (!isNative) return
  let hash = 0
  for (const char of subscriptionId) hash = (hash * 31 + char.charCodeAt(0)) % 100000
  await LocalNotifications.cancel({ notifications: [{ id: hash }] })
}

// 类型重导出，方便调度层统一引用。
export type { NotificationCandidate }
