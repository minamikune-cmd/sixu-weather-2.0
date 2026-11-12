# 阶段 00：全面审计

深入检查 2.0 当前仓库，并只读分析 1.0 源仓库。盘点目录、技术栈、依赖、页面、组件、天气 API、地理定位、时区处理、日出日落算法、主题系统、通知、Capacitor、Android 原生代码、测试、CI/CD、部署配置。

对照 1.0 识别必须迁移的功能、资源和业务规则；检查 2.0 已有实现哪些可复用、哪些损坏、哪些缺失。检查安全风险、性能、无障碍、移动端适配、密钥管理。

先不要大规模改代码。产出：
- docs/PROJECT_AUDIT.md
- docs/FEATURE_INVENTORY.md
- docs/TECHNICAL_ARCHITECTURE.md
- docs/RISK_REGISTER.md
- docs/progress/PHASE-00.md

列出迁移映射、优先级、依赖关系、验证方式。