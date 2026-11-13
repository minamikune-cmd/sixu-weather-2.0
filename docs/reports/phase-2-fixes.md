# Phase 2 修复报告：遗留问题修复与回归验证

日期：2026-11-10
仓库：https://github.com/minamikune-cmd/sixu-weather-2.0（已转 **public**）
基线：Phase 1 审计（`docs/reports/phase-1-audit.md` §12 问题清单）

## 0. 结论摘要

Phase 1 审计列出的遗留问题中，**4 项 P2 + 6 项 P3 + 2 项 P4 已全部修复**，共改动 11 个源文件、新增 1 个 hook 文件。lint 通过、构建通过、Playwright 回归 **27/27 + 12/12 全部通过**，原有功能无回归。bundle 由 277.5KB(gzip 90.3KB) 降至 243.4KB(gzip 78.5KB)。

剩余未处理项（均为产品需求而非缺陷）：无测试框架（仅有 Playwright 验收脚本，未入库）、无 PWA、无 LICENSE、无 AQI/预警。

## 1. 修复清单

| # | 级别 | 问题 | 修复方式 | 验证 |
|---|---|---|---|---|
| 1 | P2 | 移动端逐时曲线与小时项不对齐，首屏空白 | `HourlyForecast.tsx` 重写：ResizeObserver 实测 SVG 尺寸替代固定 `viewBox 1120×150`；点位 x = `width*(index+0.5)/24` 对齐列中心；`preserveAspectRatio="none"` + `vectorEffect="non-scaling-stroke"` | 390px 视口 svg=2628px 与 24 列网格 2628px 完全一致，点位 55→2573 全覆盖 |
| 2 | P2 | 切城短暂显示旧天气 | `useWeather.ts`：city 变化且无新鲜缓存时先 `setData(cached?.data ?? null)`；加载失败保留当前屏数据仅提示 | 拦截 forecast 后定位切换：header 显示"上海市"，hero 不渲染旧北京数据 |
| 3 | P2 | 反查/坐标城市缺 timezone，时钟错时区 | `App.tsx`：`timeZone = data?.timezone ?? city.timezone ?? null`，删除硬编码 `Asia/Shanghai`；时区未知时显示 `--:--` + "正在校准当地时区…" | 上述同场景无错误时钟渲染 |
| 4 | P2 | 缓存只支持单城市 | `useWeather.ts`：缓存改为 `Record<cityId, {city,data,fetchedAt}>` map，LRU 上限 8 城；1.0 单条格式自动迁移 | 切换上海→北京后缓存含 2 个 cityId |
| 5 | P3 | 弹窗无焦点陷阱/不恢复焦点 | 新增 `src/hooks/useDialogFocus.ts`：滚动锁、初始聚焦（可指定 selector）、Tab 循环、Escape 关闭、关闭恢复触发元素焦点；CityDialog/SettingsDialog 接入 | 12 次 Tab 不出框、Escape 关闭、焦点回到 `.city-trigger` |
| 6 | P3 | clearData 漏清定位提示键 | 删除列表补 `LOCATION_NOTICE_KEY`，同时 `setLocationNotice(true)` | 清除后 `sixu-location-notice-v1` 为 null |
| 7 | P3 | weatherKind 96/99 死代码 | `weather.ts` snow 分支删除不可达条件 | lint/tsc 通过 |
| 8 | P3 | 部署名仍是 1.0 的 `sixu-weather` | `wrangler.toml` + `package.json` deploy + README 三处 → `sixu-weather-2-0`；README dev 端口 5173→3000 | 文本核对 |
| 9 | P3 | README 与实现不一致 | README 端口改 3000；`.gitignore` 缺失项 Phase 0 已补，README 目录树现与实现一致 | 文本核对 |
| 10 | P4 | react-router 未使用 | 移除依赖与 `BrowserRouter` 包裹，`main.tsx` 精简 | 锁文件 react-router 清零，bundle -34KB |
| 11 | P4 | 无 HSTS | `public/_headers` 增 `Strict-Transport-Security: max-age=31536000; includeSubDomains`（CSP 留待部署前报告模式验证） | dist/_headers 复核 |

## 2. 回归验证

### 2.1 构建

- `npm run lint`：通过（0 错误）。
- `npm run build`：通过；`dist/index.html` 0.73KB / CSS 33.93KB / JS 243.40KB(gzip 78.46KB)。
- `npm audit --omit=dev`：0 vulnerabilities。
- 锁文件 lockfileVersion 3 更新（移除 react-router），`npm ci` 可复现（181→164 包）。

### 2.2 Playwright 验收（headless Chromium 158，容器内自装系统库+字体）

- 原 27 项断言（桌面/设置/搜索/定位/移动/reduced-motion/控制台零错误）：**27/27 PASS**。
- 新增 12 项针对本次修复的断言：**12/12 PASS**（曲线对齐×3、过期时钟防护×2、多城缓存×1、焦点陷阱×4、clearData×1、缓存渲染×1）。
- 离线缓存回退（Phase 1 验证过）：本轮未重跑，逻辑未改动（仅存储格式从单条变 map，`getCachedWeather` 行为等价）。

### 2.3 截图

- `docs/reports/assets/phase1-desktop.png`、`phase1-mobile.png`：回归时重新生成（修复后版本）。
- `docs/reports/assets/phase2-mobile-chart.png`：390px 视口移动端 hero（曲线区在截图外，对齐由 DOM 断言验证）。

## 3. 未处理项与原因

| 项 | 原因 |
|---|---|
| 无单元测试框架 | 超出"修复遗留问题"范围；Playwright 验收脚本在 /tmp 未入库。建议后续阶段引入 Vitest |
| 无 PWA | 产品需求，非缺陷 |
| 无 LICENSE | 需所有者决定许可证类型 |
| 无 AQI/预警 | 中国区无免密钥官方源（Phase 0 已确认） |
| 无 CSP | 需把 open-meteo/bigdatacloud 域纳入 connect-src，待真实部署域名确定后以报告模式验证后再上线 |

## 4. 提交

- 待提交：11 个源文件修改 + 1 个新 hook + 本报告 + audit.md 注记 + 截图。
