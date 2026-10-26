import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ArrowDown, ArrowUp, Check, CloudSun, Droplets, Eye, Gauge, LocateFixed,
  MapPin, Menu, Navigation, RefreshCw, Search, Settings, Star, Sun,
  Umbrella, Wind, X,
} from 'lucide-react'
import Atmosphere from './components/Atmosphere'
import CityDialog from './components/CityDialog'
import DailyForecast from './components/DailyForecast'
import HourlyForecast from './components/HourlyForecast'
import SettingsDialog from './components/SettingsDialog'
import SunArc from './components/SunArc'
import WeatherIcon from './components/WeatherIcon'
import { getSavedCity, saveCity, useWeather } from './hooks/useWeather'
import {
  DEFAULT_CITY, DEFAULT_PREFERENCES, formatTemperature, formatWind, getCityParts,
  getDayPhase, getSeason, localTimeFromIso, reverseGeocode, seasonNames, uvDescription,
  visibilityText, weatherDescription, weatherKind, windDirection,
} from './lib/weather'
import type { City, Preferences } from './types/weather'
import './App.css'

const PREFERENCES_KEY = 'sixu-preferences-v1'
const FAVORITES_KEY = 'sixu-favorites-v1'
const RECENT_KEY = 'sixu-recent-v1'
const LOCATION_NOTICE_KEY = 'sixu-location-notice-v1'

function readLocal<T>(key: string, fallback: T): T {
  try {
    const stored = localStorage.getItem(key)
    return stored ? JSON.parse(stored) as T : fallback
  } catch { return fallback }
}

function writeLocal(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)) } catch { /* private mode */ }
}

const phaseLabels = { dawn: '晨曦', day: '白昼', dusk: '日暮', night: '夜色' }
const seasonEnglish = { spring: 'SPRING', summer: 'SUMMER', autumn: 'AUTUMN', winter: 'WINTER' }

