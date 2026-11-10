# 阶段 5 交付报告：sixu-weather 2.0 Android 原生集成（Capacitor）

日期：2026-11-11　提交基线：fc55c29 之后

## 1. Android 基础（完善项）

| 项 | 状态 | 说明 |
| --- | --- | --- |
| Android 项目 | ✅ | Capacitor 8 工程（`android/`），AGP 9.5.1 / Gradle 9.8.2 / compileSdk 37 / minSdk 24 |
| 应用名称 | ✅ | 中文「四序天气」，Manifest + aapt2 核验通过 |
| 应用图标 | ✅ | 自适应图标（阶段 2 已建，本轮核验打包） |
| 启动屏幕 | ✅ | 启动屏主题（阶段 2 已建，本轮核验） |
| 状态栏 | ✅ | 随滚动自动反色（既有实现） |
| 导航栏 / 安全区域 / 屏幕适配 | ✅ | env(safe-area-inset) + 横竖屏布局核验（静态） |
| 网络权限 | ✅ | INTERNET + ACCESS_NETWORK_STATE |
| 定位权限 | ✅ | COARSE/FINE，运行时申请，拒绝可手动选城 |
| 通知权限 | ✅ | POST_NOTIFICATIONS（13+），订阅弹窗内申请 + 状态横幅 |
| 返回键 | ✅ | 弹窗优先关闭 → 历史后退；原生 onBackPressed 链路 |

## 2. 原生通知（本轮新增）

- **三渠道分类管理**：`daily`（每日天气）、`reminder`（降雨等提醒）、`warning`（官方预警/强天气），JS + 原生双侧幂等注册，定义一致。
- **每日天气通知**：AlarmManager 精确每日调度，杀进程/重启后仍送达，不依赖 JS 定时器。
- **降雨提醒 / 天气预警**：复用订阅评估引擎，按渠道分流，7 天去重。
- **通知点击跳转**：本地通知与 FCM 唤起均支持按订阅城市跳转并滚动定位。
- **远程推送（真实服务）**：Firebase Cloud Messaging 完整集成——`SixuFirebaseMessagingService` + `PushTokenPlugin`（令牌获取/点击载荷桥接）+ 设置弹窗令牌展示（脱敏可复制）；未配置 `google-services.json` 时安全降级。后端下发示例见 notifications.md。
- **后台定时方案评估**：WorkManager（≥15 分钟批量延迟、轮询耗电，不采用）/ FCM（即时预警，已集成）/ 精确闹钟（每日通知，已采用）——结论与理由见 notifications.md 第 6 节。
- **通知权限状态提示**：订阅弹窗横幅 + 一键申请/引导设置。

## 3. 用户体验

启动速度（bundle gzip 93.7 kB、无阻塞资源）、页面切换（既有动画）、原生返回键、网络状态反馈（OnlineBanner 订阅）、断网缓存 + 重连自动刷新（既有可靠性层，本轮回归测试通过）、触觉反馈（订阅开关等）、系统主题适配（深色/浅色跟随）、Android 动态安全区域（safe-area-insets + 状态栏反色）。

## 4. 应用安全（检查结论）

| 项 | 结论 |
| --- | --- |
| 网络请求安全 | 全部 HTTPS（Open-Meteo / nmc.cn / BigDataCloud / FCM），fetch 封装统一超时与错误映射 |
| API 密钥保护 | 密钥仅存在于服务端代理，Web/Android 客户端零密钥 |
| Token 存储 | 无用户凭证落盘；设置中展示的是设备 FCM 令牌（非敏感凭证），随应用卸载清除 |
| 权限最小化 | 9 项权限，无后台定位/存储；硬件特性声明 optional |
| HTTPS | Manifest 显式 `usesCleartextTraffic="false"` |
| WebView 安全 | 未开启 WebContentsDebugging；仅加载打包资源与 HTTPS API |
| 调试/正式隔离 | debug.keystore（公开等价物）vs 用户 keystore.properties（不入库）；FCM 由 google-services.json 存在性开关；详见 build-and-signing.md |

## 5. 构建产物（本环境实际产出）

| 产物 | 路径 | 状态 |
| --- | --- | --- |
| Debug APK | `android/app/build/outputs/apk/debug/app-debug.apk`（10.1 MB） | ✅ 可直接安装 |
| Release APK | `android/app/build/outputs/apk/release/app-release-unsigned.apk`（4.9 MB） | ⚠️ 未签名（等用户 keystore） |
| Release AAB | `android/app/build/outputs/bundle/release/app-release.aab`（4.6 MB） | ⚠️ 配置签名后即签名 AAB |

CI（`.github/workflows/ci.yml`）保留 assembleDebug 门禁；release 构建不接触任何签名材料。

## 6. 交付物清单

- Android 项目：`android/`（含 4 个新增原生类）
- Capacitor 配置：`capacitor.config.ts` + `android/` 工程
- 权限说明：`docs/android/permissions.md`
- 通知实现说明：`docs/android/notifications.md`（含 FCM 后端示例、WorkManager 评估）
- 构建与签名：`docs/android/build-and-signing.md`
- 测试报告：`docs/android/device-test-report.md`（含真机手动测试协议 13 条用例）

## 7. 未完成 / 需用户配合（诚实声明）

1. **真机测试未执行**：本环境无模拟器与真机（无 KVM、adb devices 为空）。已完成构建期与静态核验（见测试报告第 1 节）；运行期验证需用户按协议执行。
2. **正式签名待密钥**：Release APK/AAB 当前未签名。keystore 与密码必须由用户安全提供（`.gitignore` 已排除，绝不提交 GitHub）。
3. **FCM 待 google-services.json**：代码已就绪，放入配置文件重装即启用真实推送。
4. 在完成 2、3 与真机验证前，**不宣称 Android 应用已完成**——当前状态为：构建流水线全通、静态核验全过、待真机确认。
