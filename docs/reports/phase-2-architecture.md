# 四序天气 2.0 阶段 2 交付：架构重组与 Capacitor 集成

日期：2026-11-10 · 代码基线：`main`（阶段 2 提交见 Git 历史）

## 1. 1.0 技术栈分析与 2.0 升级方案

1.0 实际栈：React 19 + Vite 7 + TypeScript 5.9（严格模式）+ 原生 CSS（CSS 变量主题）+ Canvas 2D / SVG，数据来自 Open-Meteo（免密钥 HTTPS JSON），状态持久化在 localStorage，部署于 Cloudflare Pages。

升级决策（遵循"不为新技术而无意义重写"）：

- **Web**：原栈原样保留，仅做目录分层重组，零功能回退。
- **Android**：Capacitor 8（`@capacitor/core/cli/android 8.6.0`），WebView 容器直接承载同一 `dist/` 产物，业务代码 100% 共享。
- **构建**：GitHub Actions，Web job（lint + build）与 Android job（cap sync + assembleDebug + APK artifact）并行。
- **原生能力**：经 `src/platform/` 统一桥接，Web 端全部自动降级，无双份业务逻辑。

## 2. 新架构目录树

```
天气项目/
├── src/
│   ├── main.tsx                 # 启动引导：initPlatform() → render → hideSplash()
│   ├── App.tsx                  # 应用外壳：状态编排/网络监听/返回键/状态栏/预警条
│   ├── App.css / index.css      # 全局样式（含 .alerts-strip 新增预警条）
│   ├── types/weather.ts         # 天气数据模型（双端共享）
│   │
│   ├── ui/components/           # ① UI 展示层（git mv 自 src/components/）
│   │   ├── Atmosphere.tsx       #   Canvas 天气粒子场景
│   │   ├── WeatherIcon.tsx      #   WMO 代码 → SVG 图标
│   │   ├── SunArc.tsx           #   日照弧
│   │   ├── HourlyForecast.tsx / DailyForecast.tsx
│   │   ├── CityDialog.tsx / SettingsDialog.tsx
│   │
│   ├── pages/                   # ② 页面和路由层
│   │   ├── HomePage.tsx         #   主页面组合（注入式 props，可双端复用）
│   │   └── routes.ts            #   哈希锚点路由 #overview/#hourly/#daily
│   │
│   ├── domain/                  # ③ 天气业务逻辑层（纯函数，无 IO）
│   │   ├── weather.ts           #   天气描述/单位换算/风向
│   │   ├── time.ts              #   时区换算/本地化时间
│   │   ├── solar.ts             #   日出日落/昼夜阶段
│   │   ├── seasons.ts           #   南北半球四季判断
│   │   ├── alerts.ts            #   buildWeatherAlerts：由预报推导提示级预警
│   │   └── cities.ts            #   收藏/最近城市管理（上限与持久化）
│   │
│   ├── services/weather/        # ④ 天气数据服务层（纯 HTTP + 映射）
│   │   └── api.ts               #   fetchWeather/searchCities/reverseGeocode
│   │
│   ├── config/                  # ⑤ 用户配置层
│   │   ├── keys.ts              #   存储键（与 1.0 的 sixu-*-v1 完全兼容）
│   │   └── preferences.ts       #   默认城市/默认偏好
│   │
│   ├── theme/                   # ⑥ 主题和动画系统
│   │   └── index.ts             #   resolveStyleClass/isDarkChrome/阶段标签
│   │
│   └── platform/                # ⑦ 平台适配层（Capacitor 判断唯一来源）
│       ├── native.ts            #   isNative/isAndroid/isWeb
│       ├── index.ts             #   initPlatform() 初始化入口
│       ├── storage.ts           #   Web=localStorage；Android=Preferences 双写
│       ├── geolocation.ts       #   定位 + 中文错误归一化
│       ├── network.ts           #   在线状态监听
│       ├── statusBar.ts         #   状态栏 overlay + 深浅样式
│       ├── backButton.ts        #   返回键消费栈
│       └── splash.ts            #   启动屏淡出（Web 为空操作）
│
├── android/                     # ⑧ Android 原生能力层（cap add 生成 + 定制）
├── capacitor.config.ts
└── resources/                   # 图标/启动屏矢量源（icon.svg/splash.svg）
```

