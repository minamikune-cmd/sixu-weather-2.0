import { useState } from 'react'
import { BellRing, Check, Copy, RotateCcw, X } from 'lucide-react'
import { DEFAULT_PREFERENCES } from '../../config/preferences'
import { seasonNames } from '../../domain/seasons'
import { useDialogFocus } from '../../hooks/useDialogFocus'
import { lightHaptic } from '../../platform/haptics'
import type { Preferences, Season, VisualStyle } from '../../types/weather'

interface Props {
  open: boolean
  preferences: Preferences
  /** FCM 注册令牌；Web 端或未配置推送时为 null，不展示推送区块。 */
  pushToken: string | null
  onChange: (preferences: Preferences) => void
  onClose: () => void
  onClearData: () => void
}

export default function SettingsDialog({ open, preferences, pushToken, onChange, onClose, onClearData }: Props) {
  const dialogRef = useDialogFocus(open, onClose)
  const [tokenCopied, setTokenCopied] = useState(false)

  if (!open) return null
  const update = <K extends keyof Preferences>(key: K, value: Preferences[K]) => onChange({ ...preferences, [key]: value })

  return (
    <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <section ref={dialogRef} className="dialog settings-dialog" role="dialog" aria-modal="true" aria-labelledby="settings-title" tabIndex={-1}>
        <header className="dialog-header">
          <div><span className="section-kicker">PREFERENCES</span><h2 id="settings-title">让天空合你心意</h2></div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="关闭设置"><X size={21} /></button>
        </header>
        <div className="setting-group">
          <div className="setting-label"><strong>温度单位</strong><span>预报与当前温度同步切换</span></div>
          <div className="segmented-control">
            <button type="button" className={preferences.temperatureUnit === 'c' ? 'active' : ''} onClick={() => update('temperatureUnit', 'c')}>摄氏度 °C</button>
            <button type="button" className={preferences.temperatureUnit === 'f' ? 'active' : ''} onClick={() => update('temperatureUnit', 'f')}>华氏度 °F</button>
          </div>
        </div>
        <div className="setting-group">
          <div className="setting-label"><strong>风速单位</strong><span>气象数据始终按公制请求，本地换算</span></div>
          <div className="segmented-control">
            <button type="button" className={preferences.windUnit === 'kmh' ? 'active' : ''} onClick={() => update('windUnit', 'kmh')}>km/h</button>
            <button type="button" className={preferences.windUnit === 'ms' ? 'active' : ''} onClick={() => update('windUnit', 'ms')}>m/s</button>
          </div>
        </div>
        <div className="setting-group">
          <div className="setting-label"><strong>季节主题</strong><span>自动模式按当地月份与南北半球判断</span></div>
          <div className="season-options">
            {(['auto', 'spring', 'summer', 'autumn', 'winter'] as const).map((season) => (
              <button type="button" key={season} className={`season-option ${season} ${preferences.season === season ? 'active' : ''}`} onClick={() => update('season', season)} aria-pressed={preferences.season === season}>
                <span className="season-swatch" />
                {season === 'auto' ? '自动' : seasonNames[season as Season]}
                {preferences.season === season && <Check size={15} />}
              </button>
            ))}
          </div>
        </div>
        <div className="setting-group">
          <div className="setting-label"><strong>视觉风格</strong><span>跟随系统时随设备深浅色自动切换</span></div>
          <div className="segmented-control four">
            {([['scene', '跟随场景'], ['system', '跟随系统'], ['light', '浅色'], ['dark', '深色']] as [VisualStyle, string][]).map(([value, label]) => (
              <button type="button" key={value} className={preferences.visualStyle === value ? 'active' : ''} onClick={() => update('visualStyle', value)}>{label}</button>
            ))}
          </div>
        </div>
        <div className="setting-row">
          <div><strong>环境动画</strong><span>关闭后保留静态场景；系统减少动态效果设置优先</span></div>
          <button type="button" role="switch" aria-checked={preferences.animations} className={`switch ${preferences.animations ? 'is-on' : ''}`} onClick={() => update('animations', !preferences.animations)}><span /></button>
        </div>
        <div className="setting-row">
          <div><strong>触觉反馈</strong><span>Android 设备上操作时轻微振动；桌面端无效果</span></div>
          <button type="button" role="switch" aria-checked={preferences.haptics} className={`switch ${preferences.haptics ? 'is-on' : ''}`} onClick={() => { update('haptics', !preferences.haptics); lightHaptic(!preferences.haptics) }}><span /></button>
        </div>
        {pushToken && (
          <div className="setting-group">
            <div className="setting-label"><strong>远程推送令牌</strong><span>FCM 注册令牌，复制后供自建推送后端向本设备下发预警</span></div>
            <div className="push-token-row">
              <code>{`${pushToken.slice(0, 18)}…${pushToken.slice(-6)}`}</code>
              <button type="button" className="text-button" onClick={() => {
                void navigator.clipboard?.writeText(pushToken)
                setTokenCopied(true)
                window.setTimeout(() => setTokenCopied(false), 2000)
              }}>{tokenCopied ? <Check size={15} /> : <Copy size={15} />}{tokenCopied ? '已复制' : '复制'}</button>
            </div>
          </div>
        )}
        <div className="storage-note">
          <strong>本地存储说明</strong>
          <p>城市、收藏、最近访问、偏好及最近天气缓存仅保存在当前设备，不会跨设备同步。清除应用数据会将其删除。</p>
          <p className="privacy-small"><BellRing size={13} />通知在设备本地评估与调度；官方预警来自中央气象台公开接口；远程推送经 FCM，不含位置历史。</p>
          <div className="settings-actions">
            <button type="button" className="text-button" onClick={() => onChange(DEFAULT_PREFERENCES)}><RotateCcw size={15} />恢复默认偏好</button>
            <button type="button" className="text-button danger" onClick={onClearData}>清除本地数据</button>
          </div>
        </div>
      </section>
    </div>
  )
}
