// 用户配置层 · 偏好设置（单位、季节、视觉风格、动画）与默认城市。
// 读写经平台适配层存储；Web 与 Android 共用同一份键与默认值。
import { readStorage, writeStorage } from '../platform/storage'
import type { City, Preferences } from '../types/weather'
import { CITY_KEY, PREFERENCES_KEY } from './keys'

export const DEFAULT_CITY: City = {
  id: '101010100',
  name: '北京',
  admin1: '北京市',
  country: '中国',
  countryCode: 'CN',
  latitude: 39.9042,
  longitude: 116.4074,
  timezone: 'Asia/Shanghai',
}

export const DEFAULT_PREFERENCES: Preferences = {
  temperatureUnit: 'c',
  windUnit: 'kmh',
  season: 'auto',
  animations: true,
  haptics: true,
  visualStyle: 'scene',
}

function readJson<T>(key: string): T | null {
  try {
    const value = readStorage(key)
    return value ? JSON.parse(value) as T : null
  } catch {
    return null
  }
}

export function loadPreferences(): Preferences {
  return { ...DEFAULT_PREFERENCES, ...readJson<Partial<Preferences>>(PREFERENCES_KEY) }
}

export function savePreferences(preferences: Preferences): void {
  writeStorage(PREFERENCES_KEY, JSON.stringify(preferences))
}

export function loadSavedCity(fallback: City): City {
  return readJson<City>(CITY_KEY) ?? fallback
}

export function saveCity(city: City): void {
  writeStorage(CITY_KEY, JSON.stringify(city))
}