依赖方向严格单向：`pages → ui/domain/services/config/theme`，`App → platform`，任何下层不反向依赖上层。

## 3. 架构说明

- **App.tsx 成为薄外壳**：只负责状态编排（数据/偏好/城市/弹窗）、网络监听（断网 toast、恢复自动刷新）、返回键消费（设置 > 城市 > 提示 栈）、状态栏深浅同步、预警条注入；页面渲染全部委托 `HomePage`（注入式 props，未来新增页面无需改动外壳）。
- **domain/ 全部纯函数**：`alerts.ts` 的 `buildWeatherAlerts(data)` 由 7 天预报推导提示级预警（雷电、强降水、大风 ≥50 km/h、高温 ≥35 ℃、寒潮 ≤-10 ℃、降雪、能见度 <1000 m、紫外线 ≥8），watch 优先、上限 4 条，在 Web 与 Android 行为完全一致。
- **platform/ 是唯一平台分叉点**：`native.ts` 集中 `Capacitor.isNativePlatform()` 判断；storage/geolocation 等在 Web 分支退回浏览器 API，Android 分支调用 Capacitor 插件。业务层（App/hooks/domain）不 import 任何 `@capacitor/*`，实现双端共享。
- **存储兼容**：`config/keys.ts` 沿用 1.0 的 `sixu-*-v1` 键与 JSON 格式，1.0 用户数据在 2.0 自动继承；Android 端启动时 `initStorage()` 把 Preferences 全量预热进内存 Map，读操作同步命中，写操作双写。

## 4. Capacitor 配置

`capacitor.config.ts`：

```ts
{
  appId: 'com.minamikune.sixuweather',
  appName: '四序天气',
  webDir: 'dist',
  android: { allowMixedContent: false },   // 仅 HTTPS，无需明文流量
  plugins: {
    SplashScreen: {
      launchAutoHide: false,               // 由 splash.ts 在 React 首帧后主动淡出
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
    },
  },
}
```

- **应用 ID**：`com.minamikune.sixuweather` 已按建议采用。仓库内原无 Android 工程、无既有签名/发布身份配置，**不存在身份冲突**。当前为 versionCode 1 / versionName 1.0 的首次 2.0 构建。
- **签名**：debug 构建使用工作区内 `android/app/debug.keystore`（标准 Android debug 密钥参数，`.gitignore` 排除）；release 签名未配置，发布前需在 `android/app/build.gradle` 注入正式 keystore（不擅自配置）。
- **工具链**（适配本地 SDK 现状，详见第 7 节）：AGP `9.5.1`、Gradle `9.8.2`（wrapper 指向同版本，CI 可复现）、compileSdk/targetSdk `37`、buildTools `37.0.0`、minSdk `24`。
- **集成插件**（6 个，全部经 platform/ 封装）：`@capacitor/app`（返回键/最小化）、`@capacitor/geolocation`（定位）、`@capacitor/network`（断网提示）、`@capacitor/preferences`（KV 存储）、`@capacitor/splash-screen`（启动屏）、`@capacitor/status-bar`（状态栏/安全区域）。
- **权限**（`AndroidManifest.xml`）：`INTERNET`、`ACCESS_COARSE_LOCATION`、`ACCESS_FINE_LOCATION`（Capacitor 8 geolocation 插件不再自带声明，已手动补齐），GPS/网络定位 feature 均为 `required=false`。
- **图标/启动屏**：`resources/icon.svg`（四叶标 + 品牌深蓝 #263b54 底，源自 public/favicon.svg）与 `resources/splash.svg` 经 `@capacitor/assets` 生成全套 mipmap/drawable（含 night/land 变体，共 100 个文件）。

## 5. Android 项目结构

```
android/
├── build.gradle                 # AGP 9.5.1 + 全模块统一 buildTools 37.0.0
├── settings.gradle / variables.gradle / gradle.properties
├── gradle/wrapper/              # gradle-9.8.2-all.zip
├── capacitor.settings.gradle    # 6 个 Capacitor 插件模块（cap sync 生成）
├── app/
│   ├── build.gradle             # applicationId/签名/依赖
│   ├── debug.keystore           # 工作区自包含 debug 签名（gitignore）
│   └── src/main/
│       ├── AndroidManifest.xml  # 权限/Activity/FileProvider
│       ├── java/com/minamikune/sixuweather/MainActivity.java  # BridgeActivity
│       ├── assets/public/       # Web 构建产物（cap sync 注入，gitignore）
│       └── res/                 # @capacitor/assets 生成的图标与启动屏
└── capacitor-cordova-android-plugins/（空壳，gitignore）
```

