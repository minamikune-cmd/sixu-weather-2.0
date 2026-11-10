# Phase 1 · 1.0 → 2.0 文件迁移清单与校验

- 审计日期：2026-11-10（Asia/Shanghai）
- 1.0 基线：`minamikune-cmd/sixu-weather` @ `ca24d631fd6b91d33fe3e70d50e1847d248e3910`（main）
- 2.0 迁移基线：`minamikune-cmd/sixu-weather-2.0` @ `05672e929773056b602d89f6afeb497d9bf2553e`（main）
- 1.0 受版本控制文件：**27 个**，全部为 blob；无子模块、无 Git LFS、无历史删除文件。
- 统计：**27 文件 / 5,759 行 / 242,551 字节**。
- 校验方式：逐路径比较 `git rev-parse <ref>:<path>` 的 blob SHA-1，并对 1.0 blob 计算 SHA-256；同时比较文件数量与路径集合。
- 结果：**27/27 完全一致（100%）**，无遗漏、无额外改动、无内容替换。2.0 仅新增工程与文档文件（见文末）。

## 一、逐文件清单

| # | 路径 | 行数 | 字节 | Blob SHA-1（1.0 = 2.0） | SHA-256（前 16 位） | 迁移职责 |
|---:|---|---:|---:|---|---|---|
| 1 | `CREDITS.md` | 20 | 1084 | `aaa4d43e3052ff9d641355ad68a2f1949ac90881` | `b203ce9cac93a223…` | 第三方代码、数据服务与视觉资源许可 |
| 2 | `README.md` | 233 | 14349 | `aaddb26713e64e889035f61f99a377223f9273b4` | `da7de600c07203cc…` | 项目说明、功能清单与部署手册 |
| 3 | `eslint.config.js` | 23 | 616 | `5e6b472f583e34a1cca751440d4f241495475723` | `4efe97b16d1200fa…` | ESLint 9 flat config |
| 4 | `index.html` | 15 | 628 | `fe236efc4534f067dbda087e447f11c4e91fcdf4` | `1b988816b2c4a518…` | HTML 入口、中文 SEO 元信息与主题色 |
| 5 | `package-lock.json` | 3402 | 116458 | `ab13e882223414ff62676a51f29c95caa03dd512` | `3e4cbb8b82dd148c…` | npm 锁定文件（lockfileVersion 3） |
| 6 | `package.json` | 37 | 962 | `eb83f96b37a990972eace9c3b48d6d262313930c` | `958106c232d7abdb…` | 依赖、Node 版本要求与 dev/build/lint/preview/deploy 脚本 |
| 7 | `public/_headers` | 14 | 361 | `9aa7e016f1c8235bac52613c525ec44b444130ac` | `aaebde9c01699a04…` | Cloudflare Pages 缓存与安全响应头 |
| 8 | `public/favicon.svg` | 9 | 411 | `1aafa1191086dbae510e84c86655998eed0c2375` | `dd81a555fe69258f…` | 原创四叶站点图标 |
| 9 | `src/App.css` | 489 | 38537 | `240776dc25d942eb620ebea0e7ac236704b07fae` | `9f2cedcc656c5246…` | 场景、组件、响应式、动画与减少动态效果样式 |
| 10 | `src/App.tsx` | 328 | 21017 | `16e60a780fd1e307d3a0959b18aa72a1934ccca1` | `09d50a51d2a12143…` | 应用状态、定位流程、页面区块与本地存储编排 |
| 11 | `src/components/Atmosphere.tsx` | 173 | 7027 | `29f6ea04fd951d6dd3d494daefdd418d073ac431` | `e6f7d95d78f0ea57…` | Canvas 2D 粒子与 CSS 动态背景，后台暂停 |
| 12 | `src/components/CityDialog.tsx` | 129 | 6299 | `c6b8bdf1e05eaf875222b9465ed4e0b40d96168f` | `e488d636e47c7deb…` | 城市搜索、经纬度、收藏、最近与定位入口 |
| 13 | `src/components/DailyForecast.tsx` | 45 | 2030 | `441de6f4854b41fc6058beb28d8992d67820eb74` | `fbd824c522da12b1…` | 7 日预报与温度区间 |
| 14 | `src/components/HourlyForecast.tsx` | 78 | 3881 | `c7fac26b03a4c6eaa37d4eb9f83fbaefa2f70a51` | `72d98b571623642e…` | 24 小时 SVG 温度曲线与小时选择 |
| 15 | `src/components/SettingsDialog.tsx` | 86 | 5170 | `84d547c654abe62d7d9b7ca614a7f9a43aaaa8c2` | `1b05f79ce2c2b2e1…` | 单位、季节、视觉风格、动画与本地数据设置 |
| 16 | `src/components/SunArc.tsx` | 31 | 1776 | `227855888f7e68717e80cd8404fbdfeb78bbb66c` | `045a3210ff6ff86c…` | 日出日落时间、日照弧与进度 |
| 17 | `src/components/WeatherIcon.tsx` | 53 | 2291 | `d7814081558fc58244810c8e6ed60db9f65a7047` | `c57c095be15b15da…` | WMO 天气代码对应内联 SVG 图标 |
| 18 | `src/hooks/useWeather.ts` | 109 | 3372 | `2b01812a20f8f0a5abb94202b969a7896311cfe2` | `8045e5fc64203682…` | 天气请求、去重、取消、10 分钟缓存、刷新与错误回退 |
| 19 | `src/index.css` | 11 | 390 | `d0e87b949bd8e7435e392667bbc71061b88ce0b0` | `c4e6bf3fbd4ad6b1…` | 全局字体与基础样式 |
| 20 | `src/lib/weather.ts` | 280 | 11580 | `49a41329125b634da2eadee2891d7f0ddd3c8d28` | `840ec49627e17911…` | 三个 API、数据转换、时区、日出日落、季节、单位与格式化 |
| 21 | `src/main.tsx` | 13 | 318 | `ae3d161d13579bb46dc6bccb0589bdc5c0cd9a5d` | `9861e637825001af…` | React 18/19 createRoot 入口与 BrowserRouter |
| 22 | `src/types/weather.ts` | 90 | 1935 | `c08cd2218f20b1edf0d2018c05b1fd542e7b5fff` | `ace90f71512f3b0a…` | 城市、天气、预报、偏好等 TypeScript 类型 |
| 23 | `tsconfig.app.json` | 34 | 815 | `c8935afc799661abf414297918f17136874b3929` | `6adc7ebeabae8e2f…` | 应用侧 TS 编译选项 |
| 24 | `tsconfig.json` | 16 | 232 | `afa1ec61a3179d6bc59f722896eaa3ea6c77d080` | `a389bfb0309454cd…` | TypeScript 项目引用入口 |
| 25 | `tsconfig.node.json` | 26 | 653 | `8a67f62f4ceebff3424e6e8cd4b3c25b17347546` | `c3dd0fb522feba35…` | 构建脚本侧 TS 编译选项 |
| 26 | `vite.config.ts` | 12 | 269 | `d8f09e08330c9783774376fdbc519129c39ab127` | `e482cb0f25aeffb6…` | Vite 构建、端口 3000、相对 base 与 @ 别名 |
| 27 | `wrangler.toml` | 3 | 90 | `612240bf42a485cf0b7ddf0bf0010582a61c6cb0` | `242900503adb53b1…` | Cloudflare Pages 输出目录与兼容日期 |

