# Phase 1 · sixu-weather 1.0 全量审计报告

- 项目：sixu-weather（四序天气）
- 1.0 仓库：<https://github.com/minamikune-cmd/sixu-weather>
- 1.0 审计基线：`ca24d631fd6b91d33fe3e70d50e1847d248e3910`（`main`）
- 2.0 仓库：<https://github.com/minamikune-cmd/sixu-weather-2.0>
- 2.0 迁移基线：`05672e929773056b602d89f6afeb497d9bf2553e`（`main`）
- 审计日期：2026-11-10（Asia/Shanghai）
- 配套清单：[phase-1-file-manifest.md](./phase-1-file-manifest.md)
- 验收记录：[phase-1-migration-verification.md](./phase-1-migration-verification.md)

## 0. 结论摘要

1. **1.0 是一个纯前端、无后端、无密钥的单页天气应用。** React 19 + TypeScript 5.9 + Vite 7，全部数据由浏览器直接请求 Open-Meteo 与 BigDataCloud 三个公开 HTTPS 接口。
2. **受版本控制文件共 27 个**，全部为普通 blob；无子模块、无 Git LFS、无历史删除文件、无 `.env`、无 `.github/`、无 PWA 文件、无测试、无 LICENSE。
3. **2.0 已原样迁移 27/27 个文件，blob SHA-1 逐一相同，迁移成功率 100%。** 没有源码、资源或文档遗漏。
4. **构建与运行验证通过：** `npm ci`、`npm run lint`、`npm run build` 均成功；生产构建在 Chromium 中通过 27 项功能/响应式/无障碍检查，实时天气、城市搜索、定位、单位切换、本地持久化均可用。
5. **未发现真实 API 密钥、Token、密码或隐私数据。** 1.0 的部署文档只使用占位符；2.0 的 GitHub 凭据仅存于 `.git/github-credentials`，不会入库。
6. **本阶段没有修改任何 1.0 应用源码。** 2.0 新增内容仅为 `.gitignore`、Phase 0/1 文档、验收截图与只读权限 CI，符合“先完整迁移、后重构”的阶段目标。
7. **有 3 个需要下一阶段处理的中等优先级继承问题：** 移动端逐小时曲线对齐、切换城市时短暂显示旧天气、反向定位城市缺少时区。它们不影响本阶段“完整迁移”的验收。

## 1. 审计范围与方法

本次审计不是只看 README 和入口文件，而是覆盖：

- Git 对象与历史：4 个提交、27 个路径、全部历史路径、删除记录、子模块/LFS 检查。
- 全部 27 个文件：逐文件读取源码、配置、样式、README、CREDITS、响应头与部署文件。
- 依赖：`package.json` 声明范围、`package-lock.json` 解析版本、实际 `node_modules` 树、生产依赖审计。
- 构建：干净目录 `npm ci`、ESLint、`tsc -b && vite build`、产物路径与 gzip 体积。
- 网络：三个真实 API 的 HTTP 状态、响应字段、时区、日出日落、城市搜索结果。
- 浏览器：Playwright + Chromium 158，桌面 1440、移动 390、地理定位、减少动态效果、控制台与失败请求监控。
- 部署：Cloudflare Pages 配置、`_headers`、缓存策略、GitHub Actions 与仓库权限。
- 安全：密钥模式扫描、环境变量、凭据文件、公开仓库暴露面。

环境：Node.js v24.22.2、npm 11.19.1、Git 2.47.3、Debian 13、Chromium Headless Shell 158.0.8127.18。浏览器所需的系统库与字体安装在 `/tmp` 下，仅用于本机验收，不进入仓库，也不改变项目依赖。

## 2. 仓库基线

| 项目 | 1.0 | 2.0（本阶段开始时） |
|---|---|---|
| 地址 | `minamikune-cmd/sixu-weather` | `minamikune-cmd/sixu-weather-2.0` |
| 可见性 | Public | **Private**（待用户决定是否公开） |
| 默认分支 | `main` | `main` |
| HEAD | `ca24d631fd6b91d33fe3e70d50e1847d248e3910` | `05672e929773056b602d89f6afeb497d9bf2553e` |
| 提交数 | 4 | 5（继承 1.0 历史 + Phase 0 文档提交） |
| 文件数 | 27 | 29（27 个 1.0 文件 + `.gitignore` + Phase 0 报告） |
| Actions | 无 | 已启用，默认权限为 read，0 个 workflow |
| Pages | 未启用 | 未启用 |
| Tags / Releases | 无 | 无 |
| 分支保护 | 无 | 无（私有仓库，单人维护） |

