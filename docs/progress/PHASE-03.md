# 阶段 03 · 视觉设计系统与沉浸式天气体验 — 完成报告

- 日期：2026-11-13 · 状态：**已完成，等待用户验收批准进入阶段 04**
- 依据：`prompts/03-visual-system.md` · 总控：`00-MASTER-RULES.md`

## 1. 阶段完成摘要

阶段 03 要求：全面审计现有设计系统 → 统一设计 Token → 四季主题 → 沉浸式天气视觉 → Web/Android 兼容 → 验证与文档。

执行前核查的关键事实：当前基线（`4af51fa`，阶段 02 验收）中**已经包含**完整的高级视觉系统实现——它来自历史提交 `c7e57a3`（阶段 3：高级视觉系统重构）并经阶段 01 提交 `2e2654e` 恢复。`docs/design-system.md` 与 `docs/reports/phase-3-visual-system.md` 已存在，12 张场景截图已在库。PHASE-02 报告末尾对此有预见性指示："阶段 03 应先审计该文档与现有主题机制的差距清单，再决定视觉重构范围"。

因此阶段 03 以**审计 + 验证 + 补缺口**为策略，未重写任何现有视觉代码（尊重"优先使用现有主题系统进行增量扩展"与"增量修改，不重写整个项目"）：

1. **视觉系统全面审计**（§2）：确认令牌三层结构、决策纯函数、四季 × 昼夜 × 天气三层组合、玻璃三档体系、性能预算与降级链路全部成型且合理。
2. **预警级别色 token 化**：补齐审计发现的唯一样式缺口——应用内提示卡两级色与官方预警蓝/黄/橙/红四级色原本硬编码 hex，现集中为语义令牌（§3）。
3. **Playwright 视觉/交互检查入库**（§4）：落实阶段提示词的硬性要求（"补充 Playwright 视觉/交互检查，并输出截图"）。11 例用例对生产构建运行，注入确定性夹具，覆盖全部天气种类、主题切换持久化、动效双重降级、预警令牌色断言与移动端布局，输出 7 张 `phase3-e2e-*.png` 截图。
4. **文档修订**：`design-system.md` 断点描述修正为与 CSS 实际一致的四个媒体查询，新增预警令牌表；架构/配置文档补记 E2E 工具链；本报告。

## 2. 原有设计系统审计结果

### 2.1 主题系统（结论：结构良好，直接复用）

- **决策层** `src/theme/index.ts`（31 行纯函数）：`resolveStyleClass(preferences, phase, systemDark)` 把四项视觉风格解析为 CSS 类；`isDarkChrome()` 同步 Android 状态栏。
- **季节**：`src/domain/seasons.ts` `getSeason(month, latitude)`，auto = 当地月份 + 纬度半球反转；用户选择经 `sixu-preferences-v1` 持久化（`src/config/preferences.ts`），刷新不丢失、不重载数据。
- **昼夜**：`src/domain/solar.ts` 以日出日落 ±45min 分 dawn/day/dusk/night 四相位。
- **令牌三层**（`src/App.css`，787 行）：primitive（`--glass-blur 22px`、`--glass-sat 1.25`、`--radius-* 12/20/30px`、`--shadow-soft/lift`）→ semantic（文字/玻璃/表面/边框/天空/光晕/图表色，按 `[data-season]`/`[data-phase]`/`[data-kind]` 覆盖）→ `.glass` 工具类统一入口。暗色为默认，`.style-light/.style-dark` 覆盖。
- **根节点组合**：`src/App.tsx` 根 div 携带 `styleClass + animations-on/off + data-season/phase/kind`，Atmosphere 背景层与天气数据完全解耦。

### 2.2 UI 组件审计（结论：信息层级已达标）

逐文件阅读确认：Hero（温度锁定层/体感/高低温/城市与更新时间）、metrics 七卡（线框分隔而非均重卡片堆叠）、24h 温度降水图表、7 日预报 + 日照弧、官方预警、应用内天气提示、设置弹窗（单位/季节/视觉风格/动画/触觉）、骨架加载与空态齐全。气象含义与业务逻辑零改动。

### 2.3 性能与兼容审计（结论：预算明确，降级链完整）

