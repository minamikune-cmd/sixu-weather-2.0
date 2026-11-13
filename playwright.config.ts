// Playwright 端到端配置：构建后以 vite preview 提供生产构建产物，
// 视觉与交互测试基于真实构建运行（不依赖 dev server 的 HMR 注入）。
// 浏览器复用仓库内 .pw-browsers（通过环境变量 PLAYWRIGHT_BROWSERS_PATH 指定）。
import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  retries: process.env.CI ? 1 : 0,
  workers: 2,
  reporter: [['list']],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:4173',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  // 提供 E2E_BASE_URL 时直接对已运行的实例测试（例如真机/模拟器验收的 Web 端）。
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: 'npm run build && npm run preview -- --port 4173 --strictPort',
        url: 'http://localhost:4173',
        // 不复用已有服务：端口被残留 preview 占用时 Playwright 会跳过 build，
        // 导致测试跑在过期 dist 上（阶段 03 验收修复期间实际踩中）。
        reuseExistingServer: false,
        timeout: 120_000,
      },
})
