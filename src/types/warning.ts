// 官方天气预警（中央气象台 / 国家预警信息发布中心发布）。
// 数据源：中央气象台官网公开接口 nmc.cn/rest/findAlarm（免费、无需密钥，带 CORS 头）。
export type WarningLevel = 'red' | 'orange' | 'yellow' | 'blue'

export interface OfficialWarning {
  /** NMC alertid，全局唯一（含行政区划代码与发布时间戳），用于去重。 */
  id: string
  /** 原始标题，如「北京市气象台发布暴雨蓝色预警信号」。 */
  title: string
  level: WarningLevel
  /** 预警类型，如 暴雨 / 大雾 / 大风。 */
  type: string
  /** 发布单位，如 北京市气象台。 */
  issuer: string
  /** 发布时间，原始字符串「2026/11/11 03:12」，为北京时间（UTC+8）。 */
  issueTime: string
  /** 详情页完整链接（nmc.cn）。 */
  url: string
}
