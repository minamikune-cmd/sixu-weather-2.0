# Phase 1 · 迁移验证报告

- 验证日期：2026-11-10（Asia/Shanghai）
- 验证环境：Node.js v24.22.2、npm 11.19.1、Git 2.47.3、Debian 13、Chromium Headless Shell 158.0.8127.18（Playwright）
- 被验证对象：`minamikune-cmd/sixu-weather-2.0`（迁移后工作副本）
- 关联文档：[phase-1-audit.md](./phase-1-audit.md)、[phase-1-file-manifest.md](./phase-1-file-manifest.md)

## 1. 验证方法

| 验证项 | 方法 | 判定标准 |
|---|---|---|
| 文件完整性 | `git ls-tree` 逐路径对比 1.0 与 2.0 blob SHA-1 + SHA-256 清单 | 27/27 路径完全一致 |
| 依赖安装 | 删除 `node_modules` 后 `npm ci`（干净复现） | 退出码 0，无错误 |
| 代码检查 | `npm run lint`（ESLint 9 + typescript-eslint） | 退出码 0，无警告 |
| 生产构建 | `npm run build`（`tsc -b && vite build`） | 退出码 0，产物齐全 |
| 静态资源 | `vite preview` + curl 逐资源请求 | index/JS/CSS/favicon 全部 200 |
| 浏览器功能 | Playwright 桌面 1440 / 移动 390 / 定位 / reduced-motion，共 27 项断言 | 27/27 PASS |
| 缓存回退 | 人为置过期缓存 + 拦截 forecast 请求，刷新页面 | 显示缓存提示，温度仍可渲染 |
| API 连通性 | curl 实测三个上游 API | HTTP 200，字段完整 |
| 依赖漏洞 | `npm audit --omit=dev` | 0 vulnerabilities |
| 密钥泄露 | 全文件密钥模式扫描 + `.gitignore` 覆盖检查 | 无真实密钥，凭据不入库 |

## 2. 文件清单对比

- 1.0 受版本控制文件：**27 个**（详见 [phase-1-file-manifest.md](./phase-1-file-manifest.md)）。
- 2.0 迁移结果：**27/27 个 blob SHA-1 逐一相同，迁移成功率 100%**。
- 无遗漏、无替换、无内容漂移；应用源码 0 行改动。
- 2.0 新增文件仅为：`.gitignore`、`.github/workflows/ci.yml`、`docs/reports/` 下 Phase 0/1 报告与验收截图。

## 3. 构建与检查

| 步骤 | 命令 | 结果 | 备注 |
|---|---|---|---|
| 依赖安装 | `npm ci --cache /tmp/npm-cache` | ✅ 181 packages / 7s | 沙箱 `/root/.npm` 无写权限，用 `--cache` 指向 `/tmp`；不影响项目配置 |
| Lint | `npm run lint` | ✅ 通过 | 无输出警告 |
| 构建 | `npm run build` | ✅ 通过 | `tsc -b` 无错误，Vite 转换 1720 模块，5.6s |
| 产物体积 | `dist/` | index 0.73KB(gzip .51) / CSS 33.93KB(gzip 8.11) / JS 277.51KB(gzip 90.31) | 与 Phase 0 基线一致 |
| 依赖树 | `npm ls --depth=0` | ✅ 17 个直接依赖全部按 lockfile 解析 | 无 invalid/extraneous |
| 漏洞审计 | `npm audit --omit=dev` | ✅ 0 vulnerabilities | 生产依赖 |

产物 SHA-256（本次构建）：

```text
7bc1e00e671a8399d8bbdce56f279f328b67cbb430f9ef9a87082b6eea7c9a28  dist/index.html
1fad2ae2738483eb5f40a170432b4461bf1c04b383f47862d11ec3f1608d60e2  dist/assets/index-CRYKsXNk.js
2efd907efbd771b0e0c979762c47660cfdc186c1bf2721c03757216c081d8613  dist/assets/index-k7JLShqj.css
dd81a555fe69258fffef884ed341daeaeb86a5bfaa5d38bb5165b090a4987f8c  dist/favicon.svg
aaebde9c01699a043a706f320de634560c58fba2f299ab4f5b29f089bdf958f8  dist/_headers
```

## 4. 静态资源路径（vite preview 实测）

