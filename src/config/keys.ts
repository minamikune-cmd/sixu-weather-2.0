// 用户配置层 · 本地存储键（v1 格式与 1.0 完全一致，升级后旧数据自动继承）。
export const DATA_KEY = 'sixu-weather-data-v1'
export const CITY_KEY = 'sixu-city-v1'
export const PREFERENCES_KEY = 'sixu-preferences-v1'
export const FAVORITES_KEY = 'sixu-favorites-v1'
export const RECENT_KEY = 'sixu-recent-v1'
export const LOCATION_NOTICE_KEY = 'sixu-location-notice-v1'

export const ALL_KEYS = [DATA_KEY, CITY_KEY, PREFERENCES_KEY, FAVORITES_KEY, RECENT_KEY, LOCATION_NOTICE_KEY] as const
