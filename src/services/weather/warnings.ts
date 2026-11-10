// 官方天气预警服务：中央气象台官网公开接口（方案 B，免费、无需密钥）。
// 接口实测带 Access-Control-Allow-Origin: *，浏览器可直接请求，无需自建代理。
// 全国预警共用一个列表（实测单日约数百条，pageSize=500 一页拉全），
// 因此按“全国列表缓存 + 客户端按城市过滤”设计：一次请求服务所有订阅城市。
import { WARNINGS_KEY } from '../../config/keys'
import { readStorage, writeStorage } from '../../platform/storage'
import type { City } from '../../types/weather'
import type { OfficialWarning, WarningLevel } from '../../types/warning'

const ALARM_URL = 'https://www.nmc.cn/rest/findAlarm?pageNo=1&pageSize=500&signaltype=&signallevel=&province='
const DETAIL_BASE = 'https://www.nmc.cn'
const WARNINGS_TTL = 10 * 60 * 1000
const REQUEST_TIMEOUT = 12 * 1000

// ── 标题解析 ──────────────────────────────────────────────

const TITLE_PATTERN = /^(.+?)发布(.+?)(红色|橙色|黄色|蓝色)预警/

const LEVEL_MAP: Record<string, WarningLevel> = {
  红色: 'red', 橙色: 'orange', 黄色: 'yellow', 蓝色: 'blue',
}

// 把「北京市气象台发布暴雨蓝色预警信号」解析为结构化预警。
export function parseWarning(raw: { alertid?: string; title?: string; issuetime?: string; url?: string }): OfficialWarning | null {
  if (!raw.alertid || !raw.title) return null
  // 解除中的预警不展示（当前接口实测不返回，这里兜底）。
  if (raw.title.includes('解除')) return null
  const matched = TITLE_PATTERN.exec(raw.title)
  if (!matched) return null
  const [, issuer, type, levelText] = matched
  return {
    id: raw.alertid,
    title: raw.title,
    level: LEVEL_MAP[levelText],
    type,
    issuer,
    issueTime: raw.issuetime ?? '',
    url: raw.url ? DETAIL_BASE + raw.url : DETAIL_BASE,
  }
}

// ── 城市匹配 ──────────────────────────────────────────────

// 去掉行政区划后缀：北京市→北京、广西壮族自治区→广西、内蒙古自治区→内蒙古。
export function stripAdminSuffix(name: string): string {
  return name
    .replace(/(?:维吾尔|壮族|回族)?自治区$/, '')
    .replace(/特别行政区$/, '')
    .replace(/(?:地区|盟|省|市|县|州)+$/, '')
}

// 预警标题包含城市名（市级发布）或省份名（省级发布，覆盖全省）即算命中。
// 城市名通常不带后缀（Open-Meteo 返回「北京」），标题中「北京市」自然包含「北京」。
export function filterWarningsForCity(all: OfficialWarning[], city: City): OfficialWarning[] {
  const keys = [city.name, city.admin1]
    .filter((item): item is string => !!item)
    .map(stripAdminSuffix)
    .filter((item) => item.length >= 2)
  if (keys.length === 0) return []
  return all.filter((warning) => keys.some((key) => warning.title.includes(key)))
}

// ── 排序 ──────────────────────────────────────────────────

const LEVEL_WEIGHT: Record<WarningLevel, number> = { red: 4, orange: 3, yellow: 2, blue: 1 }

// NMC 的 issuetime 是北京时间字符串「2026/11/11 03:12」，按 +08:00 解析，不做本地时区假设。
export function parseIssueTime(issueTime: string): number {
  const normalized = issueTime.trim().replace(/\//g, '-').replace(' ', 'T')
  if (!normalized) return 0
  const withZone = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(normalized) ? `${normalized}:00+08:00` : normalized
  const time = new Date(withZone).getTime()
  return Number.isNaN(time) ? 0 : time
}

// 级别高的在前；同级别按发布时间倒序。
export function sortWarnings(warnings: OfficialWarning[]): OfficialWarning[] {
  return [...warnings].sort(
    (a, b) => LEVEL_WEIGHT[b.level] - LEVEL_WEIGHT[a.level] || parseIssueTime(b.issueTime) - parseIssueTime(a.issueTime),
  )
}

// ── 缓存与请求 ────────────────────────────────────────────

interface WarningListCache {
  list: OfficialWarning[]
  fetchedAt: number
}

let memoryCache: WarningListCache | null = null

function readPersistedCache(): WarningListCache | null {
  if (memoryCache) return memoryCache
  try {
    const raw = readStorage(WARNINGS_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as WarningListCache
    if (!Array.isArray(parsed.list) || typeof parsed.fetchedAt !== 'number') return null
    memoryCache = parsed
    return parsed
  } catch {
    return null
  }
}

function persistCache(cache: WarningListCache): void {
  memoryCache = cache
  try {
    writeStorage(WARNINGS_KEY, JSON.stringify(cache))
  } catch {
    // 存储失败（如隐私模式）不影响本次使用。
  }
}

interface AlarmItem {
  alertid?: string
  title?: string
  issuetime?: string
  url?: string
}

async function fetchWarningList(): Promise<OfficialWarning[]> {
  const response = await fetch(ALARM_URL, {
    signal: AbortSignal.timeout(REQUEST_TIMEOUT),
    headers: { Accept: 'application/json' },
  })
  if (!response.ok) throw new Error(`预警接口返回 ${response.status}`)
  const payload = await response.json() as { code?: number; data?: { page?: { list?: AlarmItem[] } } }
  const items = payload.data?.page?.list
  if (!Array.isArray(items)) throw new Error('预警接口数据结构异常')
  return items
    .map((item) => parseWarning(item))
    .filter((item): item is OfficialWarning => item !== null)
}

export interface WarningsResult {
  warnings: OfficialWarning[]
  /** true 表示本次结果来自缓存（网络失败或缓存未过期）。 */
  fromCache: boolean
}

/** 拉取某城市的官方预警。失败时退回过期缓存；无缓存时返回空列表（不抛出，预警是增强信息，不阻断主流程）。 */
export async function fetchWarnings(city: City): Promise<WarningsResult> {
  const cached = readPersistedCache()
  if (cached && Date.now() - cached.fetchedAt < WARNINGS_TTL) {
    return { warnings: sortWarnings(filterWarningsForCity(cached.list, city)), fromCache: true }
  }
  try {
    const list = await fetchWarningList()
    persistCache({ list, fetchedAt: Date.now() })
    return { warnings: sortWarnings(filterWarningsForCity(list, city)), fromCache: false }
  } catch {
    if (cached) return { warnings: sortWarnings(filterWarningsForCity(cached.list, city)), fromCache: true }
    return { warnings: [], fromCache: false }
  }
}

/** 同步读取缓存并过滤（供 hook 首帧立即渲染，避免闪烁）。 */
export function readCachedWarnings(city: City): OfficialWarning[] {
  const cached = readPersistedCache()
  return cached ? sortWarnings(filterWarningsForCity(cached.list, city)) : []
}

/** 仅测试使用：清空模块级缓存。 */
export function clearWarningsCacheForTest(): void {
  memoryCache = null
}
