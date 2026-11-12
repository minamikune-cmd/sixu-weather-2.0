# 阶段 01：1.0 功能迁移与基线建立

依据阶段 00 的审计报告，把 1.0 中仍有价值的功能、业务规则、资源和内容完整迁移到 2.0。禁止复制旧 bug、过时依赖、硬编码密钥和不兼容实现。保留 2.0 现有可靠的 Capacitor/Android 工程资产。

建立可重复安装、开发、测试、构建流程。修复迁移导致的 lint、类型、构建和测试问题。为关键业务逻辑补单元测试。

输出 docs/MIGRATION_REPORT.md、docs/DEVELOPMENT_GUIDE.md、docs/progress/PHASE-01.md。逐项标记迁移完成/替代/废弃及原因。