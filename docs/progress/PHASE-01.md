# 阶段 01 · 1.0 功能迁移与基线建立 — 完成报告

- 日期：2026-11-13 · 状态：**已完成，待用户批准进入阶段 02** · 详表：[MIGRATION_REPORT.md](../MIGRATION_REPORT.md)

## 1. 目标（对照 prompts/01-migration.md）

把 1.0 仍有价值的功能/业务规则/资源完整迁移到 2.0，保留 2.0 可靠的 Capacitor/Android 资产；建立可重复安装/开发/测试/构建流程；修复迁移问题；输出 MIGRATION_REPORT、DEVELOPMENT_GUIDE、本文件。

## 2. 恢复文件

从 `e4df8a6` 恢复 187 文件 +14,266 行（`2e2654e`）：src/ 44 TS/TSX、tests/、android/ 工程（含 FCM/通知原生插件）、.github/ci.yml、public/、resources/、docs/ 历史报告、全部配置文件。保留未动：`00-MASTER-RULES.md`、README.md（DSH 入口）、prompts/00–09、阶段 00 审计五件套。

## 3. 合并记录

`wip/geolocation-native-error-codes`（5 文件 +69/−4）合并前逐文件审查（映射表/测试/忽略项/报告四部分均为纯增量，无覆盖有效修改），`git merge` 无冲突，`c90dd35`。

## 4. keystore 安全处理

- `sixu-weather-release.jks_copy_58023407` 移出工作区至 `/root/.sixu-keystore-backup/`（目录 700、文件 600），**保留副本未删除**（同目录另存 `.orig` 原件）。
- SHA-256：`7fd14ec135e55c36f921cda3014241a1f45dfd9527158e991b6aceb827c0c69a`（源文件与备份一致）。
- gitignore 核验：`*.jks` / `*.jks_*` / `*.keystore` / `android/keystore.properties` / `android/app/google-services.json` / `.env*`，`git check-ignore` 逐条命中。
- git 全历史扫描：任何提交均无 .jks/keystore/google-services.json 入库（仅 keystore.properties.template 模板，无敏感内容）。

## 5. 验证结果（实跑命令）

| 命令 | 结果 |
|---|---|
| `npm ci --cache /tmp/npm-cache` | 成功（锁文件一致） |
| `npm run lint` | 退出码 0 |
| `npx tsc -b` | 退出码 0 |
| `npm test` | 7 套件 55/55 通过（含新增 geolocation 3 例） |
| `npm run build` | 成功；index 285.90 kB / gzip 94.17 kB |
| `npm audit --omit=dev` | found 0 vulnerabilities |
| `npx cap sync` | 7 插件识别，copy/update web 成功，工作树无残留变更 |

## 6. 提交 SHA

- `2e2654e` 恢复应用资产 · `c90dd35` 合并 WIP 分支 · 文档提交见 `git log`

## 7. 剩余风险与未解决问题

1. FCM 缺 `google-services.json` → 推送 BLOCKED-CONFIG（R-04，阶段 06 决策）。
2. 定位错误码修复需重装 APK 真机回填（PENDING-DEVICE，R-13 已合入待验证）。
3. CI 无 test job、无 Playwright（R-01/R-02，阶段 07/08）。
4. 版本号 1.0.0 未管理（R-09，阶段 09）。
5. 未跟踪构建残留（node_modules/dist/.gradle*/.pw-browsers/.tmp-e2e）不提交，建议定期清理。

## 8. 暂停点

按用户要求，阶段 01 完成后暂停，等待批准进入阶段 02（未提前执行）。