- 动画全部 transform/opacity；雨幕为 200% 高伪元素平移零重绘；粒子硬预算（雨 64/雪 46/星 52，移动端 ×0.55）；30fps 上限；DPR≤1.5；visibilitychange 后台暂停。
- 动效双重降级：设置开关 `animations-off`（`animation:none !important`）+ `prefers-reduced-motion` 媒体查询（`.01ms`）。
- 玻璃降级：无 `backdrop-filter` 时仍有半透明底；`.dialog` 使用 `--glass-bg-strong`（82–96% 不透明）保证可读。
- 安全区：`viewport-fit=cover` + `env(safe-area-inset-bottom)` 用于移动导航/Toast/弹窗；触控目标 ≥44px。

### 2.4 差距清单（本阶段处理）

| # | 差距 | 处理 |
|---|---|---|
| 1 | 无 Playwright 视觉/交互检查（提示词硬性要求） | 本阶段新增 11 例（§4） |
| 2 | 预警级别色硬编码 hex 未走 token | 已 token 化（§3），e2e 断言计算色值 |
| 3 | `design-system.md` 断点描述（720/1024/1440 五档）与 CSS 实际（600/820/1180/701+ 四查询）不符 | 已修订文档 |
| 4 | `docs/progress/PHASE-03.md` 缺失 | 本报告 |
| 5 | `oklch()` 全量使用需 WebView Chrome 111+ | 记录：Capacitor 8 基线可接受，不改造 |
| 6 | AQI 颜色在 `src/domain/air.ts` 单一数据源 | 记录：数据驱动语义色，符合"统一管理"，不动 |

## 3. 新设计 Token：预警语义色

在 App.css 语义层 `:root` 集中定义（App.css:41-59 附近），组件与浅色覆盖只引用令牌：

- 应用内提示卡：`--alert-watch`（#d97757）、`--alert-advisory`（#c9a44c）+ `--alert-*-bg-light` 浅色底变体。
- 官方预警四级：`--warn-red/orange/yellow/blue`（#e5484d / #f76b15 / #ffb224 / #0091ff）+ `-text` 文字色 + `-bg-light` 浅色底。

效果：`.alert-card.watch/advisory` 与 `.official-warning.level-*` 不再含任何硬编码色值；令牌断链由 e2e 计算样式断言（rgb 精确匹配）守护。

## 4. Playwright E2E 视觉/交互检查

- **配置**：`playwright.config.ts` —— 对 `npm run build && vite preview` 的生产构建运行（非 dev server）；`E2E_BASE_URL` 可切到外部实例；浏览器复用仓库内 `.pw-browsers`（chromium-1254 与 @playwright/test 1.65 精确匹配，零额外下载）。
- **夹具**：`tests/e2e/fixtures.ts` —— 路由拦截 Open-Meteo forecast / air-quality / 中央气象台 alarm 接口注入确定性响应；`Date` 冻结使昼夜相位/季节推导与时间显示完全确定；预置 localStorage 走与 App 相同的存储键。
- **类型覆盖**：新建 `tsconfig.e2e.json` 并加入 `tsconfig.json` references，`tsc -b` 覆盖 e2e 代码（此前 tests/ 单测不在任何 tsconfig include，维持原状）。

11 例用例（`tests/e2e/visual.spec.ts`）：

| 分组 | 用例 | 关键断言 |
|---|---|---|
| 天气场景 | 晴天白天桌面端 | data-kind/phase/season、温度锁定层文案、backdrop-filter 生效、逐时逐日模块存在 |
| 天气场景 | 雨天 | data-kind=rain、雨幕层挂载、advisory 卡令牌色 rgb(201,164,76) |
| 天气场景 | 大风 | watch 卡令牌色 rgb(217,119,87) |
| 天气场景 | 雪天×冬季主题 | data-kind=snow + data-season=winter 组合 |
| 天气场景 | 雷暴夜间 | data-phase=night、暗云砧层、星空画布挂载 |
| 天气场景 | 官方预警 | 蓝/橙级别边框与文字令牌色、级别排序（橙先于蓝） |
| 移动端 | 390×844 底部导航 | 导航可见、触控目标 ≥44px、安全区样式 |
| 主题 | 春季切换与持久化 | 设置弹窗玻璃、data-season 切换、刷新后保持（localStorage 断言）、Escape 关闭 |
| 主题 | 动画开关 | animations-off 类、sun-rays animation-name 为 none |
| 动效降级 | prefers-reduced-motion | 动画时长 ≤0.01ms（Chromium 序列化为 1e-05s） |
| 加载 | 骨架屏过渡 | aria-busy、骨架截图、数据到达后消失 |

