// 空气质量分级测试：六档边界与首要污染物。
import { test, equal } from './harness'
import { aqiLevel, primaryPollutant } from '../src/domain/air'

export async function runAirTests(): Promise<void> {
  await test('AQI 六档边界', () => {
    equal(aqiLevel(0).level, 'good', '0 为优')
    equal(aqiLevel(50).level, 'good', '50 仍为优')
    equal(aqiLevel(51).level, 'moderate', '51 为良')
    equal(aqiLevel(100).level, 'moderate', '100 仍为良')
    equal(aqiLevel(101).level, 'usg', '101 为轻度污染（敏感人群）')
    equal(aqiLevel(150).level, 'usg', '150 仍为轻度污染')
    equal(aqiLevel(151).level, 'unhealthy', '151 为中度污染')
    equal(aqiLevel(200).level, 'unhealthy', '200 仍为中度污染')
    equal(aqiLevel(201).level, 'very-unhealthy', '201 为重度污染')
    equal(aqiLevel(300).level, 'very-unhealthy', '300 仍为重度污染')
    equal(aqiLevel(301).level, 'hazardous', '301 为严重污染')
  })

  await test('首要污染物按占分级上限比例最高者', () => {
    // PM2.5 20/250=8%，PM10 40/420≈9.5%，O3 90/400=22.5% → 臭氧。
    equal(primaryPollutant({ pm25: 20, pm10: 40, ozone: 90, nitrogenDioxide: 15, sulphurDioxide: 5, carbonMonoxide: 300 }), '臭氧', '臭氧占比最高')
    equal(primaryPollutant({ pm25: 90, pm10: 45, ozone: 60, nitrogenDioxide: 10, sulphurDioxide: 4, carbonMonoxide: 200 }), 'PM2.5', 'PM2.5 占比最高')
    equal(primaryPollutant({ pm25: null, pm10: null, ozone: null, nitrogenDioxide: null, sulphurDioxide: null, carbonMonoxide: null }), null, '全缺数据时返回 null')
  })
}
