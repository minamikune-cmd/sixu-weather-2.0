# 阶段 3 报告：高级视觉系统重构

> 日期：2026-11-10 · 状态：完成
> 设计关键词：Premium Soft Glassmorphism · Atmospheric Weather Experience · Immersive Dynamic Weather · Seasonal Adaptive Interface

## 一、交付总览

| 交付物 | 位置 |
| --- | --- |
| 新设计系统（令牌/组件/动效/适配） | [docs/design-system.md](../design-system.md) |
| 主题配置（四季×昼夜×天气×偏好决策） | `src/theme/index.ts` + `src/App.css` 令牌区 |
| 可复用组件清单 | 设计系统文档 §4 |
| 动态天气效果清单 | 设计系统文档 §3 |
| Web/Android 截图（12 张） | `docs/reports/assets/phase3-*.png` |
| 性能测试结果 | 本文 §五 |
| Android APK | `android/app/build/outputs/apk/debug/app-debug.apk`（`npm run android:build` 成功） |

所有场景截图均连接**真实数据管线**（Playwright 路由拦截注入与 Open-Meteo 响应结构完全一致的合成数据，经同一 `fetchWeather → domain → UI` 路径渲染），非静态 UI 演示。

## 二、主要变更

1. **代码层**
   - `src/theme/index.ts`：视觉风格决策改为 `resolveStyleClass(preferences, phase, systemDark)`，新增"跟随系统"（`prefers-color-scheme` 实时监听，App.tsx 注入 `systemDark`）。
   - `src/platform/haptics.ts`（新增）：`lightHaptic()`（`navigator.vibrate(8)`，try/catch 静默降级）+ `watchReducedMotion()`。
   - `src/types/weather.ts`：`VisualStyle` 增加 `'system'`；`Preferences` 增加 `haptics`。
   - `src/ui/components/Atmosphere.tsx`：新增 sun-rays / storm-shelf / rain-veil / water-shimmer / 双层 mist。
   - `src/ui/components/SettingsDialog.tsx`：视觉风格四项分段控件 + 触觉反馈开关。
   - `src/App.css`：玻璃令牌体系（`.glass` 工具类）+ 天气天空再平衡 + 9 组新关键帧 + 图标微交互；修复三处天气状态被季节规则覆盖/动画压制的缺陷。
   - `android/app/src/main/AndroidManifest.xml`：声明 `VIBRATE` 权限。

2. **修复的渲染缺陷**
   - 雨天/阴天天空被 `[data-phase][data-season]`（特异性 0-3-0）覆盖 → 天气规则抬级为 `.app.app[data-kind=…]`。
   - 日月光球隐藏规则被 `orb-breathe` 关键帧动画压制 → 隐藏时同时 `animation: none`。
   - 网络错误裸抛 `Failed to fetch` → `fetchJson` 统一转为友好中文文案。

3. **性能优化**
   - 雨幕从"全屏 `background-position` 动画 + `filter: blur`"重构为"200% 高伪元素 + transform 平移一个渐变周期"，每帧零重绘、零 filter。
   - 水面波光以渐变软边替代 `blur(10px)`；云层/雷暴云砧模糊半径 16/18px → 10/12px。
   - 全部动效仅 transform/opacity；列表内图标降频，悬停才动。

## 三、截图索引

| 场景 | 文件 |
| --- | --- |
| 桌面 · 秋季晴 | assets/phase3-desktop-clear-day.png |
| 桌面 · 大雨 | assets/phase3-desktop-rain.png |
| 桌面 · 雷暴 | assets/phase3-desktop-thunder.png |
| 桌面 · 大雪 | assets/phase3-desktop-snow.png |
| 桌面 · 雾（低能见度预警） | assets/phase3-desktop-fog.png |
| 桌面 · 阴 | assets/phase3-desktop-overcast.png |
| 桌面 · 春（花瓣） | assets/phase3-desktop-spring-petals.png |
| 桌面 · 夜晴（月光+落叶） | assets/phase3-desktop-night.png |
| 桌面 · 设置弹窗 | assets/phase3-desktop-settings.png |
| 移动 · 晴 | assets/phase3-mobile-clear-day.png |
| 移动 · 雨 | assets/phase3-mobile-rain.png |
| 移动 · 骨架屏 | assets/phase3-mobile-skeleton.png |

## 四、质量验证

- `npm run build`（tsc 5.9 严格模式 + vite build）通过。
- `npx eslint .` 通过。
- `npm run android:build`（Capacitor sync + `assembleDebug`）通过，APK 6.1MB。

## 五、性能测试

环境：容器内 Chromium Headless Shell 158，**SwiftShader 软件渲染**（无 GPU），1440×900 视口，rAF 计帧 4s。

| 场景 | 优化前 FPS | 优化后 FPS |
| --- | --- | --- |
| 晴（日芒+云层+日球） | 11 | 13 |
| 雨（雨幕+水光+雨滴） | 4 | 14–16 |
| 雷暴（雨全套+云砧+闪电微光） | 5 | 13 |
| 雪（雪花粒子+冰蓝天空） | 14 | 13–14 |

- JS 堆稳定在 ~10MB（10 个场景连开无增长）；首屏数据到位约 3.5–4.5s（含 2.6s 人工等待动画稳定，软件渲染下的绝对值偏慢）。
- 瓶颈分析：优化前雨幕全屏 `background-position` 重绘 + `filter: blur` 为最主要开销（隐藏雨幕 FPS 5→11）；重构后各场景均衡。
- **说明**：SwiftShader 纯 CPU 光栅化是所有效果的地板场景；所有动画层均为 transform/opacity 合成层、Canvas 单循环，真实设备（WebView/Chromium GPU 合成）下按 60fps 目标设计。`prefers-reduced-motion` 或关闭"环境动画"后粒子与循环动画全部停止。

## 六、无障碍与适配

- 语义化按钮 + `aria-label`、焦点环、`prefers-reduced-motion` 双重降级（系统级 + 应用内开关）。
- 移动/平板/桌面/宽屏五档断点；Android safe-area 全屏/非全屏；触控区 ≥44px。
- 夜色/雨天自动加深玻璃底与文字对比，保证可读性（避免"过度透明导致文字难以阅读"）。

## 七、遗留与后续

- 容器无 GPU，真机 60fps 验证需在实体 Android 设备执行（APK 已可装）。
- 雷暴"温和闪电"当前为图标辉光脉冲，后续可加受随机间隔控制的画面级微光（仍须避开光敏闪烁）。