2.0 保留了 1.0 的完整 Git 历史（`ca24d63` 为共同祖先），但仓库、远程、默认分支和后续历史完全独立，不会覆盖或改写 1.0。审计前后均复核 1.0 的 API SHA 仍为 `ca24d63`。

## 3. 技术栈与构建链

### 3.1 运行时与框架

| 依赖 | package.json 声明 | 锁定版本 | 用途 |
|---|---|---|---|
| `react` | `^19.2.0` | 19.2.3 | UI |
| `react-dom` | `^19.2.0` | 19.2.3 | DOM 渲染 |
| `react-router` | `^7.6.1` | 7.18.4 | 仅 `BrowserRouter` 包裹；无 Route、无路由表 |
| `lucide-react` | `^0.562.0` | 0.562.0 | 界面线性图标 |
| `vite` | `^7.2.4` | 7.3.7 | 开发服务器与生产构建 |
| `typescript` | `~5.9.3` | 5.9.3 | 类型检查 |
| `eslint` | `^9.39.1` | 9.39.2 | 静态检查 |
| `typescript-eslint` | `^8.46.4` | 8.52.0 | TS ESLint 规则 |
| `@vitejs/plugin-react` | `^5.1.1` | 5.1.2 | React 插件 |

- `package-lock.json` 为 **lockfileVersion 3**，共 232 个包条目，`npm ci` 可复现。
- `engines.node` 为 `>=20.19.0`；Vite 7 的最低要求与之匹配。
- 无 Tailwind、CSS-in-JS、状态管理库、测试框架、PWA 插件或字体包。
- 生产依赖审计：`npm audit --omit=dev` 返回 **0 vulnerabilities**。

### 3.2 脚本

```json
{
  "dev": "vite",
  "build": "tsc -b && vite build",
  "lint": "eslint .",
  "preview": "vite preview",
  "deploy": "npm run build && wrangler pages deploy dist --project-name=sixu-weather"
}
```

`deploy` 依赖全局/临时安装的 `wrangler` 与 Cloudflare 登录态；本阶段未执行真实部署。

### 3.3 Vite 与 TypeScript

- `vite.config.ts`：`base: './'`、开发端口 **3000**、别名 `@` → `./src`、React 插件。
- `base: './'` 使产物使用相对路径，适合 Cloudflare Pages 根路径/子路径静态托管。
- `tsconfig.json` 使用项目引用，拆分 `tsconfig.app.json`（应用）与 `tsconfig.node.json`（构建脚本）。
- 实际产物入口：

```html
<link rel="icon" type="image/svg+xml" href="./favicon.svg" />
<script type="module" crossorigin src="./assets/index-CRYKsXNk.js"></script>
<link rel="stylesheet" crossorigin href="./assets/index-k7JLShqj.css">
```

## 4. 目录与启动链路

```text
sixu-weather/
├── public/
│   ├── _headers                 # Cloudflare Pages 缓存与安全响应头
│   └── favicon.svg              # 原创四叶图标
├── src/
│   ├── components/              # 7 个 UI/场景组件
│   ├── hooks/useWeather.ts      # 请求、缓存、刷新
│   ├── lib/weather.ts           # API、时区、季节、单位、格式化
│   ├── types/weather.ts         # 类型定义
│   ├── App.tsx / App.css        # 主界面与全部视觉样式
│   ├── index.css                # 全局字体
│   └── main.tsx                 # React 入口
├── .github/workflows/ci.yml     # 2.0 新增（1.0 无）
├── README.md / CREDITS.md
├── index.html
├── package.json / package-lock.json
├── eslint.config.js
├── vite.config.ts
├── wrangler.toml
└── tsconfig*.json
```

启动链路：

1. `index.html` 提供 `#root`、中文 lang、viewport、theme-color、description。
2. `src/main.tsx` 用 `createRoot` + `StrictMode` + `BrowserRouter` 挂载 `App`。
3. `App.tsx` 初始化城市、偏好、收藏、最近记录和定位提示；调用 `useWeather(city)`。
4. `useWeather` 先读 `sixu-weather-data-v1` 单城市缓存，再请求 Open-Meteo，失败时回退缓存。
5. `Atmosphere` 根据季节/昼夜/天气绘制 Canvas 与 CSS 场景；`HourlyForecast`、`DailyForecast`、`SunArc` 渲染预报。

