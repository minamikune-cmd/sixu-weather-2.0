# 阶段 00 · 2.0 全面审计报告（PROJECT AUDIT）

- 项目：sixu-weather 2.0（四序天气）
- 1.0 源仓库：`minamikune-cmd/sixu-weather`（只读参考，本地 remote `upstream-1x`）
- 1.0 审计基线：`ca24d631fd6b91d33fe3e70d50e1847d248e3910`（main，4 个提交，27 个受控文件）
- 2.0 完整实现基线：`e4df8a6`（main，阶段 5 完成态；本地已归档为分支 `archive/full-2.0-e4df8a6`）
- 2.0 分阶段工作区基线：`04cfb0c`（origin/main，仅 `00-MASTER-RULES.md` + `README.md` + `prompts/00–09`）
- 审计日期：2026-11-12（Asia/Shanghai）
- 配套文档：[FEATURE_INVENTORY.md](./FEATURE_INVENTORY.md) · [TECHNICAL_ARCHITECTURE.md](./TECHNICAL_ARCHITECTURE.md) · [RISK_REGISTER.md](./RISK_REGISTER.md) · [progress/PHASE-00.md](./progress/PHASE-00.md)

## 0. 结论摘要

1. **2.0 在 `e4df8a6` 处是一个功能完整、验证通过的 Web + Android 双端天气应用。** 八层架构（ui / pages / domain / services / config / theme / platform / hooks + types），TypeScript/TSX 共 44 个文件约 3,473 行；Android 侧为 Capacitor 8 容器 + 原生 Java 插件。
2. **本机验证全部通过**：`npm run lint` 0 错误；`npm test` 6 个套件 52/52 通过；`npm run build` 成功（主包 285.9 kB / gzip 94.2 kB）；`npm audit --omit=dev` 0 漏洞。
3. **1.0 的全部 27 个文件已在前期阶段 100% 迁移**（blob SHA 逐一相同，见 docs/reports/phase-1-audit.md），此后 2.0 在其上增量演化：src 差异 45 个文件、+2,973/−642 行。**1.0 功能是 2.0 的严格子集，不存在 1.0 有而 2.0 缺失的能力**；两处行为差异（空气质量、昼夜兜底）均为 2.0 的有意替代，不是丢失。
4. **origin/main 已重置为分阶段工作区**（`04cfb0c` 删除全部应用代码、CI 与 android 工程，仅保留总控规则与 prompts 00–09）。应用资产完整保留在 git 历史 `e4df8a6` 与本地分支 `archive/full-2.0-e4df8a6` 中，可随时恢复。
5. **存在一份未提交 WIP**（Capacitor Geolocation v8 原生错误码中文映射 + 单元测试 + eslint 忽略项 + 文档更新，5 文件 +69/−4），已保全到分支 `wip/geolocation-native-error-codes`，阶段 01 可直接合入。
6. **未发现入库的密钥或隐私数据**：git 全历史无 keystore/google-services.json/.env；发布签名走 GitHub Secrets；`.gitignore` 覆盖 `*.jks`、`*.jks_*`、`keystore.properties`、`google-services.json`。
7. **主要缺口**（详见 RISK_REGISTER）：CI 未运行 `npm test`；无 Playwright E2E 入库（此前为临时脚本）；工作区残留一份发布 keystore 副本 `sixu-weather-release.jks_copy_58023407`（未入库，属敏感残留）；Web 通知受浏览器限制（页面关闭即不可达）；FCM 无 `google-services.json` 时整体降级（BLOCKED-CONFIG）。

## 1. 审计范围与方法

