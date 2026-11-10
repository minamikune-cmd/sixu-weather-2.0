// 视图状态层 · 官方天气预警。
// 城市切换时用 React 推荐的"渲染期间调整 state"模式同步缓存（避免列表闪空）；
// effect 内异步拉取并用 alive 标志防止城市快速切换时串数据；失败静默退回缓存。
import { useCallback, useEffect, useState } from 'react'
import type { City } from '../types/weather'
import type { OfficialWarning } from '../types/warning'
import { fetchWarnings, readCachedWarnings } from '../services/weather/warnings'

export function useWarnings(city: City | null) {
  const [warnings, setWarnings] = useState<OfficialWarning[]>(() => (city ? readCachedWarnings(city) : []))
  const [fromCache, setFromCache] = useState(true)
  // 渲染期间检测城市变化并同步切换缓存（React 官方 adjust-state-when-props-change 模式）。
  const [loadedCityId, setLoadedCityId] = useState(city?.id ?? '')
  if ((city?.id ?? '') !== loadedCityId) {
    setLoadedCityId(city?.id ?? '')
    setWarnings(city ? readCachedWarnings(city) : [])
  }

  const refresh = useCallback(async () => {
    if (!city) return
    try {
      const result = await fetchWarnings(city)
      setWarnings(result.warnings)
      setFromCache(result.fromCache)
    } catch {
      // fetchWarnings 内部已兜底，这里双保险。
    }
  }, [city])

  useEffect(() => {
    let alive = true
    if (!city) {
      return () => { alive = false }
    }
    void (async () => {
      try {
        const result = await fetchWarnings(city)
        if (!alive) return
        setWarnings(result.warnings)
        setFromCache(result.fromCache)
      } catch {
        // fetchWarnings 内部已兜底，这里双保险。
      }
    })()
    return () => { alive = false }
  }, [city])

  return { warnings, fromCache, refresh }
}