截图产物（`docs/reports/assets/phase3-e2e-*.png`，7 张）：clear-day-desktop、rain-day、snow-winter、thunder-night、settings-dialog、mobile-clear、skeleton-loading。

## 5. 主要修改文件

| 文件 | 类型 | 原因与内容 |
|---|---|---|
| `src/App.css` | 修改 | 新增预警语义令牌（§3）；`.alert-card` / `.official-warning` 各级别规则改引令牌（行为零变化） |
| `playwright.config.ts` | 新增 | E2E 配置：生产构建 + preview、浏览器路径、失败留证 |
| `tests/e2e/fixtures.ts` | 新增 | 确定性夹具：接口拦截、Date 冻结、偏好/标记预置 |
| `tests/e2e/visual.spec.ts` | 新增 | 11 例视觉/交互用例（§4） |
| `tsconfig.e2e.json` | 新增 | e2e 类型检查项目 |
| `tsconfig.json` | 修改 | references 加入 e2e 项目 |
| `package.json` | 修改 | devDependency `@playwright/test@1.65.0`；脚本 `test:e2e`（内置 `PLAYWRIGHT_BROWSERS_PATH=.pw-browsers`） |
| `.gitignore` | 修改 | 忽略 `.npm-cache/`（沙箱内本地 npm 缓存） |
| `docs/design-system.md` | 修改 | 断点描述修正为四查询实况；新增预警语义令牌表 |
| `docs/TECHNICAL_ARCHITECTURE.md` | 修改 | §4 测试策略：E2E 工具链说明、单元计数更新、缺口修订 |
| `docs/CONFIGURATION.md` | 修改 | §6 验证：补记 `test:e2e` 用法 |
| `docs/reports/assets/phase3-e2e-*.png` | 新增 | 7 张 e2e 验收截图 |

## 6. 设计与架构决策

1. **不重写，先审计**——视觉系统已由基线完整提供且质量达标；阶段预算全部投向验证基建与真实缺口（预警令牌、E2E）。理由：避免对已验收行为的回归风险，符合总控"增量修改"红线。
2. **E2E 对生产构建运行**（`vite preview` 而非 dev server）——玻璃、oklch、裁剪等浏览器行为以构建产物为准，截图可信。
3. **确定性优先**：接口拦截 + Date 冻结 + localStorage 预置，使截图与断言在任何时刻/网络下可复现；外部网络只发生在浏览器二进制与 npm 层。
4. **令牌色用计算样式断言守护**——比截图比对更稳：精确 rgb 匹配直接验证 token 接线，截图保留给人眼审阅。
5. **浏览器零新增下载**：复用历史 `.pw-browsers`（chromium-1254），版本与 @playwright/test 1.65 精确对齐；`.pw-browsers` 保持 gitignore。

## 7. 性能与兼容性考虑

- 视觉层零新增运行时依赖：@playwright/test 仅 devDependency，产物包体积不变（构建主包 gzip 94.9 kB）。
- 样式改动为颜色引用替换，不新增选择器、不新增动画。
- E2E 在 headless Chromium 验证 oklch/backdrop-filter 计算值；Android WebView 真机验证仍属缺口（§9）。
- 动效降级链经双路径断言（设置开关 + 系统减少动态）。

## 8. 测试命令及真实执行结果

| 命令 | 结果 |
|---|---|
| `npm ci --cache ./.npm-cache` | 通过（lockfile 一致；沙箱内 npm 用工作区缓存目录替代全局缓存） |
| `npm run lint` | 通过，0 错误 |
| `npx tsc -b`（含新增 e2e 项目） | 通过，退出码 0 |
| `npm test`（单测） | 通过：10 套件 73/73 |
| `npm run test:e2e` | 通过：11/11（npm ci 后复跑确认） |
| `npm run build` | 通过，12.8s，主包 287.3 kB / gzip 94.9 kB |
| `npm audit --omit=dev` | 0 漏洞 |
| `npx cap sync` | 通过，Android/Web 双端 copy+update 成功 |