- **Git 与仓库**：两个仓库的全部分支/提交/路径树、删除记录、敏感文件历史扫描、gitignore 有效性。
- **2.0 实现（e4df8a6 + WIP）**：逐层阅读全部 44 个 TS/TSX 源码文件与配置（package.json、tsconfig×3、vite、eslint、capacitor、_headers、wrangler）。
- **Android 工程**：Gradle 配置（AGP/Gradle/SDK 版本）、AndroidManifest 权限、MainActivity、NotificationChannels、PushTokenPlugin、SixuFirebaseMessagingService、ProGuard、签名方案。
- **测试与 CI**：tests/（esbuild 打包 + node 运行的零依赖单元测试）、.github/workflows/ci.yml（build/android/release 三 job）。
- **1.0 仓库（只读）**：27 个文件逐类核对（README 业务规则、lib/weather.ts 单体模块、components/、hooks/）。
- **验证执行**：Node v24.22.2 / npm 11.19.1，干净依赖树下 lint、test、build、audit 实跑。

## 2. 仓库基线对照

| 项目 | 1.0 | 2.0 完整实现（e4df8a6） | 2.0 分阶段工作区（04cfb0c，当前） |
|---|---|---|---|
| 受控文件数 | 27 | 约 120（含 android/res/docs） | 13（规则 + README + prompts×10 + 本审计文档） |
| 技术栈 | React 19 + Vite 7 + TS 5.9 | 同上 + Capacitor 8 全家桶 | 无（待阶段 01 起重建） |
| 测试 | 无 | 52 例零依赖单元测试（node 运行） | 无 |
| CI | 无 | lint+build / android debug / release 三 job | 无（待阶段 08 重建） |
| 部署 | Cloudflare Pages 文档 | 同上 + wrangler.toml + `npm run deploy` | 无 |
| 依赖漏洞 | 0（prod） | 0（prod） | 无依赖 |

## 3. 2.0 实现审计（按层）

### 3.1 UI 展示层 `src/ui/components/`（7 组件 + App.css 787 行）

- `Atmosphere.tsx`（189 行）：Canvas 2D 粒子（雨 64 / 雪 46 / 星 52 / 季节装饰 22 基准，移动端约减半）、30fps 上限、DPR 上限 1.5、页面后台暂停、`prefers-reduced-motion` 与动画总开关；CSS 负责云/雾/光晕/热浪。**性能预算与 1.0 一致且有实现**。
- `CityDialog.tsx`：中文搜索（380ms 防抖、取消前次请求）、经纬度查询、收藏/最近、定位入口。
- `HourlyForecast.tsx` / `DailyForecast.tsx`：24h SVG 温度曲线（内部横向滚动）、7 日高低温区间。
- `SunArc.tsx`：日出日落日照弧与进度。
- `SettingsDialog.tsx`：单位、季节、视觉风格、动画、触觉、本地数据清除、FCM 令牌展示。
- `SubscriptionsDialog.tsx`（195 行，2.0 新增）：订阅地点/时间/规则/启停管理。
- `WeatherIcon.tsx`：WMO 代码 → SVG 图标。
- 无障碍：skip-link、语义标签、aria 标签、44px 触控、Esc/背景关闭弹窗、骨架屏、role=status 提示条。

### 3.2 页面与路由 `src/pages/`

- 单页 + 哈希锚点路由（`#overview / #hourly / #daily`，与 1.0 一致）；`HomePage.tsx`（217 行，注入式 props）：官方预警区、提示级预警条、hero（大温度/城市时钟/收藏）、指标区、空气质量卡、逐时、七日。
- Android 返回键由 `platform/backButton.ts` 消费（设置>订阅>城市>定位说明的弹层栈），不涉及历史回退。

### 3.3 业务领域层 `src/domain/`（8 个纯函数模块）

- `weather.ts`：WMO 中文描述、天气归类（clear/cloud/overcast/fog/rain/snow/thunder）、°C/°F、km/h↔m/s、风向、UV、能见度。**与 1.0 业务规则一致**。
- `time.ts`：所有"城市当地时间"经 `Intl.DateTimeFormat(timeZone)` 计算，不依赖设备时区；h23 小时制。
- `solar.ts`：昼夜四阶段（晨曦/白昼/日暮/夜晚，日出日落 ±45 分钟窗口）、日照进度；缺失字段回退 `current.is_day`，进度兜底 06:00/18:00（与 1.0 语义一致，形式简化）。
- `seasons.ts`：按城市当地月份 + 纬度半球划分四季，南北半球反转。
- `air.ts`（2.0 新增）：US AQI 六级分级与建议、首要污染物估算。
- `alerts.ts`（2.0 新增）：由预报推导提示级预警（雷电/强降水/大风/高温/寒潮/降雪/大雾/强紫外线），规则集中、纯函数。
- `cities.ts`：收藏上限 12、最近上限 6、去重置顶。
- `subscriptions.ts`（2.0 新增）：订阅 CRUD（上限 10）+ "订阅 × 天气 + 官方预警 → 通知候选"纯函数评估引擎（含 dedupeKey、官方预警最多 3 条）。

