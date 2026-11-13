# 阶段 02 · 架构与数据层 — 完成报告

- 日期：2026-11-13 · 状态：**已完成，等待用户验收批准进入阶段 03**
- 依据：`prompts/02-architecture.md` · 总控：`00-MASTER-RULES.md`

## 1. 阶段完成摘要

阶段 02 要求：清晰分层、统一数据模型/API 客户端/缓存/错误/加载/重试、统一城市/语言/单位/时区、Web 与 Android 平台能力接口隔离、落实环境变量校验/超时/限流/缓存过期/离线兜底/日志脱敏、禁暴露服务端密钥、输出架构文档与数据流图。

执行前核查结论：阶段 01 恢复的基线（`2e2654e` 等三个提交）与 PHASE-01 报告一致；分层架构、统一数据模型（`types/weather.ts`）、平台抽象层（`platform/` 10 模块）、缓存过期与离线兜底（`useWeather` 10min TTL/8 城 LRU/失败回退缓存）、超时与客户端限流（`fetchJson` 12s + 3s 节流 + 429 处理）在基线中已成型且经 55 例测试验证。因此阶段 02 以**增量补强**方式落实剩余缺口，未重写任何现有模块：

1. **有界重试策略**：基线无自动重试，仅缓存兜底。`fetchJson` 现对瞬时故障（5xx / 网络层 TypeError / 单次超时）重试 1 次（间隔 400ms）；429/4xx、已断网、调用方主动取消不重试。对外错误文案与阶段 01 完全一致（兼容性风险：无）。
2. **环境变量校验**：新增 `config/env.ts`，启动时扫描 `import.meta.env`，凡 `VITE_*` 且命名疑似密钥即告警（只输出键名）——直接落实"禁止在客户端暴露服务端密钥"的防呆门禁。本应用数据源全部免密钥，正常扫描恒为干净。
3. **日志脱敏**：新增 `platform/log.ts` 安全日志出口（只提取 `name/code/message` 原始字段，嵌套对象一律省略）；`platform/geolocation.ts` 原生失败日志从 dump 整个错误对象切换为该出口（错误对象可能携带坐标等敏感载荷）。
4. **文档**：架构文档修订（重试/环境变量/日志三节 + 数据流图 4 幅），新增 `docs/CONFIGURATION.md` 配置说明，本报告。

## 2. 文件修改清单

| 文件 | 类型 | 原因与内容 |
|---|---|---|
| `src/services/weather/api.ts` | 修改 | `fetchJson` 拆分出 `fetchOnce` 并增加有界重试循环（`MAX_ATTEMPTS=2`、`RETRY_DELAY_MS=400`、`__retryable` 内部标记）；对外行为与错误文案不变 |
| `src/config/env.ts` | 新增 | `scanEnvForSecrets` / `validateClientEnv`：`VITE_*` 疑似密钥命名扫描，告警只含键名 |
| `src/platform/log.ts` | 新增 | `describeError` / `logError`：错误日志脱敏出口 |
| `src/platform/geolocation.ts` | 修改 | 原生失败日志改用 `logError`（脱敏），错误码→中文映射逻辑不动 |
| `src/main.tsx` | 修改 | bootstrap 首步调用 `validateClientEnv(import.meta.env)` |
| `tests/api.test.ts` | 修改 | 新增 `runApiRetryTests` 6 例（重试成功/5xx 上限/网络抖动/429 与 4xx 不重试/离线不重试/取消不重试） |
| `tests/env.test.ts` | 新增 | 环境变量校验 6 例（含"日志绝不泄露变量值"断言） |
| `tests/log.test.ts` | 新增 | 日志脱敏 6 例（含"坐标/令牌不得进日志"断言） |
| `tests/run.ts` | 修改 | 注册三个新套件 |
| `docs/TECHNICAL_ARCHITECTURE.md` | 修改 | 阶段 02 修订头注、§6 数据流图（启动/主数据流/预警流/平台边界）、§7 修订要点 |
| `docs/CONFIGURATION.md` | 新增 | 环境变量/数据源/限流重试/缓存/单位时区全量配置说明 |
| `docs/progress/PHASE-02.md` | 新增 | 本报告 |

无删除文件。未触碰 Android 原生代码、CI、平台插件配置。

## 3. 架构说明

分层与依赖方向未变（pages → hooks/services → domain；platform 被上层调用且 Web 自动降级；domain 零 IO）。阶段 02 变更集中在**数据访问层横向能力**与**平台层日志出口**：

