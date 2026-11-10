// 天气业务逻辑层 · 天气订阅。
// 订阅的增删改查（经平台适配层存储）与“订阅 × 天气数据 → 通知候选”评估引擎。
// 引擎是纯函数，Web 与 Android 共用；派发与去重由通知模块负责。
import { SUBSCRIPTIONS_KEY, NOTIFIED_KEY } from '../config/keys'
import { readStorage, writeStorage } from '../platform/storage'
import type { City, WeatherData } from '../types/weather'
import type { NotificationCandidate, Subscription } from '../types/subscription'
import { DEFAULT_ALERT_RULES } from '../types/subscription'
import { buildWeatherAlerts } from './alerts'
import { getCityParts } from './time'
import { weatherDescription } from './weather'

const SUBSCRIPTION_LIMIT = 10

function readJson<T>(key: string): T | null {
  try {
    const value = readStorage(key)
    return value ? JSON.parse(value) as T : null
  } catch {
    return null
  }
}

export function loadSubscriptions(): Subscription[] {
  const parsed = readJson<unknown>(SUBSCRIPTIONS_KEY)
  if (!Array.isArray(parsed)) return []
  return parsed.filter(
    (item): item is Subscription =>
      !!item && typeof item === 'object' && 'id' in item && 'city' in item && 'rules' in item,
  )
}

export function saveSubscriptions(subscriptions: Subscription[]): void {
  writeStorage(SUBSCRIPTIONS_KEY, JSON.stringify(subscriptions.slice(0, SUBSCRIPTION_LIMIT)))
}

export function createSubscription(city: City, notifyTime = '07:30'): Subscription {
  return {
    id: `sub-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    city,
    enabled: true,
    notifyTime,
    rules: { ...DEFAULT_ALERT_RULES },
    createdAt: Date.now(),
  }
}

export function upsertSubscription(subscriptions: Subscription[], next: Subscription): Subscription[] {
  const index = subscriptions.findIndex((item) => item.id === next.id)
  const result = index >= 0
    ? subscriptions.map((item) => (item.id === next.id ? next : item))
    : [next, ...subscriptions]
  saveSubscriptions(result)
  return result
}

export function removeSubscription(subscriptions: Subscription[], id: string): Subscription[] {
  const result = subscriptions.filter((item) => item.id !== id)
  saveSubscriptions(result)
  return result
}

// ── 评估引擎 ──────────────────────────────────────────────

const RAIN_CODES = new Set([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82, 95, 96, 99])

// 把“今天是否已过了通知时间”交给调度器判断；引擎只负责根据数据生成候选。
export function evaluateSubscription(subscription: Subscription, data: WeatherData): NotificationCandidate[] {
  if (!subscription.enabled) return []
  const candidates: NotificationCandidate[] = []
  const local = getCityParts(data.timezone)
  const dateKey = `${local.year}-${local.month}-${local.day}`
  const push = (type: string, level: NotificationCandidate['level'], title: string, body: string) => {
    candidates.push({
      dedupeKey: `${subscription.id}:${dateKey}:${type}`,
      subscriptionId: subscription.id,
      cityId: subscription.city.id,
      title,
      body,
      level,
    })
  }

  const today = data.daily[0]
  const tomorrow = data.daily[1]
  const cityName = subscription.city.name
  const next12 = data.hourly.slice(0, 12)
  const maxRainProb = Math.max(0, ...next12.map((hour) => hour.precipitationProbability))
  const rainHours = next12.filter(
    (hour) => hour.precipitationProbability >= subscription.rules.heavyRain.probability,
  ).length
  const willRain = next12.some((hour) => RAIN_CODES.has(hour.weatherCode))

  if (subscription.rules.daily && today) {
    push(
      'daily', 'info', `${cityName}今日天气 · ${weatherDescription(today.weatherCode)}`,
      `${Math.round(today.temperatureMin)}~${Math.round(today.temperatureMax)}°C`
      + `，降水概率 ${Math.round(today.precipitationProbabilityMax)}%。`,
    )
  }

  if (subscription.rules.rain.enabled && maxRainProb >= subscription.rules.rain.probability && willRain) {
    push(
      'rain', 'info', `${cityName}未来 12 小时有降雨可能`,
      `降水概率最高约 ${Math.round(maxRainProb)}%，出门记得带伞。`,
    )
  }

  if (subscription.rules.heavyRain.enabled && rainHours >= 3) {
    push(
      'heavy-rain', 'warning', `${cityName}未来 12 小时降水概率持续较高`,
      `约 ${rainHours} 个小时降水概率 ≥ ${subscription.rules.heavyRain.probability}%，注意路况与积水。`,
    )
  }

  if (subscription.rules.highTemp.enabled && today && today.temperatureMax >= subscription.rules.highTemp.threshold) {
    push(
      'high-temp', 'warning', `${cityName}今日高温提醒`,
      `最高气温约 ${Math.round(today.temperatureMax)}°C（阈值 ${subscription.rules.highTemp.threshold}°C），注意补水防晒。`,
    )
  }

  if (subscription.rules.lowTemp.enabled && today && today.temperatureMin <= subscription.rules.lowTemp.threshold) {
    push(
      'low-temp', 'warning', `${cityName}今日低温提醒`,
      `最低气温约 ${Math.round(today.temperatureMin)}°C（阈值 ${subscription.rules.lowTemp.threshold}°C），注意防寒保暖。`,
    )
  }

  const windNow = data.current.windSpeed
  if (subscription.rules.wind.enabled && windNow >= subscription.rules.wind.threshold) {
    push(
      'wind', 'warning', `${cityName}大风提醒`,
      `当前风速约 ${Math.round(windNow)} km/h（阈值 ${subscription.rules.wind.threshold} km/h），注意高空坠物。`,
    )
  }

  // 寒潮：与明日最低气温对比，24 小时内降幅达到阈值。
  if (subscription.rules.coldWave.enabled && today && tomorrow) {
    const drop = today.temperatureMin - tomorrow.temperatureMin
    if (drop >= subscription.rules.coldWave.drop) {
      push(
        'cold-wave', 'warning', `${cityName}寒潮提醒`,
        `明晨最低气温较今日下降约 ${Math.round(drop)}°C，请提前添衣。`,
      )
    }
  }

  // 官方气象预警：Open-Meteo 不提供官方预警数据源，这里推送数据推导的 watch 级提示。
  if (subscription.rules.alerts) {
    for (const alert of buildWeatherAlerts(data)) {
      if (alert.level !== 'watch') continue
      push(`alert-${alert.id}`, 'warning', `${cityName}${alert.title}提示`, alert.detail)
    }
  }

  return candidates
}

// ── 去重记录 ──────────────────────────────────────────────

interface NotifiedRecord {
  [dedupeKey: string]: number
}

// 读取已通知记录，并清理 7 天前的过期条目（防止存储无限增长）。
export function readNotifiedKeys(): Set<string> {
  const record = readJson<NotifiedRecord>(NOTIFIED_KEY) ?? {}
  const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000
  const keys = new Set<string>()
  let changed = false
  for (const [key, at] of Object.entries(record)) {
    if (at >= cutoff) keys.add(key)
    else { delete record[key]; changed = true }
  }
  if (changed) writeStorage(NOTIFIED_KEY, JSON.stringify(record))
  return keys
}

export function markNotified(dedupeKey: string): void {
  const record = readJson<NotifiedRecord>(NOTIFIED_KEY) ?? {}
  record[dedupeKey] = Date.now()
  writeStorage(NOTIFIED_KEY, JSON.stringify(record))
}
