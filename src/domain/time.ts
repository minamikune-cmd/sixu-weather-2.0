// 天气业务逻辑层 · 时间与地理时间工具。
// 所有“城市当地时间”的计算都走这里，Web 与 Android 共用。
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
