// 平台适配层 · 触觉反馈。
// Android：经 WebView 的 navigator.vibrate 触发短振动（Manifest 已声明 VIBRATE 权限）。
// Web 桌面端无振动能力，静默降级为空操作；系统减少动态效果设置开启时不触发。
let cachedReduced: boolean | null = null

function readReducedMotion(): boolean {
  if (cachedReduced === null) {
    cachedReduced = typeof window !== 'undefined'
      && typeof window.matchMedia === 'function'
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  }
  return cachedReduced
}

// 轻点反馈：主按钮、收藏、开关等成功操作时调用。
export function lightHaptic(enabled: boolean): void {
  if (!enabled || readReducedMotion()) return
  lightHapticNow()
}

// 最轻反馈（仅用于明确的用户主动操作）。
export function lightHapticNow(): void {
  try {
    const nav = navigator as Navigator & { vibrate?: (pattern: number | number[]) => boolean }
    if (typeof nav.vibrate === 'function') nav.vibrate(8)
  } catch {
    /* 不支持振动的环境静默忽略 */
  }
}

// 系统减少动态效果状态变化时同步缓存（尊重运行中途切换）。
export function watchReducedMotion(): () => void {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return () => undefined
  const query = window.matchMedia('(prefers-reduced-motion: reduce)')
  const onChange = () => { cachedReduced = query.matches }
  query.addEventListener('change', onChange)
  return () => query.removeEventListener('change', onChange)
}
