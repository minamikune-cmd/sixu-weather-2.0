import { Moon, Sunrise, Sunset } from 'lucide-react'
import { getDayProgress } from '../../domain/solar'
import { localTimeFromIso } from '../../domain/time'
import type { WeatherData } from '../../types/weather'

export default function SunArc({ data }: { data: WeatherData }) {
  const today = data.daily[0]
  const progress = getDayProgress(data)
  const angle = Math.PI * progress
  const x = 18 + 164 * progress
  const y = 77 - Math.sin(angle) * 56
  return (
    <div className="sun-arc-card">
      <div className="sun-arc-heading"><span>日照轨迹</span><strong>{Math.round(progress * 100)}%</strong></div>
      <svg viewBox="0 0 200 94" role="img" aria-label={`日出${localTimeFromIso(today.sunrise)}，日落${localTimeFromIso(today.sunset)}，当前日照进度${Math.round(progress * 100)}%`}>
        <defs><linearGradient id="sunArcGradient" x1="0" x2="1"><stop stopColor="#f5bd8b"/><stop offset=".5" stopColor="#ffe6a7"/><stop offset="1" stopColor="#e99781"/></linearGradient></defs>
        <path d="M18 77 Q100 -35 182 77" className="sun-arc-base" />
        <path d="M18 77 Q100 -35 182 77" pathLength="100" strokeDasharray={`${progress * 100} 100`} className="sun-arc-progress" />
        <line x1="10" y1="77" x2="190" y2="77" className="sun-arc-horizon" />
        <g transform={`translate(${x} ${y})`} className="sun-arc-orb">
          <circle r="9" fill="#ffe6a7" opacity=".18" />
          <circle r="4.5" fill="#fff0be" />
        </g>
      </svg>
      <div className="sun-times">
        <span><Sunrise size={16} /><small>日出</small><strong>{localTimeFromIso(today.sunrise)}</strong></span>
        <Moon size={15} className="sun-moon" />
        <span><Sunset size={16} /><small>日落</small><strong>{localTimeFromIso(today.sunset)}</strong></span>
      </div>
    </div>
  )
}
