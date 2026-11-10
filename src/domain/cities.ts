// 天气业务逻辑层 · 城市管理。
// 收藏与最近访问的纯列表规则 + 持久化（经平台适配层存储，Web 与 Android 共用）。
import { readStorage, removeStorage, writeStorage } from '../platform/storage'
import { FAVORITES_KEY, RECENT_KEY } from '../config/keys'
import type { City } from '../types/weather'

const FAVORITES_LIMIT = 12
const RECENT_LIMIT = 6

function readCities(key: string): City[] {
  try {
    const stored = readStorage(key)
    const parsed = stored ? JSON.parse(stored) as unknown : null
    return Array.isArray(parsed) ? parsed.filter((item) => item && typeof item === 'object' && 'id' in item) as City[] : []
  } catch {
    return []
  }
}

export function loadFavorites(): City[] {
  return readCities(FAVORITES_KEY)
}

export function loadRecent(): City[] {
  return readCities(RECENT_KEY)
}

// 收藏上限 12；已存在则移除（取消收藏）。
export function toggleFavorite(favorites: City[], target: City): { next: City[]; added: boolean } {
  const exists = favorites.some((item) => item.id === target.id)
  const next = exists
    ? favorites.filter((item) => item.id !== target.id)
    : [target, ...favorites].slice(0, FAVORITES_LIMIT)
  writeStorage(FAVORITES_KEY, JSON.stringify(next))
  return { next, added: !exists }
}

// 最近城市去重置顶，上限 6。
export function pushRecent(recent: City[], target: City): City[] {
  const next = [target, ...recent.filter((item) => item.id !== target.id)].slice(0, RECENT_LIMIT)
  writeStorage(RECENT_KEY, JSON.stringify(next))
  return next
}

export function isFavorite(favorites: City[], city: City): boolean {
  return favorites.some((item) => item.id === city.id)
}

export function clearCityData(keys: string[]): void {
  keys.forEach((key) => removeStorage(key))
}
