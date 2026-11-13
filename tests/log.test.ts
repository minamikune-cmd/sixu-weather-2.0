// 安全日志测试：describeError 只提取原始类型字段，绝不序列化嵌套对象（可能含坐标/令牌）。
import { test, equal, assert } from './harness'
import { describeError, logError } from '../src/platform/log'

export async function runLogTests(): Promise<void> {
  await test('Error 对象：输出 name 与 message', async () => {
    const text = describeError(new TypeError('fetch failed'))
    assert(text.includes('name=TypeError'), '应含错误名')
    assert(text.includes('message=fetch failed'), '应含错误信息')
  })

  await test('带数字 code 的 Error：附加 code 字段', async () => {
    const error = new Error('denied') as Error & { code: number }
    error.code = 1
    const text = describeError(error)
    assert(text.includes('code=1'), '应含数字错误码')
  })

  await test('插件风格 plain object：只取 name/code/message，丢弃嵌套对象', async () => {
    const text = describeError({
      code: 'OS-PLUG-GLOC-0003',
      message: 'permission denied',
      coords: { latitude: 39.9042, longitude: 116.4074 }, // 敏感：不得进日志
      token: 'fcm-token-xxx', // 敏感：不得进日志
    })
    assert(text.includes('code=OS-PLUG-GLOC-0003'), '应含字符串错误码')
    assert(text.includes('message=permission denied'), '应含 message')
    assert(!text.includes('39.9042') && !text.includes('116.4074'), '坐标不得出现在日志中')
    assert(!text.includes('fcm-token-xxx'), '令牌不得出现在日志中')
  })

  await test('无可提取字段的对象：输出占位符而非 [object Object]', async () => {
    const text = describeError({ data: { nested: true } })
    equal(text, '[非 Error 对象，已省略]', '无原始字段时应输出占位符')
  })

  await test('原始值直接字符串化', async () => {
    equal(describeError('plain string'), 'plain string', '字符串原样输出')
    equal(describeError(42), '42', '数字原样输出')
    equal(describeError(null), 'null', 'null 安全处理')
  })

  await test('logError：带标签输出并返回描述串', async () => {
    const errors: string[] = []
    const original = console.error
    console.error = (...args: unknown[]) => { errors.push(args.map(String).join(' ')) }
    try {
      const text = logError('geolocation', new Error('boom'))
      equal(errors.length, 1, '应输出一条日志')
      assert(errors[0].includes('[geolocation]'), '日志应带标签前缀')
      assert(errors[0].includes('message=boom'), '日志应含脱敏描述')
      assert(text.includes('message=boom'), '返回值应与日志内容一致')
    } finally { console.error = original }
  })
}
