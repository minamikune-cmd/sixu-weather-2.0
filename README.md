# sixu-weather 2.0 — DSH 分阶段执行入口

目标：基于 sixu-weather 1.0 的完整能力，升级为 Web + Android 双端天气应用。Android 使用 Capacitor。视觉方向为高级柔光玻璃、毛玻璃与沉浸式动态天气；功能包括四季主题、天气推送订阅、准确天气数据与日出日落时间。

## 执行顺序
先读 `00-MASTER-RULES.md`，再依次执行 `prompts/00-audit.md` 到 `prompts/09-release.md`。每阶段完成后输出变更清单、测试证据、风险和下一阶段计划；通过阶段验收后再继续。

## 测试状态
- PASS-AUTOMATED：自动化测试通过
- PASS-BUILD-ONLY：构建通过，未进行设备运行验证
- PENDING-DEVICE：需真实 Android 设备验证
- BLOCKED-CONFIG：缺少密钥、服务或环境
- FAIL：测试失败

不得将 APK 构建成功说成真机验证成功，不得虚构推送送达、后台运行或定位测试结果。