# 阶段 05：天气订阅与推送

设计用户可管理的天气订阅：订阅地点、天气事件、阈值、静默时段、频率、时区、启停和取消。明确 Web Push 与 Android Push 的能力边界。Android 使用 Capacitor Push Notifications 与 Firebase Cloud Messaging（如项目现有技术栈适用）；Web 使用标准 Push API/Service Worker。

实现安全的 token 注册、更新、注销、去重、用户授权、权限拒绝和失效 token 清理。服务端发送需防重、限频、记录结果；Secrets 只放服务端/CI Secret。提供模拟推送测试，不宣称模拟等于真实送达。

没有 Firebase 配置时标记 BLOCKED-CONFIG；无设备验证时标记 PENDING-DEVICE。输出订阅设计、部署配置与测试证据。