import { useCallback, useEffect, useRef, useState } from 'react'
import { fetchWeather } from '../lib/weather'
import type { City, WeatherData } from '../types/weather'

const CACHE_TTL = 10 * 60 * 1000
const DATA_KEY = 'sixu-weather-data-v1'
const CITY_KEY = 'sixu-city-v1'

interface CachedWeather {
  city: City
  data: WeatherData
}

function readJson<T>(key: string): T | null {
  try {
    const value = localStorage.getItem(key)
    return value ? JSON.parse(value) as T : null
  } catch {
    return null
  }
}

function writeJson(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Storage can be disabled; the app remains usable without persistence.
  }
}

export function getSavedCity(fallback: City): City {
  return readJson<City>(CITY_KEY) ?? fallback
}

export function getCachedWeather(cityId: string): CachedWeather | null {
  const cached = readJson<CachedWeather>(DATA_KEY)
  return cached?.city.id === cityId ? cached : null
}

export function saveCity(city: City) {
  writeJson(CITY_KEY, city)
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
      writeJson(DATA_KEY, { city, data: result } satisfies CachedWeather)
      setData(result)
      setFromCache(false)
    } catch (requestError) {
      if (controller.signal.aborted) return
      if (cached) {
        setData(cached.data)
        setFromCache(true)
        setError('实时数据暂时不可用，已显示上次缓存。')
      } else {
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
    void load()
    return () => activeRequest.current?.abort()
  }, [city, load])

  return { data, loading, refreshing, error, fromCache, refresh: () => load(true) }
}
