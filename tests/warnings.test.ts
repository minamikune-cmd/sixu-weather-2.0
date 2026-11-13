// 官方天气预警（nmc.cn 公开接口）解析、城市过滤、排序、缓存与订阅集成测试。
import { assert, equal, test } from './harness'
import { BEIJING, makeWeather, makeSubscription } from './fixtures'
import type { City } from '../src/types/weather'
import type { OfficialWarning } from '../src/types/warning'
import {
  clearWarningsCacheForTest, fetchWarnings, filterWarningsForCity,
  parseIssueTime, parseWarning, sortWarnings, stripAdminSuffix,
} from '../src/services/weather/warnings'
import { evaluateSubscription } from '../src/domain/subscriptions'
import { WARNINGS_KEY } from '../src/config/keys'

function makeWarning(partial: Partial<OfficialWarning> = {}): OfficialWarning {
  return {
    id: '11000041600000_20261111080000',
    title: '北京市气象台发布暴雨蓝色预警信号',
    level: 'blue',
    type: '暴雨',
    issuer: '北京市气象台',
    issueTime: '2026/11/11 08:00',
    url: 'https://www.nmc.cn/publish/alarm/11000041600000_20261111080000.html',
    ...partial,
  }
}

const RAW_ITEM = {
  alertid: '21072741600000_20261111031000',
  issuetime: '2026/11/11 03:12',
  title: '辽宁省锦州市义县气象台发布大雾红色预警信号',
  url: '/publish/alarm/21072741600000_20261111031000.html',
}

function mockFetch(payload: unknown, failWith?: Error): { calls: number } {
  const state = { calls: 0 }
  globalThis.fetch = (() => {
    state.calls += 1
    if (failWith) return Promise.reject(failWith)
    return Promise.resolve(new Response(JSON.stringify(payload)))
  }) as typeof fetch
  return state
}

