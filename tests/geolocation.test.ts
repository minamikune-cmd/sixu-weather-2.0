// 定位平台层：原生错误码 → 中文提示映射（@capacitor/geolocation v8 字符串码 + 旧版数字码）。
import { test, assert, equal } from './harness'
import { messageForNativeError } from '../src/platform/geolocation'

export function runGeolocationTests(): Promise<void> {
  test('v8 字符串码逐码映射', () => {
    equal(messageForNativeError('OS-PLUG-GLOC-0003'), '定位权限未开启，你可以手动搜索城市。', '0003 应为权限提示')
    equal(messageForNativeError('OS-PLUG-GLOC-0007'), '系统「位置信息」开关未开启，打开后重试即可。', '0007 应为系统开关提示')
    assert(messageForNativeError('OS-PLUG-GLOC-0010')?.includes('超时'), '0010 应为超时提示')
    assert(messageForNativeError('OS-PLUG-GLOC-0015')?.includes('Google 服务'), '0015 应为 Google 服务提示')
    assert(messageForNativeError('OS-PLUG-GLOC-0017')?.includes('网络'), '0017 应为网络+定位提示')
  })

  test('旧版数字码 1 映射为权限提示', () => {
    equal(messageForNativeError(1), '定位权限未开启，你可以手动搜索城市。', '数字码 1 兼容')
  })

  test('未知码与空码返回 undefined（由调用方给兜底文案）', () => {
    equal(messageForNativeError('OS-PLUG-GLOC-9999'), undefined, '未知字符串码')
    equal(messageForNativeError(2), undefined, '未知数字码')
    equal(messageForNativeError(undefined), undefined, '空码')
  })

  return Promise.resolve()
}