## 二、完整 SHA-256

<details>
<summary>展开 27 个文件的完整 SHA-256</summary>

```text
b203ce9cac93a22375fab4e36c4e2e5d58aa3498b8ebd1166fcb781f87deb703  CREDITS.md
da7de600c07203ccf0abe43694f5c894aeeb4d50a211bd01f916192ce66c3f07  README.md
4efe97b16d1200fac0eaf07aa00930a8668b1f96a0be1891ace8c1e712ff0ccb  eslint.config.js
1b988816b2c4a5188e8f47592b631ad65019a605ea28e4baa24cb89cae37f022  index.html
3e4cbb8b82dd148cd93b6cac95508ee85c68c227b3bf7884cf8c4a36c0955f6a  package-lock.json
958106c232d7abdba6e652930399a2575be20636a974353fc2d57c5ea1d95559  package.json
aaebde9c01699a043a706f320de634560c58fba2f299ab4f5b29f089bdf958f8  public/_headers
dd81a555fe69258fffef884ed341daeaeb86a5bfaa5d38bb5165b090a4987f8c  public/favicon.svg
9f2cedcc656c52469942ba5799f5a7709435a7aeac9c2bec70c96b3326b77a87  src/App.css
09d50a51d2a12143ca3814e5479782b42f43c0de44e4de38db12ec92f0ff89ce  src/App.tsx
e6f7d95d78f0ea570d5a811856d54bc4796659282f799e83979821a53b9b1d2e  src/components/Atmosphere.tsx
e488d636e47c7deb69962096fb65e89f19e4e5256e74937d17260c417db988e9  src/components/CityDialog.tsx
fbd824c522da12b1e38d0f5b07d7eadd3b5ac6d443a9650ee0ff8e531bb5a554  src/components/DailyForecast.tsx
72d98b571623642e797240fe995bfcec35aca0d35b4deaa5db3b0c51d08f9e77  src/components/HourlyForecast.tsx
1b05f79ce2c2b2e17964ba4b9011e49c5a4238f5bd7d105b8dc779238e3796e5  src/components/SettingsDialog.tsx
045a3210ff6ff86c4fb0eddc2575b07f497b8019d31c2c4a2771428de4f94663  src/components/SunArc.tsx
c57c095be15b15da1d469d705b9df039d7561d9a73b990717c2de3a55b887a57  src/components/WeatherIcon.tsx
8045e5fc64203682f8046d1b61312a8ae2bcee577593025289bfc32821699cb9  src/hooks/useWeather.ts
c4e6bf3fbd4ad6b1a9992e42e1e53729e4567200207448b798318b24f5baf9ed  src/index.css
840ec49627e17911936519b04138a573b1572ef55ba9960129c2bdcf6ac9727c  src/lib/weather.ts
9861e637825001af4f96dbd8b0d3fa551b8b1b2a01bed5e31a9a2eec21454ff8  src/main.tsx
ace90f71512f3b0a67c7973a287e20bca25b91bc055bce552b1e11cf6045daca  src/types/weather.ts
6adc7ebeabae8e2f7280cacce1778b40a51743c240ffd7733b2efd4eb017c53a  tsconfig.app.json
a389bfb0309454cd0828a3c4a7431e56c3d6f50a70e648613fd0f51ae300057c  tsconfig.json
c3dd0fb522feba3596713f51b95bd53d781d845d24aedbfa2ac093d8b39c5120  tsconfig.node.json
e482cb0f25aeffb6bd9a1e6a1ca557c1e5433bc613d3ae234423ae3c1da7a692  vite.config.ts
242900503adb53b1c64b08b00f7efe95f4e5051c55c888bd032c391b0d7b4811  wrangler.toml
```

