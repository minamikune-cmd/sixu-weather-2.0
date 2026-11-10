// 页面和路由层 · 主页面。
// 负责把业务数据组合成“此刻 / 逐时 / 七日”三个锚点区块；
// 自身不发起请求，数据全部由 App 外壳注入。
import {
  ArrowDown, ArrowUp, CloudSun, Droplets, Eye, Gauge, Leaf, RefreshCw, Search, Star, Sun, Umbrella, Wind,
} from 'lucide-react'
import DailyForecast from '../ui/components/DailyForecast'
import HourlyForecast from '../ui/components/HourlyForecast'
import SunArc from '../ui/components/SunArc'
import WeatherIcon from '../ui/components/WeatherIcon'
import { aqiLevel, primaryPollutant } from '../domain/air'
import { buildWeatherAlerts } from '../domain/alerts'
import { daylightDuration } from '../domain/solar'
import {
  formatTemperature, formatWind, uvDescription, visibilityText, weatherDescription, windDirection,
} from '../domain/weather'
import { phaseLabels, seasonEnglish } from '../theme'
import { seasonNames } from '../domain/seasons'
import type { City, DayPhase, Preferences, Season, WeatherData, WeatherKind } from '../types/weather'

export interface HomePageProps {
  city: City
  data: WeatherData | null
  loading: boolean
  error: string | null
  fromCache: boolean
  refreshing: boolean
  preferences: Preferences
  isFavorite: boolean
  local: Record<string, string> | null
  timeZone: string | null
  season: Season
  phase: DayPhase
  kind: WeatherKind
  now: Date
  onRefresh: () => void
  onOpenCity: () => void
  onToggleFavorite: () => void
}