## 6. 构建结果

### Web

- `npm run lint`：0 警告 0 错误。
- `npm run build`：`tsc -b && vite build` 通过，✓ 1751 modules，约 5.3–5.8 s；产物 `dist/`（gzip 后 JS 约 85 KB + 代码分包）。
- 原有功能回归：主题切换、设置弹窗、城市搜索、逐小时/逐日预报、动画开关、`prefers-reduced-motion` 行为均未改动（组件文件为 git mv + 仅接口适配）。

### Android（首次编译）

- 命令：`gradle :app:assembleDebug`（本地 Gradle 9.8.2，SDK 37）。
- 结果：**BUILD SUCCESSFUL**，169 个任务；产出 `android/app/build/outputs/apk/debug/app-debug.apk`（**5.9 MB**）。
- APK 校验（aapt）：`package: com.minamikune.sixuweather versionCode=1 versionName=1.0`、`application-label: 四序天气`、定位/网络权限齐全、`assets/public/` 内嵌最新 Web 产物。

### CI

`.github/workflows/ci.yml` 双 job：`build`（Node 22：lint + build）与 `android`（JDK 21 + setup-android 安装 platform 37/build-tools 37 → `npm run cap:sync` → `./gradlew :app:assembleDebug` → 上传 APK artifact）。

本地等价流程：`npm run android:build`（= `cap:sync` + gradle 打包）。

## 7. 兼容性问题清单

| # | 问题 | 处理 |
| --- | --- | --- |
| 1 | Capacitor 模板默认 AGP 8.13 + compileSdk 36，但本机 SDK 仅有 android-37.0 / build-tools 37.0.0，且 Google SDK manifest 端点被墙无法下载旧平台 | 升级至 AGP 9.5.1 + Gradle 9.8.2 + compileSdk/targetSdk 37；wrapper 指向 9.8.2 保证 CI 可复现；AGP 9 移除 `proguard-android.txt`，已改用 `proguard-android-optimize.txt` |
| 2 | AGP 9 下 `capacitor-android` 等库模块默认拉取 build-tools 36.0.0 | 根 `build.gradle` `subprojects` 钩子统一 `buildToolsVersion = "37.0.0"` |
| 3 | 沙箱无法写 `~/.android/debug.keystore` | `app/build.gradle` 增加工作区内 `debug.keystore` 签名配置（标准 debug 参数，gitignore），CI/本地行为一致 |
| 4 | Capacitor 8 Geolocation 插件不再声明定位权限 | 手动在 Manifest 补齐 COARSE/FINE 权限及 `required=false` 的 feature |
| 5 | 双端存储实现不同（localStorage vs Preferences） | `platform/storage.ts` 统一接口：Web 同步读；Android 启动预热全量键入内存 Map + 写时双写，业务层零感知 |
| 6 | 网络中断 | `platform/network.ts` 监听：断网显示 toast 并标记离线，恢复自动刷新；Android 与 Web 共用同一套 UI 反馈 |
| 7 | 不支持的原生功能 | 定位拒绝/超时/不可用 → 定位提示卡 + 手动搜索城市（原有 1.0 降级路径原样保留）；启动屏/状态栏在 Web 为空操作 |
| 8 | 屏幕尺寸适配 | 沿用 1.0 响应式布局；Android 端 viewport-fit=cover + 状态栏 overlay，弹窗/移动导航已带 `env(safe-area-inset-*)` |
| 9 | 返回键 | Android 消费栈（设置 > 城市 > 提示），无消费时 `App.minimizeApp()` 退后台；Web 端不注册 |
| 10 | release 签名未配置 | 按约定不擅自配置发布身份；发布前需注入正式 keystore 并更新 versionCode |

## 8. Git 提交记录（阶段 2）

1. `37e3c62` refactor: 重组为八层架构并新增平台适配层（33 文件，含 git mv 保留历史）
2. （Capacitor 集成提交，见当前 HEAD）
