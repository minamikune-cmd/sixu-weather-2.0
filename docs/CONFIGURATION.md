# 配置说明（CONFIGURATION）

> 阶段 02 交付。本文件说明 sixu-weather 2.0 的全部运行时配置面：环境变量、数据源、存储键、缓存与超时参数。结论先行：**客户端零必需环境变量、零密钥**；所有参数均有安全默认值，未配置时应用完整可用。

## 1. 环境变量

### 1.1 客户端（Web / Capacitor WebView）

| 变量 | 是否必需 | 说明 |
|---|---|---|
| （无） | — | 三个数据源均为免密钥公开 GET（见 §2），客户端不需要任何 `VITE_*` 变量 |

- 启动时 `src/config/env.ts` 的 `validateClientEnv(import.meta.env)` 会扫描全部注入前端的公开变量：凡 `VITE_*` 且命名命中密钥惯例（`key` / `token` / `secret` / `password` / `private` / `credential`，含大小写与 `-`/`_` 变体）即在控制台告警（只输出键名，绝不输出值）并返回 false。**服务端密钥禁止经 `VITE_` 前缀注入前端 bundle**；如未来需要带密钥的私有数据源，必须走后端代理，密钥存服务端环境变量或 GitHub Secrets。
- 构建产物为纯静态文件，无 `process.env` 注入；`import.meta.env` 中仅有 Vite 内置键（`MODE` / `BASE_URL` / `PROD` / `DEV` / `SSR`），校验对这些键恒为干净。

### 1.2 服务端 / CI（均不进入客户端）

| 配置 | 位置 | 用途 |
|---|---|---|
| 签名 keystore | GitHub Secrets（`KEYSTORE_BASE64` 等，见 `android/keystore.properties.template` 与 CI workflow） | 仅 Release 构建签名，永不入库 |
| `google-services.json` | 本地 `android/app/`（gitignore）/ CI Secret | FCM 推送配置；缺失时推送安全降级（BLOCKED-CONFIG，R-04） |
| `CLOUDFLARE_API_TOKEN` 等 | GitHub Secrets | 部署用，阶段 08/09 范围 |

## 2. 数据源

| 用途 | 端点 | 认证 | 超时 | 失败处理 |
|---|---|---|---|---|
| 天气预报 | `https://api.open-meteo.com/v1/forecast` | 无 | 12s | 重试 1 次后按错误类型提示；有缓存回退缓存 |
| 空气质量 | `https://air-quality-api.open-meteo.com/v1/air-quality` | 无 | 10s | 并行请求，失败降级为 `null`，不阻断主流程 |
| 城市搜索 | `https://geocoding-api.open-meteo.com/v1/search` | 无 | 10s | 抛出可读错误文案 |
| 逆地理编码 | `https://api.bigdatacloud.net/data/reverse-geocode-client` | 无 | 10s | 抛出可读错误文案 |
| 官方预警 | `https://www.nmc.cn/rest/findAlarm`（pageSize=500） | 无 | 12s | 静默回退过期缓存；无缓存返回空列表 |

## 3. 客户端限流与重试

| 参数 | 值 | 位置 |
|---|---|---|
| 请求间隔 | 任意两次 API 请求 ≥ 3000ms | `services/weather/api.ts` `MIN_REQUEST_INTERVAL` |
| 重试次数 | 最多 1 次（共 2 次尝试），间隔 400ms | `services/weather/api.ts` `MAX_ATTEMPTS` / `RETRY_DELAY_MS` |
| 可重试条件 | 仅 5xx、网络层异常（TypeError）、单次请求超时 | 同上 |
| 不重试 | 429（避免加剧限流）、4xx、已断网（`navigator.onLine=false`）、调用方取消（`signal.aborted`） | 同上 |

## 4. 缓存

| 缓存 | 键（`src/config/keys.ts`） | TTL / 容量 | 写入时机 |
|---|---|---|---|
| 天气数据（按城市） | `sixu-weather-data-v1` | 10min TTL · 8 城 LRU | 每次成功拉取 |
| 官方预警（全国列表） | `sixu-warnings-v1` | 10min TTL | 每次成功拉取 |
| 当前城市 | `sixu-city-v1` | 持久 | 城市切换/定位成功 |
| 偏好设置 | `sixu-preferences-v1` | 持久 | 设置变更 |
| 收藏 / 最近 | `sixu-favorites-v1` / `sixu-recent-v1` | 持久 | 收藏/搜索时 |
| 推送订阅 | `sixu-subscriptions-v1` | 持久 | 订阅变更 |
| 通知去重 / 权限 / 定位提示 | `sixu-notified-v1` / `sixu-notification-permission-v1` / `sixu-location-notice-v1` | 持久 | 调度器/权限流程 |

存储实现（`src/platform/storage.ts`）：Web 用 `localStorage`；Android 用 `@capacitor/preferences` 并启动预热进内存，业务层保持同步 API。全部 11 个键与 1.0 完全一致（`sixu-*-v1`），1.0 用户升级后数据自动继承。

## 5. 单位、语言与时区

| 项 | 处理 | 位置 |
|---|---|---|
| 温度/风速单位 | API 固定取 Celsius/kmh，展示层按偏好换算（`°F` / `m/s`） | `domain/weather.ts` |
| 语言 | 城市搜索/逆地理固定 `zh`；UI 文案为内置中文 | `services/weather/api.ts` |
| 时区 | API 返回 IANA `timezone`；所有"城市当地时间"经 `Intl.DateTimeFormat(timeZone)` 计算，与设备时区解耦；h23 小时制；预警 issuetime 按 +08:00 解析 | `domain/time.ts`、`services/weather/warnings.ts` |
| 坐标 | 定位经 `platform/geolocation.ts`（Web HTTPS 限制 / 原生错误码中文映射）；坐标只用于请求与缓存键，不进入日志 | `platform/` |

## 6. 验证

- `npm test`：10 套件 73 例（含环境变量校验 6、有界重试 6、安全日志 6）。
- `npm run test:e2e`（阶段 03 新增）：Playwright 11 例视觉/交互检查，对生产构建运行，接口经路由拦截注入确定性夹具；浏览器复用 `.pw-browsers`（脚本已内置 `PLAYWRIGHT_BROWSERS_PATH`），首次在其他机器运行需 `npx playwright install chromium`。
- `docs/TECHNICAL_ARCHITECTURE.md` §7 记录阶段 02 全部配置面变更。
