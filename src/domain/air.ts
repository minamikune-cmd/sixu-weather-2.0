// 天气业务逻辑层 · 空气质量。
// 美国 AQI 分级（0-500），纯函数，Web 与 Android 共用。
export type AirLevel = 'good' | 'moderate' | 'usg' | 'unhealthy' | 'very-unhealthy' | 'hazardous'

export interface AirLevelInfo {
  level: AirLevel
  label: string
  color: string
  advice: string
}

export function aqiLevel(aqi: number): AirLevelInfo {
  if (aqi <= 50) return { level: 'good', label: '优', color: '#3fb950', advice: '空气质量令人满意，适宜户外活动。' }
  if (aqi <= 100) return { level: 'moderate', label: '良', color: '#d29922', advice: '空气质量可接受，敏感人群适当减少长时间户外。' }
  if (aqi <= 150) return { level: 'usg', label: '轻度污染', color: '#db7d2c', advice: '敏感人群应减少户外活动。' }
  if (aqi <= 200) return { level: 'unhealthy', label: '中度污染', color: '#e5534b', advice: '建议减少户外活动，敏感人群避免外出。' }
  if (aqi <= 300) return { level: 'very-unhealthy', label: '重度污染', color: '#b04adc', advice: '避免户外活动，关闭门窗，必要时佩戴口罩。' }
  return { level: 'hazardous', label: '严重污染', color: '#7d1f1f', advice: '停止户外活动，留在室内并开启空气净化设备。' }
}

// 首要污染物：取数值相对其分级上限比例最高者（简化估算）。
export function primaryPollutant(aq: {
  pm25: number | null; pm10: number | null; ozone: number | null
  nitrogenDioxide: number | null; sulphurDioxide: number | null; carbonMonoxide: number | null
}): string | null {
  const candidates: Array<[string, number, number]> = [
    ['PM2.5', aq.pm25 ?? NaN, 250],
    ['PM10', aq.pm10 ?? NaN, 420],
    ['臭氧', aq.ozone ?? NaN, 400],
    ['二氧化氮', aq.nitrogenDioxide ?? NaN, 200],
    ['二氧化硫', aq.sulphurDioxide ?? NaN, 300],
    ['一氧化碳', aq.carbonMonoxide ?? NaN, 30000],
  ]
  let best: string | null = null
  let bestRatio = 0
  for (const [name, value, limit] of candidates) {
    if (Number.isNaN(value)) continue
    const ratio = value / limit
    if (ratio > bestRatio) { bestRatio = ratio; best = name }
  }
  return best
}
