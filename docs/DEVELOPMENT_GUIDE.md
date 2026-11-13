# 四序天气 2.0 开发指南（DEVELOPMENT GUIDE）

> 本指南由 e4df8a6 版 README 的完整功能/部署文档拆解更新而成（阶段 01），替代旧 README 作为开发参考。执行纪律与阶段入口见仓库根 `README.md` 与 `00-MASTER-RULES.md`。

## 1. 项目概述与技术选型

沉浸式动态天气应用，Web + Android 双端。真实天气来自 Open-Meteo，支持定位、中文城市搜索、经纬度查询、24 小时/7 天预报、南北半球四季主题、基于日出日落的昼夜场景、空气质量、中央气象台预警与订阅推送。无付费后端、无客户端 API 密钥。

| 技术 | 用途 | 理由 |
|---|---|---|
| Vite 7 + React 19 + TypeScript 5.9 | 应用与构建 | 类型安全、静态构建、Cloudflare Pages 易部署 |
| 原生 CSS + CSS 变量 | 响应式与主题 | 四季/昼夜平滑换色，无运行时 CSS 依赖 |
| Canvas 2D + SVG | 粒子、图标、曲线、日照弧 | 轻量、无图片下载、性能可控 |
| Lucide React | 界面图标 | 统一 SVG 图标，ISC 许可 |
| Open-Meteo Forecast / Air Quality | 实时、预报、空气质量 | 免费、无需密钥 |
| Open-Meteo Geocoding · BigDataCloud | 城市搜索 · 逆地理 | 免费客户端端点 |
| localStorage / Capacitor Preferences | 城市、偏好、缓存 | 双端统一接口（platform/storage 双写预热） |
| Capacitor 8 | Android 容器 | Web 产物直接进 APK，业务逻辑双端共享 |
| Cloudflare Pages | 静态托管 | 全球 CDN、Git 自动部署 |

**没有 Pages Functions**：所有 API 均为浏览器直接访问的公开 HTTPS GET。未来若加密钥代理/数据库，才需要 Functions/Workers。

## 2. 架构速览（八层）

```
ui/components → pages → hooks → domain（纯函数）← services → platform（Web 自动降级）
config · theme · types 横切；android/ 为 Capacitor 原生层
```

详见 [TECHNICAL_ARCHITECTURE.md](./TECHNICAL_ARCHITECTURE.md)。关键约定：

- domain/ 纯函数、零 IO；页面注入式 props；平台判断唯一来源 `platform/native.ts`。
- 所有"城市当地时间"经 `Intl.DateTimeFormat(timeZone)`，与设备时区解耦。
- 性能预算：粒子硬上限（雨 64/雪 46/星 52，移动端约减半）、30fps、DPR≤1.5、后台暂停、transform/opacity 动画。
- localStorage 键沿用 1.0 `sixu-*-v1` 命名，老用户数据自动继承。

## 3. 本地开发

推荐 Node.js 22 LTS（Vite 7 要求 Node 20.19+ 或 22.12+；本仓库已在 Node 24 验证）。

```bash
npm ci          # 可复现安装（锁文件）
npm run dev     # 开发服务器 http://localhost:3000
npm run lint    # ESLint
npx tsc -b      # 类型检查（build 内含）
npm test        # 单元测试：esbuild 打包 → node，7 套件 55 例
npm run build   # 类型检查 + 生产构建 → dist/
npm run preview # 预览生产构建 http://localhost:4173
```

定位在 localhost 可用；局域网 IP 或 HTTP 环境不可用，手机测定位请用 HTTPS 部署地址。

## 4. Android（Capacitor）

```bash
npm run cap:sync       # Web 构建 + 同步到 android/
npm run android:build  # 构建 debug APK（JDK 21 + SDK platform 37 + build-tools 37.0.0）
```

工具链：AGP 9.5.1 · Gradle 9.8.2（wrapper 固定）· compileSdk/targetSdk 37 · minSdk 24。

- 通知三渠道（每日天气/提醒/预警）；每日通知 AlarmManager 精确调度；订阅引擎驱动提醒与预警；点击按城市跳转。FCM 集成，无 `google-services.json` 自动降级。
- 权限最小化：INTERNET、定位、POST_NOTIFICATIONS、SCHEDULE_EXACT_ALARM、RECEIVE_BOOT_COMPLETED、VIBRATE。`usesCleartextTraffic=false`，WebView 不开调试。
- 发布签名：复制 `android/keystore.properties.template` → `keystore.properties` 填本地 keystore 信息（**绝不提交 GitHub**）。详见 [android/build-and-signing.md](./android/build-and-signing.md)。
- 真机测试协议与问题记录：[android/device-test-report.md](./android/device-test-report.md)。

