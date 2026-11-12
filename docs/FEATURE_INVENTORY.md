# 2.0 功能清单（FEATURE INVENTORY）

> 审计基线：`e4df8a6`（2.0 完整实现）对 `ca24d63`（1.0 源仓库）。「来源」列：✅=1.0 已有且 2.0 保留 · ⬆️=2.0 增强/替代 · 🆕=2.0 新增 · ⛔=1.0 有但有意废弃 · —=不变更。测试状态标注按 00-MASTER-RULES。

## A. 核心天气与数据

| # | 功能 | 来源 | 实现位置 | 验证状态 |
|---|---|---|---|---|
| A1 | 当前天气 12 项指标（温度/体感/湿度/露点/气压/云量/UV/能见度/风/降水概率/降水/降雪深度），°C/°F 切换 | ✅ | domain/weather.ts · services/weather/api.ts · pages/HomePage.tsx | PASS-AUTOMATED（间接，api 7 例）+ PASS-BUILD-ONLY |
| A2 | 24 小时逐时预报，SVG 温度曲线（内部横向滚动） | ✅ | ui/components/HourlyForecast.tsx | PASS-BUILD-ONLY |
| A3 | 7 日逐日预报，高低温区间条 | ✅ | ui/components/DailyForecast.tsx | PASS-BUILD-ONLY |
| A4 | 数据源 Open-Meteo forecast（`timezone=auto`，forecast_days=8 取 7 日，12s 超时） | ✅ | services/weather/api.ts | PASS-AUTOMATED（api 错误路径/超时/取消 7 例） |
| A5 | 空气质量卡（US AQI 六级 + 首要污染物 + 健康建议 + "仅供参考"免责） | ⬆️（1.0 明确不做，2.0 用 Open-Meteo CAMS 模式数据新增） | domain/air.ts · services/weather/api.ts（air-quality 10s 并行，失败降级 null 不阻断） | PASS-AUTOMATED（air 2 例） |
| A6 | BigDataCloud 逆地理（中文地名） | ✅ | services/weather/api.ts | PASS-BUILD-ONLY |
| A7 | 3 秒请求节流、AbortController 去重、429/5xx/离线/超时中文提示 | ⬆️ | services/weather/api.ts · hooks/useWeather.ts | PASS-AUTOMATED |
| A8 | 10 分钟天气缓存 + 失败读缓存 + 8 城缓存上限 | ✅ | hooks/useWeather.ts · config/keys.ts（sixu-weather-cache-v1） | PASS-AUTOMATED（间接） |

## B. 定位与城市

| # | 功能 | 来源 | 实现位置 | 验证状态 |
|---|---|---|---|---|
| B1 | 浏览器定位（HTTPS 校验、错误提示） | ✅ | platform/geolocation.ts（Web 分支） | PASS-AUTOMATED（geolocation 3 例） |
| B2 | Capacitor 原生定位（v8 错误码→中文逐码映射） | ⬆️（WIP） | platform/geolocation.ts（Native 分支） | PASS-AUTOMATED（WIP 3 例）· 真机待 PENDING-DEVICE |
| B3 | 中文城市搜索（380ms 防抖、取消前次、收藏/最近/定位入口） | ✅ | ui/components/CityDialog.tsx · services/weather/api.ts（geocoding） | PASS-BUILD-ONLY |
| B4 | 经纬度精确查询 | ✅ | ui/components/CityDialog.tsx | PASS-BUILD-ONLY |
| B5 | 收藏上限 12 / 最近上限 6 / 去重置顶 / 自动保存，1.0 localStorage 键沿用自动继承 | ✅ | domain/cities.ts · config/keys.ts | PASS-AUTOMATED（subscriptions 套件含边界，间接） |

## C. 时区、日出日落、季节

