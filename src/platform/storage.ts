// 平台适配层 · 持久化存储。
// Web：localStorage，同步读写（保持 1.0 行为）。
// Android：@capacitor/preferences（原生持久化，避免 WebView localStorage 被回收），
// 启动时把已知键预热进内存，业务层仍使用同步 API。
import { Preferences } from '@capacitor/preferences'
import { isNative } from './native'

const memory = new Map<string, string>()

export async function initStorage(): Promise<void> {
  if (!isNative) return
  // 原生端预热全部已持久化的键；业务层读操作命中内存，写操作双写内存与 Preferences。
  const { keys } = await Preferences.keys()
  const pairs = await Promise.all(keys.map(async (key) => ({ key, value: (await Preferences.get({ key })).value })))
  for (const { key, value } of pairs) {
    if (value !== null) memory.set(key, value)
  }
}

export function readStorage(key: string): string | null {
  if (isNative) return memory.get(key) ?? null
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

export function writeStorage(key: string, value: string): void {
  if (isNative) {
    memory.set(key, value)
    void Preferences.set({ key, value }).catch(() => { /* 存储失败不影响当前会话 */ })
    return
  }
  try {
    localStorage.setItem(key, value)
  } catch {
    // 隐私模式等场景下静默失败，应用仍可运行。
  }
}

export function removeStorage(key: string): void {
  if (isNative) {
    memory.delete(key)
    void Preferences.remove({ key }).catch(() => { /* 忽略 */ })
    return
  }
  try {
    localStorage.removeItem(key)
  } catch {
    // 忽略
  }
}
