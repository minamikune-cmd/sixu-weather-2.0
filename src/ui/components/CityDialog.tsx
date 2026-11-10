import { useEffect, useRef, useState } from 'react'
import { Clock3, LocateFixed, MapPin, Navigation, Search, Star, X } from 'lucide-react'
import { useDialogFocus } from '../../hooks/useDialogFocus'
import { searchCities } from '../../services/weather/api'
import type { City } from '../../types/weather'

interface Props {
  open: boolean
  current: City
  favorites: City[]
  recent: City[]
  onClose: () => void
  onSelect: (city: City) => void
  onToggleFavorite: (city: City) => void
  onLocate: () => void
  locating: boolean
}

export default function CityDialog({ open, current, favorites, recent, onClose, onSelect, onToggleFavorite, onLocate, locating }: Props) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<City[]>([])
  const [searching, setSearching] = useState(false)
  const [message, setMessage] = useState('')
  const abortRef = useRef<AbortController | null>(null)
  const dialogRef = useDialogFocus(open, onClose, '.search-field input')

  useEffect(() => {
    if (!open) return
    return () => { abortRef.current?.abort() }
  }, [open])

  useEffect(() => {
    const value = query.trim()
    if (!value) {
      setResults([])
      setMessage('')
      setSearching(false)
      return
    }
    const coordinates = value.match(/^(-?\d+(?:\.\d+)?)\s*[,，\s]\s*(-?\d+(?:\.\d+)?)$/)
    if (coordinates) {
      const latitude = Number(coordinates[1])
      const longitude = Number(coordinates[2])
      if (Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180) {
        setResults([{ id: `coord-${latitude}-${longitude}`, name: `${latitude.toFixed(3)}, ${longitude.toFixed(3)}`, admin1: '经纬度位置', latitude, longitude }])
        setMessage('')
        setSearching(false)
        return
      }
    }
    if (value.length < 2) {
      setResults([])
      setMessage('请输入至少两个字符，或输入“纬度, 经度”。')
      return
    }
    setSearching(true)
    setMessage('')
    const timer = window.setTimeout(async () => {
      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller
      try {
        const cities = await searchCities(value, controller.signal)
        setResults(cities)
        setMessage(cities.length ? '' : '未找到匹配城市，试试完整城市名或经纬度。')
      } catch (error) {
        if (!controller.signal.aborted) setMessage(error instanceof Error ? error.message : '搜索失败，请重试。')
      } finally {
        if (!controller.signal.aborted) setSearching(false)
      }
    }, 380)
    return () => window.clearTimeout(timer)
  }, [query])

  if (!open) return null

  const renderCity = (city: City) => {
    const favorite = favorites.some((item) => item.id === city.id)
    return (
      <div className={`city-result ${current.id === city.id ? 'is-current' : ''}`} key={city.id}>
        <button type="button" className="city-select" onClick={() => { onSelect(city); setQuery('') }}>
          <MapPin size={18} />
          <span><strong>{city.name}</strong><small>{[city.admin1, city.country].filter(Boolean).join(' · ') || `${city.latitude.toFixed(2)}, ${city.longitude.toFixed(2)}`}</small></span>
          {current.id === city.id && <em>当前</em>}
        </button>
        <button type="button" className={`icon-button favorite-button ${favorite ? 'is-favorite' : ''}`} onClick={() => onToggleFavorite(city)} aria-label={favorite ? `取消收藏${city.name}` : `收藏${city.name}`}>
          <Star size={18} fill={favorite ? 'currentColor' : 'none'} />
        </button>
      </div>
    )
  }

  return (
    <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <section ref={dialogRef} className="dialog city-dialog" role="dialog" aria-modal="true" aria-labelledby="city-dialog-title" tabIndex={-1}>
        <header className="dialog-header">
          <div><span className="section-kicker">PLACES</span><h2 id="city-dialog-title">你想看哪里的天空？</h2></div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="关闭城市搜索"><X size={21} /></button>
        </header>
        <div className="search-field">
          <Search size={20} />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索城市，或输入纬度, 经度" aria-label="搜索城市或经纬度" />
          {query && <button type="button" className="clear-search" onClick={() => setQuery('')} aria-label="清空搜索"><X size={17} /></button>}
        </div>
        <button type="button" className="locate-row" onClick={onLocate} disabled={locating}>
          <LocateFixed size={19} className={locating ? 'spin' : ''} />
          <span><strong>{locating ? '正在获取位置…' : '使用我的当前位置'}</strong><small>仅在你确认后请求浏览器定位权限</small></span>
          <Navigation size={17} />
        </button>
        <div className="city-results" aria-live="polite">
          {searching && <div className="search-status"><span className="loader-dot" />正在寻找城市…</div>}
          {!searching && message && <p className="search-status">{message}</p>}
          {!searching && results.length > 0 && <div className="city-group"><h3>搜索结果</h3>{results.map(renderCity)}</div>}
          {!query && favorites.length > 0 && <div className="city-group"><h3><Star size={15} />收藏城市</h3>{favorites.map(renderCity)}</div>}
          {!query && recent.length > 0 && <div className="city-group"><h3><Clock3 size={15} />最近使用</h3>{recent.filter((city) => !favorites.some((item) => item.id === city.id)).map(renderCity)}</div>}
          {!query && !favorites.length && !recent.length && <div className="city-empty"><Navigation size={30} /><p>搜索城市后，可将其加入收藏。<br />最近访问会自动保存在此浏览器。</p></div>}
        </div>
      </section>
    </div>
  )
}
