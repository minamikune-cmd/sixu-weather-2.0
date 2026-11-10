import { useCallback, useEffect, useRef, useState } from 'react'
import { DATA_KEY, CITY_KEY } from '../config/keys'
import { readStorage, writeStorage } from '../platform/storage'
import { fetchWeather } from '../services/weather/api'
import type { City, WeatherData } from '../types/weather'

const CACHE_TTL = 10 * 60 * 1000
// Keep at most this many cities in the offline cache; oldest entries are evicted.
const CACHE_LIMIT = 8

interface CachedWeather {
  city: City
  data: WeatherData
}

// New format: a map keyed by city id so every recently viewed city has its own
// cache entry. The 1.0 format was a single { city, data } object; it is
// migrated transparently on first read.
type WeatherCache = Record<string, CachedWeather>

function readJson<T>(key: string): T | null {
  try {
    const value = readStorage(key)
    return value ? JSON.parse(value) as T : null
  } catch {
    return null
  }
}

function readCache(): WeatherCache {
  const stored = readJson<unknown>(DATA_KEY)
  if (!stored || typeof stored !== 'object') return {}
  if ('city' in stored && 'data' in stored) {
    const legacy = stored as CachedWeather
    return legacy.city?.id ? { [legacy.city.id]: legacy } : {}
  }
  return stored as WeatherCache
}

function writeCache(cache: WeatherCache) {
  const entries = Object.values(cache)
    .filter((entry) => entry.city?.id && entry.data)
    .sort((a, b) => b.data.fetchedAt - a.data.fetchedAt)
    .slice(0, CACHE_LIMIT)
  writeStorage(DATA_KEY, JSON.stringify(Object.fromEntries(entries.map((entry) => [entry.city.id, entry]))))
}

export function saveWeather(city: City, data: WeatherData) {
  const cache = readCache()
  cache[city.id] = { city, data }
  writeCache(cache)
}

export function getSavedCity(fallback: City): City {
  return readJson<City>(CITY_KEY) ?? fallback
}

export function getCachedWeather(cityId: string): CachedWeather | null {
  const entry = readCache()[cityId]
  return entry ?? null
}

export function saveCity(city: City) {
  writeStorage(CITY_KEY, JSON.stringify(city))
}

export function useWeather(city: City) {
  const [data, setData] = useState<WeatherData | null>(() => getCachedWeather(city.id)?.data ?? null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fromCache, setFromCache] = useState(false)
  const activeRequest = useRef<AbortController | null>(null)
  const lastKey = useRef('')

  const load = useCallback(async (force = false) => {
    const requestKey = `${city.id}:${force ? 'force' : 'normal'}`
    if (lastKey.current === requestKey && activeRequest.current && !activeRequest.current.signal.aborted) return
    lastKey.current = requestKey
    activeRequest.current?.abort()
    const controller = new AbortController()
    activeRequest.current = controller
    const cached = getCachedWeather(city.id)
    if (cached) {
      setData(cached.data)
      setFromCache(Date.now() - cached.data.fetchedAt >= CACHE_TTL)
      setLoading(false)
    } else {
      setLoading(true)
    }
    setRefreshing(true)
    setError(null)
    try {
      const result = await fetchWeather(city, controller.signal)
      saveWeather(city, result)
      setData(result)
      setFromCache(false)
    } catch (requestError) {
      if (controller.signal.aborted) return
      if (cached) {
        setData(cached.data)
        setFromCache(true)
        setError('实时数据暂时不可用，已显示上次缓存。')
      } else {
        // Keep whatever is on screen (the effect above already cleared stale
        // data when the city changed); only surface the error.
        setError(requestError instanceof Error ? requestError.message : '天气加载失败，请稍后重试。')
      }
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false)
        setRefreshing(false)
        lastKey.current = ''
      }
    }
  }, [city])

  useEffect(() => {
    const cached = getCachedWeather(city.id)
    const fresh = cached && Date.now() - cached.data.fetchedAt < CACHE_TTL
    if (fresh) {
      setData(cached.data)
      setFromCache(false)
      setLoading(false)
      setRefreshing(false)
      setError(null)
      return
    }
    // Never keep the previous city's weather on screen while the new one loads.
    setData(cached?.data ?? null)
    setFromCache(false)
    void load()
    return () => activeRequest.current?.abort()
  }, [city, load])

  return { data, loading, refreshing, error, fromCache, refresh: () => load(true) }
}