**没有实际路由。** `BrowserRouter` 只提供上下文，页面内导航全部是 `#now`、`#hourly`、`#city`、`#daily` 锚点；`react-router` 目前是未使用的依赖。

## 5. 功能清单

| # | 功能 | 实现位置 | 审计结果 |
|---:|---|---|---|
| 1 | 当前天气：温度、体感、天气描述 | `src/App.tsx`、`src/lib/weather.ts` | 正常；实时接口返回 11 个 current 字段 |
| 2 | 六项指标：湿度、风、降水概率、紫外线、能见度、气压 | `src/App.tsx` | 正常；桌面 6 张、移动 2×3 |
| 3 | 24 小时逐时预报 + SVG 温度曲线 + 小时选择 | `src/components/HourlyForecast.tsx` | 数据 24 条正常；移动端曲线对齐有继承缺陷（见 §12） |
| 4 | 7 天预报 + 高低温区间 + 降水概率 | `src/components/DailyForecast.tsx` | 正常；7 行 |
| 5 | 日出日落、日照时长、太阳轨迹进度 | `src/components/SunArc.tsx`、`src/lib/weather.ts` | 正常；按城市当地日期匹配 |
| 6 | 中文城市搜索 | `src/components/CityDialog.tsx` | 正常；Open-Meteo Geocoding，380ms 防抖、最多 8 条 |
| 7 | 经纬度查询 | `src/components/CityDialog.tsx` | 支持 `31.2304,121.4737` 形式 |
| 8 | 浏览器定位 + 反向地理编码 | `src/App.tsx`、`src/lib/weather.ts` | 正常；上海坐标实测反查“上海市” |
| 9 | 收藏与最近城市 | `src/App.tsx` | 收藏最多 12、最近最多 6；本地存储 |
| 10 | 温度单位 °C/°F、风速 km/h / m/s | `src/lib/weather.ts`、`SettingsDialog` | 正常；请求始终公制，本地换算 |
| 11 | 自动/手动四季主题 | `src/lib/weather.ts`、`SettingsDialog` | 按当地月份与南北半球判断 |
| 12 | 晨曦/白昼/日暮/夜晚场景 | `src/lib/weather.ts`、`Atmosphere` | 日出日落 ±45 分钟划分，缺失时回退 `is_day` |
| 13 | Canvas 雨/雪/花瓣/落叶/星点 + CSS 云/雾/热浪/极光/地景 | `src/components/Atmosphere.tsx`、`App.css` | 正常；真实天气优先于季节粒子 |
| 14 | 视觉风格：跟随场景/浅色/深色 | `App.tsx`、`App.css` | 正常；刷新后保持 |
| 15 | 动画开关 + `prefers-reduced-motion` | `App.tsx`、`Atmosphere.tsx`、`App.css` | 正常；减少动态效果下 Canvas 不绘制 |
| 16 | 10 分钟缓存、刷新、超时、429、离线回退 | `src/hooks/useWeather.ts`、`weather.ts` | 正常；单城市缓存（见 §12） |
| 17 | 本地存储与清除数据 | `App.tsx`、`useWeather.ts` | 正常；清除时漏掉定位提示键（见 §12） |
| 18 | 响应式与移动底部导航 | `App.css` | 390/768/1024/1440 无页面级横向滚动 |
| 19 | 无障碍：语义标签、44px 触控、Esc/背景关闭、焦点样式 | 组件与 CSS | 基本具备；弹窗无焦点陷阱/焦点恢复 |
| 20 | Cloudflare Pages 缓存与安全响应头 | `public/_headers` | 正常；无 CSP/HSTS |
| 21 | PWA / Service Worker / Manifest | — | **1.0 不存在，未迁移** |
| 22 | 天气预警 / AQI / 多城市对比 / 账号同步 | — | **1.0 不存在，未迁移** |

## 6. 天气 API 与数据处理

### 6.1 接口

| 用途 | 端点 | 认证 | 超时 |
|---|---|---|---|
| 实时与预报 | `https://api.open-meteo.com/v1/forecast` | 无 | 12s |
| 城市搜索 | `https://geocoding-api.open-meteo.com/v1/search` | 无 | 10s |
| 反向地理编码 | `https://api.bigdatacloud.net/data/reverse-geocode-client` | 无 | 10s |