export default function HomePage(props: HomePageProps) {
  const { city, data, loading, error, fromCache, refreshing, preferences, isFavorite, local, timeZone, season, phase, kind, now } = props
  const today = data?.daily[0]
  const uv = data?.hourly[0]?.uvIndex ?? today?.uvIndexMax ?? 0
  const updatedAt = data
    ? new Intl.DateTimeFormat('zh-CN', { timeZone: timeZone ?? undefined, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(data.fetchedAt)
    : '--:--'
  // 数据过期提示：缓存超过 1 小时明确标注，避免用户误读为实时数据。
  const staleCache = data ? now.getTime() - data.fetchedAt > 60 * 60 * 1000 : false
  const updateLabel = fromCache ? (staleCache ? '缓存数据较旧，获取于' : '缓存于') : '更新于'
  const currentDate = local ? `${local.year}-${local.month}-${local.day}` : ''
  const todaySolar = data?.daily.find((day) => day.date === currentDate) ?? today
  const alerts = data ? buildWeatherAlerts(data) : []

  if (loading && !data) return <LoadingScene city={city} />
  if (!data) {
    return (
      <section className="empty-state" id="overview">
        <CloudSun size={56} /><h1>暂时看不见这片天空</h1><p>{error || '天气数据尚未就绪，请重试或换一个城市。'}</p>
        <div>
          <button type="button" className="primary-button" onClick={props.onRefresh}><RefreshCw size={17} />重新加载</button>
          <button type="button" className="secondary-button" onClick={props.onOpenCity}>选择城市</button>
        </div>
      </section>
    )
  }

  return (
    <>
      {alerts.length > 0 && (
        <section className="alerts-strip page-shell" aria-label="天气提示">
          {alerts.map((alert) => (
            <article key={alert.id} className={`alert-card ${alert.level}`}>
              <strong>{alert.title}</strong>
              <p>{alert.detail}</p>
            </article>
          ))}
        </section>
      )}

      <section className="hero page-shell" id="overview">
        <div className="hero-meta">
          <div className="place-line"><span className="live-dot" />{city.country || '当前位置'} · {city.admin1 || city.name}</div>
          {local && timeZone ? (
            <>
              <div className="local-clock" aria-label={`当地时间${local.hour}时${local.minute}分${local.second}秒`}><span>{local.hour}:{local.minute}</span><small>:{local.second}</small></div>
              <p>{local.year} 年 {Number(local.month)} 月 {Number(local.day)} 日 · {local.weekday} · {timeZone.replace(/_/g, ' ')}</p>
            </>
          ) : (
            <>
              <div className="local-clock" aria-label="正在校准当地时区"><span>--:--</span></div>
              <p>正在校准当地时区…</p>
            </>
          )}
        </div>

        <div className="hero-grid">
          <div className="hero-copy">
            <div className="season-stamp"><span>{seasonEnglish[season]}</span><i />{seasonNames[season]}季 · {phaseLabels[phase]}</div>
            <div className="temperature-lockup">
              <span className="current-temperature">{formatTemperature(data.current.temperature, preferences.temperatureUnit)}</span>
              <div className="temperature-side">
                <WeatherIcon code={data.current.weatherCode} isDay={data.current.isDay} size={76} />
                <strong>{weatherDescription(data.current.weatherCode)}</strong>
                <span>体感 {formatTemperature(data.current.apparentTemperature, preferences.temperatureUnit, true)}</span>
              </div>
            </div>
            <div className="high-low">
              <span><ArrowUp size={15} />最高 {formatTemperature(today?.temperatureMax ?? data.current.temperature, preferences.temperatureUnit)}</span>
              <span><ArrowDown size={15} />最低 {formatTemperature(today?.temperatureMin ?? data.current.temperature, preferences.temperatureUnit)}</span>
            </div>
            <p className="weather-note">{weatherNarrative(kind, data.current.temperature, data.hourly[0]?.precipitationProbability ?? 0)}</p>
          </div>

          <div className="celestial-panel" aria-hidden="true">
            <div className={`celestial-orb ${phase}`}><span /><i /></div>
            <div className="orbital-ring ring-one" /><div className="orbital-ring ring-two" />
            <div className="weather-glyph"><WeatherIcon code={data.current.weatherCode} isDay={data.current.isDay} size={154} /></div>
            <span className="scene-caption">{kind === 'clear' ? (phase === 'night' ? 'MOONLIT SKY' : 'OPEN SKY') : weatherDescription(data.current.weatherCode).toUpperCase()}</span>
          </div>
        </div>

        <div className="hero-bottom">
          <div className="quick-actions">
            <button type="button" className="secondary-button" onClick={props.onOpenCity}><Search size={17} />切换城市</button>
            <button
              type="button"
              className={`icon-button bordered ${isFavorite ? 'is-favorite' : ''}`}
              onClick={props.onToggleFavorite}
              aria-label={isFavorite ? '取消收藏当前城市' : '收藏当前城市'}
            >
              <Star size={18} fill={isFavorite ? 'currentColor' : 'none'} />
            </button>
            <button type="button" className="icon-button bordered" onClick={props.onRefresh} disabled={refreshing} aria-label="刷新天气">
              <RefreshCw size={18} className={refreshing ? 'spin' : ''} />
            </button>
          </div>
          <div className="update-note"><span className={refreshing ? 'live-dot refreshing' : 'live-dot'} />{refreshing ? '正在更新气象数据' : `${updateLabel} ${updatedAt}`}<small>Open-Meteo</small></div>
        </div>
      </section>

      <section className="metrics-section page-shell" aria-label="当前天气详情">
        <Metric icon={<Droplets />} label="相对湿度" value={`${data.current.humidity}%`} detail={data.current.humidity > 70 ? '空气湿润' : data.current.humidity < 35 ? '空气偏干' : '体感舒适'} />
        <Metric icon={<Wind />} label="风" value={formatWind(data.current.windSpeed, preferences.windUnit)} detail={`${windDirection(data.current.windDirection)} · ${Math.round(data.current.windDirection)}°${data.current.windGusts != null ? ` · 阵风 ${formatWind(data.current.windGusts, preferences.windUnit)}` : ''}`} />
        <Metric icon={<Umbrella />} label="降水概率" value={`${data.hourly[0]?.precipitationProbability ?? 0}%`} detail={`过去一小时 ${data.current.precipitation} mm`} />
        <Metric icon={<Sun />} label="紫外线" value={`${uv.toFixed(1)}`} detail={uvDescription(uv)} />
        <Metric icon={<Eye />} label="能见度" value={visibilityText(data.current.visibility)} detail={data.current.visibility >= 10000 ? '视野清晰' : '注意视野变化'} />
        <Metric icon={<Gauge />} label="海平面气压" value={`${Math.round(data.current.pressure)}`} detail="hPa" />
        {data.airQuality?.usAqi != null ? (
          <Metric
            icon={<Leaf />}
            label="空气质量"
            value={<span style={{ color: aqiLevel(data.airQuality.usAqi).color }}>{Math.round(data.airQuality.usAqi)}</span>}
            detail={`${aqiLevel(data.airQuality.usAqi).label}${primaryPollutant(data.airQuality) ? ` · 首要 ${primaryPollutant(data.airQuality)}` : ''}`}
          />
        ) : (
          <Metric icon={<Leaf />} label="空气质量" value="暂无" detail="该区域暂无监测数据" />
        )}
      </section>

      <section className="forecast-section page-shell" id="hourly">
        <SectionHeading kicker="NEXT 24 HOURS" title="一天，由此展开" aside="逐小时温度与降水趋势" />
        <HourlyForecast hours={data.hourly} unit={preferences.temperatureUnit} />
      </section>

      <section className="forecast-section daily-section page-shell" id="daily">
        <SectionHeading kicker="NEXT 7 DAYS" title="未来一周的节奏" aside="每日温度、降水与日照" />
        <div className="daily-layout">
          <DailyForecast days={data.daily} unit={preferences.temperatureUnit} />
          <aside className="solar-column">
            <SunArc data={{ ...data, daily: todaySolar ? [todaySolar, ...data.daily.filter((day) => day.date !== todaySolar.date)] : data.daily }} />
            <div className="daylight-note"><span>今日日照</span><strong>{daylightDuration(todaySolar?.sunrise, todaySolar?.sunset)}</strong><p>太阳轨迹按所选城市的当地日出、日落时间计算。</p></div>
          </aside>
        </div>
      </section>
    </>
  )
}

function Metric({ icon, label, value, detail }: { icon: React.ReactNode; label: string; value: React.ReactNode; detail: string }) {
  return <article className="metric-card"><div className="metric-icon">{icon}</div><span>{label}</span><strong>{value}</strong><small>{detail}</small></article>
}

function SectionHeading({ kicker, title, aside }: { kicker: string; title: string; aside: string }) {
  return <header className="section-heading"><div><span className="section-kicker">{kicker}</span><h2>{title}</h2></div><p>{aside}</p></header>
}

function LoadingScene({ city }: { city: City }) {
  return <section className="loading-scene page-shell" aria-busy="true" aria-label={`正在加载${city.name}天气`}><div className="skeleton skeleton-meta" /><div className="skeleton skeleton-temperature" /><div className="skeleton skeleton-copy" /><div className="loading-label"><span className="loader-dot" />正在读取 {city.name} 的天空…</div></section>
}

function weatherNarrative(kind: string, temperature: number, rain: number): string {
  if (kind === 'thunder') return '雷雨正在附近活动，尽量减少户外停留，注意短时强降水。'
  if (kind === 'snow') return '雪花让城市慢了下来，外出注意防滑与保暖。'
  if (kind === 'rain') return rain >= 60 ? '雨水到访的可能性较高，出门记得带伞。' : '局部可能有雨，随身备一把轻便雨伞。'
  if (kind === 'fog') return '雾气降低了能见度，出行请预留更多时间。'
  if (kind === 'overcast') return '云层铺满天际，光线柔和，适合放慢一点节奏。'
  if (temperature >= 30) return '阳光热力十足，注意补水与防晒，避开正午长时间暴晒。'
  if (temperature <= 3) return '空气带着清冽寒意，外出请添衣保暖。'
  return rain >= 40 ? '天空总体平静，晚些时候仍有降水可能。' : '此刻天色正好，适合出门走走，感受风与光。'
}
