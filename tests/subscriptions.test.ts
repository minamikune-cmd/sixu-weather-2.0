// 订阅评估引擎测试：各类规则触发/不触发、禁用、去重键格式。
import { test, equal, assert } from './harness'
import { evaluateSubscription } from '../src/domain/subscriptions'
import { makeWeather, makeSubscription, makeHour } from './fixtures'

export async function runSubscriptionTests(): Promise<void> {
  await test('每日天气摘要候选', () => {
    const candidates = evaluateSubscription(makeSubscription(), makeWeather())
    const daily = candidates.find((candidate) => candidate.title.includes('今日天气'))
    assert(daily, '应生成每日摘要候选')
    equal(daily.level, 'info', '摘要为 info 级')
    assert(/北京/.test(daily.title), '标题含城市名')
    assert(/33/.test(daily.body), '正文含最高气温')
  })

  await test('降雨提醒：概率达标且确有雨时触发', () => {
    const data = makeWeather({
      hourly: Array.from({ length: 24 }, (_, index) =>
        makeHour(index < 6 ? { precipitationProbability: 80, weatherCode: 61 } : {})),
    })
    const candidates = evaluateSubscription(makeSubscription(), data)
    assert(candidates.some((candidate) => candidate.title.includes('降雨')), '应触发降雨提醒')
  })

  await test('降雨提醒：概率达标但无雨时不触发', () => {
    const data = makeWeather({
      hourly: Array.from({ length: 24 }, (_, index) =>
        makeHour(index < 6 ? { precipitationProbability: 90, weatherCode: 1 } : {})),
    })
    const candidates = evaluateSubscription(makeSubscription(), data)
    assert(!candidates.some((candidate) => candidate.title.includes('未来 12 小时有降雨')), '无雨代码时不应触发降雨提醒')
  })

  await test('暴雨提醒：≥3 小时持续高降水概率', () => {
    const data = makeWeather({
      hourly: Array.from({ length: 24 }, (_, index) =>
        makeHour(index < 4 ? { precipitationProbability: 85, weatherCode: 63 } : {})),
    })
    const candidates = evaluateSubscription(makeSubscription(), data)
    const heavy = candidates.find((candidate) => candidate.title.includes('降水概率持续较高'))
    assert(heavy, '应触发暴雨提醒')
    equal(heavy.level, 'warning', '暴雨为 warning 级')
  })

  await test('暴雨提醒：不足 3 小时不触发', () => {
    const data = makeWeather({
      hourly: Array.from({ length: 24 }, (_, index) =>
        makeHour(index < 2 ? { precipitationProbability: 85, weatherCode: 63 } : {})),
    })
    const candidates = evaluateSubscription(makeSubscription(), data)
    assert(!candidates.some((candidate) => candidate.title.includes('持续较高')), '仅 2 小时不满足持续条件')
  })

  await test('高温/低温提醒按自定义阈值触发', () => {
    const sub = makeSubscription()
    sub.rules.highTemp = { enabled: true, threshold: 30 }
    sub.rules.lowTemp = { enabled: true, threshold: 25 }
    const candidates = evaluateSubscription(sub, makeWeather())
    assert(candidates.some((candidate) => candidate.title.includes('高温')), '最高 33°C 超阈值 30 应触发')
    assert(candidates.some((candidate) => candidate.title.includes('低温')), '最低 20°C 低于阈值 25 应触发')
    // 阈值调高后不触发。
    sub.rules.highTemp = { enabled: true, threshold: 35 }
    sub.rules.lowTemp = { enabled: true, threshold: 0 }
    const none = evaluateSubscription(sub, makeWeather())
    assert(!none.some((candidate) => candidate.title.includes('高温提醒')), '阈值 35 时 33°C 不触发')
    assert(!none.some((candidate) => candidate.title.includes('低温提醒')), '阈值 0 时 20°C 不触发')
  })

  await test('大风提醒按当前风速阈值触发', () => {
    const sub = makeSubscription()
    sub.rules.wind = { enabled: true, threshold: 10 }
    const candidates = evaluateSubscription(sub, makeWeather())
    assert(candidates.some((candidate) => candidate.title.includes('大风')), '风速 12 超阈值 10 应触发')
  })

  await test('寒潮提醒：今明最低气温降幅达标触发', () => {
    const data = makeWeather()
    data.daily[1] = { ...data.daily[1], temperatureMin: 10 } // 20°C → 10°C，降幅 10°C
    const sub = makeSubscription()
    sub.rules.coldWave = { enabled: true, drop: 8 }
    const candidates = evaluateSubscription(sub, data)
    const cold = candidates.find((candidate) => candidate.title.includes('寒潮'))
    assert(cold, '降幅 10°C 超阈值 8 应触发寒潮提醒')
    assert(/10/.test(cold.body), '正文含降幅')
  })

  await test('寒潮阈值高于实际降幅时不触发', () => {
    const sub = makeSubscription()
    sub.rules.coldWave = { enabled: true, drop: 12 }
    const candidates = evaluateSubscription(sub, makeWeather())
    assert(!candidates.some((candidate) => candidate.title.includes('寒潮')), '降幅不足不触发')
  })

  await test('官方预警：watch 级数据推导提示（雷电）', () => {
    const data = makeWeather()
    data.current.weatherCode = 95
    const candidates = evaluateSubscription(makeSubscription(), data)
    assert(candidates.some((candidate) => candidate.title.includes('雷电')), '雷电天气代码应产生 watch 级提示')
  })

  await test('禁用订阅不产生任何候选', () => {
    const candidates = evaluateSubscription(makeSubscription({ enabled: false }), makeWeather())
    equal(candidates.length, 0, '禁用后候选为空')
  })

  await test('去重键格式：订阅ID:城市当地日期:类型', () => {
    const candidates = evaluateSubscription(makeSubscription(), makeWeather())
    const daily = candidates.find((candidate) => candidate.title.includes('今日天气'))
    assert(daily, '应有每日候选')
    assert(/^sub-test-1:\d{4}-\d{2}-\d{2}:daily$/.test(daily.dedupeKey), `去重键应为 订阅ID:日期:类型，实际 ${daily.dedupeKey}`)
  })
}
