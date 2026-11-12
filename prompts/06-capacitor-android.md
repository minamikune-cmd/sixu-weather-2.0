# 阶段 06：Capacitor Android 集成

核验 Capacitor 版本、插件兼容性、Android Gradle Plugin、Gradle Wrapper、JDK、compileSdk/targetSdk/minSdk 和包名。确保 Web build 后可同步到 Android，应用启动、导航、状态栏/安全区、返回键、键盘、网络状态和生命周期行为合理。

检查权限最小化、定位授权流程、通知渠道、FCM 集成、图标/启动页、深浅色、离线与错误页。签名材料和密钥只能来自安全 Secrets，不得提交仓库。

在可用云环境执行 npm/包管理器检查、lint、typecheck、测试、Capacitor sync、Gradle assembleDebug；生成 APK artifact（若 CI 环境允许）。真机功能必须标 PENDING-DEVICE，不能伪称已验证。