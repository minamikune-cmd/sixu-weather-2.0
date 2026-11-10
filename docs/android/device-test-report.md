# 四序天气 Android · 测试报告

日期：2026-11-11　构建：app-debug.apk（10.1 MB）/ app-release-unsigned.apk（4.9 MB）/ app-release.aab（4.6 MB），均产自本次流水线（Gradle 9.8.2 / AGP 9.5.1，compileSdk 37，minSdk 24）。

## 0. 环境限制声明（诚实说明）

本次集成环境为 Linux 容器：**无 Android 模拟器（/dev/kvm 不可用、无 system-images）、无连接真机（adb devices 为空）**。因此**真机/模拟器运行测试无法在本环境执行**，本报告不包含虚构的运行结果。已完成的是构建期与静态可验证项 + 可复现的手动测试协议，真机验证需用户配合执行（见第 3 节）。

## 1. 本环境已完成的验证（全部通过）

| 项目 | 方法 | 结果 |
| --- | --- | --- |
| Web 构建 | `npm run build` | ✓ 284.75 kB bundle（gzip 93.7 kB） |
| 代码规范 | `npm run lint` | ✓ 0 错误 |
| 单元测试 | `npm test`（含数据可靠性 7/7） | ✓ 全部通过 |
| Capacitor 同步 | `npx cap sync android` | ✓ webDir 正确落入 `android/app/src/main/assets/public` |
| Debug APK | `gradlew :app:assembleDebug` | ✓ app-debug.apk（debug keystore 签名，可直接安装） |
| Release APK | `gradlew :app:assembleRelease` | ✓ app-release-unsigned.apk（未配置用户 keystore，按设计产出未签名包） |
| Release AAB | `gradlew :app:bundleRelease` | ✓ app-release.aab（Play 上架格式） |
| APK 内容核验 | `unzip -l` | ✓ 内含最新 bundle `index-6Zzq2g72.js`、Firebase Messaging 库、原生渠道/FCM/插件类 |
| 包信息核验 | `aapt2 dump badging` | ✓ 应用名「四序天气」、包名 `com.minamikune.sixuweather`、targetSdk 37、启动 Activity、权限集合与设计一致、定位硬件声明为 optional |
| 明文流量 | Manifest 合并结果 | ✓ `android:usesCleartextTraffic="false"` |
| WebView 调试 | 源码检查 | ✓ 未启用 `setWebContentsDebuggingEnabled` |
| 密钥卫生 | `git status` / .gitignore | ✓ keystore、keystore.properties、google-services.json 均不入库 |

## 2. 静态审查结论

- **通知**：三渠道（daily/reminder/warning）双侧注册且定义一致；每日通知走 AlarmManager 精确调度（不依赖 JS 定时器）；点击跳转链路（本地通知 actionPerformed / FCM Intent → stash → JS 消费）代码路径完整。
- **FCM 降级**：无 `google-services.json` 时 `FCM_ENABLED=false`，`isAvailable()` 返回 false，应用功能不受影响；`firebase-bom` 仅为编译期依赖。
- **权限**：仅 9 项（含插件自动合并的 VIBRATE / WAKE_LOCK / ACCESS_NETWORK_STATE / c2dm.RECEIVE），无后台定位、无存储权限，符合最小化原则。
- **安全**：全链路 HTTPS（Open-Meteo、nmc.cn、BigDataCloud、FCM）；API 密钥仅存于服务端代理（Web 端零密钥）；Token 不落盘（设置弹窗展示的是设备 FCM 令牌，非用户凭证）；用户数据仅 localStorage。

## 3. 真机手动测试协议（待用户执行）

安装：`adb install android/app/build/outputs/apk/debug/app-debug.apk`（Android 8+ 真机或模拟器）。

| # | 用例 | 预期 |
| --- | --- | --- |
| 1 | 冷启动 | 启动屏→主页 ≤2s（二次启动），无白屏闪烁 |
| 2 | 首次定位授权 | 说明弹层→授权→定位到当前城市；拒绝→手动选城流程 |
| 3 | 状态栏/导航栏/安全区 | 首页滚动时状态栏文字自动反色；底部卡片不被导航条遮挡；横屏/分屏不错位 |
| 4 | 返回键 | 设置弹窗打开时按返回→关闭弹窗；主页按返回→浏览器历史后退/退出确认 |
| 5 | 订阅+通知权限 | 订阅弹窗点「开启通知」→系统授权框；授权后横幅消失 |
| 6 | 每日通知 | 订阅后把提醒时间设为 2 分钟后，杀进程，到点收到「每日天气」渠道通知 |
| 7 | 降雨提醒 | 选择降雨城市（如广州）订阅提醒，触发评估后收到「天气提醒」渠道通知（带振动） |
| 8 | 通知点击跳转 | 点击通知→应用启动/回到前台→自动切换到订阅城市并滚到「此刻」 |
| 9 | 通知渠道管理 | 系统设置→通知→四序天气，可见 3 个渠道并可分别开关 |
| 10 | 断网缓存 | 飞行模式启动→展示缓存天气+离线提示；恢复网络→自动刷新 |
| 11 | 系统主题 | 切换深色/浅色→应用跟随；切换过程无异常闪烁 |
| 12 | FCM（可选） | 放入 google-services.json 重装→设置弹窗出现「远程推送令牌」；后端按 notifications.md 示例下发→收到「天气预警」渠道通知，点击跳转对应城市 |
| 13 | 触觉反馈 | 订阅开关、城市切换等操作有轻微振动反馈 |

## 4. 待用户提供 / 配合

1. Release keystore（按 build-and-signing.md 生成，安全渠道传递）→ 产出正式签名 APK/AAB。
2. `google-services.json`（Firebase 控制台下载）→ 启用 FCM 真推送。
3. 一台 Android 8+ 真机执行第 3 节协议（约 15 分钟），结果回填本报告。