没有 Pages Functions、Worker、代理或服务端缓存；浏览器直接访问公开接口。

### 6.2 Forecast 请求参数与字段

`src/lib/weather.ts:204-212` 的请求参数：

- `latitude` / `longitude`
- `timezone=auto`
- `forecast_days=8`
- `temperature_unit=celsius`
- `wind_speed_unit=kmh`
- `current`：`temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,cloud_cover,pressure_msl,wind_speed_10m,wind_direction_10m,visibility`
- `hourly`：`temperature_2m,precipitation_probability,weather_code,is_day,uv_index`
- `daily`：`weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,uv_index_max,precipitation_probability_max`

处理逻辑：

- 用 `raw.current.time.slice(0, 13) + ':00'` 找到当前小时的索引，取从该小时起的 **24 条** hourly。
- daily 取 **前 7 条**（请求 8 天，留出时区/跨日余量）。
- 缺失的降水概率、UV 以 `0` 回退；天气码映射为中文描述和 7 类场景 `clear/cloud/overcast/rain/thunder/snow/fog`。
- 请求失败按 HTTP 429、非 2xx、超时、离线分别给出中文错误；`useWeather` 在无缓存时显示可恢复空状态。

### 6.3 2026-11-10 实测

| 请求 | 结果 |
|---|---|
| 北京 Forecast | HTTP 200，0.88s；12.0°C、体感 9.6°C、湿度 50%、风 3.4 km/h 212°、能见度 11280m、天气码 0、日出 06:53、日落 17:03、`timezone=Asia/Shanghai`、192 条 hourly / 8 条 daily |
| “上海” Geocoding | HTTP 200，7 条结果；首条 id 1796236、31.22222/121.45806、`Asia/Shanghai` |
| 上海坐标反查 | HTTP 200；`city=上海市`、`locality=黃浦區`、`countryName=中华人民共和国` |

浏览器内实测：北京首屏 12°、晴朗、6 项指标、24 个小时项、7 天预报、日出 06:53 / 日落 17:03；搜索“上海”后切换为 56°F（在 °F 设置下），刷新后城市与偏好保持。

## 7. 时区、日出日落与季节

### 7.1 时区

- Open-Meteo 在 `timezone=auto` 下返回**城市当地 ISO 时间**（无 offset），并返回 IANA 时区名。
- 城市时钟、日期、星期由 `getCityParts()` 使用 `Intl.DateTimeFormat('zh-CN', { timeZone, hourCycle: 'h23' })` 计算，不依赖设备时区。
- `getLocalMinutes()` 用同一套 `Intl` 结果换算当地分钟，自动处理夏令时。
- 页面显示 `2026 年 11 月 10 日 · 星期二 · Asia/Shanghai`，与 API 时区一致（浏览器实测）。

### 7.2 昼夜阶段

`getDayPhase()`（`src/lib/weather.ts:90-102`）：

- 日出前 45 分钟到日出后 45 分钟：`dawn`
- 日出后 45 分钟到日落前 45 分钟：`day`
- 日落前 45 分钟到日落后 45 分钟：`dusk`
- 其余：`night`
- 日出/日落缺失时回退 `current.is_day`。

`getDayProgress()`（`104-112`）按当地分钟与日出日落计算 0–1 进度；缺失时回退 06:00 / 18:00（360 / 1080 分钟）。

### 7.3 季节

`getSeason(month, latitude)` 按月份和南北半球返回四季；设置中 `season=auto` 使用自动值，也可固定春/夏/秋/冬。季节只影响主题色与粒子类型，不影响天气数据。

## 8. 动态背景、图标与资源

### 8.1 Atmosphere

`src/components/Atmosphere.tsx`：

- Canvas 2D 粒子：雨 64、雪 46、星 52、其他 22；手机乘以 0.55。
- 30fps 上限、DPR 上限 1.5、页面隐藏时暂停。
- 真实天气优先：雨/雪/雷暴覆盖季节粒子；晴天/多云按季节生成花瓣、落叶或星点。
- CSS 层：云、雾、热浪、极光、地景、太阳/月亮光晕。
- `prefers-reduced-motion` 或设置关闭动画时停止绘制。

### 8.2 图片、图标、字体

