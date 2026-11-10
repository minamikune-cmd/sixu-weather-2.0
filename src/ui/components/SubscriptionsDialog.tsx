// UI 组件层 · 天气订阅管理。
// 订阅城市、通知时间、各类提醒开关与阈值的配置入口；持久化由 domain/subscriptions 完成。
import { useEffect, useState } from 'react'
import { Bell, BellOff, Plus, Trash2, X } from 'lucide-react'
import { createSubscription, removeSubscription, upsertSubscription } from '../../domain/subscriptions'
import { useDialogFocus } from '../../hooks/useDialogFocus'
import {
  getNotificationPermission, notificationsSupported, requestNotificationPermission,
} from '../../platform/notifications'
import type { City } from '../../types/weather'
import type { AlertRuleConfig, Subscription } from '../../types/subscription'

interface Props {
  open: boolean
  subscriptions: Subscription[]
  onChange: (subscriptions: Subscription[]) => void
  onClose: () => void
  // 可作为订阅对象的候选城市：当前城市 + 收藏 + 最近。
  candidates: City[]
}

type Permission = 'granted' | 'denied' | 'default' | 'unsupported'

export default function SubscriptionsDialog({ open, subscriptions, onChange, onClose, candidates }: Props) {
  const dialogRef = useDialogFocus(open, onClose)
  const [permission, setPermission] = useState<Permission>('default')

  useEffect(() => {
    if (open && notificationsSupported()) void getNotificationPermission().then(setPermission)
  }, [open])

  if (!open) return null

  const update = (next: Subscription) => onChange(upsertSubscription(subscriptions, next))
  const remove = (id: string) => onChange(removeSubscription(subscriptions, id))
  const subscribedIds = new Set(subscriptions.map((item) => item.city.id))
  const addable = candidates.filter((city) => !subscribedIds.has(city.id))

  const requestPermission = async () => {
    if (await requestNotificationPermission()) setPermission('granted')
    else setPermission(await getNotificationPermission())
  }

  return (
    <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <section ref={dialogRef} className="dialog subscriptions-dialog" role="dialog" aria-modal="true" aria-labelledby="subscriptions-title" tabIndex={-1}>
        <header className="dialog-header">
          <div><span className="section-kicker">SUBSCRIPTIONS</span><h2 id="subscriptions-title">天气提醒订阅</h2></div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="关闭订阅管理"><X size={21} /></button>
        </header>

        {permission !== 'granted' && (
          <div className="permission-banner">
            {permission === 'denied'
              ? <><BellOff size={17} /><span>通知权限已被拒绝，请在浏览器或系统设置中开启后提醒才能送达。</span></>
              : (
                <>
                  <Bell size={17} /><span>开启通知权限后，订阅的提醒才能推送给你。</span>
                  {permission === 'default' && <button type="button" className="secondary-button" onClick={() => void requestPermission()}>开启通知</button>}
                </>
                )}
          </div>
        )}

        {subscriptions.length === 0 && <p className="subscriptions-empty">还没有订阅。添加一个城市，定时接收每日天气与异常提醒。</p>}

        {subscriptions.map((subscription) => (
          <SubscriptionCard
            key={subscription.id}
            subscription={subscription}
            onChange={update}
            onRemove={() => remove(subscription.id)}
          />
        ))}

        {addable.length > 0 && subscriptions.length < 10 && (
          <div className="add-subscription">
            <strong>添加订阅城市</strong>
            <div className="add-candidate-list">
              {addable.map((city) => (
                <button
                  type="button"
                  key={city.id}
                  className="secondary-button"
                  onClick={() => update(createSubscription(city))}
                >
                  <Plus size={15} />{city.name}
                </button>
              ))}
            </div>
          </div>
        )}
        <p className="subscriptions-note">通知按各城市的当地时间发送。网页端需在页面打开时才能送达；Android 安装版由系统调度，应用关闭后仍可收到每日提醒。</p>
      </section>
    </div>
  )
}

