# 阶段 01 · 1.0 功能迁移报告（MIGRATION REPORT）

- 日期：2026-11-13 · 基线：2.0 完整实现 `e4df8a6`（1.0 源仓库 `ca24d63` 已只读分析，见 [PROJECT_AUDIT.md](./PROJECT_AUDIT.md)）
- 前置事实：1.0 的 27 个受控文件在前期阶段已 27/27 blob 级迁入 2.0 并持续演化（docs/reports/phase-1-audit.md）。本阶段做的是**工程恢复**：将 e4df8a6 验证过的完整 2.0 资产恢复到 main 工作区，并合入待审 WIP。

## 1. 迁移（恢复）动作记录

| 动作 | 来源 → 目标 | 结果 |
|---|---|---|
| 恢复应用资产 | `e4df8a6` → main（`git checkout e4df8a6 -- . ':!README.md'`） | 187 文件，+14,266 行，提交 `2e2654e` |
| 保留分阶段工作区文件 | `00-MASTER-RULES.md`、`README.md`（DSH 入口版）、`prompts/00–09`、阶段 00 审计文档五件套 | 未被覆盖 |
| 保留 Capacitor/Android 工程资产 | `android/` 整体（Capacitor 8、FCM 服务、PushTokenPlugin、NotificationChannels、Manifest、签名方案） | 完整恢复，`npx cap sync` 通过（7 插件识别，web assets 拷贝成功） |
| 审查并合并 WIP | `wip/geolocation-native-error-codes` → main（merge `c90dd35`，无冲突） | 见第 3 节审查记录 |

## 2. 逐项迁移状态清单（对照 1.0 功能全集）

图例：✅ 完成（2.0 已有且验证）· ⬆️ 替代/增强 · 🆕 2.0 新增 · ⛔ 废弃（有意，不回迁）

| 1.0 功能/资产 | 状态 | 2.0 落点 | 说明 |
|---|---|---|---|
| 当前天气 12 项指标、°C/°F | ✅ | domain/weather.ts · pages/HomePage.tsx | 与 1.0 业务规则一致 |
| 24h 逐时曲线 / 7 日预报 | ✅ | ui/components/Hourly·DailyForecast.tsx | 横滚隔离在图内部 |
| Open-Meteo forecast（12s 超时、timezone=auto） | ✅ | services/weather/api.ts | 补 429/离线中文提示、3s 节流 |
| 浏览器定位（HTTPS 校验、错误提示） | ✅ | platform/geolocation.ts Web 分支 | 与 1.0 语义一致 |
| 中文城市搜索（防抖 380ms、取消前次） | ✅ | CityDialog.tsx · api.ts geocoding | — |
| 经纬度查询 | ✅ | CityDialog.tsx | — |
| 收藏 12 / 最近 6 / 自动保存 | ✅ | domain/cities.ts · config/keys.ts（sixu-*-v1 沿用，1.0 数据自动继承） | — |
| 四季（南北半球） | ✅ | domain/seasons.ts | — |
| 昼夜四阶段（日出日落 ±45min） | ⬆️ | domain/solar.ts | 缺失字段回退 `current.is_day`，进度兜底 06:00/18:00（语义与 1.0 兼容，更精确） |
| Canvas 天气粒子（雨/雪/星/季节装饰）+ 性能预算 | ✅ | ui/components/Atmosphere.tsx | 预算数值与 1.0 一致 |
| 10 分钟缓存与缓存回退 | ✅ | hooks/useWeather.ts | 增 8 城上限 |
| 骨架屏 / 空状态 / 无障碍 | ✅ | 各组件 | — |
| `react-router` 依赖 | ⛔ | —（哈希锚点 routes.ts 替代） | 1.0 只用 BrowserRouter 包裹；移除依赖 |
| `src/lib/weather.ts` 单体 | ⛔ | 拆为 domain/services/config/theme/platform 八层 | 组织方式废弃，业务规则全部保留 |
| 旧 README（286 行功能/部署文档） | ⛔ | 拆解进 [DEVELOPMENT_GUIDE.md](./DEVELOPMENT_GUIDE.md) 与既有 docs/ | 内容不丢失 |
| 1.0"不做空气质量"决策 | ⬆️ | domain/air.ts + Open-Meteo CAMS | 2.0 新增模式数据 + "仅供参考"免责（审计 R-11） |
| 1.0 没有的：预警、订阅推送、Android 双端、测试、CI | 🆕 | services/weather/warnings.ts · domain/subscriptions.ts · android/ · tests/ · .github/ | 均为 2.0 新增能力 |

## 3. WIP 合并审查记录

