# Phase 0 · 项目初始化与现状核查报告

- 执行日期：2026-11-10
- 执行范围：GitHub 授权、1.0 仓库、运行环境、构建基线、数据源可用性、2.0 仓库建立
- 结论：**初始化完成，可以进入 Phase 1（基线迁移审计与工程化）**
- 本阶段未进行 UI 重构、未引入 Capacitor、未发布任何版本

## 1. GitHub 授权与仓库能力

| 检查项 | 结果 |
| --- | --- |
| 认证账号 | `minamikune-cmd`（仓库所有者） |
| 认证方式 | 本机既有 GitHub 授权凭据；仅存放于 `.git/` 本地凭据文件，不进入版本库 |
| 关键权限 | `repo`、`workflow`、`admin:repo_hook`、`delete_repo`、`gist` 等 |
| 1.0 仓库权限 | `admin: true`、`maintain: true`、`push: true` |
| Actions | 已启用，允许全部 Action |
| 账户计划 | GitHub Free（公开仓库 Actions 不限时长；私有仓库每月 2,000 分钟） |
| 1.0 分支保护 | 无（`GET /branches/main/protection` 返回 404） |
| GitHub Pages | 未启用（返回 404） |

结论：具备创建独立仓库、推送代码、配置 Actions 的实际权限。

## 2. 仓库状态

### 2.1 原 1.0 仓库（保持不变）

- 地址：<https://github.com/minamikune-cmd/sixu-weather>
- 可见性：公开
- 默认分支：`main`
- HEAD：`ca24d63 fix(sun-arc): 修正日落时间被挤出日照卡片的错位`
- 提交数：4
- 已跟踪文件：27 个
- 仓库体积：约 81 KB
- 本阶段结束后再次核对：1.0 的 `refs/heads/main` 仍为 `ca24d631fd6b91d33fe3e70d50e1847d248e3910`，**未被改写、未被强推、未被删除**

### 2.2 新建 2.0 仓库

- 地址：<https://github.com/minamikune-cmd/sixu-weather-2.0>
- 可见性：**私有**（等待用户确认是否转公开）
- 默认分支：`main`
- 初始基线：完整保留 1.0 的 Git 历史，HEAD 为 `ca24d63`
- 主题标签：`weather`、`react`、`typescript`、`capacitor`、`android`、`open-meteo`、`pwa`
- 推送凭据：仅保存在本地 `.git/github-credentials`（权限 600），`.git/` 不进入版本库

本地远程配置：

```text
origin       https://github.com/minamikune-cmd/sixu-weather-2.0.git
upstream-1x  https://github.com/minamikune-cmd/sixu-weather.git
```

`origin` 指向 2.0；1.0 仅保留为只读上游，后续不会向 `upstream-1x` 推送。

## 3. 运行环境

| 组件 | 版本 / 状态 |
| --- | --- |
| 操作系统 | Debian 13（容器） |
| CPU / 内存 | 2 核 / 3.8 GB |
| 磁盘 | 40 GB，可用约 24 GB |
| Node.js | v24.22.2 |
| npm | 11.19.1 |
| pnpm | 12.16.1 |
| Git | 2.47.3 |
| Java | OpenJDK 21.0.13（Capacitor 8 要求 JDK 21） |
| Android SDK | `/opt/android-sdk`，已装 `platforms;android-37.0`、`build-tools;37.0.0`、`platform-tools 37.0.1` |
| Android 设备 | 无真机、无模拟器（`adb devices` 为空） |
| Gradle | 未全局安装；将使用 Capacitor 生成的 Gradle Wrapper |
| 浏览器自动化 | 未安装 Chromium/Playwright，Phase 6 前需补齐 |
| 环境变量 | `ANDROID_HOME` / `ANDROID_SDK_ROOT` 未设置，构建脚本需显式指定 |

## 4. 1.0 基线验证

在 2.0 工作副本、1.0 原始代码上执行：

| 命令 | 结果 |
| --- | --- |
| `npm run build`（`tsc -b && vite build`） | 通过；JS 277.51 KB（gzip 90.31 KB），CSS 33.93 KB（gzip 8.11 KB） |
| `npm run lint`（ESLint 9） | 通过，无报错 |
| 单元测试 | **不存在**（无测试框架、无测试脚本） |
| E2E 测试 | **不存在** |
| CI/CD | **不存在**（无 `.github/`） |

结论：1.0 可作为可靠迁移基线，但 2.0 必须补齐测试与 CI。

## 5. 真实数据源探测

所有探测均为实际 HTTPS 请求，未使用任何模拟响应。

