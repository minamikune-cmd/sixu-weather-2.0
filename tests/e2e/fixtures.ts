// 端到端视觉/交互测试的确定性夹具。
// 通过 Playwright 路由拦截 Open-Meteo / 中央气象台接口，注入固定结构的气象数据，
// 让视觉与交互断言不依赖真实网络、配额与运行时刻。
import type { Page } from '@playwright/test'

export interface SceneOptions {
  /** WMO 天气码，决定天气种类（晴/云/雨/雷/雪/雾）。 */
  weatherCode: number
  /** 当前是否白天（0/1），与日出日落共同决定昼夜相位。 */
  isDay: 0 | 1
  temperature?: number
  windSpeed?: number
  visibility?: number
  uvIndex?: number
  precipitationProbability?: number
  temperatureMax?: number
  temperatureMin?: number
}

export interface WarningItem {
  alertid: string
  title: string
  issuetime: string
  url?: string
}

const DAY_START_HOUR = 6
const DAY_END_HOUR = 18
const HOURLY_COUNT = 168 // 7 天 × 24 小时，覆盖 nowIndex + 24 的切片窗口。
const DAILY_COUNT = 8

// 生成以 baseDate 为起点的小时时间数组（本地 ISO 字符串，与接口格式一致）。
function hourSeries(baseDate: string): string[] {
  const [datePart] = baseDate.split('T')
  const times: string[] = []
  for (let day = 0; day < HOURLY_COUNT / 24; day += 1) {
    const dayPart = datePart.slice(0, 8) + String(Number(datePart.slice(8, 10)) + day).padStart(2, '0')
    for (let hour = 0; hour < 24; hour += 1) {
      times.push(`${dayPart}T${String(hour).padStart(2, '0')}:00`)
    }
  }
  return times
}

/**
 * 构造 Open-Meteo forecast 响应体。
 * @param currentTime 必须与页面内被固定的“当前时间”一致（'YYYY-MM-DDTHH:00'），
 *   否则 nowIndex 切片会偏移。
 */
export function buildForecast(currentTime: string, scene: SceneOptions): Record<string, unknown> {
  const baseDate = currentTime.slice(0, 10)
  const hourOf = (time: string) => Number(time.slice(11, 13))
  const times = hourSeries(currentTime)
  const rainChance = scene.precipitationProbability ?? 10
  const uv = scene.uvIndex ?? 3
  return {
    timezone: 'Asia/Shanghai',
    timezone_abbreviation: 'CST',
    utc_offset_seconds: 28800,
    current: {
      time: currentTime,
      temperature_2m: scene.temperature ?? 21,
      relative_humidity_2m: 58,
      apparent_temperature: (scene.temperature ?? 21) - 1,
      is_day: scene.isDay,
      precipitation: rainChance > 50 ? 0.6 : 0,
      weather_code: scene.weatherCode,
      cloud_cover: scene.weatherCode === 0 ? 8 : 86,
      pressure_msl: 1016,
      wind_speed_10m: scene.windSpeed ?? 12,
      wind_direction_10m: 210,
      wind_gusts_10m: (scene.windSpeed ?? 12) + 14,
      visibility: scene.visibility ?? 24000,
    },
    hourly: {
      time: times,
      temperature_2m: times.map((_, index) => 16 + Math.round(6 * Math.sin((index % 24 - 9) / 24 * Math.PI * 2))),
      precipitation_probability: times.map(() => rainChance),
      weather_code: times.map(() => scene.weatherCode),
      is_day: times.map((time) => (hourOf(time) >= DAY_START_HOUR && hourOf(time) < DAY_END_HOUR ? 1 : 0)),
      uv_index: times.map((time) => (hourOf(time) >= DAY_START_HOUR && hourOf(time) < DAY_END_HOUR ? uv : 0)),
    },
    daily: {
      time: Array.from({ length: DAILY_COUNT }, (_, index) => {
        const day = String(Number(baseDate.slice(8, 10)) + index).padStart(2, '0')
        return `${baseDate.slice(0, 8)}${day}`
      }),
      weather_code: Array.from({ length: DAILY_COUNT }, () => scene.weatherCode),
      temperature_2m_max: Array.from({ length: DAILY_COUNT }, () => scene.temperatureMax ?? 26),
      temperature_2m_min: Array.from({ length: DAILY_COUNT }, () => scene.temperatureMin ?? 14),
      sunrise: Array.from({ length: DAILY_COUNT }, (_, index) => {
        const day = String(Number(baseDate.slice(8, 10)) + index).padStart(2, '0')
        return `${baseDate.slice(0, 8)}${day}T06:45`
      }),
      sunset: Array.from({ length: DAILY_COUNT }, (_, index) => {
        const day = String(Number(baseDate.slice(8, 10)) + index).padStart(2, '0')
        return `${baseDate.slice(0, 8)}${day}T17:20`
      }),
      uv_index_max: Array.from({ length: DAILY_COUNT }, () => uv),
      precipitation_probability_max: Array.from({ length: DAILY_COUNT }, () => rainChance),
    },
  }
}

