// 极简测试工具：无外部依赖，esbuild 打包后由 node 运行。
export interface TestResult { name: string; error?: string }

const results: TestResult[] = []

export function test(name: string, fn: () => void | Promise<void>): Promise<void> {
  return Promise.resolve()
    .then(fn)
    .then(() => { results.push({ name }) })
    .catch((error: unknown) => {
      results.push({ name, error: error instanceof Error ? `${error.name}: ${error.message}` : String(error) })
    })
}

export function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

export function equal<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) throw new Error(`${message}（期望 ${String(expected)}，实际 ${String(actual)}）`)
}

export function summary(suite: string): void {
  const failed = results.filter((result) => result.error)
  for (const result of results) {
    if (result.error) console.error(`  ✗ ${result.name}\n      ${result.error}`)
    else console.log(`  ✓ ${result.name}`)
  }
  console.log(`${suite}: ${results.length - failed.length}/${results.length} 通过`)
  if (failed.length > 0) process.exitCode = 1
  results.length = 0
}