| 数据源 | 探测结果 | 用途 |
| --- | --- | --- |
| Open-Meteo Forecast | HTTP 200，约 1.06 s | 实时、逐小时、7 天、日出日落、UV、能见度 |
| Open-Meteo Geocoding | HTTP 200，返回“北京” | 中文城市搜索 |
| Open-Meteo Air Quality | HTTP 200，返回 `pm2_5`、`us_aqi` | 空气质量（2.0 新增） |
| BigDataCloud Reverse Geocode | HTTP 200，约 0.14 s | 定位坐标转城市 |
| NWS（美国）预警 | HTTP 200（`api.weather.gov/alerts/active`） | 美国区域预警候选源 |
| 中国区预警 | **尚未找到可验证的免密钥官方源** | 需用户提供和风天气等密钥，或明确降级策略 |
| MeteoAlarm 旧接口 | HTTP 404（接口已变更） | 暂不采用 |

## 6. 1.0 现状与 2.0 差距

### 已具备

- 真实天气、体感、湿度、风、降水、UV、能见度、气压、云量
- 24 小时逐时预报、7 天预报、日出日落与日照弧
- 中文城市搜索、经纬度查询、定位、收藏、最近城市
- 四季主题、昼夜场景、Canvas 粒子、减少动态效果
- 单位切换、本地缓存、超时/限流/离线回退、无障碍基础
- 响应式布局与移动端底部导航

### 主要差距

1. **空气质量**：未接入；Open-Meteo AQI 已验证可用。
2. **天气预警**：未接入；中国区缺少可验证的免密钥官方源。
3. **天气订阅 / 推送**：完全缺失。
4. **Android**：无 Capacitor 工程、无原生通知、无签名与构建流水线。
5. **测试与 CI**：零测试、零流水线。
6. **工程结构**：`App.tsx` 328 行集中承载状态与页面；数据层缺少运行时校验；缓存只支持单城市。
7. **仓库卫生**：1.0 的 README 声称存在 `.gitignore`，实际缺失；`dist/`、`node_modules/` 处于未跟踪状态。
8. **依赖使用**：`react-router` 已安装但仅用于 `BrowserRouter`，没有实际路由。
9. **发布物**：无 LICENSE、无 PWA、无 Android 图标/启动图/签名配置。

## 7. 2.0 分阶段计划

| 阶段 | 目标 | 关键验收 |
| --- | --- | --- |
| Phase 1 | 基线迁移审计、`.gitignore`、工程脚本、Vitest 与 CI 骨架 | `npm ci`、lint、typecheck、test、build 全绿；CI 在 GitHub 实际运行通过 |
| Phase 2 | 领域层与数据层重构：类型校验、Provider、缓存、多城市状态；保持功能等价 | 1.0 功能清单逐项通过；单元测试覆盖数据转换与缓存 |
| Phase 3 | 视觉 2.0：设计令牌、柔光玻璃、毛玻璃、沉浸背景、微交互、响应式 | 375/390/768/1024/1440 五档验收；无横向滚动；对比度与减少动态效果达标 |
| Phase 4 | 新功能：AQI、预警、城市管理、订阅、主题设置、PWA | 仅使用真实数据；无数据时明确空状态；订阅可实际触发 |
| Phase 5 | Capacitor Android：工程、图标、启动图、本地通知、FCM 接入、APK 构建 | `assembleDebug` 成功；通知在真机验证；CI 产出 APK |
| Phase 6 | QA 与发布：E2E、性能、无障碍、安全、文档、Release | 自动化验收全绿；版本号、变更日志、回滚方案齐全 |

## 8. 尚未解决的问题 / 需要决策

1. **仓库可见性**：当前为私有。是否转为公开？（公开可获得不限量 Actions 分钟数，也符合 1.0 已公开的现状。）
2. **预警数据源**：中国区没有验证通过的免密钥官方接口。是否提供和风天气（QWeather）API Key，或接受“仅覆盖有官方开放接口的地区 + 明确空状态”？
3. **原生推送**：FCM 需要 Firebase 项目（`google-services.json`）以及发送端服务。是否已有 Firebase 项目？若没有，Phase 5 将先实现 **本地定时天气通知**（无需服务器），并保留 FCM 接入层。
4. **Web 部署**：继续使用 Cloudflare Pages（1.0 方案），还是 GitHub Pages？前者可部署私有仓库，后者需要公开仓库。
5. **Android 发布**：正式签名密钥、包名（建议 `com.sixu.weather`）、minSdk 目标尚未确定。

## 9. 本阶段实际变更

- 新建独立仓库 `sixu-weather-2.0`（私有）。
- 将 1.0 完整 Git 历史与 27 个源文件推送到新仓库。
- 本地 `origin` 切换到 2.0，1.0 保留为 `upstream-1x`。
- 新增 `.gitignore`（依赖、构建产物、环境变量、签名、Capacitor 生成物）。
- 新增本报告。

> 下一阶段开始前，不会修改 1.0 仓库，也不会在 2.0 中进行大规模重构。
