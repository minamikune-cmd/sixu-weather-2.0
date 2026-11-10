# 四序天气 Android · 权限说明

声明位置：`android/app/src/main/AndroidManifest.xml`。原则：权限最小化，仅申请功能必需项。

| 权限 | 用途 | 申请时机 | 拒绝的影响 |
| --- | --- | --- | --- |
| `INTERNET` | 请求 Open-Meteo 天气/空气质量、nmc.cn 官方预警、BigDataCloud 反向地理编码；FCM 推送 | 安装时授予（普通权限） | 无法获取任何天气数据 |
| `ACCESS_COARSE_LOCATION` | 定位当前城市（城市级精度足够） | 用户点击「定位」后运行时申请 | 可手动搜索城市，功能完整 |
| `ACCESS_FINE_LOCATION` | 提高定位精度（优先 coarse，fine 为增量精度） | 同上 | 定位偏差略大，不影响使用 |
| `POST_NOTIFICATIONS`（Android 13+） | 每日天气、降雨提醒、官方预警通知 | 用户在订阅弹窗点击「开启通知」后申请 | 订阅调度静默跳过，天气页正常使用 |
| `SCHEDULE_EXACT_ALARM` | 每日通知按用户设定的精确时间弹出 | 安装时声明；Android 12+ 默认授予，部分机型需用户在闹钟设置中确认 | 每日通知可能有几分钟漂移 |
| `RECEIVE_BOOT_COMPLETED` | 设备重启后恢复每日通知调度 | 安装时授予 | 重启后需打开一次应用恢复调度 |
| `WAKE_LOCK` | 通知触发时唤醒屏幕片刻（插件内部使用） | 安装时授予 | 无感知 |

## 硬件特性声明（非权限）

```xml
<uses-feature android:name="android.hardware.location.gps" android:required="false" />
<uses-feature android:name="android.hardware.location.network" android:required="false" />
```

定位为可选增强，不存在的设备（平板、电视）也能安装使用。

## 权限设计决策

- **不申请** `ACCESS_BACKGROUND_LOCATION`：定位仅在用户主动点击时前台执行一次，订阅城市为显式选择，无后台定位需求。
- **不申请** `READ/WRITE_EXTERNAL_STORAGE`：无任何文件读写；WebView 资源全部打包在 APK 内。
- **通知权限状态提示**：订阅弹窗内展示权限横幅（`src/ui/components/SubscriptionsDialog.tsx`）：未授权时提示「开启通知权限后，订阅的提醒才能推送给你」并提供一键申请；被拒绝时引导至系统设置。调度器每 tick 先检查权限，未授权不调度。
- **定位权限**：首次启动展示定位说明弹层（用途、数据去向、可拒绝），拒绝后进入手动选城流程，不反复骚扰。