| # | 功能 | 来源 | 实现位置 | 验证状态 |
|---|---|---|---|---|
| C1 | 城市当地时间（`Intl.DateTimeFormat(timeZone)`，不依赖设备时区，h23） | ⬆️（1.0 用固定 UTC+8，2.0 国际化） | domain/time.ts | PASS-AUTOMATED（solar 11 例间接覆盖） |
| C2 | 日出日落日照弧 + 进度 | ✅ | ui/components/SunArc.tsx · domain/solar.ts | PASS-AUTOMATED（solar 11 例） |
| C3 | 昼夜四阶段（晨曦/白昼/日暮/夜晚，日出日落 ±45min）；缺失字段回退 `current.is_day`，进度兜底 06:00/18:00 | ⬆️（兜底形式从固定偏移简化为 is_day 优先） | domain/solar.ts · theme/index.ts | PASS-AUTOMATED（solar 11 例） |
| C4 | 四季判定（当地月份 + 纬度半球，南北半球反转） | ✅ | domain/seasons.ts | PASS-BUILD-ONLY |

## D. 视觉与主题

| # | 功能 | 来源 | 实现位置 | 验证状态 |
|---|---|---|---|---|
| D1 | 季节 × 昼夜 × 天气 × 用户偏好（跟随系统）→ style-scene/style-dark/style-light 主题决策 | ✅ | theme/index.ts · App.css（CSS 变量 + data-season/data-phase/data-kind） | PASS-BUILD-ONLY |
| D2 | Canvas 天气粒子：雨 64/雪 46/星 52/季节装饰 22（移动端约减半）、30fps、DPR≤1.5、后台暂停 | ✅ | ui/components/Atmosphere.tsx（189 行） | PASS-BUILD-ONLY |
| D3 | 云/雾/光晕/热浪（CSS）、热浪色差位移 | ✅ | App.css | PASS-BUILD-ONLY |
| D4 | 动画总开关 + prefers-reduced-motion 双关断 | ✅ | ui/components/Atmosphere.tsx · SettingsDialog.tsx | PASS-BUILD-ONLY |
| D5 | 暗色场景联动 Android 状态栏文字色 | ✅ | theme/index.ts · platform/statusBar.ts | PENDING-DEVICE |
| D6 | 设计系统（色板/对比度/触控/动效预算） | ✅ | docs/design-system.md · App.css | PASS-BUILD-ONLY（人工文档评审） |

## E. 预警与通知

| # | 功能 | 来源 | 实现位置 | 验证状态 |
|---|---|---|---|---|
| E1 | 中央气象台官方预警（nmc.cn 公开接口、全国列表客户端过滤、标题正则解析红橙黄蓝、issuetime +08:00、10min 双级缓存、失败静默兜底） | 🆕 | services/weather/warnings.ts（167 行） | PASS-AUTOMATED（warnings 13 例） |
| E2 | 预报推导提示级预警（雷电/强降水/大风/高温/寒潮/降雪/大雾/强紫外线，页面提示条） | 🆕 | domain/alerts.ts · pages/HomePage.tsx | PASS-AUTOMATED（间接） |
| E3 | 订阅系统（地点/时间/规则/启停，上限 10，评估引擎输出通知候选 + dedupeKey） | 🆕 | domain/subscriptions.ts · ui/components/SubscriptionsDialog.tsx | PASS-AUTOMATED（subscriptions 16 例） |
| E4 | 通知调度器（30s tick、城市当地时间触发、红橙预警立即推、dedupe 落盘 7 天、Android 幂等刷新原生调度） | 🆕 | services/notifications/scheduler.ts（121 行） | PASS-BUILD-ONLY（单元测试未覆盖，阶段 07 补）· Web 受浏览器限制仅页面打开时运行（文档已声明） |
| E5 | 通知渠道：Web Notification API；Android local-notifications 三渠道（每日天气/天气提醒/天气预警） | 🆕 | platform/notifications.ts · android/NotificationChannels.java | Web PASS-BUILD-ONLY · Android PENDING-DEVICE |
| E6 | FCM 推送（令牌桥 PushTokenPlugin、下行消息直接发系统通知、无 google-services.json 安全降级 null） | 🆕 | platform/push.ts · android/PushTokenPlugin.java · SixuFirebaseMessagingService.java | BLOCKED-CONFIG（缺 google-services.json）· 有令牌降级路径 PASS-BUILD-ONLY |
| E7 | 设置页 FCM 令牌展示、本地数据清除 | 🆕 | ui/components/SettingsDialog.tsx | PASS-BUILD-ONLY |

