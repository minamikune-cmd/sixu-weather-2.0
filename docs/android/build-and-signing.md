# 四序天气 Android · 构建与签名

## 环境要求

- JDK 21、Android SDK（platform 37、build-tools 37.0.0）
- Node.js ≥ 20.19（Web 构建）

## 三种构建产物

```bash
# 1. Debug APK（自包含 debug 签名，可直接安装测试）
npm run android:build          # = npm run cap:sync + gradlew :app:assembleDebug
# 产物：android/app/build/outputs/apk/debug/app-debug.apk

# 2. Release APK（未配置签名时为未签名包，仅验证流水线）
cd android && ./gradlew :app:assembleRelease
# 产物：android/app/build/outputs/apk/release/app-release-unsigned.apk（未签名时）

# 3. Android App Bundle（Google Play 上架格式；配置签名后即为签名 AAB）
cd android && ./gradlew :app:bundleRelease
# 产物：android/app/build/outputs/bundle/release/app-release.aab
```

本环境（Linux 容器，无 Android Studio）三条流水线均已实际跑通，产物见 `android/app/build/outputs/`。

## 发布签名（密钥由用户安全提供）

**keystore 与密码绝不提交 GitHub**（`.gitignore` 已排除 `*.keystore`、`*.jks`、`android/keystore.properties`、`android/app/google-services.json`）。

1. 生成密钥（本地执行一次，离线备份）：

   ```bash
   keytool -genkeypair -v -keystore sixu-weather-release.jks \
     -alias sixu-weather -keyalg RSA -keysize 2048 -validity 10000
   ```

2. 复制 `android/keystore.properties.template` 为 `android/keystore.properties`，填入 `storeFile`（相对 `android/` 目录）、`storePassword`、`keyAlias`、`keyPassword`。

3. 重新执行 `assembleRelease` / `bundleRelease`，产物自动使用发布签名。

4. 校验签名：

   ```bash
   apksigner verify --print-certs android/app/build/outputs/apk/release/app-release.apk
   jarsigner -verify android/app/build/outputs/bundle/release/app-release.aab
   ```

未提供 `keystore.properties` 时 release 构建产出**未签名**产物——这是刻意的流水线验证行为，不是可发布包。

## 调试 / 正式配置隔离

| 项 | Debug | Release |
| --- | --- | --- |
| 签名 | `android/app/debug.keystore`（公开等价物，gitignore） | 用户 keystore.properties（不入库） |
| 日志 | 完整 | 业务代码无日志输出 |
| minify | 关 | 关（当前无混淆需求；启用时检查 Capacitor 插件 keep 规则） |
| FCM | 同 release 机制 | 由 `google-services.json` 是否存在决定（`BuildConfig.FCM_ENABLED`） |
| WebView 调试 | 未开启 `setWebContentsDebuggingEnabled` | 同左 |

## CI

`.github/workflows/ci.yml` 中 Web 与 Android 构建并行；Android 任务复用同一 gradle 命令，不接触任何签名材料。
