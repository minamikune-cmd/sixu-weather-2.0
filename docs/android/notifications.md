# 四序天气 Android · 通知实现说明

## 1. 通知类型与渠道

Android 8+ 的通知渠道（NotificationChannel）由 JS 层 `src/platform/notifications.ts` 与原生层 `android/app/src/main/java/com/minamikune/sixuweather/NotificationChannels.java` 双侧幂等注册（定义保持一致），用户可在系统设置中按渠道开关、改重要性：

| 渠道 id | 名称 | 用途 | 重要性 | 振动 |
| --- | --- | --- | --- | --- |
| `daily` | 每日天气 | 订阅城市的每日天气摘要（每日定时） | 默认 | 无 |
| `reminder` | 天气提醒 | 降雨、高温、低温、大风、寒潮提醒 | 默认 | 有 |
| `warning` | 天气预警 | 中央气象台官方预警（红/橙/黄/蓝）与强天气提醒 | 高（弹出） | 有 |

渠道选择逻辑：`channelForCandidate()`（`src/platform/notifications.ts`）——`level === 'warning'` 走 `warning`；降雨提醒走 `reminder`；每日摘要走 `daily`。FCM 下行消息的 `channelId` 经原生白名单校验（`NotificationChannels.sanitizeChannelId`），非法值回落到 `warning`。

## 2. 每日天气通知（应用被杀后仍送达）

- 用户在订阅弹窗中为城市设置通知时间（城市当地时间，默认 07:30）。
- `scheduleDailyReminder()` 通过 `@capacitor/local-notifications` 注册**每日重复的精确本地通知**（底层 `AlarmManager`，`SCHEDULE_EXACT_ALARM` 权限）。这是系统级调度，**不依赖 JS 定时器**：应用被杀、设备重启后（`RECEIVE_BOOT_COMPLETED` 由插件处理）仍会按时弹出。
- 调度是幂等的：每次调度器 tick 先取消同订阅旧调度再注册，通知 id 为订阅 id 的稳定散列，不会叠加。
- 通知 body 为最近一次评估的摘要（`dailySummaryBody()`），内容在前台运行时随天气刷新。

## 3. 降雨提醒与天气预警

评估引擎 `evaluateSubscription()`（`src/domain/subscriptions.ts`，纯函数，双端共用）产出候选通知：

- **降雨提醒**：未来 12 小时降水概率 ≥ 阈值且天气码为降雨类 → `reminder` 渠道。
- **强降雨提醒**：未来 12 小时 ≥3 小时降水概率 ≥ 阈值 → `warning` 渠道。
- **官方预警**：中央气象台 nmc.cn 公开接口（红/橙立即推送，黄/蓝随每日摘要），走 `warning` 渠道。
- 去重：`dedupeKey`（订阅 + 日期 + 类型）落盘 7 天，同一内容只发一次；每天每个订阅只触发一次（`triggerKey`）。

**送达时效边界（必须知晓）**：红/橙官方预警的「立即推送」由 JS 调度器（30 秒 tick）执行，**仅在应用存活时即时**；应用被杀后，下一次机会是每日定时本地通知。要做到被杀后仍即时送达官方预警，需第 5 节的 FCM 远程推送（后端轮询 nmc.cn 接口后定向下发）。

## 4. 通知点击跳转

- 本地通知：点击触发 `localNotificationActionPerformed`，JS 层 `onNotificationTap()`（`App.tsx`）按载荷中的 `subscriptionId`/`cityId` 切换到对应城市并滚动到「此刻」概览。
- FCM 通知：原生 `SixuFirebaseMessagingService` 把 `subscriptionId`/`cityId` 放入启动 Intent；应用未运行时经 `PushTokenPlugin.stashTapPayload()` 暂存，JS 启动时 `consumePushTapPayload()` 消费一次并执行同样的跳转（应用存活时走 `onNewIntent`）。

## 5. 远程推送：Firebase Cloud Messaging（真实推送服务）

应用侧已完整集成 FCM：

