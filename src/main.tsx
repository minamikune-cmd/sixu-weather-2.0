import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { initPlatform, isNative } from './platform'
import { hideSplash } from './platform/splash'
import { validateClientEnv } from './config/env'

async function bootstrap() {
  // 环境变量门禁：扫描注入前端的公开变量，发现命名疑似密钥的 VITE_* 即告警（不阻断启动）。
  validateClientEnv(import.meta.env)
  // 原生端先完成存储预热与原生插件配置，再渲染首帧，避免闪动与读空。
  await initPlatform()

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )

  // React 首帧提交后再淡出启动屏；Web 端为空操作。
  if (isNative) void hideSplash()
}

void bootstrap()
