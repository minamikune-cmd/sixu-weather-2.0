// 天气业务逻辑层 · 日出日落与昼夜判定。
// 昼夜阶段（晨曦/白昼/日暮/夜晚）与日照进度统一在此计算，Web 与 Android 共用。
import type { DayPhase, WeatherData } from '../types/weather'
import { getCityParts, getLocalMinutes, localTimeFromIso } from './time'

function minutesOfLocalIso(value?: string): number | null {
  if (!value || !value.includes('T')) return null
  const [hour, minute] = value.split('T')[1].split(':').map(Number)
  return hour * 60 + minute
}

function todaySolar(data: WeatherData) {
  const today = getCityParts(data.timezone)
  const dateKey = `${today.year}-${today.month}-${today.day}`
  return data.daily.find((day) => day.date === dateKey) ?? data.daily[0]
}

export function getDayPhase(data: WeatherData): DayPhase {
  const now = getLocalMinutes(data.timezone)
  const solar = todaySolar(data)
  const sunrise = minutesOfLocalIso(solar?.sunrise)
  const sunset = minutesOfLocalIso(solar?.sunset)
  if (sunrise === null || sunset === null) return data.current.isDay ? 'day' : 'night'
  if (now >= sunrise - 45 && now < sunrise + 45) return 'dawn'
  if (now >= sunrise + 45 && now < sunset - 45) return 'day'
  if (now >= sunset - 45 && now < sunset + 45) return 'dusk'
  return 'night'
}

export function getDayProgress(data: WeatherData): number {
  const now = getLocalMinutes(data.timezone)
  const solar = todaySolar(data)
  const sunrise = minutesOfLocalIso(solar?.sunrise) ?? 360
  const sunset = minutesOfLocalIso(solar?.sunset) ?? 1080
  return Math.max(0, Math.min(1, (now - sunrise) / Math.max(1, sunset - sunrise)))
}

export function daylightDuration(sunrise?: string, sunset?: string): string {
  if (!sunrise || !sunset) return '暂无数据'
  const start = localTimeFromIso(sunrise).split(':').map(Number)
  const end = localTimeFromIso(sunset).split(':').map(Number)
  const minutes = Math.max(0, (end[0] * 60 + end[1]) - (start[0] * 60 + start[1]))
  return `${Math.floor(minutes / 60)} 小时 ${minutes % 60} 分`
}
