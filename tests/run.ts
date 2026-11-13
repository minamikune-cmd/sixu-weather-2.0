// 测试入口：先打桩浏览器全局对象（localStorage / window / navigator），
// 再动态导入各测试模块（模块顶层 import 会在打桩前执行，故必须用动态导入）。
// 运行：node_modules/.bin/esbuild tests/run.ts --bundle --platform=node --format=cjs --outfile=/tmp/sixu-tests.cjs && node /tmp/sixu-tests.cjs

// localStorage 最小内存实现。
const memoryStore = new Map<string, string>()
Object.defineProperty(globalThis, 'localStorage', {
  value: {
    getItem: (key: string) => memoryStore.get(key) ?? null,
    setItem: (key: string, value: string) => { memoryStore.set(key, String(value)) },
    removeItem: (key: string) => { memoryStore.delete(key) },
    clear: () => memoryStore.clear(),
    key: (index: number) => [...memoryStore.keys()][index] ?? null,
    get length() { return memoryStore.size },
  },
  configurable: true,
})

// fetchJson 依赖 window.setTimeout / clearTimeout。
Object.defineProperty(globalThis, 'window', {
  value: {
    setTimeout: globalThis.setTimeout,
    clearTimeout: globalThis.clearTimeout,
    addEventListener: () => {},
    removeEventListener: () => {},
  },
  configurable: true,
})

if (!('onLine' in navigator)) {
  Object.defineProperty(globalThis, 'navigator', { value: { onLine: true }, configurable: true })
}

async function main(): Promise<void> {
  console.log('■ 时间与日照逻辑（时区 / 夏令时 / 跨日期）')
  await import('./solar.test').then((module) => module.runSolarTests()).then(() => import('./harness').then((h) => h.summary('时间与日照')))
  console.log('■ 空气质量分级')
  await import('./air.test').then((module) => module.runAirTests()).then(() => import('./harness').then((h) => h.summary('空气质量')))
  console.log('■ 订阅评估引擎')
  await import('./subscriptions.test').then((module) => module.runSubscriptionTests()).then(() => import('./harness').then((h) => h.summary('订阅引擎')))
  console.log('■ 官方天气预警（解析/过滤/缓存/订阅集成）')
  await import('./warnings.test').then((module) => module.runWarningTests()).then(() => import('./harness').then((h) => h.summary('官方预警')))
  console.log('■ 数据可靠性（错误路径）')
  await import('./api.test').then((module) => module.runApiTests()).then(() => import('./harness').then((h) => h.summary('数据可靠性')))
  console.log('■ 有界重试策略（瞬时故障/取消/限流边界）')
  await import('./api.test').then((module) => module.runApiRetryTests()).then(() => import('./harness').then((h) => h.summary('有界重试')))
  console.log('■ 环境变量校验（防密钥注入）')
  await import('./env.test').then((module) => module.runEnvTests()).then(() => import('./harness').then((h) => h.summary('环境变量校验')))
  console.log('■ 安全日志（错误脱敏）')
  await import('./log.test').then((module) => module.runLogTests()).then(() => import('./harness').then((h) => h.summary('安全日志')))
  console.log('■ 定位平台层（原生错误码映射）')
  await import('./geolocation.test').then((module) => module.runGeolocationTests()).then(() => import('./harness').then((h) => h.summary('定位平台层')))
  if (process.exitCode === 1) console.error('\n存在失败用例')
  else console.log('\n全部测试通过')
}

void main()