export default function App() {
  const [city, setCity] = useState<City>(() => getSavedCity(DEFAULT_CITY))
  const [preferences, setPreferences] = useState<Preferences>(() => ({ ...DEFAULT_PREFERENCES, ...readLocal(PREFERENCES_KEY, {}) }))
  const [favorites, setFavorites] = useState<City[]>(() => readLocal(FAVORITES_KEY, []))
  const [recent, setRecent] = useState<City[]>(() => readLocal(RECENT_KEY, []))
  const [cityOpen, setCityOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [locationNotice, setLocationNotice] = useState(() => !localStorage.getItem(LOCATION_NOTICE_KEY))
  const [locationDenied, setLocationDenied] = useState(false)
  const [bannerDismissed, setBannerDismissed] = useState(false)
  const [locating, setLocating] = useState(false)
  const [toast, setToast] = useState('')
  const [now, setNow] = useState(new Date())
  const { data, loading, refreshing, error, fromCache, refresh } = useWeather(city)

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(''), 3600)
    return () => window.clearTimeout(timer)
  }, [toast])

  useEffect(() => { setBannerDismissed(false) }, [city.id, error, locationDenied, fromCache])

  const selectCity = useCallback((nextCity: City) => {
    setCity(nextCity)
    saveCity(nextCity)
    setRecent((previous) => {
      const next = [nextCity, ...previous.filter((item) => item.id !== nextCity.id)].slice(0, 6)
      writeLocal(RECENT_KEY, next)
      return next
    })
    setCityOpen(false)
    setLocationDenied(false)
  }, [])

  const requestLocation = useCallback(() => {
    setLocationNotice(false)
    writeLocal(LOCATION_NOTICE_KEY, 'seen')
    if (!('geolocation' in navigator)) {
      setLocationDenied(true)
      setCityOpen(true)
      setToast('此浏览器不支持定位，请手动搜索城市。')
      return
    }
    if (!window.isSecureContext) {
      setLocationDenied(true)
      setCityOpen(true)
      setToast('定位需要 HTTPS 安全环境，请使用手动搜索。')
      return
    }
    setLocating(true)
    navigator.geolocation.getCurrentPosition(async (position) => {
      try {
        const located = await reverseGeocode(position.coords.latitude, position.coords.longitude)
        selectCity(located)
        setToast(`已定位到${located.name}`)
      } catch (locationError) {
        setLocationDenied(true)
        setCityOpen(true)
        setToast(locationError instanceof Error ? locationError.message : '定位失败，请手动选择城市。')
      } finally { setLocating(false) }
    }, (geoError) => {
      setLocating(false)
      setLocationDenied(true)
      setCityOpen(true)
      setToast(geoError.code === geoError.PERMISSION_DENIED ? '定位权限未开启，你可以手动搜索城市。' : '暂时无法获取位置，请手动搜索城市。')
    }, { enableHighAccuracy: false, timeout: 10000, maximumAge: 10 * 60 * 1000 })
  }, [selectCity])

  const toggleFavorite = useCallback((target: City) => {
    setFavorites((previous) => {
      const exists = previous.some((item) => item.id === target.id)
      const next = exists ? previous.filter((item) => item.id !== target.id) : [target, ...previous].slice(0, 12)
      writeLocal(FAVORITES_KEY, next)
      setToast(exists ? `已取消收藏${target.name}` : `已收藏${target.name}`)
      return next
    })
  }, [])

  const updatePreferences = useCallback((next: Preferences) => {
    setPreferences(next)
    writeLocal(PREFERENCES_KEY, next)
  }, [])
  const closeCityDialog = useCallback(() => setCityOpen(false), [])
  const closeSettingsDialog = useCallback(() => setSettingsOpen(false), [])

  const clearData = () => {
    ;['sixu-weather-data-v1', 'sixu-city-v1', PREFERENCES_KEY, FAVORITES_KEY, RECENT_KEY].forEach((key) => localStorage.removeItem(key))
    setFavorites([])
    setRecent([])
    setPreferences(DEFAULT_PREFERENCES)
    setCity(DEFAULT_CITY)
    saveCity(DEFAULT_CITY)
    setSettingsOpen(false)
    setToast('本地数据已清除，已恢复默认城市与偏好。')
  }

  const timeZone = data?.timezone ?? city.timezone ?? 'Asia/Shanghai'
  const local = getCityParts(timeZone, now)
  const month = Number(local.month)
  const automaticSeason = getSeason(month, city.latitude)
  const season = preferences.season === 'auto' ? automaticSeason : preferences.season
  const phase = data ? getDayPhase(data) : 'day'
  const kind = data ? weatherKind(data.current.weatherCode) : 'clear'
  const isFavorite = favorites.some((item) => item.id === city.id)
  const styleClass = preferences.visualStyle === 'scene' ? (phase === 'night' || phase === 'dusk' ? 'style-dark' : 'style-scene') : `style-${preferences.visualStyle}`
  const today = data?.daily[0]
  const uv = data?.hourly[0]?.uvIndex ?? today?.uvIndexMax ?? 0
  const updatedAt = data ? new Intl.DateTimeFormat('zh-CN', { timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(data.fetchedAt) : '--:--'
  const currentHour = useMemo(() => `${local.year}-${local.month}-${local.day}`, [local.year, local.month, local.day])
  const todaySolar = data?.daily.find((day) => day.date === currentHour) ?? today

  return (
    <div className={`app ${styleClass} ${preferences.animations ? 'animations-on' : 'animations-off'}`} data-season={season} data-phase={phase} data-kind={kind}>
      <Atmosphere season={season} phase={phase} kind={kind} animations={preferences.animations} temperature={data?.current.temperature ?? 20} windSpeed={data?.current.windSpeed ?? 10} />
      <a className="skip-link" href="#main-content">跳至天气内容</a>

      <header className="site-header">
        <a href="#overview" className="brand" aria-label="四序天气首页">
          <span className="brand-mark"><i /><i /><i /><i /></span>
          <span><strong>四序</strong><small>SIXU WEATHER</small></span>
        </a>
        <nav className="desktop-nav" aria-label="主导航">
          <a href="#overview">此刻</a><a href="#hourly">逐时</a><a href="#daily">七日</a>
        </nav>
        <div className="header-actions">
          <button type="button" className="city-trigger" onClick={() => setCityOpen(true)}><MapPin size={17} /><span>{city.name}</span><Search size={15} /></button>
          <button type="button" className={`icon-button header-icon ${locating ? 'is-loading' : ''}`} onClick={requestLocation} disabled={locating} aria-label="定位当前位置"><LocateFixed size={19} /></button>
          <button type="button" className="icon-button header-icon" onClick={() => setSettingsOpen(true)} aria-label="打开设置"><Settings size={19} /></button>
        </div>
      </header>

      {!bannerDismissed && (error || locationDenied || fromCache) && (
        <div className="status-banner" role="status">
          <span>{locationDenied ? '定位不可用，手动搜索同样方便。' : error || '正在显示缓存天气。'}</span>
          {locationDenied ? <button type="button" onClick={() => setCityOpen(true)}>搜索城市</button> : <button type="button" onClick={() => void refresh()}>重新获取</button>}
          <button type="button" aria-label="关闭提示" onClick={() => { setBannerDismissed(true); setLocationDenied(false) }}><X size={15} /></button>
        </div>
      )}

      <main id="main-content">
        {loading && !data ? <LoadingScene city={city} /> : !data ? (
          <section className="empty-state" id="overview">
            <CloudSun size={56} /><h1>暂时看不见这片天空</h1><p>{error || '天气数据尚未就绪，请重试或换一个城市。'}</p>
            <div><button type="button" className="primary-button" onClick={() => void refresh()}><RefreshCw size={17} />重新加载</button><button type="button" className="secondary-button" onClick={() => setCityOpen(true)}>选择城市</button></div>
          </section>
        ) : (
          <>
            <section className="hero page-shell" id="overview">
              <div className="hero-meta">
                <div className="place-line"><span className="live-dot" />{city.country || '当前位置'} · {city.admin1 || city.name}</div>
                <div className="local-clock" aria-label={`当地时间${local.hour}时${local.minute}分${local.second}秒`}><span>{local.hour}:{local.minute}</span><small>:{local.second}</small></div>
                <p>{local.year} 年 {Number(local.month)} 月 {Number(local.day)} 日 · {local.weekday} · {timeZone.replace(/_/g, ' ')}</p>
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
                  <button type="button" className="secondary-button" onClick={() => setCityOpen(true)}><Search size={17} />切换城市</button>
                  <button type="button" className={`icon-button bordered ${isFavorite ? 'is-favorite' : ''}`} onClick={() => toggleFavorite(city)} aria-label={isFavorite ? '取消收藏当前城市' : '收藏当前城市'}><Star size={18} fill={isFavorite ? 'currentColor' : 'none'} /></button>
                  <button type="button" className="icon-button bordered" onClick={() => void refresh()} disabled={refreshing} aria-label="刷新天气"><RefreshCw size={18} className={refreshing ? 'spin' : ''} /></button>
                </div>
                <div className="update-note"><span className={refreshing ? 'live-dot refreshing' : 'live-dot'} />{refreshing ? '正在更新气象数据' : `${fromCache ? '缓存' : '更新'}于 ${updatedAt}`}<small>Open-Meteo</small></div>
              </div>
            </section>

            <section className="metrics-section page-shell" aria-label="当前天气详情">
              <Metric icon={<Droplets />} label="相对湿度" value={`${data.current.humidity}%`} detail={data.current.humidity > 70 ? '空气湿润' : data.current.humidity < 35 ? '空气偏干' : '体感舒适'} />
              <Metric icon={<Wind />} label="风" value={formatWind(data.current.windSpeed, preferences.windUnit)} detail={`${windDirection(data.current.windDirection)} · ${Math.round(data.current.windDirection)}°`} />
              <Metric icon={<Umbrella />} label="降水概率" value={`${data.hourly[0]?.precipitationProbability ?? 0}%`} detail={`过去一小时 ${data.current.precipitation} mm`} />
              <Metric icon={<Sun />} label="紫外线" value={`${uv.toFixed(1)}`} detail={uvDescription(uv)} />
              <Metric icon={<Eye />} label="能见度" value={visibilityText(data.current.visibility)} detail={data.current.visibility >= 10000 ? '视野清晰' : '注意视野变化'} />
              <Metric icon={<Gauge />} label="海平面气压" value={`${Math.round(data.current.pressure)}`} detail="hPa" />
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
        )}
      </main>

      <footer className="site-footer page-shell">
        <div className="footer-brand"><span className="brand-mark"><i /><i /><i /><i /></span><strong>四序天气</strong><p>让每一次抬头，都有迹可循。</p></div>
        <div className="footer-meta"><p>天气与地理编码：Open-Meteo · 反向城市识别：BigDataCloud</p><p>无需密钥 · 本地偏好仅保存在此浏览器 · 不展示无可靠来源的空气质量数据</p></div>
        <button type="button" className="text-button" onClick={() => setSettingsOpen(true)}>偏好与隐私 <Settings size={14} /></button>
      </footer>

      <nav className="mobile-nav" aria-label="移动端导航">
        <a href="#overview"><CloudSun size={19} /><span>此刻</span></a>
        <a href="#hourly"><Menu size={19} /><span>逐时</span></a>
        <button type="button" onClick={() => setCityOpen(true)}><Search size={19} /><span>城市</span></button>
        <a href="#daily"><Sun size={19} /><span>七日</span></a>
      </nav>

      <CityDialog open={cityOpen} current={city} favorites={favorites} recent={recent} onClose={closeCityDialog} onSelect={selectCity} onToggleFavorite={toggleFavorite} onLocate={requestLocation} locating={locating} />
      <SettingsDialog open={settingsOpen} preferences={preferences} onChange={updatePreferences} onClose={closeSettingsDialog} onClearData={clearData} />

      {locationNotice && (
        <div className="modal-backdrop notice-backdrop">
          <section className="dialog location-notice" role="dialog" aria-modal="true" aria-labelledby="location-title">
            <div className="location-illustration"><Navigation size={30} /><span /></div>
            <span className="section-kicker">YOUR LOCAL SKY</span>
            <h2 id="location-title">看看你头顶的天气</h2>
            <p>允许浏览器定位后，我们会将经纬度发送至 BigDataCloud 识别城市，并向 Open-Meteo 请求天气。位置不会保存在我们的服务器，因为本项目没有服务器。</p>
            <p className="privacy-small">你可以拒绝并手动搜索。选择的城市、收藏与偏好仅存储在当前浏览器。</p>
            <div className="notice-actions"><button type="button" className="primary-button" onClick={requestLocation}><LocateFixed size={17} />允许定位</button><button type="button" className="secondary-button" onClick={() => { setLocationNotice(false); setLocationDenied(true); writeLocal(LOCATION_NOTICE_KEY, 'seen'); setCityOpen(true) }}>暂不，手动选择</button></div>
          </section>
        </div>
      )}
      {toast && <div className="toast" role="status"><Check size={17} />{toast}<button type="button" onClick={() => setToast('')} aria-label="关闭通知"><X size={15} /></button></div>}
    </div>
  )
}

function Metric({ icon, label, value, detail }: { icon: React.ReactNode; label: string; value: string; detail: string }) {
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

function daylightDuration(sunrise?: string, sunset?: string): string {
  if (!sunrise || !sunset) return '暂无数据'
  const start = localTimeFromIso(sunrise).split(':').map(Number)
  const end = localTimeFromIso(sunset).split(':').map(Number)
  const minutes = Math.max(0, (end[0] * 60 + end[1]) - (start[0] * 60 + start[1]))
  return `${Math.floor(minutes / 60)} 小时 ${minutes % 60} 分`
}