</details>

## 三、差异说明

1. **1.0 → 2.0 内容差异：无。** 27 个路径的 blob ID 全部相同，说明迁移不是“复制后重写”，而是 Git 对象级原样迁移。
2. **2.0 新增文件（不属于 1.0 迁移范围）：**
   - `.gitignore`：依赖、构建产物、环境变量、Android 签名与编辑器文件忽略规则。
   - `docs/reports/phase-0-initialization.md`：Phase 0 仓库初始化与基线记录。
   - `docs/reports/phase-1-audit.md`：本阶段完整审计报告。
   - `docs/reports/phase-1-file-manifest.md`：本清单。
   - `docs/reports/phase-1-migration-verification.md`：构建、浏览器与 API 验收记录。
   - `docs/reports/assets/phase1-desktop.png`、`phase1-mobile.png`：浏览器验收截图。
   - `.github/workflows/ci.yml`：只读权限的 lint + build CI。
3. **未迁移内容及原因：无源码或资源遗漏。** `node_modules/`、`dist/`、`*.tsbuildinfo` 是本地构建产物，按 `.gitignore` 不纳入版本控制；1.0 本身也未提交这些文件。
4. **不存在但被 1.0 README 提到的文件：** `.gitignore` 在 1.0 中实际缺失；2.0 已补齐。该差异属于 2.0 工程修复，不改变应用源码。
