import { useId } from 'react'
import { weatherKind } from '../lib/weather'

interface Props {
  code: number
  isDay?: boolean
  size?: number
  className?: string
}

export default function WeatherIcon({ code, isDay = true, size = 48, className = '' }: Props) {
  const id = useId().replace(/:/g, '')
  const kind = weatherKind(code)
  const sun = isDay ? '#ffe4a3' : '#dce9ff'
  const cloud = '#e8f0f2'
  const shadow = '#a9bec8'
  const rain = '#8bd8ef'
  const common = { width: size, height: size, viewBox: '0 0 64 64', fill: 'none', className, 'aria-hidden': true as const }

  if (kind === 'clear') return (
    <svg {...common}>
      <defs><radialGradient id={`s${id}`}><stop stopColor="#fff8d9"/><stop offset="1" stopColor={sun}/></radialGradient></defs>
      <g stroke={sun} strokeWidth="2" strokeLinecap="round" opacity=".75">
        <path d="M32 5v6M32 53v6M5 32h6M53 32h6M13 13l4 4M47 47l4 4M51 13l-4 4M17 47l-4 4"/>
      </g>
      <circle cx="32" cy="32" r="13" fill={`url(#s${id})`}/>
      {!isDay && <circle cx="38" cy="26" r="12" fill="#253554"/>}
    </svg>
  )

  if (kind === 'thunder') return (
    <svg {...common}>
      <path d="M20 39a12 12 0 1 1 2-23 15 15 0 0 1 28 7 9 9 0 0 1-2 18H22" fill={shadow}/>
      <path d="M18 38a10 10 0 0 1 2-20 13 13 0 0 1 25 7 8 8 0 0 1 0 16H22" fill={cloud}/>
      <path d="m34 36-9 14h8l-3 10 12-16h-8l5-8Z" fill="#ffe080"/>
    </svg>
  )

  return (
    <svg {...common}>
      {(kind === 'cloud' || kind === 'overcast' || kind === 'rain' || kind === 'snow' || kind === 'fog') && (
        <>
          {kind === 'cloud' && <circle cx="23" cy="23" r="11" fill={sun} opacity=".95"/>}
          <path d="M17 43a11 11 0 0 1 1-22 14 14 0 0 1 27 6 9 9 0 0 1 1 18H20" fill={shadow} opacity=".8"/>
          <path d="M15 39a10 10 0 0 1 2-20 13 13 0 0 1 25 7 8 8 0 0 1 0 16H20" fill={cloud}/>
        </>
      )}
      {kind === 'rain' && <g stroke={rain} strokeWidth="3" strokeLinecap="round"><path d="m22 47-2 6M33 47l-2 6M44 47l-2 6"/></g>}
      {kind === 'snow' && <g fill="#eefaff"><circle cx="22" cy="51" r="2.5"/><circle cx="33" cy="48" r="2.5"/><circle cx="44" cy="52" r="2.5"/></g>}
      {kind === 'fog' && <g stroke="#d8e4e8" strokeWidth="3" strokeLinecap="round"><path d="M15 48h34M20 55h29"/></g>}
    </svg>
  )
}
