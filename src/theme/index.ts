// 主题和动画系统：把“季节 × 昼夜 × 天气 × 用户偏好”解析为最终主题令牌。
// 色板与动画本体在 App.css（CSS 变量 + data-* 选择器），这里只做决策。
import type { DayPhase, Preferences, Season, VisualStyle } from '../types/weather'

export const phaseLabels: Record<DayPhase, string> = { dawn: '晨曦', day: '白昼', dusk: '日暮', night: '夜色' }
export const seasonEnglish: Record<Season, string> = { spring: 'SPRING', summer: 'SUMMER', autumn: 'AUTUMN', winter: 'WINTER' }

// 由偏好与昼夜阶段决定根样式类；暗色场景（夜色/日暮 + 场景风格）同时供状态栏适配使用。
export function resolveStyleClass(preferences: Preferences, phase: DayPhase): string {
  if (preferences.visualStyle === 'scene') {
    return phase === 'night' || phase === 'dusk' ? 'style-dark' : 'style-scene'
  }
  return `style-${preferences.visualStyle}`
}

// 状态栏文字需要深浅反转：暗色背景用 Light（白字）。
export function isDarkChrome(preferences: Preferences, phase: DayPhase): boolean {
  if (preferences.visualStyle === 'dark') return true
  if (preferences.visualStyle === 'light') return false
  return phase === 'night' || phase === 'dusk'
}

export type { VisualStyle }