## 5. 部署（Cloudflare Pages）

`wrangler.toml` 项目名 `sixu-weather-2-0`。两种方式任选：

**Git 集成（推荐）**：Pages → Create application → Connect to Git → Framework preset Vite；Build command `npm run build`，输出目录 `dist`，生产分支 `main`，可选 `NODE_VERSION=22`；无需任何环境变量/API 密钥。

**Wrangler Direct Upload**：

```bash
npm run build
npx wrangler login
npx wrangler pages project create sixu-weather-2-0 --production-branch=main   # 首次
npm run deploy   # = build + wrangler pages deploy dist
```

注意：Direct Upload 项目不能原地切换为 Git 集成。`public/_headers` 已配哈希资源一年缓存、HTML must-revalidate、HSTS/nosniff/frame-deny/permissions-policy（定位限本站 self）；**无 CSP**——添加时需把 `api.open-meteo.com`、`api.bigdatacloud.net`、`www.nmc.cn` 加入 `connect-src` 并先 report-only 验证。

## 6. 部署后验收清单

- [ ] 首屏真实温度；Network 中 forecast 请求 200。
- [ ] 12 项指标、24 小时项、7 日期完整；体感/高低温正确。
- [ ] 定位说明 → 允许识别城市；拒绝后搜索立即可用。
- [ ] 搜"上海/东京/Paris"、坐标 `31.2304,121.4737` 均可用。
- [ ] 收藏/最近/单位/主题/最后城市刷新后保持（跨设备不同步为预期）。
- [ ] °C/°F、km/h/m/s 全同步换算；请求保持公制。
- [ ] 自动季节随城市月份与半球；手动切换无闪屏。
- [ ] 晨曦/白昼/日暮/夜晚随城市日出日落；天气代码驱动动画。
- [ ] 动画开关与 prefers-reduced-motion 生效；后台切回不加速。
- [ ] 离线刷新：有缓存显示缓存提示，无缓存友好错误可重试。
- [ ] 375/390/768/1024/1440px 无页面级横向滚动。
- [ ] Console 无错误、无 404。

## 7. 故障排查

| 现象 | 处理 |
|---|---|
| Pages 构建失败 | Deployments → Build log；查 Node 版本/`npm run build`/输出目录 |
| 页面 404/空白 | 确认输出目录 `dist`；查 Console 首个异常 |
| 天气请求失败 | Network 看状态码；429 稍后重试，5xx 等服务恢复 |
| 定位无反应 | 必须 HTTPS/localhost；查地址栏权限、系统定位开关 |
| 定位成功无城市名 | BigDataCloud 失败会提示手动搜索，不阻断天气 |
| 搜索无结果 | Open-Meteo 至少 2 字符；试全称/英文名/经纬度 |
| 时间不正确 | 页面用 forecast 返回的 `timezone`，非设备时区 |
| 部署未更新 | 查部署状态；强制刷新；确认生产域名 |
| 手机发热掉帧 | 关环境动画；减少动态效果会自动停 Canvas |

DevTools：Console 看异常；Network 过滤 `open-meteo`/`bigdatacloud`/`nmc`；Application → Local Storage 查 `sixu-*`；Sensors 模拟定位。

## 8. 性能、安全与扩展边界

- 天气请求 12s 超时、取消、去重、10 分钟缓存；搜索 380ms 防抖并取消前次；请保持刷新频率，不要绕过缓存轮询。
- Open-Meteo 免费层有配额；商业/大流量需查其条款升级。
- 前端零密钥；未来接密钥服务必须走 Pages Functions/Workers 代理限流，**不得**放入 `VITE_*`。
- localStorage 只存城市/偏好/缓存，不存轨迹。
- 可扩展方向：PWA 离线壳、多城市对比、预警源冗余。新增服务端功能必须提供 `functions/` 或 Worker 源码。

## 9. 测试

- 单元：`npm test`（零外部依赖，fixtures 不触网）。加新套件时在 `tests/run.ts` 注册并打印 summary。
- E2E（阶段 07 补齐 Playwright）；CI 接入 `npm test`（阶段 08）。

## 数据来源

- Forecast / Air Quality：<https://api.open-meteo.com/v1/forecast> · <https://air-quality-api.open-meteo.com/>
- Geocoding：<https://geocoding-api.open-meteo.com/v1/search>
- Reverse geocoding：<https://api.bigdatacloud.net/data/reverse-geocode-client>
- 官方预警：<http://www.nmc.cn/>（findAlarm 公开接口）