合并前逐项审查 `wip/geolocation-native-error-codes`（5 文件 +69/−4，基于 e4df8a6）：

| 文件 | 变更 | 审查结论 |
|---|---|---|
| src/platform/geolocation.ts | +31：Capacitor v8 字符串错误码（OS-PLUG-GLOC-0002/0003/0007/0009/0010/0014/0015/0016/0017/0018）→ 中文提示映射表；兼容旧数字码 1；导出纯函数 `messageForNativeError`；原生失败 `console.error` 完整错误到 logcat | ✅ 纯增量，无覆盖既有行为；修复真机"笼统提示"根因（数字码判断为死代码） |
| tests/geolocation.test.ts | +25：3 例（字符串码逐码映射 / 旧数字码 1 / 未知码返回 undefined） | ✅ 纯函数测试，不触网 |
| tests/run.ts | +2：注册新套件 | ✅ |
| eslint.config.js | 1 行：忽略 `.gradle*`、`.pw-browsers`、`.tmp-e2e`、`.tests-bundle.cjs` | ✅ 仅本地构建残留，不影响源码规则 |
| docs/android/device-test-report.md | +13：真机定位问题记录、根因、修复说明、待回填项 | ✅ 文档与代码一致 |

合并方式：`git merge wip/geolocation-native-error-codes`（ort 策略，无冲突），合并提交 `c90dd35`。未发现覆盖有效修改的情况。

## 4. 验证证据（本阶段实跑）

环境：Node v24.22.2 · npm 11.19.1（npm ci 干净安装，锁文件一致）。

| 检查 | 命令 | 结果 | 状态 |
|---|---|---|---|
| 依赖安装 | `npm ci --cache /tmp/npm-cache` | 成功（esbuild postinstall 因沙箱 allowScripts 策略未执行，不影响 vite 构建——构建实跑见下） | PASS-AUTOMATED |
| Lint | `npm run lint` | 退出码 0，0 error | PASS-AUTOMATED |
| 类型检查 | `npx tsc -b` | 退出码 0 | PASS-AUTOMATED |
| 单元测试 | `npm test` | 7 套件 55/55 通过（含 WIP 新增 geolocation 3 例） | PASS-AUTOMATED |
| 生产构建 | `npm run build` | 成功，index 285.90 kB / gzip 94.17 kB | PASS-AUTOMATED |
| 依赖漏洞 | `npm audit --omit=dev` | found 0 vulnerabilities | PASS-AUTOMATED |
| Capacitor 同步 | `npx cap sync` | 7 个 Android 插件识别，copy web / update 成功 | PASS-AUTOMATED |
| Android 工程完整性 | 核对 MainActivity/PushTokenPlugin/FCM Service/NotificationChannels/Manifest/SDK 版本 | 完整；compileSdk/targetSdk 37、minSdk 24、AGP 9.5.1、Gradle 9.8.2、applicationId com.minamikune.sixuweather、应用名「四序天气」 | PASS-BUILD-ONLY（assemble 历史成功；云端构建阶段 06/08 复核） |
| Android 真机 | — | 未执行 | PENDING-DEVICE |
| FCM 推送 | — | 缺 google-services.json | BLOCKED-CONFIG |

## 5. 新增单元测试

本阶段随 WIP 合入 geolocation 3 例；审计标记的其余缺口（scheduler 假时钟测试、Playwright E2E、CI 接入 npm test）按计划归阶段 07/08，不在本阶段扩 scope。

## 6. 提交记录

| 提交 | 内容 |
|---|---|
| `2e2654e` | 恢复 e4df8a6 应用资产（保留 DSH 工作区文件） |
| `c90dd35` | 合并 wip/geolocation-native-error-codes（无冲突） |
| 文档提交（见下） | MIGRATION_REPORT · DEVELOPMENT_GUIDE · PHASE-01 |

未 force push；1.0 仓库未做任何修改。

## 7. 遗留问题（带入后续阶段）

1. `google-services.json` 缺失 → FCM 推送 BLOCKED-CONFIG（阶段 06 需用户提供或维持降级声明）。
2. Android 真机回归（重装 APK 验证定位错误码文案）→ PENDING-DEVICE，待回填 docs/android/device-test-report.md。
3. CI 未接入 `npm test`、无 Playwright E2E → 阶段 07/08。
4. package.json 版本号仍为 1.0.0 → 阶段 09。
5. 工作区未跟踪的构建残留（node_modules/dist/.gradle*/.pw-browsers/.tmp-e2e 等）已被 .gitignore 与 eslint 忽略，不提交；建议定期清理。
