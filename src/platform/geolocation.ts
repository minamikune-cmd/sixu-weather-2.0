// 平台适配层 · 定位。
// Web：navigator.geolocation（要求 HTTPS 安全上下文）。
// Android：@capacitor/geolocation（原生权限弹窗，无需安全上下文限制）。
import { Geolocation } from '@capacitor/geolocation'
import { isNative } from './native'
import { logError } from './log'

export interface Coordinates {
  latitude: number
  longitude: number
}

export class GeolocationError extends Error {}

// @capacitor/geolocation v8 起原生侧使用字符串错误码（OS-PLUG-GLOC-xxxx，定义于
// GeolocationErrors.kt）；更早版本为数字码（1 = PERMISSION_DENIED）。逐码映射为可操作的中文提示。
const NATIVE_ERROR_MESSAGES: Record<string, string> = {
  'OS-PLUG-GLOC-0002': '暂时无法获取位置，请移动到开阔处重试，或手动搜索城市。',
  'OS-PLUG-GLOC-0003': '定位权限未开启，你可以手动搜索城市。',
  'OS-PLUG-GLOC-0007': '系统「位置信息」开关未开启，打开后重试即可。',
  'OS-PLUG-GLOC-0009': '已拒绝开启定位的请求，请在系统设置中打开「位置信息」后重试。',
  'OS-PLUG-GLOC-0010': '定位超时：当前位置信号较弱，请到开阔处重试，或手动搜索城市。',
  'OS-PLUG-GLOC-0014': 'Google 服务异常（可修复），修复后重试；无 Google 服务的设备请手动搜索城市。',
  'OS-PLUG-GLOC-0015': '设备缺少或过期的 Google 服务，自动定位不可用，请手动搜索城市。',
  'OS-PLUG-GLOC-0016': '系统定位设置不满足要求，请确认已开启「位置信息」（建议高精度模式）。',
  'OS-PLUG-GLOC-0017': '设备已关闭定位和网络连接，开启后重试。',
  'OS-PLUG-GLOC-0018': '应用缺少定位权限声明，请手动搜索城市。',
}

// 供测试与调用方使用：把原生错误码（字符串或旧版数字）映射为中文提示，未知码返回 undefined。
export function messageForNativeError(code: number | string | undefined): string | undefined {
  if (typeof code === 'string') return NATIVE_ERROR_MESSAGES[code]
  if (code === 1) return '定位权限未开启，你可以手动搜索城市。'
  return undefined
}

// 与 1.0 Web 端一致的语义：不支持 / 非 HTTPS / 权限拒绝 / 超时分别给出中文提示。
export async function getCurrentPosition(): Promise<Coordinates> {
  if (isNative) {
    try {
      const position = await Geolocation.getCurrentPosition({
        enableHighAccuracy: false,
        timeout: 10000,
      })
      return { latitude: position.coords.latitude, longitude: position.coords.longitude }
    } catch (error) {
      // 原生失败时把错误码与信息打到 logcat（adb logcat | grep -i "geolocation\|capacitor"）便于真机排查；
      // 经 logError 脱敏，只含 name/code/message 原始字段，不 dump 整个错误对象（可能携带坐标等敏感载荷）。
      logError('geolocation', error)
      const err = error as { code?: number | string; message?: string }
      throw new GeolocationError(
        messageForNativeError(err?.code) ?? '暂时无法获取位置，请手动搜索城市。',
      )
    }
  }

  if (!('geolocation' in navigator)) {
    throw new GeolocationError('此浏览器不支持定位，请手动搜索城市。')
  }
  if (!window.isSecureContext) {
    throw new GeolocationError('定位需要 HTTPS 安全环境，请使用手动搜索。')
  }
  return new Promise<Coordinates>((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (position) => resolve({ latitude: position.coords.latitude, longitude: position.coords.longitude }),
      (geoError) => {
        reject(new GeolocationError(
          geoError.code === geoError.PERMISSION_DENIED
            ? '定位权限未开启，你可以手动搜索城市。'
            : '暂时无法获取位置，请手动搜索城市。',
        ))
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 10 * 60 * 1000 },
    )
  })
}
