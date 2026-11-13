// 天气订阅与通知的类型定义。
// 订阅是“城市 × 规则 × 通知时间”的用户配置；评估结果产生通知候选。
import type { City } from './weather'

// 各类提醒的开关与阈值（温度单位为 °C，风速为 km/h，概率为 %）。
export interface AlertRuleConfig {
  daily: boolean
  rain: { enabled: boolean; probability: number }
  highTemp: { enabled: boolean; threshold: number }
  lowTemp: { enabled: boolean; threshold: number }
  wind: { enabled: boolean; threshold: number }
  heavyRain: { enabled: boolean; probability: number }
  coldWave: { enabled: boolean; drop: number }
  alerts: boolean
}

export const DEFAULT_ALERT_RULES: AlertRuleConfig = {
  daily: true,
  rain: { enabled: true, probability: 50 },
  highTemp: { enabled: false, threshold: 35 },
  lowTemp: { enabled: false, threshold: 0 },
  wind: { enabled: false, threshold: 50 },
  heavyRain: { enabled: true, probability: 70 },
  coldWave: { enabled: false, drop: 8 },
  alerts: true,
}

export interface Subscription {
  id: string
  city: City
  enabled: boolean
  // 通知时间，城市当地时间 "HH:MM"。
  notifyTime: string
  rules: AlertRuleConfig
  createdAt: number
}

// 一次评估产出的通知内容（尚未去重与派发）。
export interface NotificationCandidate {
  // 去重键：同一订阅同一天同一类型只发一次。
  dedupeKey: string
  subscriptionId: string
  cityId: string
  title: string
  body: string
  level: 'info' | 'warning'
}