### 3.4 数据服务层 `src/services/`

- `weather/api.ts`（192 行）：Open-Meteo forecast（12s 超时）+ air-quality（10s，失败降级 null 不阻断）并行；BigDataCloud 逆地理；geocoding 中文搜索；3 秒客户端节流；429/5xx/离线/超时分别中文提示；`timezone=auto`；forecast_days=8 取 7 日。
- `weather/warnings.ts`（167 行）：中央气象台 nmc.cn 公开接口（全国列表 pageSize=500 一次拉全 + 客户端按城市过滤）；标题正则解析（发布单位/类型/红橙黄蓝级别）；行政区划后缀剥离匹配；issuetime 按 +08:00 解析；10 分钟缓存（内存 + 持久化双级），失败静默兜底，不阻断主流程。
- `notifications/scheduler.ts`（121 行）：30 秒 tick；城市当地时间到达订阅时刻后评估派发；红/橙官方预警立即推送不等时刻；dedupeKey 落盘 7 天；Android 每次 tick 幂等刷新原生每日调度；**Web 端仅页面打开时运行（浏览器限制，文档已声明）**。

### 3.5 配置层 `src/config/`

- `keys.ts`：11 个 localStorage 键全部沿用 1.0 的 `sixu-*-v1` 命名——**1.0 用户本地数据（城市/偏好/收藏/天气缓存）升级后自动继承**；含订阅、已通知、预警缓存等 2.0 新键。
- `preferences.ts`：默认北京 + 默认偏好，读写经平台存储层。

### 3.6 主题层 `src/theme/index.ts`

- "季节 × 昼夜 × 天气 × 用户偏好（含跟随系统）" → 根样式类决策（style-scene/style-dark/style-light）；暗色场景联动 Android 状态栏文字色；色板本体在 App.css 的 CSS 变量 + `data-season/data-phase/data-kind` 选择器。

### 3.7 平台适配层 `src/platform/`（10 模块，Web 自动降级）

- `native.ts`：`Capacitor.isNativePlatform()` 为唯一平台判断源。
- `storage.ts`：Web=localStorage 同步；Android=Preferences 双写 + 启动预热进内存，业务层保持同步 API。
- `geolocation.ts`：Web=navigator.geolocation（HTTPS 校验）；Android=@capacitor/geolocation，v8 字符串错误码逐码中文映射（**WIP 改进**，已含 10 个 OS-PLUG-GLOC 码）。
- `notifications.ts`：Web=Notification API；Android=local-notifications + 三渠道（每日天气/天气提醒/天气预警）幂等创建；点击载荷回调。
- `push.ts`：FCM 令牌桥接（自定义 PushToken 插件），无 google-services.json 时安全降级 null。
- `network.ts` / `backButton.ts` / `statusBar.ts` / `splash.ts` / `haptics.ts`：在线监听、返回键、状态栏深浅、启动屏淡出、轻振动（Web 静默）。

### 3.8 Android 原生层 `android/`

