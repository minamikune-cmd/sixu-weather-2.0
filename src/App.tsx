// 应用外壳：状态编排、平台事件（网络/返回键/状态栏）与全局弹层。
// 业务数据经 props 注入 pages/HomePage，自身不渲染具体天气内容。
import { useCallback, useEffect, useState } from 'react'
import {
  Check, CloudSun, LocateFixed, MapPin, Menu, Navigation, Search, Settings, Sun, X,
} from 'lucide-react'
import CityDialog from './ui/components/CityDialog'
import SettingsDialog from './ui/components/SettingsDialog'
import Atmosphere from './ui/components/Atmosphere'
import { isFavorite as checkFavorite, loadFavorites, loadRecent, pushRecent, toggleFavorite } from './domain/cities'
import { getDayPhase } from './domain/solar'
import { weatherKind } from './domain/weather'
import { getSeason } from './domain/seasons'
import { getCityParts } from './domain/time'
import { useWeather } from './hooks/useWeather'
import HomePage from './pages/HomePage'
import { ROUTES } from './pages/routes'
import { ALL_KEYS, LOCATION_NOTICE_KEY } from './config/keys'
import { DEFAULT_CITY, DEFAULT_PREFERENCES, loadPreferences, loadSavedCity, saveCity, savePreferences } from './config/preferences'
import { GeolocationError, getCurrentPosition } from './platform/geolocation'
import { lightHaptic, watchReducedMotion } from './platform/haptics'
import { isOnline, onNetworkChange } from './platform/network'
import { registerBackConsumer } from './platform/backButton'
import { readStorage, removeStorage, writeStorage } from './platform/storage'
import { setStatusBarDark } from './platform/statusBar'
import { reverseGeocode } from './services/weather/api'
import { isDarkChrome, resolveStyleClass } from './theme'
import type { City, Preferences } from './types/weather'
import './App.css'

function readFlag(key: string): boolean {
  return readStorage(key) === 'seen'
}

