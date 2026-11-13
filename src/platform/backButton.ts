// 平台适配层 · Android 返回键。
// 原生逻辑：优先关闭打开的弹层（设置 > 城市 > 定位说明），否则最小化应用而不是退出，
// 保持天气页面状态。Web 端由浏览器历史负责，这里不做任何事。
import { App } from '@capacitor/app'
import { isNative } from './native'

type BackConsumer = () => boolean

const consumers: BackConsumer[] = []

// 注册一个返回键消费者：返回 true 表示已消费（关闭弹层等），false 表示放行。
// 后注册的优先（弹层总是最后打开的最先关闭）。
export function registerBackConsumer(consumer: BackConsumer): () => void {
  consumers.push(consumer)
  return () => {
    const index = consumers.indexOf(consumer)
    if (index >= 0) consumers.splice(index, 1)
  }
}

export function registerBackHandler(): void {
  if (!isNative) return
  void App.addListener('backButton', () => {
    for (let index = consumers.length - 1; index >= 0; index -= 1) {
      if (consumers[index]()) return
    }
    void App.minimizeApp()
  })
}