- `public/favicon.svg`：原创四叶 SVG。
- `WeatherIcon.tsx`：按 WMO 代码内联 SVG，无外部图片请求。
- 无位图、无图片目录、无字体文件；字体使用系统栈（Avenir Next、Helvetica Neue、PingFang SC、Hiragino Sans GB、Microsoft YaHei、Noto Sans CJK SC、sans-serif）。
- `CREDITS.md` 记录 React/Vite/TS/Lucide 许可、Open-Meteo 与 BigDataCloud 条款，以及原创视觉资源说明。

### 8.3 响应式

断点：1180px、820px、600px；移动端固定底部“此刻/逐时/城市/七日”导航，隐藏桌面导航和部分头部图标；`100dvh`、`env(safe-area-inset-bottom)` 处理刘海屏。实测 390px 无页面级横向滚动，底部导航可见。

## 9. 本地存储与隐私

| 键 | 内容 | 生命周期 |
|---|---|---|
| `sixu-city-v1` | 最后选择的城市 | 持久 |
| `sixu-weather-data-v1` | `{ city, data }` 单城市缓存 + `fetchedAt` | 持久；TTL 10 分钟 |
| `sixu-preferences-v1` | 温度/风速单位、季节、视觉风格、动画 | 持久 |
| `sixu-favorites-v1` | 收藏城市，最多 12 | 持久 |
| `sixu-recent-v1` | 最近城市，最多 6 | 持久 |
| `sixu-location-notice-v1` | 是否已看过定位用途说明 | 持久 |

- 全部为 `localStorage`，无服务端、无账号、无分析脚本、无跨设备同步。
- 定位坐标仅在用户主动点击后获取，用于 BigDataCloud 反查和天气请求；未发现上传到其他服务。
- “清除本地数据”删除天气缓存、城市、偏好、收藏、最近，但**未删除** `sixu-location-notice-v1`。
- 读取 localStorage 时只捕获 JSON 解析异常，没有运行时 schema 校验。

## 10. 部署、PWA 与 Actions

### 10.1 Cloudflare Pages

`wrangler.toml`：

```toml
name = "sixu-weather"
pages_build_output_dir = "./dist"
compatibility_date = "2026-10-24"
```

`public/_headers`：

- 全站：`X-Content-Type-Options: nosniff`、`Referrer-Policy: strict-origin-when-cross-origin`、`Permissions-Policy: geolocation=(self), camera=(), microphone=()`、`X-Frame-Options: DENY`
- `/assets/*`：一年 immutable
- `/favicon.svg`：一天
- `/index.html`：`max-age=0, must-revalidate`
- 无 CSP、无 HSTS。

`npm run deploy` 仍使用 1.0 的 Pages 项目名 `sixu-weather`。2.0 若部署，应改用独立项目名，避免覆盖 1.0 生产站点（列入下一阶段）。

### 10.2 PWA / Actions / 许可证

- 1.0 **没有** `manifest.webmanifest`、Service Worker、离线壳或安装提示。
- 1.0 **没有** `.github/` 或任何 CI。2.0 已新增 `.github/workflows/ci.yml`（`contents: read`，Node 22，`npm ci` + lint + build），用于迁移后持续验证。
- 1.0 **没有** LICENSE 文件；`package.json` 为 `private: true`。本阶段未擅自添加许可证，避免改变原作者授权状态。

## 11. 依赖兼容性与构建结果

- 干净安装：删除 `node_modules` 后 `npm ci --cache /tmp/npm-cache`，**181 packages / 7s** 成功。
- `npm run lint`：**通过**，无警告输出。
- `npm run build`：**通过**；`tsc -b` 无错误，Vite 转换 1720 个模块。
- 产物：
  - `dist/index.html` 729 B（gzip 0.51 KB）
  - `dist/assets/index-k7JLShqj.css` 33,928 B（gzip 8.11 KB）
  - `dist/assets/index-CRYKsXNk.js` 277,512 B（gzip 90.31 KB）
- `npm audit --omit=dev`：**0 vulnerabilities**。
- npm 11 提示 esbuild 的 postinstall 未在 `allowScripts` 中；实际 esbuild 二进制可用，构建成功。CI 使用 Node 22 + npm 10，不受该提示影响。
- Node 24.22.2 实测通过；项目声明 `>=20.19.0`，CI 固定 Node 22 LTS。

## 12. 已知问题与风险