export async function runWarningTests(): Promise<void> {
  // ── 标题解析 ──
  await test('parseWarning：解析标题/级别/类型/发布单位/链接', () => {
    const warning = parseWarning(RAW_ITEM)
    assert(warning, '应解析成功')
    equal(warning.level, 'red', '级别应为红色')
    equal(warning.type, '大雾', '类型应为大雾')
    equal(warning.issuer, '辽宁省锦州市义县气象台', '发布单位')
    equal(warning.url, 'https://www.nmc.cn/publish/alarm/21072741600000_20261111031000.html', '详情链接补全域名')
  })

  await test('parseWarning：联合发布单位与「其它」类预警', () => {
    const warning = parseWarning({
      alertid: 'a1', issuetime: '2026/11/10 20:50',
      title: '吉林省森林草原防灭火指挥部办公室和吉林省气象台发布森林火险黄色预警',
    })
    assert(warning, '应解析成功')
    equal(warning.level, 'yellow', '级别应为黄色')
    equal(warning.type, '森林火险', '类型应为森林火险')
  })

  await test('parseWarning：解除/缺字段/不匹配返回 null', () => {
    equal(parseWarning({ alertid: 'a', title: '北京市气象台解除暴雨蓝色预警信号' }), null, '解除预警不展示')
    equal(parseWarning({ title: '无 id' }), null, '缺 alertid 返回 null')
    equal(parseWarning({ alertid: 'a', title: '无法解析的标题' }), null, '不匹配返回 null')
  })

  // ── 行政区划后缀 ──
  await test('stripAdminSuffix：省/市/自治区/特别行政区', () => {
    equal(stripAdminSuffix('北京市'), '北京', '市后缀')
    equal(stripAdminSuffix('江苏省'), '江苏', '省后缀')
    equal(stripAdminSuffix('广西壮族自治区'), '广西', '自治区后缀')
    equal(stripAdminSuffix('香港特别行政区'), '香港', '特别行政区后缀')
    equal(stripAdminSuffix('北京'), '北京', '无后缀不变')
  })

  // ── 城市过滤 ──
  await test('filterWarningsForCity：市级命中 / 省级命中 / 不命中', () => {
    const beijingCity = makeWarning()
    const hebeiCity = makeWarning({ id: '2', title: '河北省气象台发布大风黄色预警信号', type: '大风', level: 'yellow' })
    const list = [beijingCity, hebeiCity]
    equal(filterWarningsForCity(list, BEIJING).length, 1, '北京命中市级预警')
    const shijiazhuang: City = { id: 'sjz', name: '石家庄', admin1: '河北省', latitude: 38, longitude: 114.5 }
    equal(filterWarningsForCity(list, shijiazhuang).length, 1, '石家庄命中省级预警（河北省气象台）')
    const shanghai: City = { id: 'sh', name: '上海', latitude: 31.2, longitude: 121.5 }
    equal(filterWarningsForCity(list, shanghai).length, 0, '上海不命中')
  })

  // ── 排序 ──
  await test('sortWarnings：级别优先，同级按发布时间倒序', () => {
    const blue = makeWarning({ level: 'blue' })
    const redOld = makeWarning({ id: 'r1', level: 'red', issueTime: '2026/11/10 08:00' })
    const redNew = makeWarning({ id: 'r2', level: 'red', issueTime: '2026/11/11 08:00' })
    const sorted = sortWarnings([blue, redOld, redNew])
    equal(sorted[0].id, 'r2', '最新红色在前')
    equal(sorted[1].id, 'r1', '较旧红色其次')
    equal(sorted[2].id, blue.id, '蓝色最后')
  })

  await test('parseIssueTime：按北京时间（+08:00）解析，与服务器时区无关', () => {
    // 2026/11/11 03:12 北京时间 = 2026-11-10T19:12:00Z
    equal(parseIssueTime('2026/11/11 03:12'), Date.parse('2026-11-10T19:12:00Z'), '北京时间解析')
    equal(parseIssueTime(''), 0, '空串返回 0')
  })

  // ── fetchWarnings：请求 / 缓存 / 失败兜底 ──
  await test('fetchWarnings：拉取→解析→过滤→持久化', async () => {
    localStorage.clear()
    clearWarningsCacheForTest()
    const state = mockFetch({ code: 0, data: { page: { list: [RAW_ITEM] } } })
    const result = await fetchWarnings({ ...BEIJING, name: '锦州', admin1: '辽宁省' })
    equal(state.calls, 1, '发起一次请求')
    equal(result.warnings.length, 1, '过滤出锦州预警')
    equal(result.warnings[0].level, 'red', '红色预警')
    equal(result.fromCache, false, '非缓存')
    assert(localStorage.getItem(WARNINGS_KEY)?.includes('大雾'), '已持久化全国列表')

    // 第二次调用命中缓存（未过期），不再请求
    const again = await fetchWarnings({ ...BEIJING, name: '锦州', admin1: '辽宁省' })
    equal(state.calls, 1, '缓存未过期不重复请求')
    equal(again.fromCache, true, '标记来自缓存')
    clearWarningsCacheForTest()
  })

  await test('fetchWarnings：网络失败退回过期缓存', async () => {
    localStorage.clear()
    clearWarningsCacheForTest()
    // 先成功一次写入缓存
    mockFetch({ code: 0, data: { page: { list: [RAW_ITEM] } } })
    await fetchWarnings({ ...BEIJING, name: '锦州', admin1: '辽宁省' })
    // 把持久化缓存改为已过期（2 小时前），并清内存缓存强制走持久化
    const stored = JSON.parse(localStorage.getItem(WARNINGS_KEY) ?? '{}') as { list: unknown[]; fetchedAt: number }
    stored.fetchedAt = Date.now() - 2 * 60 * 60 * 1000
    localStorage.setItem(WARNINGS_KEY, JSON.stringify(stored))
    clearWarningsCacheForTest()
    // 再失败：应退回过期的持久化缓存
    const state = mockFetch(null, new Error('network down'))
    const result = await fetchWarnings({ ...BEIJING, name: '锦州', admin1: '辽宁省' })
    equal(state.calls, 1, '确实发起了请求')
    equal(result.warnings.length, 1, '退回缓存数据')
    equal(result.fromCache, true, '标记来自缓存')
    clearWarningsCacheForTest()
  })

  await test('fetchWarnings：无缓存且失败时返回空列表（不抛出）', async () => {
    localStorage.clear()
    clearWarningsCacheForTest()
    mockFetch(null, new Error('network down'))
    const result = await fetchWarnings(BEIJING)
    equal(result.warnings.length, 0, '返回空列表')
  })

  // ── 订阅引擎集成 ──
  await test('evaluateSubscription：官方预警生成候选（级别映射 + 去重键）', () => {
    const subscription = makeSubscription()
    const weather = makeWeather()
    const orange = makeWarning({ id: 'w-orange', level: 'orange', type: '大风', title: '北京市气象台发布大风橙色预警信号' })
    const blue = makeWarning({ id: 'w-blue', level: 'blue', type: '暴雨' })
    const candidates = evaluateSubscription(subscription, weather, [orange, blue])
    const official = candidates.filter((item) => item.dedupeKey.includes(':official-'))
    equal(official.length, 2, '两条官方预警候选')
    const orangeCandidate = official.find((item) => item.dedupeKey.includes('w-orange'))
    const blueCandidate = official.find((item) => item.dedupeKey.includes('w-blue'))
    equal(orangeCandidate?.level, 'warning', '橙色为 warning')
    equal(blueCandidate?.level, 'info', '蓝色为 info')
    assert(orangeCandidate?.dedupeKey.endsWith(':official-w-orange'), '去重键含预警 id')
    assert(orangeCandidate?.title.includes('大风橙色预警'), '标题含类型与级别')
  })

  await test('evaluateSubscription：官方预警最多 3 条 / alerts 关闭时不生成', () => {
    const subscription = makeSubscription()
    const weather = makeWeather()
    const many = [1, 2, 3, 4, 5].map((n) => makeWarning({ id: `w-${n}` }))
    const candidates = evaluateSubscription(subscription, weather, many)
    equal(candidates.filter((item) => item.dedupeKey.includes(':official-')).length, 3, '最多 3 条')

    const alertsOff = makeSubscription()
    alertsOff.rules = { ...alertsOff.rules, alerts: false }
    const none = evaluateSubscription(alertsOff, weather, many)
    equal(none.filter((item) => item.dedupeKey.includes(':official-')).length, 0, 'alerts 关闭不生成')
  })

  await test('evaluateSubscription：不传官方预警时行为不变（向后兼容）', () => {
    const candidates = evaluateSubscription(makeSubscription(), makeWeather())
    equal(candidates.some((item) => item.dedupeKey.includes(':official-')), false, '无官方候选')
    assert(candidates.some((item) => item.dedupeKey.includes(':daily')), 'daily 候选仍在')
  })
}
