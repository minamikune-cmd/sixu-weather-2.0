# 四序天气（SIXU Weather）

一个可直接部署到 Cloudflare Pages 的沉浸式动态天气应用。真实天气来自 Open-Meteo，支持浏览器定位、中文城市搜索、经纬度查询、24 小时预报、7 天预报、南北半球四季主题和基于日出日落的昼夜场景。

本仓库包含全部可运行源码，无伪代码、无省略实现、无需付费后端或 API 密钥。

## 1. 项目功能概述与技术选型

### 功能

- 当前天气：温度、体感温度、湿度、风速、风向、降水概率、降水量、能见度、海平面气压、紫外线、云量及 WMO 中文天气描述。
- 预报：未来 24 小时逐小时温度曲线、天气图标和降水概率；未来 7 天高低温、温度区间、降水和日出日落。
- 定位：首次访问显示用途说明；拒绝、超时、非 HTTPS 或不支持定位时均可立即手动搜索，不会无限重试。
- 城市：中文搜索建议、经纬度查询、城市切换、收藏、最近使用；自动保存最后选择的城市。
- 四季：按城市当地月份及纬度所属半球判断春夏秋冬；可在设置中固定主题。
- 昼夜：按城市当地日出日落划分晨曦、白昼、日暮、夜晚；缺失时使用 `current.is_day` 和 06:00/18:00 备用逻辑。
- 天气动画：Canvas 2D 雨滴、雪、花瓣、落叶、星点与克制闪电；CSS 云层、雾、光晕和夏季热浪。
- 合理场景：真实雨雪雷暴优先于季节粒子；冬季不会无依据地下雪，夏季热浪只在晴热白天出现。
- 设置：°C/°F、km/h/m/s、自动/手动季节、跟随场景/浅色/深色、动画开关。
- 异常：12 秒超时、HTTP 错误、429 限流提示、无网络提示、10 分钟缓存及缓存回退、骨架屏和空状态。
- 无障碍：语义标签、键盘焦点、Esc/背景关闭弹窗、44px 触控区域、`prefers-reduced-motion`、后台暂停动画。
- 不展示空气质量：未接入可靠空气质量数据源，因此不以模拟数据填充。

### 技术选型及理由

| 技术 | 用途 | 选择理由 |
| --- | --- | --- |
| Vite + React + TypeScript | 应用与构建 | 类型安全、组件化、静态构建、Cloudflare Pages 原生易部署 |
| 原生 CSS + CSS 变量 | 响应式与主题 | 四季/昼夜可平滑换色，无运行时 CSS 依赖 |
| Canvas 2D + SVG | 粒子、图标、曲线、日照弧 | 轻量、无图片下载、清晰且可精确控制性能 |
| Lucide React | 界面图标 | 统一 SVG 图标，ISC 许可 |
| Open-Meteo Forecast API | 实时与预报 | 免费非商业使用、无需密钥、字段完整 |
| Open-Meteo Geocoding API | 中文城市搜索 | 与天气源一致，无需密钥 |
| BigDataCloud Reverse Geocode Client | 定位经纬度转城市 | 支持浏览器 HTTPS 请求，免费客户端端点无需密钥 |
| localStorage | 城市、收藏、偏好、天气缓存 | 纯前端即可实现；仅当前浏览器，不同步设备 |
| Cloudflare Pages | 静态托管 | 全球 CDN、自动 HTTPS、Git 自动部署、无需服务器 |

**没有 Pages Functions。** 所有 API 都是浏览器直接访问的公开 HTTPS GET 请求，静态页面可以完整运行。不要把静态托管理解为可以执行服务器端代码；若以后添加密钥代理、数据库或登录，才需要 Functions/Workers。

## 2. 界面设计与交互逻辑

- **视觉结构**：全屏气象场景 + 非对称大温度 + 实时城市时钟；下方使用指标分区、玻璃质感趋势图和七日列表。
- **信息层级**：第一屏只突出地点、时间、当前温度、天气、体感与高低温；详细指标和预报按阅读顺序展开。
- **场景系统**：季节决定色温和装饰，太阳时间决定明暗，真实天气决定云层、雾、雨雪和雷电，三者共同工作。
- **性能预算**：桌面粒子最多 64 个，手机约减半；Canvas 限制 30fps、DPR 上限 1.5；页面后台停止渲染；仅使用 transform/opacity 做主要动画。
- **移动交互**：顶部保留城市入口，底部固定“此刻/逐时/城市/七日”；逐小时图内部横向滚动，不产生页面级横向滚动；支持安全区。
- **数据流程**：选择城市 → 读取有效缓存或请求天气 → 渲染场景；请求失败时优先回退同城缓存，无缓存则显示可恢复的空状态。

## 3. 完整项目目录结构