> **更新（2026-11-10，Phase 2）**：下表 P2×4 与 P3×5、P4 中的 react-router/CSP-HSTS 项已在 Phase 2 修复并回归验证，详见 `docs/reports/phase-2-fixes.md`。本表保留作为 1.0 原始审计记录。

以下均为 **1.0 继承问题**，本阶段不做源码修复，留给 Phase 2 评估；不会阻断迁移。

| 级别 | 问题 | 证据位置 | 影响 | 建议 |
|---|---|---|---|---|
| P2 | **移动端逐小时曲线与 24 个小时项不对齐，初始滚动位置看不到曲线。** `hourly-chart-wrap` 在 ≤600px 为 `680vw`，SVG 固定 `viewBox="0 0 1120 150"` 且默认 `preserveAspectRatio="xMidYMid meet"`，曲线被居中到约 878px 处，而滚动容器初始 `scrollLeft=0`。 | `src/App.css:206`、`src/App.css:454`、`src/components/HourlyForecast.tsx:9-30` | 移动端首屏小时图区域视觉空白；数据与小时项本身正常，可横向滚动 | 让 SVG `width` 与 24 列容器同宽，或设置 `preserveAspectRatio="none"`/按容器重算 viewBox |
| P2 | **切换城市时短暂显示旧城市天气。** `useWeather` 的 `data` state 初始化为首次缓存，city 变化后请求完成前不重置；无缓存时只 `setLoading(true)`，旧 `data` 仍在。 | `src/hooks/useWeather.ts:45`、`:60-67`、`:93-106` | 新城市名 + 旧温度/天气可能同时出现数百毫秒 | city 变化时先 `setData(null)` 或用 `data.cityId` 校验 |
| P2 | **反向定位返回的 `City` 没有 `timezone`。** `reverseGeocode` 只返回经纬度/名称；天气返回前 `App` 回退 `Asia/Shanghai`。 | `src/lib/weather.ts:266-279`、`src/App.tsx:144` | 非中国城市定位后，天气返回前城市时钟/日期可能显示错误时区 | 用坐标先查时区，或天气返回前显示“同步中”而非时钟 |
| P2 | **缓存只支持单城市。** 只有一个 `sixu-weather-data-v1` 键，切换城市会覆盖；离线只能回退最后一个城市。 | `src/hooks/useWeather.ts:35-37`、`:72` | 多城市用户离线体验受限；收藏城市无独立缓存 | Phase 2 改为按 city id 的缓存 map，设容量上限 |
| P3 | **localStorage 无运行时 schema 校验。** 损坏/旧版本数据可能让 `data.current` 等字段为 undefined。 | `src/hooks/useWeather.ts:18-28`、`src/App.tsx:28-33` | 极端情况下渲染异常；普通 JSON 损坏已被 try/catch 兜底 | 引入轻量校验/版本迁移 |
| P3 | **“清除本地数据”未清除定位提示键。** | `src/App.tsx:133-142`、键定义 `:26` | 用户以为全部清除，但下次不会再看定位说明 | 将 `sixu-location-notice-v1` 加入删除列表 |
| P3 | **弹窗无焦点陷阱、关闭后不恢复焦点。** CityDialog 仅自动聚焦输入框；SettingsDialog 不聚焦。 | `src/components/CityDialog.tsx:26-38`、`src/components/SettingsDialog.tsx:14-25` | 键盘/读屏用户可能 Tab 到背景内容 | 增加 focus trap 与 `returnFocus` |
| P3 | **`weatherKind` 死代码：** 95/96/99 先返回 `thunder`，snow 分支又包含 96/99，后两者永远不可达。 | `src/lib/weather.ts:47-55` | 当前行为正确，仅逻辑冗余 | 删除 snow 分支中的 96/99 |
| P3 | **1.0 文档与实现不一致：** README 目录树写了 `.gitignore`（1.0 实际没有）；README 说 dev 默认 5173，`vite.config.ts` 实为 3000。 | `README.md:75`、`README.md:99`、`vite.config.ts:7` | 新贡献者可能困惑 | 本阶段保留原文；Phase 2 同步文档或改端口 |
| P3 | **2.0 部署名仍是 1.0 的 `sixu-weather`。** | `wrangler.toml:1`、`package.json` deploy 脚本 | 直接部署可能覆盖 1.0 Pages 项目 | Phase 2 改为 `sixu-weather-2-0` 等独立名 |
| P3 | **1.0 无测试、无 CI、无 PWA、无 LICENSE。** | 仓库清单 | 回归保障与离线能力缺失 | CI 已在 2.0 补；测试/PWA/许可证按阶段规划 |
| P4 | **`react-router` 未被实际使用。** 只有 `BrowserRouter` 包裹，无 `Routes`/`Route`/导航 API。 | `src/main.tsx:3`、`:11` | 增加不必要的依赖与打包体积 | 移除或真正引入路由 |
| P4 | **无 CSP/HSTS。** `_headers` 只有基础头。 | `public/_headers` | 安全纵深不足；CSP 需把三个 API 域加入 `connect-src` | Phase 2 先报告模式验证再上线 |
| P4 | **无 AQI/预警/多城市对比。** 1.0 README 明确不展示无可靠来源的空气质量。 | `README.md`、`App.tsx` | 功能范围限制，不是缺陷 | 作为 2.0 产品需求单独评估 |

