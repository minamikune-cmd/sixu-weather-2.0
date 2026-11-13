// 环境变量校验测试：防止服务端密钥经 VITE_ 前缀注入前端 bundle。
import { test, equal, assert } from './harness'
import { scanEnvForSecrets, validateClientEnv } from '../src/config/env'

export async function runEnvTests(): Promise<void> {
  await test('干净的 env（无 VITE_ 或无不敏感键）返回空', async () => {
    const result = scanEnvForSecrets({ MODE: 'production', BASE_URL: '/x', VITE_APP_NAME: 'sixu' })
    equal(result.suspiciousKeys.length, 0, '常规公开变量不应被标记')
  })

  await test('命名疑似密钥的 VITE_* 变量被检出', async () => {
    const result = scanEnvForSecrets({
      VITE_API_KEY: 'abc',
      VITE_FIREBASE_TOKEN: 'def',
      VITE_APP_SECRET: 'ghi',
      VITE_PRIVATE_KEY: 'jkl',
      VITE_DB_PASSWORD: 'mno',
      VITE_OAUTH_CREDENTIAL: 'pqr',
    })
    equal(result.suspiciousKeys.length, 6, '六个疑似键都应检出')
    assert(result.suspiciousKeys.includes('VITE_API_KEY'), '应含 VITE_API_KEY')
    assert(result.suspiciousKeys.includes('VITE_PRIVATE_KEY'), '应含 VITE_PRIVATE_KEY')
  })

  await test('大小写与分隔符变体同样命中', async () => {
    const result = scanEnvForSecrets({ VITE_apikey: 'x', 'VITE_ACCESS-TOKEN': 'y', VITE_Secret: 'z' })
    equal(result.suspiciousKeys.length, 3, 'apikey / access-token / secret 变体都应命中')
  })

  await test('非 VITE_ 前缀的密钥样式变量不检出（如测试环境变量）', async () => {
    const result = scanEnvForSecrets({ API_KEY: 'server-only', SECRET_TOKEN: 'server-only' })
    equal(result.suspiciousKeys.length, 0, '未注入前端的变量不在扫描范围')
  })

  await test('validateClientEnv：干净 env 返回 true', async () => {
    const warnings: unknown[] = []
    const original = console.warn
    console.warn = (...args: unknown[]) => { warnings.push(args) }
    try {
      const ok = validateClientEnv({ VITE_APP_NAME: 'sixu' })
      assert(ok === true, '干净 env 应返回 true')
      equal(warnings.length, 0, '不应告警')
    } finally { console.warn = original }
  })

  await test('validateClientEnv：疑似密钥时告警、返回 false，日志只含键名不含值', async () => {
    const warnings: string[] = []
    const original = console.warn
    console.warn = (...args: unknown[]) => { warnings.push(String(args[0])) }
    try {
      const ok = validateClientEnv({ VITE_API_KEY: 'SUPER-SECRET-VALUE-123' })
      assert(ok === false, '发现疑似密钥应返回 false')
      equal(warnings.length, 1, '应恰好告警一次')
      assert(warnings[0].includes('VITE_API_KEY'), '日志应含变量名')
      assert(!warnings[0].includes('SUPER-SECRET-VALUE-123'), '日志绝不得泄露变量值')
    } finally { console.warn = original }
  })
}