补充说明：`npx playwright install-deps chromium` 在本沙箱安装过系统共享库（libatk 等，apt 层，不入库、不影响产物）；其他机器首次运行只需 `npx playwright install chromium`。

## 9. 未执行的测试及原因

- **Android 真机/模拟器验收**：无设备条件，明确标记为未验证。WebView 兼容性依据：Chromium 111+ 能力矩阵 + headless Chromium 计算样式断言；阶段 04 建议在有条件时补真机走查。
- **桌面端多浏览器（Firefox/WebKit）**：套件面向 Chromium 基线（与 Android WebView 同源内核），跨浏览器矩阵未执行。

## 10. 尚存问题

1. `oklch()` 全量使用要求 WebView Chrome 111+；过旧不可更新的系统 WebView 上色彩会降级为近似值（玻璃可读性不受影响）。已记录，不属本阶段范围。
2. 主题/调度器/UI 组件仍无单元覆盖（与阶段 02 结论一致，责任阶段 07）。
3. CI 未接入 `npm test` / `test:e2e`（责任阶段 08）。
4. `tests/` 单测不在 `tsc` include 内（阶段 01 既有现状）；本次仅保证新增 e2e 被类型覆盖，单测维持 esbuild 打包运行方式。

## 11. 安全扫描结果

- `npm audit --omit=dev`：**0 漏洞**。
- 环境变量防呆扫描（阶段 02 门禁）不受影响；本阶段无新增运行时依赖、无密钥面变化。
- e2e 夹具不含任何真实密钥；`.npm-cache/`、`.pw-browsers/`、`test-results/` 均已 gitignore。
- `git diff --check` 与敏感文件核查：提交前执行（见 §13）。

## 12. Git 提交 SHA

- 阶段 03 提交：`feat(phase-03): build immersive weather design system`（20 文件，+736/-22）；提交 SHA 见阶段汇报（自引用 SHA 随 amend 变化，不内嵌，与 PHASE-01/02 惯例一致）。
- 基线：阶段 02 `4af51fa`；阶段 01 `2e2654e` / `c90dd35` / `530c5c7`。
- 未 push；未 force push；未触碰阶段 00–02 历史提交与 upstream-1x 只读仓库。

## 13. 阶段 04 建议

（按 `prompts/` 目录实际提示词为准，以下为交接备忘）

1. **通知与订阅闭环**：阶段 01 已建 FCM 令牌链路与订阅数据模型，阶段 04 可落地本地调度通知的端到端验证（scheduler → evaluate → 通知展示），并利用本阶段 e2e 基建补通知场景的交互检查。
2. **真机验收窗口**：借阶段 04 的真机/模拟器条件，一并走查本阶段视觉（四季切换、玻璃、安全区、减少动态）。
3. **CI 前置**：阶段 08 的 CI 接入可直接复用 `npm test` 与 `test:e2e` 两个脚本（浏览器缓存 key 建议用 `.pw-browsers` 版本指纹）。
4. **文档衔接**：`docs/reports/phase-3-visual-system.md` 为历史视觉验收报告，本报告与其互补（审计+缺口+E2E）；阶段 04 报告建议沿用本格式。

## 14. 验收问题与修复（2026-11-13 第二、三轮合并记录）

针对两轮验收意见，以独立修复提交处理（第二轮 `480544c`，第三轮见 Git 历史；未重写视觉系统，未改历史提交）：

