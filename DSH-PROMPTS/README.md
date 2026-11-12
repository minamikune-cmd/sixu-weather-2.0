# sixu-weather 2.0 — DSH 分阶段执行提示词

本目录用于 DeepSeek Harness（DSH）按阶段执行 sixu-weather 2.0 重构。

## 执行顺序

1. 先阅读本仓库根目录的 `00-MASTER-RULES.md`（如尚未创建，先以本文件规则为准）。
2. 依次执行 `prompts/00-audit.md` 至 `prompts/09-release.md`。
3. 每阶段完成后提交代码、测试结果、变更摘要和未解决风险，再进入下一阶段。
4. 不得跳过审计直接重写；先备份和盘点，再迁移与重构。

## 目标

- Web + Android 双端；Android 使用 Capacitor。
- 视觉方向：高级柔光玻璃、毛玻璃、沉浸式动态天气。
- 功能方向：天气推送订阅、四季主题、可靠天气数据与日出日落时间。
- CI：GitHub Actions、Web 自动化测试、Android Gradle 构建。

## 测试诚信

DSH 云端没有真实 Android 设备时，必须区分：
- PASS-AUTOMATED：自动化测试通过
- PASS-BUILD-ONLY：构建通过，未进行设备运行验证
- PENDING-DEVICE：必须真机验证
- BLOCKED-CONFIG：缺少密钥、服务或环境
- FAIL：测试失败

不得把 APK 构建成功描述为 Android 真机验证成功。不得虚构推送送达、定位、后台运行或耗电测试结果。

## 安全边界

- 不访问、不修改 sixu-weather 1.0 仓库。
- 不提交 API Key、Firebase 私钥、签名密钥或其他 Secrets。
- 禁止 force push；禁止删除 Git 历史。
- 所有功能变更必须有测试与文档。
