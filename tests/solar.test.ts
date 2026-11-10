// 时间与日照逻辑测试：时区、夏令时、跨日期、极地边界。
// 覆盖阶段 4 要求：UTC、本地时区、夏令时、不同经纬度、跨日期、时间格式、API 时间语义。
import { test, equal, assert } from './harness'
import { getCityParts, getLocalMinutes, localTimeFromIso } from '../src/domain/time'
import { getDayPhase, getDayProgress, daylightDuration } from '../src/domain/solar'
import { makeWeather } from './fixtures'

// 北京 2026-06-15T16:20:30Z 的当地时间为 2026-06-16 00:20:30（UTC+8，无夏令时）。
export async function runSolarTests(): Promise<void> {
  await test('UTC 时刻换算为北京当地时间（跨日）', () => {
    const parts = getCityParts('Asia/Shanghai', new Date('2026-06-15T16:20:30Z'))
    equal(parts.year, '2026', '年份应为 2026')
    equal(parts.month, '06', '月份应为 06')
    equal(parts.day, '16', 'UTC 时刻换算后北京已进入次日')
    equal(parts.hour, '00', '小时应为 00')
    equal(parts.minute, '20', '分钟应为 20')
  })

  await test('纽约夏令时（EDT, UTC-4）', () => {
    // 2026-07-15T16:00:00Z → 纽约应为 12:00（夏令时，非 UTC-5）。
    const parts = getCityParts('America/New_York', new Date('2026-07-15T16:00:00Z'))
    equal(parts.hour, '12', '夏令时期间纽约为 UTC-4')
    // 冬季同一 UTC 时刻 → 13:00（EST, UTC-5）。
    const winter = getCityParts('America/New_York', new Date('2026-01-15T16:00:00Z'))
    equal(winter.hour, '11', '冬季纽约为 UTC-5')
  })

  await test('伦敦冬夏令时切换（GMT/BST）', () => {
    const summer = getCityParts('Europe/London', new Date('2026-07-15T11:00:00Z'))
    equal(summer.hour, '12', '夏季伦敦 BST = UTC+1')
    const winter = getCityParts('Europe/London', new Date('2026-01-15T12:00:00Z'))
    equal(winter.hour, '12', '冬季伦敦 GMT = UTC+0')
  })

  await test('API 返回的日出日落是城市本地时间字符串，直接解析不做时区换算', () => {
    // Open-Meteo timezone=auto 时 daily.sunrise 为本地 ISO（如 "2026-06-15T05:30"）。
    equal(localTimeFromIso('2026-06-15T05:30'), '05:30', '本地 ISO 应直接截取 HH:MM')
    equal(localTimeFromIso('2026-06-15T19:45'), '19:45', '日落时间解析')
  })

  await test('daylightDuration 正常日照时长', () => {
    equal(daylightDuration('2026-06-15T05:30', '2026-06-15T19:02'), '13 小时 32 分', '日照时长计算')
  })

  await test('daylightDuration 极夜（日落早于日出）不输出负数', () => {
    equal(daylightDuration('2026-01-15T11:00', '2026-01-15T01:00'), '0 小时 0 分', '负时长应被钳制为 0')
    equal(daylightDuration(undefined, '2026-01-15T01:00'), '暂无数据', '缺数据时应明确提示')
  })

  await test('getDayPhase 清晨/白昼/日暮/夜晚四段', () => {
    const data = makeWeather()
    // 北京日出 05:30、日落 19:45（见 fixtures）。
    // 本地 05:50 → dawn；12:00 → day；19:30 → dusk；23:00 → night。
    const at = (utcHour: number) => new Date(Date.UTC(2026, 5, 14, utcHour))
    // 北京时间 = UTC+8：本地 05:50 = 前一日 21:50Z；本地 12:00 = 04:00Z；本地 19:30 = 11:30Z；本地 23:00 = 15:00Z。
    equal(getDayPhase(data, at(20)), 'night', '日出前 1 小时 30 分（超出 45 分钟窗口）仍为夜晚')
    equal(getDayPhase(data, at(21.9)), 'dawn', '日出后 20 分钟内为晨曦')
    equal(getDayPhase(data, at(4)), 'day', '正午为白昼')
    equal(getDayPhase(data, at(11.6)), 'dusk', '日落前 15 分钟为日暮')
    equal(getDayPhase(data, at(15)), 'night', '日落 3 小时后为夜晚')
  })

  await test('getDayProgress 日出日落之间线性推进', () => {
    const data = makeWeather()
    const sunrise = 5.5 * 60 // 05:30 = 330 分钟
    const sunset = (19 + 45 / 60) * 60 // 19:45 = 1185 分钟
    // 本地 12:00 = 720 分钟 → (720-330)/(1185-330)。
    const date = new Date(Date.UTC(2026, 5, 14, 4, 0, 0)) // 北京 12:00
    const expected = (720 - sunrise) / (sunset - sunrise)
    const actual = getDayProgress(data, date)
    assert(Math.abs(actual - expected) < 0.01, `日照进度应约为 ${expected.toFixed(3)}，实际 ${actual.toFixed(3)}`)
  })

  await test('极地无日出日落数据时回退 isDay', () => {
    const data = makeWeather({
      daily: [{
        date: '2026-06-15', weatherCode: 3, temperatureMax: 2, temperatureMin: -1,
        sunrise: null as unknown as string, sunset: null as unknown as string, uvIndexMax: 2, precipitationProbabilityMax: 0,
      }],
    })
    const day = makeWeather()
    day.current.isDay = true
    equal(getDayPhase({ ...data, current: day.current }), 'day', '极昼按 isDay=1 判为白昼')
    const night = makeWeather()
    night.current.isDay = false
    equal(getDayPhase({ ...data, current: night.current }), 'night', '极夜按 isDay=0 判为夜晚')
  })

  await test('跨日期：城市当地日期与 UTC 日期不一致时选对当天的日出日落', () => {
    // 夏威夷 UTC-10：UTC 6 月 16 日 08:00 = 当地 6 月 15 日 22:00。
    const hawaii = makeWeather({
      timezone: 'Pacific/Honolulu',
      daily: [
        { date: '2026-06-15', weatherCode: 0, temperatureMax: 30, temperatureMin: 22, sunrise: '2026-06-15T05:45', sunset: '2026-06-15T19:05', uvIndexMax: 11, precipitationProbabilityMax: 0 },
        { date: '2026-06-16', weatherCode: 0, temperatureMax: 30, temperatureMin: 22, sunrise: '2026-06-16T05:45', sunset: '2026-06-16T19:05', uvIndexMax: 11, precipitationProbabilityMax: 0 },
      ],
    })
    const parts = getCityParts('Pacific/Honolulu', new Date(Date.UTC(2026, 5, 16, 8, 0, 0)))
    equal(parts.day, '15', 'UTC 16 日时夏威夷仍是 15 日')
    equal(getLocalMinutes('Pacific/Honolulu', new Date(Date.UTC(2026, 5, 16, 8, 0, 0))), 22 * 60, '当地时间 22:00')
    // 22:00 在 19:05 日落之后 → night（若错误使用 16 日的日出日落，22:00 同样 night，
    // 因此再用 day 判定：当地 10:00 = UTC 20:00，位于 05:45~19:05 之间 → day）。
    equal(getDayPhase(hawaii, new Date(Date.UTC(2026, 5, 16, 20, 0, 0))), 'day', '应使用 15 日的日出日落判定白昼')
  })

  await test('时间格式完整性：getCityParts 输出可拼出城市当地日期键', () => {
    const parts = getCityParts('Australia/Sydney', new Date('2026-06-15T16:30:00Z'))
    equal(`${parts.year}-${parts.month}-${parts.day}`, '2026-06-16', '悉尼 UTC+10 已进入次日')
  })
}