- Capacitor 8（`@capacitor/core 8.6.0` 等 8 个官方插件）；appId `com.minamikune.sixuweather`，应用名「四序天气」。
- 工具链：AGP 9.5.1 · Gradle 9.8.2（wrapper 固定）· compileSdk/targetSdk 37 · minSdk 24 · build-tools 37.0.0 · JDK 21。
- `MainActivity.java`：注册 PushTokenPlugin、渠道兜底创建、FCM 点击载荷暂存（onCreate/onNewIntent）。
- `PushTokenPlugin.java`：isAvailable/getToken/consumeTapPayload，Firebase 未初始化时安全降级。
- `SixuFirebaseMessagingService.java`：下行消息直接发系统通知（默认归入 warning 高重要性渠道），onNewToken 缓存。
- `NotificationChannels.java`：三渠道定义，与 TS 层一致。
- Manifest：INTERNET、定位（前/粗）、POST_NOTIFICATIONS、SCHEDULE_EXACT_ALARM、RECEIVE_BOOT_COMPLETED、VIBRATE；`usesCleartextTraffic=false`；WebView 未开调试。
- 签名：debug 自包含 keystore；release 经 `keystore.properties`（gitignore）+ CI Secrets 注入；无 Secrets 时产出未签名 release 并显式警告。

### 3.9 测试 `tests/`

- 零外部依赖：esbuild 打包 → node 运行。6 套件 52 例：air 2 · api 7（错误路径/429/超时/取消）· geolocation 3（WIP 新增）· solar 11 · subscriptions 16 · warnings 13。
- fixtures 构造假 WeatherData，不触网。**缺口：CI 未接入 `npm test`；无 UI/E2E 测试入库**（.pw-browsers/.tmp-e2e 是此前临时验收残留）。

### 3.10 CI/CD 与部署

- `.github/workflows/ci.yml`：①lint+build ②Android debug APK（SDK 37 安装 + cap:sync + assembleDebug + artifact）③release（Secrets 完备则签名 APK/AAB + apksigner 校验，否则未签名产物 + warning）。最小权限 `contents: read`、并发取消、超时 10/30 分钟。**该 workflow 在 04cfb0c 中已被删除，阶段 08 需重建（可直接以 e4df8a6 版本为基线）**。
- 部署：Cloudflare Pages；`wrangler.toml`（项目名 sixu-weather-2-0）；`public/_headers`（HTML must-revalidate、哈希资源一年缓存、HSTS/nosniff/frame-deny/permissions-policy 限定位 self）。

## 4. 1.0 仓库只读分析

- **形态**：纯前端单页、无后端无密钥无测试无 CI，React 19 + Vite 7；`src/lib/weather.ts` 单体（API+类型+单位+季节+昼夜+格式化混在一起），`src/components/` 6 组件，hooks 仅 useWeather。
- **功能全集**：当前天气 12 项指标、24h/7d 预报、浏览器定位、中文城市搜索、经纬度查询、收藏/最近/自动保存、四季（南北半球）、昼夜四阶段、Canvas 天气动画、°C/°F 与 km/h/m/s、10 分钟缓存与缓存回退、12s 超时、骨架屏/空状态、无障碍、**明确不展示空气质量**。
- **与 2.0 的差异**：全部为 2.0 的超集覆盖；唯一两处"不同而非缺失"：
  1. 空气质量——1.0 因"无可靠数据源"主动不做；2.0 接入 Open-Meteo CAMS 模式数据并加"仅供参考"免责（产品决策升级，迁移时保留该免责声明）。
  2. 昼夜兜底——1.0 用 06:00/18:00 固定偏移推阶段；2.0 优先 `current.is_day`，仅日照进度用 06:00/18:00 兜底（更精确，语义兼容）。
- **已淘汰、不应回迁的 1.0 资产**：`react-router` 依赖（1.0 只用了 BrowserRouter 包裹，2.0 已用哈希锚点替代并移除依赖）；单体 `lib/weather.ts` 组织方式（2.0 已拆分为 domain/services 八层）。

## 5. 可复用 / 损坏 / 缺失 判定