1. **浅色主题预警文字对比度**：新增 `--alert-watch-text` / `--alert-advisory-text` 令牌（深色主题同边框色，行为不变），并在 `.style-light` 为四级官方预警与两级提示卡建立独立深色文字变体。边框令牌保持原色（非文本对比 3:1 即可）。
2. **真实合成背景测量**（第三轮重写 `tests/e2e/contrast.ts`）：不再把卡片半透明背景解析式合成在纯白色上。现对活动页面截取景口 PNG，在隔离页用 canvas 解码，采样卡片内部纯背景区（左右内缩 16 CSS px 避开 14px 圆角弧线与左侧彩色边框、上下内缩 3 px 避开 1px 玻璃边框、排除所有子元素并扩 2 px 覆盖文字抗锯齿溢出），每 1 CSS px 一个采样点。玻璃透明度、天空渐变、天气氛围层、暗角全部来自最终渲染像素。
3. **最差像素法**（第三轮）：对每个有效背景像素逐一计算与标题文字色的 WCAG 相对亮度对比度，**取最低值**作为结果并输出对应背景色——不用中位数/平均数，避免掩盖局部低对比度。采样不足（<16 像素）、采样区越出截图边界、canvas 颜色解析失败（哨兵法 #010203）均显式报错，杜绝假通过。E2E 用例冻结入场动效（`animations: false`）后测量。
4. **浅色风格天空缺陷修复**（`src/App.css`，第三轮）：根因是 `.style-light.app`（特异性 (0,2,0)）的天空令牌被昼夜×季节 (0,3,0) 与天气再平衡 `.app.app[data-kind=…]` (0,3,0) 覆盖——浅色模式实际渲染中暗场景天空，旧解析式"叠白"假设掩盖了该缺陷。新增 `.style-light.app.app`（同为 (0,3,0)，靠样式表后置位置级联胜出）强制浅色风格在任何季节/天气下天空恒定明亮；深色风格规则不动。
5. **预警文字 Token（浅色变体最终值，第三轮）**：watch `#93400f`、advisory `#6f520f`、蓝 `#0a54b6`、黄 `#7a4f00`、橙 `#963f00`、红 `#a92428`；浅色卡背景透明度提至 .6（黄 .65）。深色主题 Token 与视觉不变。
6. **E2E 时间夹具时区**：`current.time` 原经 `toISOString()` 生成（UTC，与上海当地时间差 8 小时）；现由 `shanghaiDateTime()` 经 `Intl.DateTimeFormat(timeZone: 'Asia/Shanghai')` 生成，与 `utc_offset_seconds` 一致。`hourSeries` / `daily.time` / `sunrise` / `sunset` 原手工拼接日期（跨月产出 "11-32" 非法值）；现统一走 `addCalendarDays()`（`Date.UTC` 纯日历运算），跨月/跨年/闰年安全，且不依赖执行机器本地时区。
7. **文档**：`design-system.md` 中错误的 `src/domain/season.ts` 已修正为 `src/domain/seasons.ts`；令牌表同步更新浅色文字变体。

**最差像素实测（第三轮 E2E 输出，阈值 ≥4.5:1）**：

| 级别 | 最差对比度 | 对应背景色 |
|---|---|---|
| 蓝 | 5.07:1 | rgb(183, 224, 245) |
| 黄 | 5.33:1 | rgb(218, 226, 202) |
| 橙 | 4.85:1 | rgb(224, 214, 197) |
| 红 | 4.86:1 | rgb(227, 210, 213) |
| watch | 4.88:1 | rgb(226, 212, 205) |
| advisory（雨天场景） | 5.12:1 | rgb(212, 219, 204) |

证据截图：`docs/reports/assets/phase3-e2e-contrast-light-{official,watch,advisory}.png`。

**新增测试 9 例**（总计 11 → 20 例，全部真实执行通过）：

- `tests/e2e/fixtures.spec.ts`（纯函数，不启浏览器）4 例：`shanghaiDateTime` 时区对齐（含 UTC/上海不同日、跨年）、`addCalendarDays` 跨月/跨年/闰年、`buildForecast` 跨月与跨年日期翻转及 `current.time` 与 hourly 序列对齐。
- `tests/e2e/visual.spec.ts`（浏览器）5 例：浅色主题官方预警四级文字对比度、浅色主题 watch / advisory 提示卡对比度、白天 12:00 与跨月边界 02:00 的页面时钟/日期/逐日数据一致性（UTC 与上海不同日场景）。

**工具链修复（实际事故）**：`playwright.config.ts` 的 `reuseExistingServer` 原为 `!process.env.CI`——验收修复期间两个 11 月 11 日残留的 `vite preview` 进程占用 4173 端口，导致 webServer 的 `npm run build` 被跳过，测试跑在过期 dist 上（浅色覆盖"未生效"假象）。已改为 `false` 强制每次全新构建；残留进程已清理。
