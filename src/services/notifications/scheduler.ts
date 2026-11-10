// 通知调度服务：定时检查订阅是否到达通知时间，评估规则并派发通知。
// Web 端仅在页面打开时运行（浏览器限制，见交付报告）；Android 端另有原生每日调度兜底。
// 去重：已派发的 dedupeKey 落盘 7 天，触发标记保证每天每个订阅只触发一次。
import {
  evaluateSubscription, loadSubscriptions, markNotified, readNotifiedKeys,
} from '../../domain/subscriptions'
import { getCachedWeather, saveWeather } from '../../hooks/useWeather'
import { getCityParts } from '../../domain/time'
import type { City, WeatherData } from '../../types/weather'
import type { NotificationCandidate } from '../../types/subscription'
import {
  cancelDailyReminder, deliverNotification, getNotificationPermission, isNative,
  scheduleDailyReminder,
} from '../../platform/notifications'
import { fetchWeather } from '../weather/api'
import { fetchWarnings } from '../weather/warnings'

const TICK_INTERVAL = 30 * 1000
const WEATHER_TTL = 10 * 60 * 1000

// 官方预警（红/橙）不等每日通知时间，发现即推送。
function isUrgent(candidate: NotificationCandidate): boolean {
  return candidate.level === 'warning' && candidate.dedupeKey.includes(':official-')
}

async function weatherFor(city: City): Promise<WeatherData | null> {
  const cached = getCachedWeather(city.id)
  if (cached && Date.now() - cached.data.fetchedAt < WEATHER_TTL) return cached.data
  try {
    const fresh = await fetchWeather(city)
    saveWeather(city, fresh)
    return fresh
  } catch {
    // 网络失败时退回缓存（即使过期），保证评估与通知不中断。
    return cached?.data ?? null
  }
}

// 合并候选通知为一条“每日摘要”，用于 Android 原生每日调度的内容。
function dailySummaryBody(candidates: NotificationCandidate[]): string {
  const detail = candidates.find((item) => item.title.includes('今日天气'))
  const extras = candidates.filter((item) => item !== detail).slice(0, 2)
  const parts: string[] = []
  if (detail) parts.push(detail.body)
  for (const extra of extras) parts.push(extra.body)
  return parts.length > 0 ? parts.join(' ') : '打开四序天气查看最新预报。'
}

export function startNotificationScheduler(onError?: (message: string) => void): () => void {
  let running = false

  const tick = async () => {
    if (running) return
    running = true
    try {
      if ((await getNotificationPermission()) !== 'granted') return
      const subscriptions = loadSubscriptions()
      const notified = readNotifiedKeys()
      for (const subscription of subscriptions) {
        if (!subscription.enabled) {
          if (isNative) await cancelDailyReminder(subscription.id)
          continue
        }
        const weather = await weatherFor(subscription.city)
        if (!weather) continue
        // 官方预警走全国列表缓存，多城市订阅不会重复请求。
        const { warnings } = await fetchWarnings(subscription.city)
        const local = getCityParts(weather.timezone)
        const hhmm = `${local.hour}:${local.minute}`
        const dateKey = `${local.year}-${local.month}-${local.day}`
        const triggerKey = `${subscription.id}:${dateKey}:triggered`

        const candidates = evaluateSubscription(subscription, weather, warnings)
          .filter((candidate) => !notified.has(candidate.dedupeKey))

        // 红/橙官方预警立即推送，不等每日通知时间。
        const deliveredKeys = new Set<string>()
        let urgentDelivered = 0
        for (const candidate of candidates.filter(isUrgent)) {
          if (await deliverNotification(candidate)) {
            markNotified(candidate.dedupeKey)
            deliveredKeys.add(candidate.dedupeKey)
            urgentDelivered += 1
          }
        }
        if (urgentDelivered > 0) onError?.(`${subscription.city.name}官方预警：已推送 ${urgentDelivered} 条`)

        // Android：每次运行都刷新原生每日调度（幂等：先取消同 id 旧调度）。
        if (isNative) {
          await scheduleDailyReminder({
            id: subscription.id,
            city: subscription.city,
            notifyTime: subscription.notifyTime,
            body: dailySummaryBody(candidates),
          })
        }

        // 未到通知时间（城市当地时间），今天不触发。
        if (notified.has(triggerKey) || hhmm < subscription.notifyTime) continue

        let delivered = 0
        for (const candidate of candidates.filter((item) => !deliveredKeys.has(item.dedupeKey))) {
          if (await deliverNotification(candidate)) {
            markNotified(candidate.dedupeKey)
            delivered += 1
          }
        }
        markNotified(triggerKey)
        if (delivered > 0) onError?.(`已向${subscription.city.name}发送 ${delivered} 条天气提醒`)
      }
    } catch (error) {
      onError?.(error instanceof Error ? error.message : '天气提醒调度出现异常')
    } finally {
      running = false
    }
  }

  const interval = window.setInterval(() => void tick(), TICK_INTERVAL)
  void tick()
  return () => window.clearInterval(interval)
}
