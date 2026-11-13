# 四序天气 2.0 · 阶段 3 设计系统

> 设计语言：**Premium Soft Glassmorphism · Atmospheric Weather Experience · Immersive Dynamic Weather · Seasonal Adaptive Interface**
> 实现位置：`src/App.css`（令牌 + 组件样式 + 动效）、`src/theme/index.ts`（主题决策）、`src/ui/components/Atmosphere.tsx`（动态背景层）。

---

## 1. 设计令牌（Design Tokens）

### 1.1 Primitive 令牌

| 令牌 | 值 | 用途 |
| --- | --- | --- |
| `--glass-blur` | `22px` | 玻璃面板统一背景模糊 |
| `--glass-sat` | `1.25` | 模糊时背景饱和度提升，避免发灰 |
| `--shadow-soft` | `0 12px 40px oklch(40% 0.05 245 / .12)` | 低对比度柔和阴影 |
| `--shadow-lift` | `0 16px 48px oklch(40% 0.05 245 / .18)` | 悬停/浮起态阴影 |
| `--radius-*` | small / medium / large | 统一圆角档位 |
| `--motion-fast` / `--motion-med` | 160ms / 320ms | 交互反馈时长 |

### 1.2 Semantic 玻璃令牌

| 令牌 | 场景自适应 | 说明 |
| --- | --- | --- |
| `--glass-bg` | 随天气状态调整 | 面板底色（半透明），雨天自动降低透明度保证文字可读 |
| `--glass-bg-hover` / `--glass-bg-strong` | — | 悬停态 / 弹窗等需要更高可读性的态 |
| `--glass-border` | 随天气状态调整 | 1px 描边，勾勒玻璃边缘 |
| `--glass-edge` | — | inset 顶部边缘高光（`oklch(100% 0 0 / .35)` 1px） |
| `--accent` / `--accent-soft` | 随季节切换 | 强调色 / 强调色 16% 透明底 |
| `--season-glow` | 随季节 + 天气调整 | 背景光晕（sky-aurora），雨天/阴天自动转冷压暗 |
| `--chart-color` | 随季节切换 | 温度曲线主色 |
| `--sky-top/middle/bottom` | 随 相位×季节×天气 | 三段天空渐变 |
| `--alert-watch` / `--alert-advisory` | 固定语义色（#d97757 / #c9a44c） | 应用内天气提示卡（`alert-card`）边框与标题 |
| `--alert-watch-bg-light` / `--alert-advisory-bg-light` | 固定浅色底变体 | `style-light` 下提示卡底色 |
| `--warn-red/orange/yellow/blue` + `-text` + `-bg-light` | 固定语义色（#e5484d / #f76b15 / #ffb224 / #0091ff） | 官方预警四级（`official-warning`）边框、标题文字、浅色底 |

预警级别色集中在一处定义（App.css 语义层 `:root`），组件只引用令牌，禁止在组件内硬编码级别色；e2e 用例（`tests/e2e/visual.spec.ts`）断言解析后的计算色值，防止令牌断链。

### 1.3 `.glass` 工具类

统一玻璃质感的唯一入口，任何面板加 `class="glass"` 即获得：
`backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-sat))` + 顶部边缘高光 + 低对比阴影 + 半透明渐变底。

当前应用范围：逐小时外壳、日照弧卡片、白昼提示、预警卡片、状态横幅、设置弹窗、移动端底部导航、Toast、搜索框、定位行、存储说明、季节选项、分段控件。

---

## 2. 主题配置（四季 × 昼夜 × 天气 × 用户偏好）

### 2.1 四季主题

| 季节 | 强调色 | 光晕 | 天空（白昼） | 元素 |
| --- | --- | --- | --- | --- |
| 春 spring | 清新绿 `oklch(72% 0.14 160)` | 绿 + 柔和粉 | 青绿渐变 | 花瓣粒子 |
| 夏 summer | 天空蓝→阳光金 `oklch(80% 0.12 85)` | 金色 | 高饱和湛蓝 | 清爽明亮，无粒子 |
| 秋 autumn | 暖橙琥珀 `oklch(75% 0.13 60)` | 琥珀橙 | 暖橙渐变 | 落叶粒子 |
| 冬 winter | 冰蓝 `oklch(85% 0.09 225)` | 冰蓝银白 | 低饱和冰蓝 | 雪花粒子 |

