// 平台适配层 · 网络状态。
// Web：navigator.onLine + online/offline 事件。
// Android：@capacitor/network（原生连接状态回调）。
import { Network } from '@capacitor/network'
import { isNative } from './native'

export type NetworkListener = (online: boolean) => void

const listeners = new Set<NetworkListener>()
let webBound = false

function notify(online: boolean) {
  listeners.forEach((listener) => listener(online))
}

export async function isOnline(): Promise<boolean> {
  if (isNative) {
    const status = await Network.getStatus()
    return status.connected
  }
  return navigator.onLine
}

// 返回取消订阅函数。重复调用是安全的（Web 事件只绑定一次）。
export function onNetworkChange(listener: NetworkListener): () => void {
  listeners.add(listener)
  if (isNative) {
    const handle = Network.addListener('networkStatusChange', (status) => {
      notify(status.connected)
    })
    return () => {
      listeners.delete(listener)
      void handle.then((h) => h.remove())
    }
  }
  if (!webBound) {
    webBound = true
    window.addEventListener('online', () => notify(true))
    window.addEventListener('offline', () => notify(false))
  }
  return () => listeners.delete(listener)
}