### 移动端曲线问题的补充证据

浏览器实测（390×844，DPR 2）：

- `.hourly-chart-wrap` 宽 2652px（680vw）
- `.temperature-chart` 宽 2628px、高 132px
- SVG `viewBox="0 0 1120 150"`，默认 `xMidYMid meet` 将内容缩放到高 132px（内容宽约 985px），水平居中后曲线起点约在 **878px**
- `.hourly-scroll` 初始 `scrollLeft=0`，可视宽度 373px，因此首屏曲线区域为空
- 24 个小时按钮存在且可滚动，桌面 1440 下曲线正常

该问题在 1.0 源码中已存在，2.0 原样保留；截图 `docs/reports/assets/phase1-mobile.png` 可见空白曲线区。

## 13. 安全与密钥审计

扫描范围：全部 27 个文件与 Git 历史路径。模式包括 `api_key`、`secret`、`token`、`password`、`BEGIN PRIVATE KEY`、`ghp_`、`sk-`、`.env`。

结果：

- **无真实 API 密钥。** 命中仅为 lockfile 的 `js-tokens` 包名、`package-json` 的 `tokens` 词、CSS 注释中的 “tokens”。
- **无 `.env`、`.env.*`、`.github/secrets`、签名文件、keystore。**
- README 明确“天气功能不需要任何环境变量或 API 密钥”；Cloudflare 令牌仅以 `<你的 ...>` 占位符出现。
- 三个上游 API 均为公开、免密钥、只读 GET；没有把密钥放进 `VITE_*` 的代码路径。
- 2.0 的 GitHub 凭据只保存在 `.git/github-credentials`（权限 600），`.git/` 不入库；`.gitignore` 覆盖 `.env*`、keystore、`google-services.json`。
- `_headers` 限制地理定位仅本站可用、禁止 iframe、禁止 MIME 猜测。
- 未发现用户隐私数据、日志上报、第三方分析或 Cookie。

## 14. 迁移结论

- **文件迁移：27/27，100%。** 逐路径 blob SHA-1 相同，SHA-256 清单见配套文件。
- **代码改动：0 行应用源码改动。** 2.0 只增加工程/文档文件。
- **功能保留：** 第 5 节 1–20 项全部保留；1.0 本来不存在的 PWA、AQI、预警、账号等不属于“遗漏”。
- **构建与运行：** 干净安装、lint、build、真实浏览器验收均通过；详见验收记录。
- **未迁移文件：无。** `node_modules/`、`dist/`、`*.tsbuildinfo` 是构建产物，1.0 也未入库。
- **需下一阶段决策：** 2.0 仓库可见性（当前 Private）、独立 Cloudflare Pages 项目名、上述 P2/P3 修复、是否补测试/PWA/LICENSE。

## 15. 环境与授权说明

- 本机沙箱不允许写 `/root/.npm`，依赖安装使用 `--cache /tmp/npm-cache`；这不改变项目配置，CI 中仍使用标准 `npm ci`。
- Chromium 运行所需的 `libatk` 等系统库与 Noto CJK/DejaVu 字体安装在 `/tmp`，仅用于验收；仓库不包含这些二进制，也不新增运行时依赖。
- 未执行 Cloudflare Pages 真实部署：没有 2.0 的 Pages 项目与部署凭据；`wrangler.toml` 仍指向 1.0 项目名。
- 2.0 仓库当前为 Private；是否转 Public 需用户确认后再操作。本阶段未改变可见性。