| 判定 | 资产 | 说明 |
|---|---|---|
| ✅ 可复用（已验证） | src/ 全部 44 个 TS/TSX、tests/ 52 例、android/ 工程、capacitor.config.ts、vite.config.ts、tsconfig×3、public/_headers、wrangler.toml、eslint.config.js（含 WIP 忽略项）、.gitignore、index.html、CREDITS.md、resources/、docs/ 设计系统与阶段报告 | lint/test/build/audit 四项本机全绿；按 `git archive e4df8a6` 或 archive 分支即可整体恢复 |
| ✅ 可复用（需小改） | .github/workflows/ci.yml | 补 `npm test` job、Playwright 分层（阶段 07/08） |
| ⚠️ 待合入 WIP | `wip/geolocation-native-error-codes` 分支（5 文件） | Capacitor v8 定位错误码映射，52/52 测试通过，阶段 01 直接合并 |
| ⚠️ 有意废弃 | 旧 README.md（e4df8a6 版，286 行） | 功能文档价值高，其内容应拆解进阶段 01 的 DEVELOPMENT_GUIDE 与新 README |
| ❌ 缺失 | Playwright E2E、npm test 的 CI 接入、版本号管理（package.json 仍 1.0.0）、CHANGELOG | 按计划由阶段 07/08/09 补齐 |

## 6. 安全 / 性能 / 无障碍 / 移动端核查

- **安全**：客户端零密钥；三个数据源均为公开 GET；Manifest 禁明文；_headers 安全头齐全（无 CSP，README 已说明添加 CSP 时需把三个 API 域加入 connect-src）；全历史无密钥入库；GitHub Secrets 仅存 CI。**遗留：工作区根目录有 keystore 副本文件（未入库），建议移出工作区或删除**（见 RISK_REGISTER R-07）。
- **性能**：粒子预算、30fps、DPR≤1.5、后台暂停、transform/opacity 动画均已实现；主包 gzip 94 kB 合理；3 秒请求节流保护免费额度。
- **无障碍**：skip-link、aria、键盘/Esc、44px 触控、prefers-reduced-motion、对比度由设计系统文档约束；无自动化检查入库（阶段 03/07 补 Playwright）。
- **移动端**：375–1440px 响应式、移动底部导航、安全区、横滚隔离在逐时图内部；`.tmp-e2e`/截图证据见 docs/reports/phase-3。

## 7. 迁移映射与优先级建议（阶段 01–09 入口）

| 阶段 | 主要输入（来源） | 优先级 | 依赖 |
|---|---|---|---|
| 01 迁移与基线 | src/、tests/、config、public/、index.html、package*.json 自 `e4df8a6` 恢复；合入 WIP 分支；旧 README 内容拆入 DEVELOPMENT_GUIDE | P0 | 本审计 |
| 02 架构与数据层 | 八层结构已在 e4df8a6 就位，需对照本审计复核数据模型/缓存/错误状态一致性 | P0 | 01 |
| 03 视觉系统 | App.css 787 行 + docs/design-system.md + phase-3 报告/截图 | P1 | 01 |
| 04 天气/时区/日出日落 | domain/time·solar + services/api + solar 11 例测试；补 DST/极区/跨日边界 | P0 | 01 |
| 05 订阅与推送 | domain/subscriptions、services/notifications、platform/notifications·push、android FCM 资产 | P1 | 02 |
| 06 Capacitor Android | android/ 工程整体（AGP 9.5.1/Gradle 9.8.2/SDK 37 工具链需云端复核） | P1 | 01 |
| 07 QA | tests/ 52 例 + 补 Playwright E2E、npm test 接入 | P0 | 02–04 |
| 08 CI/CD | e4df8a6 版 ci.yml 为基线增补 | P1 | 07 |
| 09 发布 | docs/ 既有阶段报告 + RELEASE_* 三件套 | P2 | 08 |

## 8. 本阶段产出与验证命令

- 产出：本文件 + FEATURE_INVENTORY + TECHNICAL_ARCHITECTURE + RISK_REGISTER + progress/PHASE-00。
- 验证命令（在 e4df8a6 工作树上执行，均通过）：`npm run lint` · `npm test`（52/52）· `npm run build` · `npm audit --omit=dev`（0）。
- 保全动作：`archive/full-2.0-e4df8a6`（e4df8a6 镜像）、`wip/geolocation-native-error-codes`（WIP 提交）、main 重置到 04cfb0c。
