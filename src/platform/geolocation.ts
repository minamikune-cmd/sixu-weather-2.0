// 平台适配层 · 定位。
// Web：navigator.geolocation（要求 HTTPS 安全上下文）。
// Android：@capacitor/geolocation（原生权限弹窗，无需安全上下文限制）。
import { Geolocation } from '@capacitor/geolocation'
import { isNative } from './native'

export interface Coordinates {
  latitude: number
  longitude: number
}

export class GeolocationError extends Error {}

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
      const code = (error as { code?: number; message?: string })?.code
      if (code === 1) throw new GeolocationError('定位权限未开启，你可以手动搜索城市。')
      throw new GeolocationError('暂时无法获取位置，请手动搜索城市。')
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
