# 阶段 08：GitHub Actions 与交付流水线

建立 PR CI：依赖安装、缓存、lint、typecheck、单元/集成测试、Web build、Playwright（适当分层）、依赖审计。建立 Android 构建 job，使用固定 JDK/SDK/Gradle 配置，上传 Debug APK artifact。必要 Secrets 使用 GitHub Actions Secrets，不写入 YAML 或日志。

为 workflow 设置最小权限、并发控制、超时、缓存和失败诊断。Release workflow 使用 tag/手动触发，构建签名发布包仅在 Secrets 完备时执行。验证 workflow 真实运行结果；未运行不得声称成功。