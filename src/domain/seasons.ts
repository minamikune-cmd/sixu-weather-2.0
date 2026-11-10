// 主题与动画系统的季节判定部分（业务规则：按城市当地月份与半球划分四季）。
// Web 与 Android 共用。
import type { Season } from '../types/weather'

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