```text
sixu-weather/
├── public/
│   ├── _headers                 # Cloudflare Pages 缓存与安全响应头
│   └── favicon.svg              # 自制四叶图标
├── src/
│   ├── components/
│   │   ├── Atmosphere.tsx       # Canvas 粒子、后台暂停、天气与季节场景
│   │   ├── CityDialog.tsx       # 搜索、经纬度、收藏、最近城市、定位入口
│   │   ├── DailyForecast.tsx    # 七日预报和温度区间
│   │   ├── HourlyForecast.tsx   # 24 小时 SVG 温度曲线与可选择小时项
│   │   ├── SettingsDialog.tsx   # 单位、季节、风格、动画、本地数据设置
│   │   ├── SunArc.tsx           # 日出日落与日照进度
│   │   └── WeatherIcon.tsx      # WMO 天气代码对应 SVG 图标
│   ├── hooks/
│   │   └── useWeather.ts        # 请求、去重、取消、缓存、刷新和错误回退
│   ├── lib/
│   │   └── weather.ts           # API、类型转换、单位、季节、昼夜和格式化
│   ├── types/
│   │   └── weather.ts           # 完整 TypeScript 类型
│   ├── App.css                  # 场景、组件、响应式与减少动态效果样式
│   ├── App.tsx                  # 应用状态、定位流程与全部页面区块
│   ├── index.css                # 全局字体和基础样式
│   └── main.tsx                 # React 入口
├── .gitignore
├── eslint.config.js
├── index.html                   # HTML 入口与中文元信息
├── package-lock.json            # 可复现依赖锁
├── package.json                 # 安装、开发、构建、检查、部署命令
├── tsconfig.app.json
├── tsconfig.json
├── tsconfig.node.json
├── vite.config.ts
├── wrangler.toml                # Pages 输出目录与兼容日期
├── CREDITS.md                   # 第三方来源与许可
└── README.md                    # 本文档
```

每个文件的完整源码均直接在仓库对应路径中提供；构建产物 `dist/` 和依赖目录 `node_modules/` 不应提交 Git。

## 4. 本地安装、启动和测试

推荐 Node.js 22 LTS（Vite 7 最低要求 Node.js 20.19+ 或 22.12+）。

```bash
# 在仓库根目录执行
npm ci

# 开发服务器，终端会显示本地地址，默认 http://localhost:5173
npm run dev

# 类型检查与生产构建
npm run build

# ESLint 检查
npm run lint

# 预览生产构建，默认 http://localhost:4173
npm run preview
```

定位在 `localhost` 通常可用，但局域网 IP 或 HTTP 部署不可用。手机测试定位时，请使用 HTTPS 预览或部署后的 `https://<项目名>.pages.dev`。

## 5. Cloudflare Pages：连接 GitHub 自动部署

### 5.1 上传 GitHub

```bash
git init
git add .
git commit -m "feat: complete SIXU weather app"
git branch -M main
# 先在 GitHub 新建空仓库，不要自动生成冲突文件
git remote add origin https://github.com/<你的用户名>/<仓库名>.git
git push -u origin main
```

### 5.2 创建 Pages 项目

1. 登录 Cloudflare Dashboard，进入 **Workers & Pages**。
2. 选择 **Create application → Pages → Connect to Git**。
3. 授权并选择刚推送的仓库。
4. Framework preset 选择 **Vite**（没有预设时手动填写以下值）。
5. 构建设置：
   - Build command：`npm run build`
   - Build output directory：`dist`
   - Root directory：仓库根目录，保持空白或 `/`
   - Production branch：`main`
6. 环境变量：**天气功能不需要任何环境变量或 API 密钥**。
   - 可选：设置 `NODE_VERSION=22`，固定构建运行时。
   - 不要把 `CLOUDFLARE_API_TOKEN` 写进前端变量或仓库。
7. 点击 **Save and Deploy**。首次部署完成后访问 `https://<项目名>.pages.dev`。
8. 后续推送到 `main` 自动更新生产环境；其他分支通常生成预览部署。

`wrangler.toml` 中项目名是 `sixu-weather`。如 Git 集成时使用其他 Pages 项目名，请同步修改该文件和 `package.json` 的 `deploy` 命令。

### 5.3 自定义域名、HTTPS 与更新

- Pages 项目 → **Custom domains → Set up a custom domain**，按提示添加域名；域名在 Cloudflare DNS 时通常可自动配置。
- Pages 自动提供 HTTPS。开启 **Always Use HTTPS**；不要自行关闭安全证书校验。
- 更新：Git 集成直接 `git push`；Direct Upload 重新执行构建和 Wrangler 部署。
- 回滚：Pages 项目 → **Deployments**，选择历史部署并回滚。
- `public/_headers` 已配置哈希资源一年缓存、HTML 必须重新验证，以及基础安全响应头。修改 HTML/JS 后重新部署即可，哈希资源不会互相覆盖。

## 6. 可选：Wrangler CLI Direct Upload

> Direct Upload 与 Git 集成是两种项目创建方式。官方文档说明 Direct Upload 项目之后不能原地切换为 Git 集成；需要自动部署时请新建 Git 集成项目。

```bash
npm ci
npm run build

# 首次登录，浏览器完成授权
npx wrangler login

# 首次创建 Direct Upload 项目
npx wrangler pages project create sixu-weather --production-branch=main

# 部署 dist 文件夹
npx wrangler pages deploy dist --project-name=sixu-weather

# 也可使用项目脚本（会先构建）
npm run deploy
```