| 资源 | URL | HTTP | 说明 |
|---|---|---|---|
| 入口 | `/` | 200 | 729B，相对路径引用资源 |
| JS bundle | `/assets/index-CRYKsXNk.js` | 200 | 相对 `./assets/...` 可子路径部署 |
| CSS | `/assets/index-k7JLShqj.css` | 200 | — |
| 图标 | `/favicon.svg` | 200 | 与 1.0 源文件 SHA-256 一致（`dd81a555…`） |

## 5. 浏览器验收（Playwright，27 项断言全部 PASS）

### 5.1 桌面 1440×900

| 断言 | 结果 |
|---|---|
| 默认城市北京，首屏真实温度 `12°`、描述“晴朗” | PASS |
| 6 项指标卡 / 24 个小时项 / 7 天预报行 | PASS |
| 日出 06:53 / 日落 17:03；城市本地时钟 `15:13:58` | PASS |
| 时区显示 `Asia/Shanghai`；season/phase/kind = autumn/day/clear | PASS |
| 无页面级横向滚动 | PASS |
| 设置切换 °F + 浅色 + 关动画即时生效（体感 49°F） | PASS |
| 搜索“上海”切换城市，温度更新 | PASS |
| 刷新后城市与偏好持久化 | PASS |
| 控制台/网络错误：无 | PASS |

截图：[phase1-desktop.png](./assets/phase1-desktop.png)

### 5.2 地理定位（新上下文，模拟上海坐标 31.2304, 121.4737）

| 断言 | 结果 |
|---|---|
| toast “已定位到上海市”，城市切换为上海市 | PASS |
| 定位后天气正常渲染 `12°` | PASS |
| 定位流程控制台干净 | PASS |

### 5.3 移动 390×844（DPR 2，触屏）

| 断言 | 结果 |
|---|---|
| 无页面级横向滚动 | PASS |
| 底部导航可见；头部多余图标隐藏 | PASS |
| 天气正常渲染 | PASS |
| 控制台干净 | PASS |

截图：[phase1-mobile.png](./assets/phase1-mobile.png)。注意：截图中移动逐时曲线区域空白是 1.0 已存在的对齐缺陷（见审计报告 §12 P2，原样保留，不在本阶段修复）。

### 5.4 减少动态效果（reduced-motion）

| 断言 | 结果 |
|---|---|
| `matchMedia('(prefers-reduced-motion: reduce)')` 生效，Canvas 无粒子绘制 | PASS |

### 5.5 离线缓存回退

将缓存 `fetchedAt` 人为置为 11 分钟前并拦截 forecast 请求后刷新：页面显示状态条“实时数据暂时不可用，已显示上次缓存。”，北京 `12°` 仍渲染，无页面错误。**PASS**。

## 6. API 配置检查

| 检查点 | 结果 |
|---|---|
| 三端点均为免密钥 HTTPS GET（Open-Meteo forecast/geocoding、BigDataCloud reverse） | ✅ |
| Forecast 2026-11-10 实测 HTTP 200（北京 12.0°C、日出 06:53/日落 17:03、timezone Asia/Shanghai） | ✅ |
| Geocoding “上海” 实测 HTTP 200，首条 31.22222/121.45806 | ✅ |
| BigDataCloud 反查实测返回 city=上海市 | ✅ |
| 仓库内无 API 密钥/Token（扫描仅命中依赖包名等无关词） | ✅ |
| `wrangler.toml` 无需密钥；部署令牌仅存在于本机环境，未入库 | ✅ |

## 7. 已知环境限制（不影响验收结论）

1. 沙箱无 `/root/.npm` 写权限，npm 缓存定向到 `/tmp/npm-cache`。
2. 沙箱无系统 Chromium，Playwright 浏览器与缺失系统库/字体安装在 `/tmp`（`LD_LIBRARY_PATH` + `FONTCONFIG_FILE` 方式加载），仅用于本机验收，不入库、不改依赖。
3. 未执行 Cloudflare Pages 真实部署（2.0 尚无独立 Pages 项目与凭据）；部署配置已原样迁移并列入下一阶段。

## 8. 验证结论

迁移后的 2.0 代码与 1.0 逐字节一致；依赖可复现安装；lint/build 通过；生产构建静态资源路径正确；真实浏览器中核心天气功能、城市搜索、定位、单位/主题设置、持久化、移动适配、减少动态效果、离线缓存回退全部验证通过；无密钥泄露；1.0 仓库在迁移前后均未被改动（SHA 复核 `ca24d63`）。

**Phase 1 迁移验证：通过。**
