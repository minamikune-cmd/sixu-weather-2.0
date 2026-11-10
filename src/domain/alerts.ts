// 天气业务逻辑层 · 天气预警。
// 数据源（Open-Meteo）不提供官方气象预警，这里基于预报数据推导“提示级”预警：
// 雷电、强降水、强风、高温、寒潮、降雪、大雾、强紫外线。
// 规则集中在这一个模块，Web 与 Android 共用；只输出数据，展示交给 UI 层。
import type { WeatherData } from '../types/weather'
import { weatherDescription, weatherKind } from './weather'

export type AlertLevel = 'advisory' | 'watch'

export interface WeatherAlert {
  id: string
  level: AlertLevel
  title: string
  detail: string
}

const THUNDER_CODES = new Set([95, 96, 99])
const SNOW_CODES = new Set([71, 73, 75, 77, 85, 86])

export function buildWeatherAlerts(data: WeatherData): WeatherAlert[] {
  const alerts: WeatherAlert[] = []
  const { current, hourly, daily } = data

  if (THUNDER_CODES.has(current.weatherCode)) {
    alerts.push({
      id: 'thunder-now',
      level: 'watch',
      title: '雷电活动',
      detail: `当前${weatherDescription(current.weatherCode)}，尽量减少户外停留，注意短时强降水。`,
    })
  }

  const rainSoon = hourly.slice(0, 6).some((hour) => weatherKind(hour.weatherCode) === 'rain')
  const heavyRain = hourly.slice(0, 12).filter((hour) => hour.precipitationProbability >= 70).length >= 3
  if (heavyRain) {
    alerts.push({
      id: 'heavy-rain',
      level: 'advisory',
      title: '降水概率较高',
      detail: '未来数小时降水概率持续较高，出门建议携带雨具并留意路况。',
    })
  } else if (rainSoon && current.precipitation < 0.1) {
    alerts.push({
      id: 'rain-soon',
      level: 'advisory',
      title: '短时降水可能',
      detail: '未来几小时有降水可能，留意天气变化。',
    })
  }

  if (current.windSpeed >= 50) {
    alerts.push({
      id: 'strong-wind',
      level: 'watch',
      title: '大风',
      detail: `当前风速约 ${Math.round(current.windSpeed)} km/h，外出注意高空坠物，远离临时搭建物。`,
    })
  }

  const today = daily[0]
  if (today && today.temperatureMax >= 35) {
    alerts.push({
      id: 'heat',
      level: 'advisory',
      title: '高温',
      detail: `今日最高气温约 ${Math.round(today.temperatureMax)}°C，注意补水防晒，避开正午长时间暴晒。`,
    })
  }
  if (today && today.temperatureMin <= -10) {
    alerts.push({
      id: 'cold',
      level: 'advisory',
      title: '寒潮低温',
      detail: `今日最低气温约 ${Math.round(today.temperatureMin)}°C，请注意防寒保暖。`,
    })
  }

  if (SNOW_CODES.has(current.weatherCode)) {
    alerts.push({
      id: 'snow-now',
      level: 'advisory',
      title: '降雪',
      detail: '当前有降雪，道路可能湿滑，出行注意防滑与交通安全。',
    })
  }

  if (current.visibility < 1000) {
    alerts.push({
      id: 'fog',
      level: 'advisory',
      title: '低能见度',
      detail: `当前能见度约 ${Math.round(current.visibility)} 米，出行请预留时间并注意交通安全。`,
    })
  }

  const maxUv = Math.max(current.isDay ? (hourly[0]?.uvIndex ?? 0) : 0, today?.uvIndexMax ?? 0)
  if (maxUv >= 8) {
    alerts.push({
      id: 'uv',
      level: 'advisory',
      title: '强紫外线',
      detail: '今日紫外线很强，外出建议遮阳并做好防晒。',
    })
  }

  // 同级预警排在一起，watch 优先；数量上限避免刷屏。
  const order: Record<AlertLevel, number> = { watch: 0, advisory: 1 }
  return alerts.sort((a, b) => order[a.level] - order[b.level]).slice(0, 4)
}