### 2.2 季节决策（`src/domain/season.ts`）

- `auto`：按当地日期月份 + **城市纬度判断南北半球**（北半球 3–5 春 / 6–8 夏 / 9–11 秋 / 12–2 冬；南半球相反）。
- 手动：设置中固定春 / 夏 / 秋 / 冬。
- 记住选择：`sixu-preferences-v1` 本地持久化；`auto` 与手动可随时切换。

### 2.3 视觉风格（四项，设置中可切换）

| 选项 | 行为 |
| --- | --- |
| 跟随场景（默认） | 白昼/晨曦/日暮用场景深色文字体系，夜色自动切 `style-dark` |
| 跟随系统 | `prefers-color-scheme` 实时监听，系统深色→暗色，浅色→场景 |
| 浅色 | 固定 `style-light`：亮天空 + 深色文字 + 55% 亮玻璃 |
| 深色 | 固定 `style-dark`：深夜蓝天空 + 浅色文字 |

决策函数：`src/theme/index.ts` 的 `resolveStyleClass(preferences, phase, systemDark)`；Android 状态栏深浅由 `isDarkChrome()` 同步。

### 2.4 昼夜相位

`dawn / day / dusk / night` 四相位，由日出日落 ±45 分钟窗口计算（`src/domain/solar.ts`），驱动天空渐变、字体层级（夜色加大对比）、日月光球形态与轨道环。

---

## 3. 动态天气效果清单（Atmosphere）

| 天气 | 效果层 | 实现 |
| --- | --- | --- |
| 晴天（昼） | 柔和旋转日芒 + 云层低透明漂移 + 呼吸日球 | `.sun-rays`(90s conic 旋转)、`.cloud-*`(34–50s 漂移)、`.celestial-orb`(orb-breathe) |
| 晴天（夜） | 月光球 + 月斑 + 星尘 | `.celestial-orb.night`、Canvas 星尘 |
| 多云 | 三层缓慢漂移云层（opacity .85） | `.cloud-one/two/three` |
| 阴天 | 低饱和灰蓝天空 + 双层雾 + 云层 .85 + 光晕转冷 | `--sky-*` 再平衡、`.mist.mist-far/.mist-near` |
| 雨天 | 压暗蓝灰天空 + 顶部斜向雨幕 + 底部水面波光 + 雨滴粒子 | `.rain-veil`(veil-fall)、`.water-shimmer`(shimmer-sway)、Canvas 雨滴；日月光球自动隐藏 |
| 雷暴 | 雨天全套 + 低垂暗云砧（呼吸）+ 温和闪电微光（无光污染式闪烁） | `.storm-shelf`(shelf-breathe)、`.wi-bolt`(wi-bolt-glow 慢速辉光脉冲，非频闪) |
| 雪天 | 冰蓝天空 + 缓慢飘落雪花（Canvas，密度/速度独立） | Canvas 雪花粒子 |
| 雾天 | 灰蓝天空 + 双层雾化景深（远层慢、近层快）+ 冬季低温自动起雾 | `.mist-far` / `.mist-near` 差速漂移 |
| 四季 | 花瓣（春）/ 落叶（秋）/ 星尘（冬夜） | Canvas 季节粒子 |

性能约束：所有 CSS 层动画仅使用 `transform`/`opacity`（GPU 合成层）；Canvas 粒子单 rAF 循环驱动，数量按天气与屏幕面积封顶；`prefers-reduced-motion` 下全部粒子与循环动画关闭。

---

## 4. 可复用组件清单