function SubscriptionCard({ subscription, onChange, onRemove }: {
  subscription: Subscription
  onChange: (next: Subscription) => void
  onRemove: () => void
}) {
  const rules = subscription.rules
  const patchRules = (patch: Partial<AlertRuleConfig>) => onChange({ ...subscription, rules: { ...rules, ...patch } })

  return (
    <article className="subscription-card">
      <header>
        <div>
          <strong>{subscription.city.name}</strong>
          <span>{subscription.city.admin1 || subscription.city.country || ''}</span>
        </div>
        <div className="subscription-actions">
          <button type="button" role="switch" aria-checked={subscription.enabled} aria-label={`${subscription.enabled ? '关闭' : '开启'}${subscription.city.name}提醒`}
            className={`switch ${subscription.enabled ? 'is-on' : ''}`}
            onClick={() => onChange({ ...subscription, enabled: !subscription.enabled })}>
            <span />
          </button>
          <button type="button" className="icon-button" onClick={onRemove} aria-label={`删除${subscription.city.name}订阅`}><Trash2 size={17} /></button>
        </div>
      </header>

      <label className="subscription-time">
        <span>通知时间（{subscription.city.timezone?.replace(/_/g, ' ') || '当地时间'}）</span>
        <input
          type="time"
          value={subscription.notifyTime}
          onChange={(event) => onChange({ ...subscription, notifyTime: event.target.value || '07:30' })}
        />
      </label>

      <div className="rule-list">
        <RuleSwitch label="每日天气" hint="通知时间发送当日概况" checked={rules.daily} onChange={(v) => patchRules({ daily: v })} />
        <RuleSwitch label="降雨提醒" hint={`12 小时内降水概率达到阈值且确有雨`} checked={rules.rain.enabled}
          onChange={(v) => patchRules({ rain: { ...rules.rain, enabled: v } })}>
          <Threshold suffix="%" min={10} max={100} value={rules.rain.probability}
            onChange={(v) => patchRules({ rain: { ...rules.rain, probability: v } })} disabled={!rules.rain.enabled} />
        </RuleSwitch>
        <RuleSwitch label="暴雨提醒" hint={`持续高降水概率的小时数 ≥ 3`} checked={rules.heavyRain.enabled}
          onChange={(v) => patchRules({ heavyRain: { ...rules.heavyRain, enabled: v } })}>
          <Threshold suffix="%" min={30} max={100} value={rules.heavyRain.probability}
            onChange={(v) => patchRules({ heavyRain: { ...rules.heavyRain, probability: v } })} disabled={!rules.heavyRain.enabled} />
        </RuleSwitch>
        <RuleSwitch label="高温提醒" hint="今日最高气温达到阈值" checked={rules.highTemp.enabled}
          onChange={(v) => patchRules({ highTemp: { ...rules.highTemp, enabled: v } })}>
          <Threshold suffix="°C" min={25} max={45} value={rules.highTemp.threshold}
            onChange={(v) => patchRules({ highTemp: { ...rules.highTemp, threshold: v } })} disabled={!rules.highTemp.enabled} />
        </RuleSwitch>
        <RuleSwitch label="低温提醒" hint="今日最低气温达到阈值" checked={rules.lowTemp.enabled}
          onChange={(v) => patchRules({ lowTemp: { ...rules.lowTemp, enabled: v } })}>
          <Threshold suffix="°C" min={-30} max={15} value={rules.lowTemp.threshold}
            onChange={(v) => patchRules({ lowTemp: { ...rules.lowTemp, threshold: v } })} disabled={!rules.lowTemp.enabled} />
        </RuleSwitch>
        <RuleSwitch label="大风提醒" hint="当前风速达到阈值" checked={rules.wind.enabled}
          onChange={(v) => patchRules({ wind: { ...rules.wind, enabled: v } })}>
          <Threshold suffix="km/h" min={20} max={120} value={rules.wind.threshold}
            onChange={(v) => patchRules({ wind: { ...rules.wind, threshold: v } })} disabled={!rules.wind.enabled} />
        </RuleSwitch>
        <RuleSwitch label="寒潮提醒" hint="明晨最低气温较今日降幅达到阈值" checked={rules.coldWave.enabled}
          onChange={(v) => patchRules({ coldWave: { ...rules.coldWave, enabled: v } })}>
          <Threshold suffix="°C" min={3} max={20} value={rules.coldWave.drop}
            onChange={(v) => patchRules({ coldWave: { ...rules.coldWave, drop: v } })} disabled={!rules.coldWave.enabled} />
        </RuleSwitch>
        <RuleSwitch label="天气预警" hint="基于气象数据推导的雷电、大风等 watch 级提示（数据源不提供官方预警）" checked={rules.alerts} onChange={(v) => patchRules({ alerts: v })} />
      </div>
    </article>
  )
}

function RuleSwitch({ label, hint, checked, onChange, children }: {
  label: string; hint: string; checked: boolean; onChange: (value: boolean) => void; children?: React.ReactNode
}) {
  return (
    <div className={`rule-row ${checked ? 'is-on' : ''}`}>
      <div className="rule-main">
        <div><strong>{label}</strong><span>{hint}</span></div>
        <button type="button" role="switch" aria-checked={checked} aria-label={label} className={`switch ${checked ? 'is-on' : ''}`} onClick={() => onChange(!checked)}><span /></button>
      </div>
      {checked && children}
    </div>
  )
}

function Threshold({ suffix, min, max, value, onChange, disabled }: {
  suffix: string; min: number; max: number; value: number; onChange: (value: number) => void; disabled: boolean
}) {
  return (
    <label className="rule-threshold">
      <input type="range" min={min} max={max} value={value} disabled={disabled}
        onChange={(event) => onChange(Number(event.target.value))} aria-label={`阈值 ${value}${suffix}`} />
      <output>{value}{suffix}</output>
    </label>
  )
}
