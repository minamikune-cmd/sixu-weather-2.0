# 2.0 技术架构报告（TECHNICAL ARCHITECTURE）

> 基线：`e4df8a6`；**阶段 02 修订**（2026-11-13）：补强数据层有界重试、客户端环境变量校验、安全日志脱敏，并补充数据流图与配置说明（详见 [CONFIGURATION.md](./CONFIGURATION.md)）。
> 架构原则：纯函数领域层 + 注入式页面 + 平台抽象层（Web 自动降级）+ 依赖倒置（pages → 注入 props；domain 无 IO）。1.0 的单体 `lib/weather.ts` 已按职责拆为八层。

## 1. 分层视图

```
┌────────────────────────────────────────────────────────────┐
│ pages/        HomePage.tsx（217 行，注入式）+ routes.ts     │  ← 哈希锚点 #overview/#hourly/#daily
│ ui/components 7 个：Atmosphere · CityDialog · Hourly ·     │
│               Daily · SunArc · Settings · Subscriptions    │  ← App.css 787 行（CSS 变量主题）
├────────────────────────────────────────────────────────────┤
│ theme/        index.ts 决策 style-scene/dark/light          │  ← 季节×昼夜×天气×偏好 → 根样式类
├────────────────────────────────────────────────────────────┤
│ hooks/        useWeather（10min TTL/8城缓存/Abort）·         │
│               useWarnings · useDialogFocus                  │
├────────────────────────────────────────────────────────────┤
│ domain/       8 纯函数模块，零 IO、零框架依赖：             │
│   weather · time · solar · seasons · air · alerts ·        │
│   cities · subscriptions                                    │
├────────────────────────────────────────────────────────────┤
│ services/     weather/api.ts（192）· weather/warnings.ts    │
│               （167）· notifications/scheduler.ts（121）    │
├────────────────────────────────────────────────────────────┤
│ config/       keys.ts（11 个 sixu-*-v1 键，兼容 1.0）·       │
│               preferences.ts                                │
├────────────────────────────────────────────────────────────┤
│ platform/     10 模块，唯一平台判断源 native.ts：           │
│   storage · geolocation · notifications · push · network · │
│   backButton · statusBar · splash · haptics                 │
├────────────────────────────────────────────────────────────┤
│ types/        共享类型                                      │
└────────────────────────────────────────────────────────────┘
      │ Web：index.html + Vite        │ Android：Capacitor 8 容器
      ▼                               ▼
  Cloudflare Pages              android/（MainActivity +
  (_headers/wrangler)           PushTokenPlugin + FCM Service +
                                NotificationChannels）
```

依赖方向：pages → hooks/services → domain；platform 被 services/hooks 调用且 Web 分支自动降级；domain 只被上层调用，不反向依赖。1.0 的 `src/lib/weather.ts` 对应关系：类型→types/、单位/天气归类→domain/weather、API→services/weather/api、昼夜→domain/solar、季节→domain/seasons、缓存键→config/keys。

## 2. 技术栈与关键版本

| 层 | 选型 | 版本 | 备注 |
|---|---|---|---|
| 语言/构建 | TypeScript 5.9 + Vite 7 | TS ^5.9.x · Vite ^7.x | tsconfig×3（app/node/tests 分离，无 `any` 逃逸） |
| UI | React 19 | ^19.x | 无路由库（哈希锚点） |
| 移动端 | Capacitor 8 | core 8.6.0 等 8 插件 | appId com.minamikune.sixuweather |
| Android | AGP 9.5.1 · Gradle 9.8.2（wrapper）· JDK 21 · compileSdk/targetSdk 37 · minSdk 24 · build-tools 37.0.0 | — | SDK 37 需 CI 手动安装路径（阶段 06 复核） |
| 测试 | esbuild + node（零依赖） | — | 6 套件 52 例 |
| CI | GitHub Actions（lint+build / android debug / release） | — | 04cfb0c 已删，阶段 08 重建 |
| 部署 | Cloudflare Pages + Wrangler | — | 项目 sixu-weather-2-0 |
| 数据源 | Open-Meteo forecast + air-quality（CAMS）、BigDataCloud 逆地理、中央气象台 nmc.cn findAlarm | — | 全部公开 GET，无密钥 |

