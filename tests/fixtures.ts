// 测试夹具：构造最小可用的 WeatherData / Subscription。
import type { City, HourWeather, WeatherData } from '../src/types/weather'
import type { Subscription } from '../src/types/subscription'
import { DEFAULT_ALERT_RULES } from '../src/types/subscription'

export const BEIJING: City = {
  id: '101010100', name: '北京', latitude: 39.9042, longitude: 116.4074, timezone: 'Asia/Shanghai',
}

export function makeHour(partial: Partial<HourWeather> = {}): HourWeather {
  return { time: '2026-06-15T08:00', temperature: 25, precipitationProbability: 10, weatherCode: 0, isDay: true, uvIndex: 5, ...partial }
}

export function makeWeather(partial: Partial<WeatherData> = {}): WeatherData {
  return {
    timezone: 'Asia/Shanghai',
    timezoneAbbreviation: 'GMT+8',
    utcOffsetSeconds: 28800,
    current: {
      time: '2026-06-15T08:00', temperature: 28, apparentTemperature: 30, humidity: 50,
      precipitation: 0, weatherCode: 0, cloudCover: 10, pressure: 1010, windSpeed: 12,
      windGusts: 20, windDirection: 180, visibility: 20000, isDay: true,
    },
    hourly: Array.from({ length: 24 }, (_, index) => makeHour({ time: `2026-06-15T${String(index).padStart(2, '0')}:00` })),
    daily: [
      {
        date: '2026-06-15', weatherCode: 0, temperatureMax: 33, temperatureMin: 20,
        sunrise: '2026-06-15T05:30', sunset: '2026-06-15T19:45', uvIndexMax: 9, precipitationProbabilityMax: 10,
      },
      {
        date: '2026-06-16', weatherCode: 61, temperatureMax: 30, temperatureMin: 18,
        sunrise: '2026-06-16T05:30', sunset: '2026-06-16T19:45', uvIndexMax: 8, precipitationProbabilityMax: 70,
      },
    ],
    airQuality: {
      time: '2026-06-15T08:00', usAqi: 55, pm25: 20, pm10: 40, ozone: 90,
      nitrogenDioxide: 15, sulphurDioxide: 5, carbonMonoxide: 300,
    },
    fetchedAt: Date.now(),
    ...partial,
  }
}

export function makeSubscription(partial: Partial<Subscription> = {}): Subscription {
  return {
    id: 'sub-test-1',
    city: BEIJING,
    enabled: true,
    notifyTime: '07:30',
    rules: { ...DEFAULT_ALERT_RULES },
    createdAt: Date.now(),
    ...partial,
  }
}
