// 用户配置层 · 客户端环境变量校验。
// 设计前提：2.0 的所有数据源（Open-Meteo / BigDataCloud / 中央气象台）均为免密钥公开 GET，
// 客户端不需要、也绝不允许携带任何服务端密钥；签名材料只存在于 CI Secrets 与本机 keystore。
// 该模块在启动时扫描注入客户端的公开变量（VITE_*），若发现命名疑似密钥（key/token/secret 等）
// 即在控制台告警，防止将来某个阶段误把服务端密钥经 VITE_ 前缀注入前端 bundle。
// 纯函数实现，便于测试；不读取 process.env（浏览器端不存在）。

// 与常见密钥命名惯例匹配的片段（大小写不敏感）。
const SECRET_NAME_PATTERN = /(secret|token|api[_-]?key|private[_-]?key|password|credential)/i

export interface EnvScanResult {
  /** 命名疑似密钥的 VITE_* 变量名（已排序，便于稳定输出）。 */
  suspiciousKeys: string[]
}

// 扫描一份环境变量表（通常为 import.meta.env），返回疑似密钥的键名。
// 仅看键名、不看值——值可能是任意用户配置，键名才是"是否密钥"的信号。
export function scanEnvForSecrets(env: Record<string, unknown>): EnvScanResult {
  const suspiciousKeys = Object.keys(env)
    .filter((key) => key.startsWith('VITE_') && SECRET_NAME_PATTERN.test(key))
    .sort()
  return { suspiciousKeys }
}

// 启动时调用一次。发现疑似密钥时告警并返回 false（不阻断启动，避免极端情况下锁死用户）；
// 干净时静默返回 true。日志只输出键名，绝不输出任何值。
export function validateClientEnv(env: Record<string, unknown>): boolean {
  const { suspiciousKeys } = scanEnvForSecrets(env)
  if (suspiciousKeys.length === 0) return true
  console.warn(
    `[config] 检测到命名疑似密钥的客户端环境变量：${suspiciousKeys.join(', ')}。`
    + '服务端密钥不得注入前端，请改用环境变量 + 后端代理。',
  )
  return false
}
