// 平台适配层 · 安全日志。
// 统一的错误日志出口：只提取错误的原始类型字段（name / code / message 等字符串与数字），
// 绝不序列化整个错误对象——插件或 SDK 抛出的对象可能携带坐标、令牌等敏感载荷，
// 直接 console.error(error) 会把它们写进浏览器控制台 / adb logcat。
// 规则：进日志的只有标签 + 原始类型字段；对象、数组、嵌套结构一律以占位符代替。

const PRIMITIVE_KEYS = ['name', 'code', 'message'] as const

// 把任意未知错误折叠成安全的描述字符串（无嵌套对象、无用户数据）。
export function describeError(error: unknown): string {
  if (error instanceof Error) {
    const fields: string[] = [`name=${error.name}`, `message=${error.message}`]
    const code = (error as { code?: unknown }).code
    if (typeof code === 'string' || typeof code === 'number') fields.push(`code=${String(code)}`)
    return fields.join(' ')
  }
  if (error !== null && typeof error === 'object') {
    // 非 Error 对象（插件常抛 plain object）：只挑原始类型字段。
    const record = error as Record<string, unknown>
    const fields = PRIMITIVE_KEYS
      .filter((key) => typeof record[key] === 'string' || typeof record[key] === 'number')
      .map((key) => `${key}=${String(record[key])}`)
    return fields.length > 0 ? fields.join(' ') : '[非 Error 对象，已省略]'
  }
  return String(error)
}

// 输出一条脱敏错误日志。返回描述串，便于调用方在 UI 上复用同一文本。
export function logError(tag: string, error: unknown): string {
  const description = describeError(error)
  console.error(`[${tag}] ${description}`)
  return description
}