## 3. 关键设计决策与机制

1. **数据流**：useWeather 是唯一数据入口（AbortController 去重、10min TTL、8 城 LRU、失败读缓存）；useWarnings 10min 双级缓存；调度器 30s tick 评估订阅。页面通过注入 props 接收，组件可独立测试。
2. **时区正确性**：所有"城市当地时间"经 `Intl.DateTimeFormat(timeZone)`（API 返回 IANA 时区）计算，跨时区/夏令时与设备时区解耦；h23 小时制；issuetime 按 +08:00 解析（中央气象台惯例）。
3. **昼夜/季节**：solar 以日出日落 ±45min 窗口分四阶段，缺失字段回退 `current.is_day`，日照进度兜底 06:00/18:00（与 1.0 语义一致）；seasons 按当地月份 + 纬度半球反转。
4. **性能预算**：粒子硬预算（雨 64/雪 46/星 52，移动端约减半）、30fps 上限、DPR≤1.5、visibilitychange 后台暂停、transform/opacity 动画、主包 gzip 94.2 kB。
5. **降级哲学**：air-quality 失败→null 不阻断；预警接口失败→静默兜底；FCM 无 google-services.json→令牌 null 安全降级；Android 存储双写+预热让业务层保持同步 API。
6. **密钥管理**：零客户端密钥；签名材料只存在于 CI Secrets + 本地 keystore.properties（gitignore）；FCM 配置 google-services.json 不入库。
7. **兼容 1.0**：11 个 localStorage 键沿用 `sixu-*-v1`，1.0 用户升级后城市/偏好/收藏/缓存自动继承。

## 4. 测试策略现状

- **单元**（52/52 通过）：air 2 · api 7（错误路径/429/超时/取消）· geolocation 3（WIP）· solar 11 · subscriptions 16 · warnings 13；fixtures 构造假数据不触网。
- **缺口**：调度器 scheduler.ts、主题 theme、UI 组件无单元覆盖；无 Playwright E2E 入库；CI 未接入 `npm test`。责任阶段 07。

## 5. 部署与安全架构

- Cloudflare Pages：HTML must-revalidate、哈希资源一年缓存；_headers 含 HSTS/nosniff/frame-deny/permissions-policy（geolocation self）；无 CSP（添加时需把三个 API 域写入 connect-src，README 已说明）。
- Android：Manifest 权限最小化（INTERNET/定位/POST_NOTIFICATIONS/SCHEDULE_EXACT_ALARM/RECEIVE_BOOT_COMPLETED/VIBRATE）；usesCleartextTraffic=false；WebView 未开调试；release 签名 Secrets 注入，无 Secrets 时未签名产物 + 显式警告。
- 验证：`npm run lint` 0 错误 · `npm test` 52/52 · `npm run build` 成功（285.9 kB/gzip 94.2 kB）· `npm audit --omit=dev` 0 漏洞。

## 6. 数据流图

### 6.1 启动初始化

```
main.tsx
  └─ validateClientEnv(import.meta.env)      // config/env.ts：扫描 VITE_* 疑似密钥，告警不阻断
  └─ initPlatform()                          // platform/index.ts
       ├─ initStorage()                      // 原生端 Preferences 全量预热进内存
       ├─ configureStatusBar()               // 仅原生
       ├─ registerBackHandler()              // 仅原生
       └─ ensureNotificationChannels()       // 仅原生，幂等建 3 渠道（daily/reminder/warning）
  └─ createRoot(<App/>)
  └─ hideSplash()                            // 仅原生
App
  └─ 同步读缓存首帧：loadSavedCity / loadPreferences / loadFavorites / loadRecent / loadSubscriptions
  └─ useWeather(city) / useWarnings(city)
  └─ startNotificationScheduler()            // 30s tick 评估订阅（services/notifications/scheduler）
```

### 6.2 主天气数据流（useWeather 为唯一入口）