- 重试策略位于 `fetchJson` 内（数据访问层最内圈），所有 API 调用（预报/空气/搜索/逆地理）自动继承；预警接口保持"永不抛出、静默兜底"的独立策略不变（预警是增强信息，重试无意义）。
- 环境变量校验位于 `config/`，启动序列最前点（先于 `initPlatform()`），告警不阻断启动，避免极端配置锁死用户。
- 日志脱敏是平台层新出口，后续阶段任何 `console.error(error)` 都应迁移到 `logError(tag, error)`。
- 数据流图见 `docs/TECHNICAL_ARCHITECTURE.md` §6；配置面全表见 `docs/CONFIGURATION.md`。

技术决策记录：
- 重试 1 次而非指数退避多次——免费公共 API 配额敏感，2 次尝试已覆盖网络抖动，且现有 3s 客户端节流不被重试绕过叠加。
- 环境变量校验看"键名"而非"值"——值可能是任意用户配置，键名才是密钥信号；只看键名也保证日志本身不泄露任何值。
- 日志脱敏只保留原始类型字段——Capacitor 插件错误是 plain object，直接序列化会把 coords/token 写进 logcat。

## 4. 测试报告（真实执行）

| 命令 | 退出码 | 结果 |
|---|---|---|
| `npm test` | 0 | 10 套件 73/73 通过（阶段 01 为 7 套件 55/55；新增有界重试 6、环境变量校验 6、安全日志 6） |
| `npm run lint` | 0 | 0 错误 |
| `npx tsc -b` | 0 | 类型检查通过 |
| `npm run build` | 0 | 成功；index 287.34 kB / gzip 94.88 kB（阶段 01：285.90 / 94.17 kB，+1.4 kB 源 / +0.7 kB gzip，为重试与校验逻辑增量） |
| `npm audit --omit=dev` | 0 | found 0 vulnerabilities |
| `npx cap sync` | 0 | sync finished，工作树无 Android 工程残留变更 |

未执行及原因：`npm ci`——本阶段未增删任何依赖，`package-lock.json` 无变化，阶段 01 已验证锁文件一致性，重装无新增信息量。Gradle 编译——本阶段未修改 Android 原生代码或 `capacitor.config.ts`，无适用性。

## 5. 安全审计

- 新增代码不含任何密钥、令牌、坐标样例之外的测试字面量；测试中的 `SUPER-SECRET-VALUE-123`、`fcm-token-xxx` 仅为断言"不得出现在日志"的探针值，非真实凭据。
- `src/config/env.ts` 只读取 `import.meta.env` 的键名；告警文本只拼接键名。
- `src/platform/log.ts` 不序列化对象；`geolocation.ts` 不再向 logcat 输出完整错误对象。
- 提交前将逐一检查暂存区无 `.jks` / `google-services.json` / `.env`（gitignore 规则阶段 01 已逐条核验）。
- 客户端环境变量门禁已落地：即便未来某个阶段误加 `VITE_xxx_KEY`，启动即告警。

## 6. 遗留问题

- **BLOCKED-CONFIG**：FCM 仍缺 `google-services.json`（R-04，维持阶段 01 状态，阶段 06 决策）。
- **PENDING-DEVICE**：定位错误码中文映射需真机重装 APK 验证（维持阶段 01 状态，阶段 06）。
- **PENDING**：scheduler/theme/UI 组件仍无单元覆盖（R-08，阶段 07 范围）；CI 无 test job、无 Playwright（R-01/R-02，阶段 07/08）。
- **已知风险**：nmc 预警源单点与 500 条上限（R-05）未变——重试策略刻意不覆盖预警接口（其自身静默兜底已足够）；package.json 版本号仍 1.0.0（R-09，阶段 09）。

## 7. Git 记录

- 阶段 02 提交：`776b483` feat(phase-02): 数据层有界重试、客户端环境变量校验与安全日志脱敏（12 文件 +580/−7）
- 当前分支：`main`，基于阶段 01 基线 `530c5c7`。
- 远程同步状态：`main...origin/main [ahead 5]`（阶段 01 三个提交 + 阶段 00 两个提交尚未推送；阶段 02 提交后 ahead 6）。按要求未执行 push。

## 8. 下一阶段建议（仅准备，未执行）

阶段 03（视觉系统）可基于以下现状启动：`App.css` 787 行 CSS 变量主题、`theme/index.ts` 风格决策、阶段 00 设计方向（高级柔光玻璃/毛玻璃、沉浸动态背景、四季主题）已在 `docs/design-system.md` 有 1.0 资产记录；阶段 03 应先审计该文档与现有主题机制的差距清单，再决定视觉重构范围。阶段 02 交付的 `platform/log.ts` 建议在阶段 03 涉及新动画/背景代码时复用为统一日志出口。