无交互 CI 环境使用具备 **Account / Cloudflare Pages / Edit** 权限的令牌：

```bash
export CLOUDFLARE_ACCOUNT_ID="<你的 Account ID>"
export CLOUDFLARE_API_TOKEN="<你的 Pages Edit Token>"
npm run deploy
```

也可以在 Dashboard 选择 Pages Direct Upload，直接拖入 `dist` 文件夹；Wrangler 接收文件夹，不接受 ZIP。

## 7. 部署后验证与故障排查

### 功能验收清单

- [ ] 首屏显示真实温度，不是静态示例；Network 中 `api.open-meteo.com/v1/forecast` 返回 200。
- [ ] 当前天气、体感、六项指标、24 个小时项、7 个日期均完整。
- [ ] 首次定位弹窗说明用途；允许后能识别城市；拒绝后城市搜索立即可用。
- [ ] 搜索“上海”“东京”“Paris”均有结果；输入 `31.2304,121.4737` 可按坐标查询。
- [ ] 收藏、最近城市、单位、主题和刷新后最后城市保持；换浏览器/设备不会同步，这是预期行为。
- [ ] °C/°F 和 km/h/m/s 全部同步换算；天气请求仍保持公制。
- [ ] 自动季节随城市月份与半球变化；手动四季可切换且无闪屏。
- [ ] 白天、夜晚、清晨、黄昏由城市日出日落决定；天气代码驱动对应动画。
- [ ] 关闭动画及系统“减少动态效果”均生效；切到后台再回来没有异常加速。
- [ ] DevTools 离线刷新时，有缓存显示缓存提示；无缓存显示友好错误，可重试和换城市。
- [ ] 375、390、768、1024、1440px 宽度无页面级横向滚动，按钮和输入可触控。
- [ ] Console 无错误、无资源 404；手机 HTTPS 下定位权限可正常询问。

### 排查方法

| 现象 | 检查与处理 |
| --- | --- |
| Pages 构建失败 | Deployments → 对应部署 → View details/Build log；确认 Node 版本、`npm run build`、输出目录 `dist` |
| 页面 404 或空白 | 确认输出目录不是 `build` 或项目根目录；检查 `dist/index.html`；查看 Console 的首个异常 |
| 天气请求失败 | Network 选 forecast 请求，查看 HTTP 状态与响应；429 稍后重试，4xx 检查参数，5xx 等待服务恢复 |
| 定位无反应 | 必须 HTTPS 或 localhost；检查地址栏权限、系统定位、浏览器是否阻止第三方环境定位 |
| 定位成功但无城市名 | BigDataCloud 请求失败时会提示手动搜索，不会阻止天气应用使用 |
| 搜索无结果 | Open-Meteo 搜索要求至少两个字符；尝试完整名称、英文名称或经纬度 |
| 时间不正确 | 检查 forecast 返回 `timezone`；页面使用城市时区而非设备时区 |
| 部署后内容未更新 | 查看部署是否成功；强制刷新；确认访问生产域名而非旧预览部署 |
| 手机发热或掉帧 | 关闭环境动画；减少动态效果会自动停用 Canvas；避免同时运行其他高负载页面 |

浏览器 DevTools：Console 看运行异常，Network 按 `open-meteo` / `bigdatacloud` 过滤，Application → Local Storage 查看 `sixu-*` 键，Sensors 可模拟地理位置。

## 8. 性能、安全与后续扩展

- 天气请求有 12 秒超时、取消、去重和 10 分钟缓存；搜索有 380ms 防抖并取消前次请求。请保持合理刷新频率，不要绕过缓存做轮询。
- Open-Meteo 免费层有调用配额且服务条款可能更新；商业使用、较大流量或 SLA 需求应查看其最新条款并升级方案。
- 所有数据请求均为只读 HTTPS；前端没有秘密密钥。若未来接入密钥服务，应通过 Pages Functions/Workers 代理并限流，不要把密钥放入 `VITE_*`。
- 已限制 Permissions Policy 仅允许本站定位、禁止 iframe、禁止 MIME 猜测。若添加 CSP，请将三个 API 域名加入 `connect-src`，并先报告模式验证，避免误伤。
- localStorage 仅存城市、偏好和天气缓存，不存精确历史轨迹；反向定位返回后保存城市及经纬度用于天气查询。清除浏览器数据会丢失这些设置。
- 可扩展：接入可靠 AQI 数据源、恶劣天气预警、PWA 离线壳、多城市天气对比、Pages Functions 缓存代理。新增服务端功能时必须提供 `functions/` 或 Worker 源码，不可假设静态文件能执行服务端逻辑。

## 数据来源

- Forecast：<https://api.open-meteo.com/v1/forecast>
- Geocoding：<https://geocoding-api.open-meteo.com/v1/search>
- Reverse geocoding：<https://api.bigdatacloud.net/data/reverse-geocode-client>
- Cloudflare Pages Direct Upload：<https://developers.cloudflare.com/pages/get-started/direct-upload/>
