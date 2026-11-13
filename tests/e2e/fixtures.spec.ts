// 时间夹具正确性：时区对齐、跨月/跨年日历递增（纯函数断言，不启动浏览器）。
// 这些用例守护 tests/e2e/fixtures.ts 的日期生成逻辑，防止回归为
// “UTC 字符串 + 手工日期递增”这类依赖执行机器时区、跨月溢出的实现。
import { expect, test } from '@playwright/test'
import { addCalendarDays, buildForecast, shanghaiDateTime } from './fixtures'

const CLEAR = { weatherCode: 0, isDay: 1 as const }

interface ForecastShape {
  current: { time: string }
  hourly: { time: string[] }
  daily: { time: string[]; sunrise: string[]; sunset: string[] }
}

function forecastAt(currentTime: string): ForecastShape {
  return buildForecast(currentTime, CLEAR) as unknown as ForecastShape
}

test.describe('时间夹具 · 时区', () => {
  test('shanghaiDateTime 按 Asia/Shanghai 生成当地时间', () => {
    // 同一时刻：UTC 04:00 = 上海 12:00。
    expect(shanghaiDateTime(Date.parse('2026-11-13T04:00:00Z'))).toBe('2026-11-13T12:00')
    // UTC 与上海不同日：18:00Z 已是次日 02:00（+08:00）。
    expect(shanghaiDateTime(Date.parse('2026-11-13T18:00:00Z'))).toBe('2026-11-14T02:00')
    // 跨年：UTC 12-31 16:30Z → 上海 2027-01-01 00:30（分钟截断到 :00）。
    expect(shanghaiDateTime(Date.parse('2026-12-31T16:30:00Z'))).toBe('2027-01-01T00:00')
  })

  test('addCalendarDays 跨月 / 跨年 / 闰年', () => {
    expect(addCalendarDays('2026-11-30', 1)).toBe('2026-12-01')
    expect(addCalendarDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addCalendarDays('2024-02-28', 1)).toBe('2024-02-29')
    expect(addCalendarDays('2026-01-01', -1)).toBe('2025-12-31')
    expect(addCalendarDays('2026-11-13', 0)).toBe('2026-11-13')
  })
})

test.describe('时间夹具 · 预报日期生成', () => {
  test('跨月：hourly / daily / sunrise / sunset 全部正确翻转', () => {
    const forecast = forecastAt('2026-11-30T22:00')
    const { hourly, daily, current } = forecast

    expect(hourly.time).toHaveLength(168)
    expect(hourly.time[0]).toBe('2026-11-30T00:00')
    expect(hourly.time[23]).toBe('2026-11-30T23:00')
    expect(hourly.time[24]).toBe('2026-12-01T00:00')
    expect(hourly.time[167]).toBe('2026-12-06T23:00')
    // current.time 必须存在于 hourly 序列（App 的 nowIndex 切片依赖此对齐）。
    expect(hourly.time).toContain(current.time)

    expect(daily.time[0]).toBe('2026-11-30')
    expect(daily.time[1]).toBe('2026-12-01')
    expect(daily.time[7]).toBe('2026-12-07')
    expect(forecast.daily.sunrise[0]).toBe('2026-11-30T06:45')
    expect(forecast.daily.sunrise[1]).toBe('2026-12-01T06:45')
    expect(forecast.daily.sunset[7]).toBe('2026-12-07T17:20')
  })

  test('跨年：日期序列进入次年', () => {
    const forecast = forecastAt('2026-12-31T23:00')
    const { hourly, daily, current } = forecast

    expect(hourly.time[23]).toBe('2026-12-31T23:00')
    expect(hourly.time[24]).toBe('2027-01-01T00:00')
    expect(hourly.time).toContain(current.time)

    expect(daily.time[0]).toBe('2026-12-31')
    expect(daily.time[1]).toBe('2027-01-01')
    expect(forecast.daily.sunrise[1]).toBe('2027-01-01T06:45')
    expect(forecast.daily.sunset[2]).toBe('2027-01-02T17:20')
  })
})
