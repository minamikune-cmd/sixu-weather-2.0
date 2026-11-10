import { Droplets, Sunrise, Sunset } from 'lucide-react'
import { formatDay, formatMonthDay, localTimeFromIso } from '../../domain/time'
import { formatTemperature, weatherDescription } from '../../domain/weather'
import type { DayWeather, TemperatureUnit } from '../../types/weather'
import WeatherIcon from './WeatherIcon'

interface Props {
  days: DayWeather[]
  unit: TemperatureUnit
}

export default function DailyForecast({ days, unit }: Props) {
  const overallMin = Math.min(...days.map((day) => day.temperatureMin))
  const overallMax = Math.max(...days.map((day) => day.temperatureMax))
  const range = Math.max(1, overallMax - overallMin)
  return (
    <div className="daily-list">
      {days.map((day, index) => {
        const left = (day.temperatureMin - overallMin) / range * 100
        const width = Math.max(8, (day.temperatureMax - day.temperatureMin) / range * 100)
        return (
          <article className="day-row" key={day.date}>
            <div className="day-date">
              <strong>{formatDay(day.date, index)}</strong>
              <span>{formatMonthDay(day.date)}</span>
            </div>
            <div className="day-condition">
              <WeatherIcon code={day.weatherCode} size={38} />
              <span>{weatherDescription(day.weatherCode)}</span>
            </div>
            <div className="day-rain" title="降水概率"><Droplets size={14} />{day.precipitationProbabilityMax}%</div>
            <div className="day-range">
              <span>{formatTemperature(day.temperatureMin, unit)}</span>
              <div className="range-track" aria-hidden="true"><i style={{ left: `${left}%`, width: `${Math.min(width, 100 - left)}%` }} /></div>
              <strong>{formatTemperature(day.temperatureMax, unit)}</strong>
            </div>
            <div className="day-sun">
              <span><Sunrise size={14} />{localTimeFromIso(day.sunrise)}</span>
              <span><Sunset size={14} />{localTimeFromIso(day.sunset)}</span>
            </div>
          </article>
        )
      })}
    </div>
  )
}
