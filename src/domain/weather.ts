// 天气业务逻辑层 · 天气描述与单位换算。
// 纯函数，Web 与 Android 共用；不依赖 DOM、存储或网络。
import type { WeatherKind } from '../types/weather'

const weatherText: Record<number, string> = {
  0: '晴朗', 1: '大部晴朗', 2: '局部多云', 3: '阴天', 45: '有雾', 48: '雾凇',
  51: '轻微毛毛雨', 53: '毛毛雨', 55: '较强毛毛雨', 56: '冻毛毛雨', 57: '强冻毛毛雨',
  61: '小雨', 63: '中雨', 65: '大雨', 66: '冻雨', 67: '强冻雨', 71: '小雪',
  73: '中雪', 75: '大雪', 77: '雪粒', 80: '小阵雨', 81: '阵雨', 82: '强阵雨',
  85: '小阵雪', 86: '强阵雪', 95: '雷暴', 96: '雷暴伴冰雹', 99: '强雷暴伴冰雹',
}

export function weatherDescription(code: number): string {
  return weatherText[code] ?? '天气变化中'
}

export function weatherKind(code: number): WeatherKind {
  if ([95, 96, 99].includes(code)) return 'thunder'
  if ([71, 73, 75, 77, 85, 86].includes(code)) return 'snow'
  if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return 'rain'
  if ([45, 48].includes(code)) return 'fog'
  if (code === 3) return 'overcast'
  if (code === 2) return 'cloud'
  return 'clear'
}

export function convertTemperature(celsius: number, unit: 'c' | 'f'): number {
  return unit === 'f' ? celsius * 9 / 5 + 32 : celsius
}

export function formatTemperature(celsius: number, unit: 'c' | 'f', withUnit = false): string {
  const value = Math.round(convertTemperature(celsius, unit))
  return `${value}°${withUnit ? unit.toUpperCase() : ''}`
}

export function formatWind(kmh: number, unit: 'kmh' | 'ms'): string {
  return unit === 'ms' ? `${(kmh / 3.6).toFixed(1)} m/s` : `${Math.round(kmh)} km/h`
}

export function windDirection(degrees: number): string {
  const labels = ['北', '东北', '东', '东南', '南', '西南', '西', '西北']
  return `${labels[Math.round(degrees / 45) % 8]}风`
}

export function uvDescription(value: number): string {
  if (value < 3) return '低'
  if (value < 6) return '中等'
  if (value < 8) return '较高'
  if (value < 11) return '很高'
  return '极高'
}

export function visibilityText(meters: number): string {
  return meters >= 1000 ? `${(meters / 1000).toFixed(meters >= 10000 ? 0 : 1)} km` : `${Math.round(meters)} m`
}