export default function App() {
  const [city, setCity] = useState<City>(() => loadSavedCity(DEFAULT_CITY))
  const [preferences, setPreferences] = useState<Preferences>(() => loadPreferences())
  const [favorites, setFavorites] = useState<City[]>(() => loadFavorites())
  const [recent, setRecent] = useState<City[]>(() => loadRecent())
  const [cityOpen, setCityOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [locationNotice, setLocationNotice] = useState(() => !readFlag(LOCATION_NOTICE_KEY))
  const [locationDenied, setLocationDenied] = useState(false)
  const [bannerDismissed, setBannerDismissed] = useState(false)
  const [locating, setLocating] = useState(false)
  const [offline, setOffline] = useState(false)
  const [toast, setToast] = useState('')
  const [now, setNow] = useState(new Date())
  const { data, loading, refreshing, error, fromCache, refresh } = useWeather(city)

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  // 跟随系统深浅色：监听系统主题变化，并同步减少动态效果缓存。
  const [systemDark, setSystemDark] = useState(() => window.matchMedia('(prefers-color-scheme: dark)').matches)
  useEffect(() => {
    const query = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => setSystemDark(query.matches)
    query.addEventListener('change', onChange)
    const stopReducedWatch = watchReducedMotion()
    return () => {
      query.removeEventListener('change', onChange)
      stopReducedWatch()
    }
  }, [])

  // 统一的轻触觉反馈入口（Android 振动 / Web 静默降级）。
  const haptic = useCallback(() => lightHaptic(preferences.haptics), [preferences.haptics])

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(''), 3600)
    return () => window.clearTimeout(timer)
  }, [toast])

  // 网络状态：进入应用时检查一次，之后监听变化；断网给出提示并在恢复时自动刷新。
  useEffect(() => {
    let wasOffline = false
    void isOnline().then((online) => setOffline(!online))
    return onNetworkChange((online) => {
      setOffline(!online)
      if (!online) {
        wasOffline = true
        setToast('网络连接已断开，将使用缓存数据。')
      } else if (wasOffline) {
        wasOffline = false
        setToast('网络已恢复，正在更新天气。')
        void refresh()
      }
    })
  }, [refresh])

  useEffect(() => { setBannerDismissed(false) }, [city.id, error, locationDenied, fromCache, offline])

  // Android 返回键：设置 > 城市 > 定位说明，优先关闭最上层的弹层。
  useEffect(() => {
    return registerBackConsumer(() => {
      if (settingsOpen) { setSettingsOpen(false); return true }
      if (cityOpen) { setCityOpen(false); return true }
      if (locationNotice) { setLocationNotice(false); return true }
      return false
    })
  }, [settingsOpen, cityOpen, locationNotice])

  const timeZone = data?.timezone ?? city.timezone ?? null
  const local = timeZone ? getCityParts(timeZone, now) : null
  const month = Number(local?.month ?? new Date().getMonth() + 1)
  const automaticSeason = getSeason(month, city.latitude)
  const season = preferences.season === 'auto' ? automaticSeason : preferences.season
  const phase = data ? getDayPhase(data) : 'day'
  const kind = data ? weatherKind(data.current.weatherCode) : 'clear'
  const styleClass = resolveStyleClass(preferences, phase, systemDark)

  // 暗色场景同步 Android 状态栏文字颜色（Web 端为空操作）。
  useEffect(() => {
    setStatusBarDark(isDarkChrome(preferences, phase, systemDark))
  }, [preferences, phase, systemDark])

  const showToast = useCallback((message: string) => setToast(message), [])

  const selectCity = useCallback((nextCity: City) => {
    setCity(nextCity)
    saveCity(nextCity)
    setRecent((previous) => pushRecent(previous, nextCity))
    setCityOpen(false)
    setLocationDenied(false)
    haptic()
  }, [haptic])

  const requestLocation = useCallback(async () => {
    setLocationNotice(false)
    writeStorage(LOCATION_NOTICE_KEY, 'seen')
    setLocating(true)
    try {
      const coordinates = await getCurrentPosition()
      const located = await reverseGeocode(coordinates.latitude, coordinates.longitude)
      selectCity(located)
      showToast(`已定位到${located.name}`)
    } catch (locationError) {
      setLocationDenied(true)
      setCityOpen(true)
      const fallback = locationError instanceof GeolocationError
        ? locationError.message
        : locationError instanceof Error ? locationError.message : '定位失败，请手动选择城市。'
      showToast(fallback)
    } finally {
      setLocating(false)
    }
  }, [selectCity, showToast])

  const handleToggleFavorite = useCallback((target: City) => {
    setFavorites((previous) => {
      const { next, added } = toggleFavorite(previous, target)
      showToast(added ? `已收藏${target.name}` : `已取消收藏${target.name}`)
      return next
    })
    haptic()
  }, [showToast, haptic])

  const updatePreferences = useCallback((next: Preferences) => {
    setPreferences(next)
    savePreferences(next)
  }, [])
  const closeCityDialog = useCallback(() => setCityOpen(false), [])
  const closeSettingsDialog = useCallback(() => setSettingsOpen(false), [])

  const clearData = () => {
    ALL_KEYS.forEach((key) => removeStorage(key))
    setFavorites([])
    setRecent([])
    setPreferences(DEFAULT_PREFERENCES)
    setCity(DEFAULT_CITY)
    saveCity(DEFAULT_CITY)
    setLocationNotice(true)
    setSettingsOpen(false)
    showToast('本地数据已清除，已恢复默认城市与偏好。')
  }

  const bannerMessage = locationDenied
    ? '定位不可用，手动搜索同样方便。'
    : offline
      ? '当前网络已断开，正在显示缓存天气。'
      : error || (fromCache ? '正在显示缓存天气。' : null)

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
          {ROUTES.map((route) => <a key={route.id} href={route.hash}>{route.label}</a>)}
        </nav>
        <div className="header-actions">
          <button type="button" className="city-trigger" onClick={() => { haptic(); setCityOpen(true) }}><MapPin size={17} /><span>{city.name}</span><Search size={15} /></button>
          <button type="button" className={`icon-button header-icon ${locating ? 'is-loading' : ''}`} onClick={() => { haptic(); void requestLocation() }} disabled={locating} aria-label="定位当前位置"><LocateFixed size={19} /></button>
          <button type="button" className="icon-button header-icon" onClick={() => { haptic(); setSettingsOpen(true) }} aria-label="打开设置"><Settings size={19} /></button>
        </div>
      </header>

      {!bannerDismissed && bannerMessage && (
        <div className="status-banner" role="status">
          <span>{bannerMessage}</span>
          {locationDenied ? <button type="button" onClick={() => setCityOpen(true)}>搜索城市</button> : <button type="button" onClick={() => void refresh()}>重新获取</button>}
          <button type="button" aria-label="关闭提示" onClick={() => { setBannerDismissed(true); setLocationDenied(false) }}><X size={15} /></button>
        </div>
      )}

      <main id="main-content">
        <HomePage
          city={city}
          data={data}
          loading={loading}
          error={error}
          fromCache={fromCache}
          refreshing={refreshing}
          preferences={preferences}
          isFavorite={checkFavorite(favorites, city)}
          local={local}
          timeZone={timeZone}
          season={season}
          phase={phase}
          kind={kind}
          onRefresh={() => { haptic(); void refresh() }}
          onOpenCity={() => { haptic(); setCityOpen(true) }}
          onToggleFavorite={() => handleToggleFavorite(city)}
        />
      </main>

      <footer className="site-footer page-shell">
        <div className="footer-brand"><span className="brand-mark"><i /><i /><i /><i /></span><strong>四序天气</strong><p>让每一次抬头，都有迹可循。</p></div>
        <div className="footer-meta"><p>天气与地理编码：Open-Meteo · 反向城市识别：BigDataCloud</p><p>无需密钥 · 本地偏好仅保存在此设备 · 不展示无可靠来源的空气质量数据</p></div>
        <button type="button" className="text-button" onClick={() => setSettingsOpen(true)}>偏好与隐私 <Settings size={14} /></button>
      </footer>

      <nav className="mobile-nav" aria-label="移动端导航">
        <a href="#overview"><CloudSun size={19} /><span>此刻</span></a>
        <a href="#hourly"><Menu size={19} /><span>逐时</span></a>
        <button type="button" onClick={() => setCityOpen(true)}><Search size={19} /><span>城市</span></button>
        <a href="#daily"><Sun size={19} /><span>七日</span></a>
      </nav>

      <CityDialog open={cityOpen} current={city} favorites={favorites} recent={recent} onClose={closeCityDialog} onSelect={selectCity} onToggleFavorite={handleToggleFavorite} onLocate={() => void requestLocation()} locating={locating} />
      <SettingsDialog open={settingsOpen} preferences={preferences} onChange={updatePreferences} onClose={closeSettingsDialog} onClearData={clearData} />

      {locationNotice && (
        <div className="modal-backdrop notice-backdrop">
          <section className="dialog location-notice" role="dialog" aria-modal="true" aria-labelledby="location-title">
            <div className="location-illustration"><Navigation size={30} /><span /></div>
            <span className="section-kicker">YOUR LOCAL SKY</span>
            <h2 id="location-title">看看你头顶的天气</h2>
            <p>允许定位后，我们会将经纬度发送至 BigDataCloud 识别城市，并向 Open-Meteo 请求天气。位置不会保存在我们的服务器，因为本项目没有服务器。</p>
            <p className="privacy-small">你可以拒绝并手动搜索。选择的城市、收藏与偏好仅存储在当前设备。</p>
            <div className="notice-actions">
              <button type="button" className="primary-button" onClick={() => void requestLocation()}><LocateFixed size={17} />允许定位</button>
              <button type="button" className="secondary-button" onClick={() => { setLocationNotice(false); setLocationDenied(true); writeStorage(LOCATION_NOTICE_KEY, 'seen'); setCityOpen(true) }}>暂不，手动选择</button>
            </div>
          </section>
        </div>
      )}
      {toast && <div className="toast" role="status"><Check size={17} />{toast}<button type="button" onClick={() => setToast('')} aria-label="关闭通知"><X size={15} /></button></div>}
    </div>
  )
}
