import type {
  City,
  DayPhase,
  GeoResult,
  Preferences,
  ReverseGeoResult,
  Season,
  WeatherData,
  WeatherKind,
} from '../types/weather'

const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast'
const GEOCODING_URL = 'https://geocoding-api.open-meteo.com/v1/search'
const REVERSE_URL = 'https://api.bigdatacloud.net/data/reverse-geocode-client'

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
  visualStyle: 'scene',
}

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
  if ([71, 73, 75, 77, 85, 86].includes(code) || [96, 99].includes(code)) return 'snow'
  if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return 'rain'
  if ([45, 48].includes(code)) return 'fog'
  if (code === 3) return 'overcast'
  if (code === 2) return 'cloud'
  return 'clear'
}

export function getSeason(month: number, latitude: number): Season {
  const northern = latitude >= 0
  if (month >= 3 && month <= 5) return northern ? 'spring' : 'autumn'
  if (month >= 6 && month <= 8) return northern ? 'summer' : 'winter'
  if (month >= 9 && month <= 11) return northern ? 'autumn' : 'spring'
  return northern ? 'winter' : 'summer'
}

export const seasonNames: Record<Season, string> = {
  spring: '春', summer: '夏', autumn: '秋', winter: '冬',
}

export function getCityParts(timeZone: string, date = new Date()) {
  const parts = new Intl.DateTimeFormat('zh-CN', {
    timeZone,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hourCycle: 'h23', weekday: 'long',
  }).formatToParts(date)
  return Object.fromEntries(parts.map((part) => [part.type, part.value]))
}

export function getLocalMinutes(timeZone: string, date = new Date()): number {
  const parts = getCityParts(timeZone, date)
  return Number(parts.hour) * 60 + Number(parts.minute)
}

function minutesOfLocalIso(value?: string): number | null {
  if (!value || !value.includes('T')) return null
  const [hour, minute] = value.split('T')[1].split(':').map(Number)
  return hour * 60 + minute
}

export function getDayPhase(data: WeatherData): DayPhase {
  const now = getLocalMinutes(data.timezone)
  const today = getCityParts(data.timezone)
  const dateKey = `${today.year}-${today.month}-${today.day}`
  const solar = data.daily.find((day) => day.date === dateKey) ?? data.daily[0]
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
  const today = getCityParts(data.timezone)
  const dateKey = `${today.year}-${today.month}-${today.day}`
  const solar = data.daily.find((day) => day.date === dateKey) ?? data.daily[0]
  const sunrise = minutesOfLocalIso(solar?.sunrise) ?? 360
  const sunset = minutesOfLocalIso(solar?.sunset) ?? 1080
  return Math.max(0, Math.min(1, (now - sunrise) / Math.max(1, sunset - sunrise)))
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

export function localTimeFromIso(value: string): string {
  return value.split('T')[1]?.slice(0, 5) ?? '--:--'
}

export function formatHour(value: string): string {
  return localTimeFromIso(value)
}

export function formatDay(value: string, index: number): string {
  if (index === 0) return '今天'
  const date = new Date(`${value}T12:00:00`)
  return new Intl.DateTimeFormat('zh-CN', { weekday: 'short' }).format(date)
}

export function formatMonthDay(value: string): string {
  const [, month, day] = value.split('-')
  return `${Number(month)}月${Number(day)}日`
}

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
