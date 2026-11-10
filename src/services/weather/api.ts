// 天气数据服务层：Open-Meteo / BigDataCloud 的 HTTP 客户端与数据模型转换。
// 纯网络与映射逻辑，不含任何展示或业务规则；Web 与 Android 共用同一份实现。
import type {
  City,
  GeoResult,
  ReverseGeoResult,
  WeatherData,
} from '../../types/weather'

const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast'
const GEOCODING_URL = 'https://geocoding-api.open-meteo.com/v1/search'
const REVERSE_URL = 'https://api.bigdatacloud.net/data/reverse-geocode-client'

export async function fetchJson<T>(url: string, timeout = 12000, signal?: AbortSignal): Promise<T> {
  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), timeout)
  const abort = () => controller.abort()
  signal?.addEventListener('abort', abort, { once: true })
  try {
    const response = await fetch(url, { signal: controller.signal, headers: { Accept: 'application/json' } })
    if (response.status === 429) throw new Error('天气服务请求较频繁，请稍后再试。')
    if (!response.ok) throw new Error(`服务暂时不可用（${response.status}），请稍后重试。`)
    return await response.json() as T
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw new Error('请求超时，请检查网络后重试。')
    if (!navigator.onLine) throw new Error('当前网络已断开，正在尝试使用缓存数据。')
    throw error
  } finally {
    window.clearTimeout(timer)
    signal?.removeEventListener('abort', abort)
  }
}

interface ForecastResponse {
  timezone: string
  timezone_abbreviation: string
  utc_offset_seconds: number
  current: {
    time: string; temperature_2m: number; relative_humidity_2m: number
    apparent_temperature: number; is_day: number; precipitation: number
    weather_code: number; cloud_cover: number; pressure_msl: number
    wind_speed_10m: number; wind_direction_10m: number; visibility: number
  }
  hourly: {
    time: string[]; temperature_2m: number[]; precipitation_probability: (number | null)[]
    weather_code: number[]; is_day: number[]; uv_index: (number | null)[]
  }
  daily: {
    time: string[]; weather_code: number[]; temperature_2m_max: number[]
    temperature_2m_min: number[]; sunrise: string[]; sunset: string[]
    uv_index_max: (number | null)[]; precipitation_probability_max: (number | null)[]
  }
}

export async function fetchWeather(city: City, signal?: AbortSignal): Promise<WeatherData> {
  const params = new URLSearchParams({
    latitude: String(city.latitude), longitude: String(city.longitude),
    current: 'temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,cloud_cover,pressure_msl,wind_speed_10m,wind_direction_10m,visibility',
    hourly: 'temperature_2m,precipitation_probability,weather_code,is_day,uv_index',
    daily: 'weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,uv_index_max,precipitation_probability_max',
    timezone: 'auto', forecast_days: '8', temperature_unit: 'celsius', wind_speed_unit: 'kmh',
  })
  const raw = await fetchJson<ForecastResponse>(`${FORECAST_URL}?${params}`, 12000, signal)
  const nowIndex = Math.max(0, raw.hourly.time.findIndex((time) => time >= raw.current.time.slice(0, 13) + ':00'))
  return {
    timezone: raw.timezone,
    timezoneAbbreviation: raw.timezone_abbreviation,
    utcOffsetSeconds: raw.utc_offset_seconds,
    fetchedAt: Date.now(),
    current: {
      time: raw.current.time,
      temperature: raw.current.temperature_2m,
      apparentTemperature: raw.current.apparent_temperature,
      humidity: raw.current.relative_humidity_2m,
      precipitation: raw.current.precipitation,
      weatherCode: raw.current.weather_code,
      cloudCover: raw.current.cloud_cover,
      pressure: raw.current.pressure_msl,
      windSpeed: raw.current.wind_speed_10m,
      windDirection: raw.current.wind_direction_10m,
      visibility: raw.current.visibility,
      isDay: raw.current.is_day === 1,
    },
    hourly: raw.hourly.time.slice(nowIndex, nowIndex + 24).map((time, offset) => {
      const index = nowIndex + offset
      return {
        time,
        temperature: raw.hourly.temperature_2m[index],
        precipitationProbability: raw.hourly.precipitation_probability[index] ?? 0,
        weatherCode: raw.hourly.weather_code[index],
        isDay: raw.hourly.is_day[index] === 1,
        uvIndex: raw.hourly.uv_index[index] ?? 0,
      }
    }),
    daily: raw.daily.time.slice(0, 7).map((date, index) => ({
      date,
      weatherCode: raw.daily.weather_code[index],
      temperatureMax: raw.daily.temperature_2m_max[index],
      temperatureMin: raw.daily.temperature_2m_min[index],
      sunrise: raw.daily.sunrise[index],
      sunset: raw.daily.sunset[index],
      uvIndexMax: raw.daily.uv_index_max[index] ?? 0,
      precipitationProbabilityMax: raw.daily.precipitation_probability_max[index] ?? 0,
    })),
  }
}

export async function searchCities(query: string, signal?: AbortSignal): Promise<City[]> {
  const params = new URLSearchParams({ name: query.trim(), count: '8', language: 'zh', format: 'json' })
  const raw = await fetchJson<{ results?: GeoResult[] }>(`${GEOCODING_URL}?${params}`, 10000, signal)
  return (raw.results ?? []).map((item) => ({
    id: String(item.id), name: item.name, admin1: item.admin1, country: item.country,
    countryCode: item.country_code, latitude: item.latitude, longitude: item.longitude, timezone: item.timezone,
  }))
}

export async function reverseGeocode(latitude: number, longitude: number, signal?: AbortSignal): Promise<City> {
  const params = new URLSearchParams({ latitude: String(latitude), longitude: String(longitude), localityLanguage: 'zh' })
  const raw = await fetchJson<ReverseGeoResult>(`${REVERSE_URL}?${params}`, 10000, signal)
  const name = raw.city || raw.locality
  if (!name) throw new Error('已获取位置，但无法识别城市，请手动搜索。')
  return {
    id: `geo-${latitude.toFixed(4)}-${longitude.toFixed(4)}`,
    name,
    admin1: raw.principalSubdivision,
    country: raw.countryName,
    countryCode: raw.countryCode,
    latitude,
    longitude,
  }
}
