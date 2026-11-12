# 2.0 风险登记表（RISK REGISTER）

> 基线：`e4df8a6` 审计（2026-11-12）。等级 = 概率 × 影响（高/中/低）。责任人：阶段负责人；每阶段验收时复核本表。

| ID | 风险 | 等级 | 影响 | 缓解 / 应对 | 责任阶段 | 状态 |
|---|---|---|---|---|---|---|
| R-01 | CI 未运行 `npm test`，回归不可见 | 中×高 = **高** | 合入坏代码无网拦 | 阶段 08 在 lint+build job 增加 `npm run test`；本审计已实测 52/52 通过 | 08 | 待办 |
| R-02 | 无 Playwright E2E 入库，UI/移动端仅人工验收 | 中×高 = **高** | 视觉/交互回归漏检 | 阶段 07 建 Playwright 套件（前期 .tmp-e2e 脚本可作种子）；关键路径冒烟入 CI | 07 | 待办 |
| R-03 | Web 通知受浏览器限制，页面关闭即不可达 | 高×中 = **高** | Web 端订阅推送实际不可用，用户预期落差 | 产品文案已声明；Android 端用本地通知+FCM 补位；Settings 页展示 FCM 令牌 | 05/09 | 已缓解（设计内） |
| R-04 | FCM 无 `google-services.json`，推送整体降级 | 高×中 = **高** | Android 远程推送不可用 | 已有安全降级路径（令牌 null）；阶段 06 由用户提供配置或保持降级并在 README/发布说明声明 BLOCKED-CONFIG | 06 | 待办 |
| R-05 | 中央气象台预警源为公开接口非官方 SLA：单点、字段可能变更、pageSize=500 全国列表上限 | 中×中 = **中** | 预警缺失或解析失败 | 失败静默兜底不阻断；10min 缓存；标题正则解析有 13 例测试；解析失败时降级为"未知类型"展示而非崩溃 | 04/07 | 已缓解，持续观察 |
| R-06 | Android 云端工具链版本超前（AGP 9.5.1/Gradle 9.8.2/SDK 37），GitHub 托管镜像可能缺 SDK 37 安装路径 | 中×中 = **中** | CI android job 失败 | 阶段 06/08 重建 ci.yml 时复核 sdkmanager 安装命令并实跑一次；必要时 pin SDK 36 | 06/08 | 待办 |
| R-07 | 工作区根目录残留发布 keystore 副本 `sixu-weather-release.jks_copy_58023407`（未入库） | 低×高 = **中** | 敏感材料散落工作区 | 已由 .gitignore（`*.jks*`）双保险防入库；建议移出工作区或删除——**待用户决定**；切勿提交 | 00（本阶段） | 待用户处置 |
| R-08 | 通知调度器 scheduler.ts（121 行）无单元测试 | 中×中 = **中** | 订阅触发/幂等逻辑回归漏检 | 阶段 07 用假时钟补调度器测试（30s tick、dedupe 7 天、Android 幂等刷新） | 07 | 待办 |
| R-09 | package.json 版本号仍为 1.0.0，无 CHANGELOG | 低×低 = **低** | 发布管理混乱 | 阶段 09 统一版本号并生成 CHANGELOG | 09 | 待办 |
| R-10 | _headers 无 CSP；添加时若漏配 connect-src 会导致三个 API 域被拦 | 低×中 = **低** | 启用 CSP 后功能静默失效 | 启用时把 `api.open-meteo.com`、`api.bigdatacloud.net`、`www.nmc.cn` 写入 connect-src；README 已有说明 | 08/09 | 已缓解（文档） |
| R-11 | 空气质量为 Open-Meteo CAMS 模式数据，与实况有偏差 | 中×低 = **低** | 用户误解 | 空气质量卡已带"仅供参考"免责（沿袭 1.0 的产品决策） | 03 | 已缓解 |
| R-12 | 上游 Open-Meteo/BigDataCloud 免费额度与可用性 | 低×中 = **低** | 限流或服务中断 | 3s 客户端节流 + 429 友好提示 + 缓存回退；多源均不可用时骨架屏+错误文案 | 04 | 已缓解 |
| R-13 | WIP 分支 `wip/geolocation-native-error-codes` 未合入主线 | 低×中 = **低** | 定位错误码改进丢失 | 已保全为独立分支，阶段 01 直接合并 | 01 | 已保全 |
| R-14 | 本地验证环境与 CI 环境差异（Node 24/npm 11 本机通过，CI 用 setup-node 默认） | 低×中 = **低** | CI 环境性失败 | 阶段 08 在 ci.yml pin Node 版本与锁文件哈希安装 | 08 | 待办 |

## 使用约定

- 新增风险：补行并指定责任阶段；每阶段 progress/PHASE-NN.md 末尾复核本表，关闭/降级需写明证据。
- 验收受阻时按 00-MASTER-RULES 标注 BLOCKED-CONFIG / PENDING-DEVICE / FAIL，不得伪造验证结论。
