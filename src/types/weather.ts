export type Season = 'spring' | 'summer' | 'autumn' | 'winter'
export type SeasonPreference = 'auto' | Season
export type DayPhase = 'dawn' | 'day' | 'dusk' | 'night'
export type TemperatureUnit = 'c' | 'f'
export type WindUnit = 'kmh' | 'ms'
export type VisualStyle = 'scene' | 'light' | 'dark'
export type WeatherKind = 'clear' | 'cloud' | 'overcast' | 'rain' | 'thunder' | 'snow' | 'fog'

export interface City {
  id: string
  name: string
  admin1?: string
  country?: string
  countryCode?: string
  latitude: number
  longitude: number
  timezone?: string
}

export interface Preferences {
  temperatureUnit: TemperatureUnit
  windUnit: WindUnit
  season: SeasonPreference
  animations: boolean
  visualStyle: VisualStyle
}

export interface CurrentWeather {
  time: string
  temperature: number
  apparentTemperature: number
  humidity: number
  precipitation: number
  weatherCode: number
  cloudCover: number
  pressure: number
  windSpeed: number
  windDirection: number
  visibility: number
  isDay: boolean
}

export interface HourWeather {
  time: string
  temperature: number
  precipitationProbability: number
  weatherCode: number
  isDay: boolean
  uvIndex: number
}

export interface DayWeather {
  date: string
  weatherCode: number
  temperatureMax: number
  temperatureMin: number
  sunrise: string
  sunset: string
  uvIndexMax: number
  precipitationProbabilityMax: number
}

export interface WeatherData {
  timezone: string
  timezoneAbbreviation: string
  utcOffsetSeconds: number
  current: CurrentWeather
  hourly: HourWeather[]
  daily: DayWeather[]
  fetchedAt: number
}

export interface GeoResult {
  id: number
  name: string
  latitude: number
  longitude: number
  country?: string
  country_code?: string
  admin1?: string
  timezone?: string
}

export interface ReverseGeoResult {
  city?: string
  locality?: string
  principalSubdivision?: string
  countryName?: string
  countryCode?: string
}