- 原生服务 `SixuFirebaseMessagingService`（`MESSAGING_EVENT`）接收下行消息，按白名单渠道发布系统通知，点击回到应用并携带跳转载荷。
- 令牌桥 `PushTokenPlugin`（自定义 Capacitor 插件）：`getToken()` / `isAvailable()` / `consumeTapPayload()`；设置弹窗中展示令牌（脱敏 + 复制），供用户粘贴到自建后端。
- 未配置 `google-services.json` 时：`BuildConfig.FCM_ENABLED = false`，`isAvailable()` 返回 false，JS 层静默降级，**应用功能与构建完全不受影响**。

### 启用步骤（用户操作）

1. 在 Firebase 控制台创建项目，添加 Android 应用（包名 `com.minamikune.sixuweather`），下载 `google-services.json` 放到 `android/app/`（已 gitignore，绝不提交）。
2. 重新构建：`npm run android:build` 或 `cd android && ./gradlew :app:assembleRelease`。
3. 应用启动后在 设置 → 远程推送令牌 复制设备令牌。

### 后端下发示例（FCM HTTP v1）

服务器密钥（service account JSON）**只存在于后端**。最小示例（Node.js）：

```js
// npm i google-auth-library
import { JWT } from 'google-auth-library'
const keys = JSON.parse(process.env.FCM_SERVICE_ACCOUNT) // 服务端环境变量
const jwt = new JWT({ email: keys.client_email, key: keys.private_key,
  scopes: ['https://www.googleapis.com/auth/firebase.messaging'] })
const { token } = await jwt.authorize()
await fetch(`https://fcm.googleapis.com/v1/projects/${keys.project_id}/messages:send`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ message: {
    token: '<设备令牌>',
    notification: { title: '北京 · 暴雨橙色预警', body: '北京市气象台 10:00 发布' },
    data: { channelId: 'warning', cityId: 'beijing' },
  } }),
})
```

后端预警机器人思路：每 5–10 分钟轮询 `https://www.nmc.cn/rest/findAlarm?pageNo=1&pageSize=500`（同前端 `src/services/weather/warnings.ts`），发现红/橙新预警时按订阅城市匹配用户令牌下发。

## 6. 后台定时方案评估：WorkManager vs 推送服务 vs 精确闹钟

Android 对后台执行的限制（Doze、应用待机、后台启动限制）意味着**不能假设 JS 定时器在应用存活期外运行**。本项目按通知类型分别选型：

| 方案 | 机制 | 应用被杀后 | 最小粒度 | 结论 |
| --- | --- | --- | --- | --- |
| **精确本地通知（已采用）** | `AlarmManager` 系统闹钟，插件持久化调度 | ✅ 送达，重启后保留 | 精确到分钟 | 每日天气通知的**唯一可靠**本地方案 |
| **FCM 推送（已集成）** | 后端 → Google FCM → 系统下发 | ✅ 送达（高优先级可唤醒） | 实时 | 官方红/橙预警的**即时**通道 |
| **WorkManager 周期任务** | JetWork 调度，受 Doze/待机桶延迟 | ✅  eventual（不保证准时） | ≥15 分钟且批量执行 | **不采用**，见下 |
| **JS setInterval 调度器** | 应用进程内 | ❌ 进程死亡即停止 | 30 秒 tick | 仅作应用存活期的补充（预警即时推送） |

**不采用 WorkManager 的理由**：其最小周期为 15 分钟且被系统批量延迟（Doze 下可能数小时），对「每日一次、时间精确」的每日通知反而不可靠（仍需精确闹钟兜底）；对「红/橙预警即时送达」而言 15 分钟粒度又太慢，且周期性轮询 nmc.cn 会带来无谓的电量与流量消耗——这正是 FCM 推送要解决的问题（事件驱动而非轮询）。因此：

- 每日/降雨/摘要类 → 精确本地通知（系统调度，零后台进程）。
- 官方预警即时送达 → FCM（真实推送服务，需后端）。
- JS 调度器仅在前台运行，负责内容刷新与即时预警，被杀后的兜底由前两者覆盖。

此结论已按系统限制评估，未假设 JS 定时器在应用被杀后继续运行。
