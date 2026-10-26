import { useMemo, useState } from 'react'
import { formatHour, formatTemperature, weatherDescription } from '../lib/weather'
import type { HourWeather, TemperatureUnit } from '../types/weather'
import WeatherIcon from './WeatherIcon'

interface Props {
  hours: HourWeather[]
  unit: TemperatureUnit
}

export default function HourlyForecast({ hours, unit }: Props) {
  const [selected, setSelected] = useState(0)
  const chart = useMemo(() => {
    const width = 1120
    const height = 150
    const padX = 32
    const values = hours.map((hour) => hour.temperature)
    const min = Math.min(...values)
    const max = Math.max(...values)
    const range = Math.max(2, max - min)
    const points = hours.map((hour, index) => ({
      x: padX + index * ((width - padX * 2) / Math.max(1, hours.length - 1)),
      y: 24 + (max - hour.temperature) / range * (height - 62),
      value: hour.temperature,
    }))
    const line = points.map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x},${point.y}`).join(' ')
    const area = `${line} L${points.at(-1)?.x ?? width},${height} L${points[0]?.x ?? 0},${height} Z`
    return { width, height, points, line, area }
  }, [hours])
  const active = hours[Math.min(selected, hours.length - 1)]

  return (
    <div className="hourly-shell">
      <div className="hourly-summary" aria-live="polite">
        <span>{selected === 0 ? '现在' : formatHour(active.time)}</span>
        <strong>{formatTemperature(active.temperature, unit, true)}</strong>
        <span>{weatherDescription(active.weatherCode)}</span>
        <span className="rain-prob">降水 {active.precipitationProbability}%</span>
      </div>
      <div className="hourly-scroll" tabIndex={0} aria-label="未来二十四小时预报，可横向滚动">
        <div className="hourly-chart-wrap">
          <svg className="temperature-chart" viewBox={`0 0 ${chart.width} ${chart.height}`} role="img" aria-label="二十四小时温度变化曲线">
            <defs>
              <linearGradient id="chartArea" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="var(--chart-color)" stopOpacity=".24" />
                <stop offset="1" stopColor="var(--chart-color)" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path d={chart.area} fill="url(#chartArea)" />
            <path d={chart.line} fill="none" stroke="var(--chart-color)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            {chart.points.map((point, index) => (
              <g key={hours[index].time}>
                <circle cx={point.x} cy={point.y} r={selected === index ? 5 : 3} fill="var(--chart-color)" stroke="var(--surface-solid)" strokeWidth="2" />
                <text x={point.x} y={point.y - 13} textAnchor="middle" className="chart-temp">{formatTemperature(point.value, unit)}</text>
              </g>
            ))}
          </svg>
          <div className="hourly-items">
            {hours.map((hour, index) => (
              <button
                type="button"
                className={`hour-item ${selected === index ? 'is-selected' : ''}`}
                key={hour.time}
                onClick={() => setSelected(index)}
                aria-pressed={selected === index}
                aria-label={`${formatHour(hour.time)}，${weatherDescription(hour.weatherCode)}，${formatTemperature(hour.temperature, unit, true)}，降水概率${hour.precipitationProbability}%`}
              >
                <span>{index === 0 ? '现在' : formatHour(hour.time)}</span>
                <WeatherIcon code={hour.weatherCode} isDay={hour.isDay} size={32} />
                <span className="hour-rain">{hour.precipitationProbability > 0 ? `${hour.precipitationProbability}%` : '—'}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