| 组件 | 位置 | 阶段 3 变化 |
| --- | --- | --- |
| `Atmosphere` | `src/ui/components/Atmosphere.tsx` | 新增 sun-rays / storm-shelf / rain-veil / water-shimmer / 双层 mist |
| `WeatherIcon` | `src/ui/components/WeatherIcon.tsx` | SVG 子组命名（wi-rays/wi-drops/wi-snowdots/wi-bolt/wi-cloud）供 CSS 动效 |
| `SettingsDialog` | `src/ui/components/SettingsDialog.tsx` | 视觉风格四项分段控件；新增触觉反馈开关 |
| `HeroPanel`（主卡片/温度） | `src/pages/HomePage.tsx` | 玻璃化、glyph 悬停浮起、日月光球随天气/季节自适应 |
| 逐小时预报 | `HourlyPanel` | 玻璃外壳、图表季节色、列表内图标降频动画 |
| 多日预报 | `DailyPanel` | 日行悬停图标弹旋、温度条季节色 |
| 预警卡片 | `alert-card` | `.glass` + card-rise 错峰入场 |
| 城市切换 | `CityDialog` | 搜索框/定位行玻璃化 |
| 订阅界面 | `SubscribePanel` | 玻璃卡片体系沿用统一令牌 |
| 骨架屏 | `Skeleton` | 骨架微光动画，文案「正在读取 ×× 的天空…」 |
| 移动端底部导航 | `mobile-nav` | `.glass` 悬浮导航，44px+ 触控区 |

---

## 5. 交互体验

- **平滑过渡**：主题/天气切换 400–900ms 的 sky、glow、orb 渐变过渡，无跳变。
- **卡片浮动**：hero 天气 glyph 5s 呼吸浮动；悬停 translateY(-4px) scale(1.04)。
- **图标动态反馈**：晴→光线慢旋、雨→雨滴下落、雪→雪花漂移、雷→温和辉光；逐小时/逐日列表内图标默认静止，悬停才动（防眩晕）。
- **触觉反馈**：Android `navigator.vibrate(8)` 轻震动，接在城市切换/收藏/定位/设置/刷新等 8 处交互上；设置内可关闭；`AndroidManifest.xml` 已声明 `VIBRATE` 权限；Web/不支持设备静默降级。
- **加载动画**：骨架屏微光 + 读取文案；错误态提供「重新加载/选择城市」。
- **触控区域**：所有图标按钮 ≥ 40×40px（移动 44px）。

---

## 6. 适配与无障碍

- **断点**：四档媒体查询协作而非分档硬切——`max-width: 600px`（小屏收紧排版）、`max-width: 820px`（平板布局）、`max-width: 1180px`（中屏微调）、`min-width: 701px`（桌面侧栏/导航增强）；≤700px 显示底部玻璃导航，≥701px 显示顶部导航与宽版 Hero 网格。
- **Android**：`viewport-fit=cover` + `safe-area-inset` 适配全屏/非全屏；状态栏颜色随 `isDarkChrome` 同步；Capacitor 8。
- **无障碍**：全部交互元素原生 `<button>` + `aria-label`；语义分区（section/nav）；焦点环 `--focus`；文字对比度在玻璃底上 ≥ WCAG AA（夜色自动加深玻璃底）。
- **prefers-reduced-motion**：环境动画开关 + 系统级减少动态双重降级：粒子停止、循环动画停止、仅保留透明度交叉淡入。

---

## 7. 截图清单（docs/reports/assets/）

| 文件 | 场景 |
| --- | --- |
| `phase3-desktop-clear-day.png` | 桌面 · 秋季晴天白昼 |
| `phase3-desktop-rain.png` | 桌面 · 秋季大雨 |
| `phase3-desktop-thunder.png` | 桌面 · 夏季雷暴 |
| `phase3-desktop-snow.png` | 桌面 · 冬季大雪 |
| `phase3-desktop-fog.png` | 桌面 · 冬季雾天（低能见度预警） |
| `phase3-desktop-overcast.png` | 桌面 · 春季阴天 |
| `phase3-desktop-spring-petals.png` | 桌面 · 春季晴（花瓣） |
| `phase3-desktop-night.png` | 桌面 · 秋季夜晴（月光+落叶） |
| `phase3-desktop-settings.png` | 桌面 · 设置弹窗（四季选择器+视觉风格+触觉反馈） |
| `phase3-mobile-clear-day.png` | 移动 · 秋季晴 |
| `phase3-mobile-rain.png` | 移动 · 雨天 |
| `phase3-mobile-skeleton.png` | 移动 · 骨架屏 |

> Android 端与 Web 端共用同一份 `dist` 产物与同一渲染内核（Chromium），上述移动视口截图即 Android WebView 等效渲染；APK 由 `npm run android:build` 产出。