```
城市切换 / 手动刷新
  │
  ▼
useWeather.load()
  │  ① AbortController 去重（同 key 进行中请求直接忽略；新请求取消旧请求）
  │  ② 命中缓存（fetchedAt < 10min TTL）→ 立即渲染缓存，后台静默刷新
  │  ③ 无缓存 → loading 态
  ▼
fetchWeather(city)                           // services/weather/api.ts
  │  ├─ throttle()：任意两次 API 请求 ≥3s 间隔（客户端限流）
  │  ├─ fetchJson(forecast)  ──┐ 并行
  │  └─ fetchJson(airQuality) ─┘ 失败降级 null 不阻断
  │     fetchJson 内部：12s 超时 + 有界重试（仅 5xx/网络异常/单次超时，最多 1 次 ×400ms，
  │     不重试 429/4xx/离线/调用方取消）
  ▼
映射为 WeatherData（统一天气数据模型，types/weather.ts）
  │
  ├─ 成功 → saveWeather() 写缓存（8 城 LRU，DATA_KEY）→ setData
  ├─ 失败 + 有缓存 → 渲染缓存 + error「已显示上次缓存」
  └─ 失败 + 无缓存 → error 文案（429/超时/断网/状态码各自区分）
```

### 6.3 预警数据流（增强信息，不阻断主流程）

```
useWarnings(city)
  └─ fetchWarnings(city)                     // services/weather/warnings.ts
       ├─ 内存/存储双级缓存（WARNINGS_KEY，10min TTL，全国列表一份）
       ├─ 过期 → 拉取 nmc.cn findAlarm（12s 超时，pageSize=500）
       │    → parseWarning（标题正则）→ filterWarningsForCity（城市/省份后缀剥离匹配）
       │    → sortWarnings（级别权重 + 发布时间）
       └─ 任何失败 → 静默退回过期缓存；无缓存 → 空列表（不抛出）
```

### 6.4 平台能力调用边界

```
业务层（hooks/services/pages）
  │  只调用 platform/ 暴露的接口
  ▼
platform/（唯一平台判断源：native.ts）
  ├─ storage：原生 Preferences / Web localStorage（同步 API，原生双写+预热）
  ├─ geolocation：原生插件（OS-PLUG-GLOC 错误码中文映射）/ Web navigator.geolocation（HTTPS 限制）
  ├─ notifications：原生本地通知（3 渠道）/ Web Notification API（页面关闭不可达）
  ├─ push：FCM 令牌（无 google-services.json 时全接口安全降级 null/false）
  ├─ network：原生插件 / Web online+offline 事件
  └─ log：安全日志出口（只含 name/code/message 原始字段，见 §3.8）
```

## 7. 阶段 02 修订要点

1. **有界重试策略**（`services/weather/api.ts`）：`fetchJson` 对 5xx、网络层 TypeError、单次请求超时重试 1 次（间隔 400ms）；429/4xx（服务端明确拒绝，重试加剧限流）、已断网（`navigator.onLine=false`）、调用方取消（`signal.aborted`）一律不重试。对外错误文案与阶段 01 完全一致。
2. **客户端环境变量校验**（`config/env.ts`）：启动时扫描 `import.meta.env`，凡 `VITE_*` 且命名命中密钥惯例（key/token/secret/password/private/credential，大小写与 `-`/`_` 变体）即 `console.warn` 告警（只输出键名，绝不输出值）并返回 false，不阻断启动。本应用数据源全部免密钥，正常扫描恒为空。
3. **安全日志脱敏**（`platform/log.ts`）：新增统一错误日志出口 `logError(tag, error)` / `describeError`，只提取 `name/code/message` 原始类型字段，嵌套对象（可能携带坐标、FCM 令牌等）一律省略；`platform/geolocation.ts` 原生失败日志已从 dump 整个错误对象切换为该出口。
4. **测试**：新增 18 例（有界重试 6、环境变量校验 6、安全日志 6），总计 10 套件 73 例，全部通过。

## 8. 已知架构风险

见 [RISK_REGISTER.md](./RISK_REGISTER.md)。要点：CI 未跑测试（R-01）、无 E2E（R-02）、Web 通知浏览器限制（R-03）、FCM 配置缺失（R-04）、nmc 预警源单点与 500 条上限（R-05）、Android SDK 37 云端工具链（R-06）、工作区 keystore 残留（R-07）、scheduler 无测试（R-08）、package.json 版本号（R-09）。