## F. 平台与移动端

| # | 功能 | 来源 | 实现位置 | 验证状态 |
|---|---|---|---|---|
| F1 | Capacitor 8 容器（8 官方插件）、appId com.minamikune.sixuweather、应用名「四序天气」 | ✅ | capacitor.config.ts · android/ | PASS-BUILD-ONLY |
| F2 | Android 返回键消费（弹层栈：设置>订阅>城市>定位说明） | 🆕 | platform/backButton.ts · MainActivity.java | PENDING-DEVICE |
| F3 | 存储双写（Web=localStorage；Android=Preferences 双写+启动预热，业务层保持同步 API） | ✅ | platform/storage.ts | PASS-BUILD-ONLY |
| F4 | 在线状态监听、启动屏淡出、触觉反馈（Web 静默） | ✅ | platform/network.ts · splash.ts · haptics.ts | PENDING-DEVICE（Android）/ PASS-BUILD-ONLY（Web） |
| F5 | Android 工具链：AGP 9.5.1 · Gradle 9.8.2 · compileSdk/targetSdk 37 · minSdk 24 · JDK 21 · release 签名（Secrets 注入，无 Secrets 产出未签名+警告） | ✅ | android/（gradle 文件）· .github/workflows/ci.yml | PASS-BUILD-ONLY（本地 assemble 历史成功；云端 SDK 37 安装路径阶段 06 复核） |
| F6 | 响应式 375–1440px、移动底部导航、安全区、44px 触控 | ✅ | App.css · pages/HomePage.tsx | PASS-BUILD-ONLY（前期截图验收） |

## G. 工程化

| # | 功能 | 来源 | 实现位置 | 验证状态 |
|---|---|---|---|---|
| G1 | 单元测试 52 例（零依赖 esbuild+node）：air 2/api 7/geolocation 3/solar 11/subscriptions 16/warnings 13 | 🆕 | tests/ | PASS-AUTOMATED（52/52） |
| G2 | CI 三 job：lint+build / Android debug APK artifact / release 签名或降级 | 🆕 | .github/workflows/ci.yml（04cfb0c 已删，阶段 08 重建） | PASS-BUILD-ONLY（曾运行） |
| G3 | 部署：Cloudflare Pages + wrangler.toml（sixu-weather-2-0）+ `npm run deploy` | ✅ | wrangler.toml · public/_headers | PASS-BUILD-ONLY |
| G4 | 安全：_headers（HSTS/nosniff/frame-deny/permissions-policy 限定位 self）、Manifest usesCleartextTraffic=false、零客户端密钥、gitignore 覆盖 jks/keystore/google-services | ✅ | public/_headers · android/ | PASS-BUILD-ONLY |
| G5 | 无障碍：skip-link、aria、键盘/Esc、骨架屏、role=status | ✅ | 各组件 | PASS-BUILD-ONLY（无自动化检查，阶段 03/07 补 Playwright） |

## H. 1.0 有而 2.0 废弃（有意，不回迁）

| 资产 | 处置 | 理由 |
|---|---|---|
| `react-router` 依赖 | ⛔ 移除 | 1.0 仅用 BrowserRouter 包裹，2.0 哈希锚点替代，少一个依赖 |
| `src/lib/weather.ts` 单体模块 | ⛔ 拆解 | 拆为 domain/services/config 八层，单体组织方式废弃 |
| 旧 README（286 行功能文档） | ⛔ 待拆 | 内容价值高，阶段 01 拆入 DEVELOPMENT_GUIDE 与新 README |

## I. 1.0 无而 2.0 缺失（待后续阶段补齐）

| 缺口 | 责任阶段 | 说明 |
|---|---|---|
| Playwright E2E 入库 | 07 QA | 此前仅临时脚本（.tmp-e2e/.pw-browsers 残留） |
| CI 接入 `npm test` | 08 CI/CD | e4df8a6 版 ci.yml 无 test job |
| 版本号管理 / CHANGELOG | 09 发布 | package.json 仍 1.0.0 |
