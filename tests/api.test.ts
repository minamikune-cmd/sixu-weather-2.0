// 数据可靠性测试：超时、429、5xx、断网、网络异常等错误路径的文案与行为。
// 通过替换 globalThis.fetch / navigator.onLine 模拟各类失败，不发起真实网络请求。
import { test, equal, assert } from './harness'
import { fetchJson } from '../src/services/weather/api'

function mockFetch(handler: (url: string, init?: RequestInit) => Promise<Response> | Response) {
  const original = globalThis.fetch
  globalThis.fetch = ((url: unknown, init?: RequestInit) => handler(String(url), init)) as typeof fetch
  return () => { globalThis.fetch = original }
}

// 模拟浏览器行为：请求被 abort 时 reject AbortError（永不自行完成）。
function pendingFetch(_url: string, init?: RequestInit): Promise<Response> {
  return new Promise<Response>((_resolve, reject) => {
    init?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true })
  })
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function setOnline(online: boolean): () => void {
  const original = navigator.onLine
  Object.defineProperty(navigator, 'onLine', { value: online, configurable: true })
  return () => Object.defineProperty(navigator, 'onLine', { value: original, configurable: true })
}

export async function runApiTests(): Promise<void> {
  await test('成功响应解析 JSON', async () => {
    const restore = mockFetch(() => jsonResponse(200, { ok: true, value: 42 }))
    try {
      const data = await fetchJson<{ value: number }>('https://example.test/x', 1000)
      equal(data.value, 42, '应解析返回体')
    } finally { restore() }
  })

  await test('429 限流提示', async () => {
    const restore = mockFetch(() => jsonResponse(429, {}))
    try {
      await fetchJson('https://example.test/x', 1000)
      assert(false, '应抛出错误')
    } catch (error) {
      assert(error instanceof Error && error.message.includes('请求较频繁'), '429 应提示请求较频繁')
    } finally { restore() }
  })

  await test('5xx 服务不可用提示含状态码', async () => {
    const restore = mockFetch(() => jsonResponse(503, {}))
    try {
      await fetchJson('https://example.test/x', 1000)
      assert(false, '应抛出错误')
    } catch (error) {
      assert(error instanceof Error && error.message.includes('503'), '错误文案应含状态码 503')
    } finally { restore() }
  })

  await test('网络 TypeError 且在线：提示网络连接异常', async () => {
    const restore = mockFetch(() => Promise.reject(new TypeError('fetch failed')))
    const restoreOnline = setOnline(true)
    try {
      await fetchJson('https://example.test/x', 1000)
      assert(false, '应抛出错误')
    } catch (error) {
      assert(error instanceof Error && error.message.includes('网络连接异常'), '在线时 TypeError 映射为网络连接异常')
    } finally { restore(); restoreOnline() }
  })

  await test('网络 TypeError 且离线：提示使用缓存', async () => {
    const restore = mockFetch(() => Promise.reject(new TypeError('fetch failed')))
    const restoreOnline = setOnline(false)
    try {
      await fetchJson('https://example.test/x', 1000)
      assert(false, '应抛出错误')
    } catch (error) {
      assert(error instanceof Error && error.message.includes('缓存'), '离线时提示回退缓存')
    } finally { restore(); restoreOnline() }
  })

  await test('请求超时：AbortError 映射为超时提示', async () => {
    // fetch 永不自行完成，仅在 abort 时 reject（与浏览器一致）。
    const restore = mockFetch(pendingFetch)
    try {
      await fetchJson('https://example.test/x', 80)
      assert(false, '应抛出错误')
    } catch (error) {
      assert(error instanceof Error && error.message.includes('请求超时'), '应提示请求超时')
    } finally { restore() }
  })

  await test('外部 AbortSignal 取消时按超时处理并快速返回', async () => {
    const restore = mockFetch(pendingFetch)
    const controller = new AbortController()
    const startedAt = Date.now()
    setTimeout(() => controller.abort(), 10) // 外部取消，远早于 5s 内部超时
    try {
      await fetchJson('https://example.test/x', 5000, controller.signal)
      assert(false, '应抛出错误')
    } catch (error) {
      assert(error instanceof Error && error.message.includes('请求超时'), 'AbortError 统一映射为超时')
      assert(Date.now() - startedAt < 1000, '应在内部超时前快速失败')
    } finally { restore() }
  })
}