export function buildAirQuality(): Record<string, unknown> {
  return {
    timezone: 'Asia/Shanghai',
    current: {
      time: '2026-11-13T12:00',
      us_aqi: 42,
      pm2_5: 12,
      pm10: 24,
      ozone: 96,
      nitrogen_dioxide: 18,
      sulphur_dioxide: 6,
      carbon_monoxide: 420,
    },
  }
}

function buildAlarmList(warnings: WarningItem[]): Record<string, unknown> {
  return { code: 0, data: { page: { list: warnings } } }
}

/**
 * 安装全部外部接口的拦截路由，注入确定性数据。
 * @param fixedNowMs 页面内被固定的当前时间（毫秒时间戳），夹具时间以此对齐。
 */
export async function installRoutes(
  page: Page,
  options: {
    scene: SceneOptions
    fixedNowMs: number
    forecastDelayMs?: number
    warnings?: WarningItem[]
  },
): Promise<void> {
  const currentTime = new Date(options.fixedNowMs).toISOString().slice(0, 16)
  await page.route('https://api.open-meteo.com/v1/forecast**', async (route) => {
    if (options.forecastDelayMs) await new Promise((resolve) => setTimeout(resolve, options.forecastDelayMs))
    await route.fulfill({ json: buildForecast(currentTime, options.scene) })
  })
  await page.route('https://air-quality-api.open-meteo.com/v1/air-quality**', (route) => {
    void route.fulfill({ json: buildAirQuality() })
  })
  await page.route('https://www.nmc.cn/rest/findAlarm**', (route) => {
    void route.fulfill({ json: buildAlarmList(options.warnings ?? []) })
  })
  // 兜底：测试中不应触达 BigDataCloud / Geocoding，给出可识别的失败。
  await page.route('https://api.bigdatacloud.net/**', (route) => {
    void route.fulfill({ status: 500, body: 'unexpected reverse-geocode call in e2e' })
  })
}

/** 在页面脚本执行前冻结 Date，保证昼夜相位/季节推导与时间显示完全确定。 */
export async function freezeTime(page: Page, fixedNowMs: number): Promise<void> {
  await page.addInitScript((fixed) => {
    const NativeDate = Date
    class FixedDate extends NativeDate {
      constructor(...args: unknown[]) {
        const first = args[0]
        if (args.length === 0) super(fixed)
        else if (typeof first === 'string') super(first)
        else super(...(args as [number, number, number?, number?, number?, number?, number?]))
      }
      static override now(): number {
        return fixed
      }
    }
    window.Date = FixedDate as unknown as typeof Date
  }, fixedNowMs)
}

/** 预置偏好（如锁定季节主题），走与 App 相同的 sixu-preferences-v1 存储键。 */
export async function seedPreferences(page: Page, preferences: Record<string, unknown>): Promise<void> {
  await page.addInitScript((prefs) => {
    window.localStorage.setItem('sixu-preferences-v1', JSON.stringify(prefs))
  }, preferences)
}

/** 把若干布尔提示标记置为「seen」，关闭首启弹层（如定位说明），保持测试场景干净。 */
export async function seedSeenFlags(page: Page, keys: string[]): Promise<void> {
  await page.addInitScript((flags) => {
    for (const key of flags) window.localStorage.setItem(key, 'seen')
  }, keys)
}
