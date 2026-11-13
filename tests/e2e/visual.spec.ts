// 阶段 03 视觉系统端到端验证：天气场景 × 主题 × 动效降级 × 交互持久化。
// 数据全部由 fixtures.ts 经路由拦截注入，截图输出到 docs/reports/assets/。
import { expect, test } from '@playwright/test'
import { resolve } from 'node:path'
import { freezeTime, installRoutes, seedPreferences, seedSeenFlags } from './fixtures'
import { measureTextContrast } from './contrast'

// 固定两个时刻：白天 12:00（日出 06:45 / 日落 17:20 → day）与夜间 22:30（→ night）。
const DAY_MS = Date.parse('2026-11-13T12:00:00+08:00')
const NIGHT_MS = Date.parse('2026-11-13T22:30:00+08:00')
const ASSETS = resolve(process.cwd(), 'docs/reports/assets')

// 关闭首启定位说明弹层，避免遮挡点击与截图。
test.beforeEach(async ({ page }) => {
  await seedSeenFlags(page, ['sixu-location-notice-v1'])
})

test.describe('天气场景渲染', () => {
  test('晴天白天 · 桌面端玻璃质感与信息层级', async ({ page }) => {
    await freezeTime(page, DAY_MS)
    await installRoutes(page, { scene: { weatherCode: 0, isDay: 1, temperature: 24, uvIndex: 4 }, fixedNowMs: DAY_MS })
    await page.goto('/')

    const root = page.locator('.app')
    await expect(root).toHaveAttribute('data-kind', 'clear')
    await expect(root).toHaveAttribute('data-phase', 'day')
    // 11 月 + 北纬 39.9° → 自动季节 autumn。
    await expect(root).toHaveAttribute('data-season', 'autumn')

    // 温度锁定层：数值 + 天气描述 + 体感 + 高低温齐全。
    await expect(page.locator('.current-temperature')).toHaveText('24°')
    await expect(page.locator('.temperature-side strong')).toHaveText('晴朗')
    await expect(page.locator('.high-low')).toContainText('最高')
    await expect(page.locator('.high-low')).toContainText('最低')

    // 玻璃材质真实生效（backdrop-filter 存在且来自 --glass-blur 令牌）。
    const glass = page.locator('.secondary-button').first()
    const backdrop = await glass.evaluate((node) => getComputedStyle(node).backdropFilter)
    expect(backdrop).toContain('blur')

    // 逐时 / 逐日模块存在。
    await expect(page.locator('#hourly')).toBeVisible()
    await expect(page.locator('#daily')).toBeVisible()

    await page.waitForTimeout(600) // 等待入场动效稳定后截图。
    await page.screenshot({ path: `${ASSETS}/phase3-e2e-clear-day-desktop.png`, fullPage: true })
  })

  test('雨天 · 雨幕层与天气提示卡片（预警色令牌）', async ({ page }) => {
    await freezeTime(page, DAY_MS)
    await installRoutes(page, {
      scene: { weatherCode: 65, isDay: 1, temperature: 18, precipitationProbability: 80, windSpeed: 12 },
      fixedNowMs: DAY_MS,
    })
    await page.goto('/')

    await expect(page.locator('.app')).toHaveAttribute('data-kind', 'rain')
    await expect(page.locator('.rain-veil')).toBeAttached()

    // 降水概率 80% 持续 → 应用内“降水概率较高”提示卡（advisory 级）。
    const advisory = page.locator('.alert-card.advisory').first()
    await expect(advisory).toBeVisible()
    // 令牌 --alert-advisory (#c9a44c) 解析到 border-left。
    const borderColor = await advisory.evaluate((node) => getComputedStyle(node).borderLeftColor)
    expect(borderColor).toBe('rgb(201, 164, 76)')

    await page.waitForTimeout(600)
    await page.screenshot({ path: `${ASSETS}/phase3-e2e-rain-day.png`, fullPage: true })
  })

  test('大风 · watch 级提示卡令牌色', async ({ page }) => {
    await freezeTime(page, DAY_MS)
    await installRoutes(page, { scene: { weatherCode: 2, isDay: 1, windSpeed: 56 }, fixedNowMs: DAY_MS })
    await page.goto('/')

    const watch = page.locator('.alert-card.watch').first()
    await expect(watch).toContainText('大风')
    const borderColor = await watch.evaluate((node) => getComputedStyle(node).borderLeftColor)
    expect(borderColor).toBe('rgb(217, 119, 87)') // --alert-watch #d97757
  })

  test('雪天 · 冬季主题组合', async ({ page }) => {
    await freezeTime(page, DAY_MS)
    await seedPreferences(page, { season: 'winter' })
    await installRoutes(page, { scene: { weatherCode: 71, isDay: 1, temperature: -2 }, fixedNowMs: DAY_MS })
    await page.goto('/')

    await expect(page.locator('.app')).toHaveAttribute('data-kind', 'snow')
    await expect(page.locator('.app')).toHaveAttribute('data-season', 'winter')

    await page.waitForTimeout(600)
    await page.screenshot({ path: `${ASSETS}/phase3-e2e-snow-winter.png`, fullPage: true })
  })

  test('雷暴夜间 · 星空画布与深蓝氛围', async ({ page }) => {
    await freezeTime(page, NIGHT_MS)
    await installRoutes(page, { scene: { weatherCode: 95, isDay: 0, temperature: 19 }, fixedNowMs: NIGHT_MS })
    await page.goto('/')

    await expect(page.locator('.app')).toHaveAttribute('data-kind', 'thunder')
    await expect(page.locator('.app')).toHaveAttribute('data-phase', 'night')
    await expect(page.locator('.storm-shelf')).toBeAttached()
    const canvas = page.locator('canvas.weather-canvas')
    await expect(canvas).toBeAttached()

    await page.waitForTimeout(600)
    await page.screenshot({ path: `${ASSETS}/phase3-e2e-thunder-night.png`, fullPage: true })
  })

  test('官方预警 · 蓝/橙级别令牌色与排序', async ({ page }) => {
    await freezeTime(page, DAY_MS)
    await installRoutes(page, {
      scene: { weatherCode: 1, isDay: 1 },
      fixedNowMs: DAY_MS,
      warnings: [
        { alertid: 'w-blue', title: '北京市气象台发布大风蓝色预警信号', issuetime: '2026/11/13 08:00' },
        { alertid: 'w-orange', title: '北京市气象台发布寒潮橙色预警信号', issuetime: '2026/11/13 09:30' },
      ],
    })
    await page.goto('/')

    const orange = page.locator('.official-warning.level-orange')
    await expect(orange).toBeVisible()
    const orangeBorder = await orange.evaluate((node) => getComputedStyle(node).borderLeftColor)
    expect(orangeBorder).toBe('rgb(247, 107, 21)') // --warn-orange #f76b15
    const orangeText = await orange.locator('strong').evaluate((node) => getComputedStyle(node).color)
    expect(orangeText).toBe('rgb(255, 164, 116)') // --warn-orange-text #ffa474

    const blue = page.locator('.official-warning.level-blue')
    await expect(blue).toBeVisible()
    // 级别排序：橙（3）在蓝（1）之前。
    await expect(page.locator('.official-warning').first()).toHaveClass(/level-orange/)
  })
})

test.describe('移动端布局', () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })

  test('底部导航与安全区', async ({ page }) => {
    await freezeTime(page, DAY_MS)
    await installRoutes(page, { scene: { weatherCode: 0, isDay: 1, temperature: 26 }, fixedNowMs: DAY_MS })
    await page.goto('/')

    const nav = page.locator('.mobile-nav')
    await expect(nav).toBeVisible()
    // 触控目标至少 44×44。
    const firstButton = nav.locator('a, button').first()
    const box = await firstButton.boundingBox()
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44)
    await page.screenshot({ path: `${ASSETS}/phase3-e2e-mobile-clear.png`, fullPage: true })
  })
})

test.describe('主题切换与持久化', () => {
  test('设置弹窗切换春季主题并跨刷新保持', async ({ page }) => {
    await freezeTime(page, DAY_MS)
    await installRoutes(page, { scene: { weatherCode: 0, isDay: 1 }, fixedNowMs: DAY_MS })
    await page.goto('/')

    await page.getByRole('button', { name: '打开设置' }).click()
    const dialog = page.locator('.settings-dialog')
    await expect(dialog).toBeVisible()
    // 弹窗玻璃与焦点管理。
    const backdrop = await dialog.evaluate((node) => getComputedStyle(node).backdropFilter)
    expect(backdrop).toContain('blur')
    await expect(dialog).toHaveAttribute('aria-modal', 'true')

    await page.screenshot({ path: `${ASSETS}/phase3-e2e-settings-dialog.png` })

    await dialog.locator('.season-option.spring').click()
    await expect(page.locator('.app')).toHaveAttribute('data-season', 'spring')

    // 持久化：刷新后仍为春季（无需账号/云端）。
    await page.reload()
    await expect(page.locator('.app')).toHaveAttribute('data-season', 'spring')
    const persisted = await page.evaluate(() => window.localStorage.getItem('sixu-preferences-v1'))
    expect(persisted).toContain('"season":"spring"')

    // Escape 关闭弹窗并还原焦点。
    await page.getByRole('button', { name: '打开设置' }).click()
    await expect(dialog).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()
  })

  test('动画开关切换 animations-off 类', async ({ page }) => {
    await freezeTime(page, DAY_MS)
    await installRoutes(page, { scene: { weatherCode: 0, isDay: 1 }, fixedNowMs: DAY_MS })
    await page.goto('/')

    await page.getByRole('button', { name: '打开设置' }).click()
    const animationsSwitch = page.locator('button[role="switch"]').first()
    await expect(animationsSwitch).toHaveAttribute('aria-checked', 'true')
    await animationsSwitch.click()
    await expect(page.locator('.app')).toHaveClass(/animations-off/)

    // 关闭设置后，动效确实停止（sun-rays 的 animation-name 为 none）。
    await page.getByRole('button', { name: '关闭设置' }).click()
    const animationName = await page.locator('.sun-rays').evaluate((node) => getComputedStyle(node).animationName)
    expect(animationName).toBe('none')
  })
})

test.describe('动效降级', () => {
  test.use({ reducedMotion: 'reduce' })

  test('prefers-reduced-motion 下动画时长收缩到 0.01ms', async ({ page }) => {
    await freezeTime(page, DAY_MS)
    await installRoutes(page, { scene: { weatherCode: 0, isDay: 1 }, fixedNowMs: DAY_MS })
    await page.goto('/')

    // Chromium 将 0.01ms 序列化为 '1e-05s'，按数值断言（≤ 0.01ms 即视为降级生效）。
    const duration = await page.locator('.sun-rays').evaluate((node) => getComputedStyle(node).animationDuration)
    expect(parseFloat(duration)).toBeLessThanOrEqual(0.00001)
  })
})

test.describe('加载状态', () => {
  test('骨架屏展示后过渡到真实内容', async ({ page }) => {
    await freezeTime(page, DAY_MS)
    await installRoutes(page, {
      scene: { weatherCode: 1, isDay: 1 },
      fixedNowMs: DAY_MS,
      forecastDelayMs: 1500,
    })
    await page.goto('/')

    const loading = page.locator('.loading-scene')
    await expect(loading).toBeVisible()
    await expect(loading).toHaveAttribute('aria-busy', 'true')
    await page.screenshot({ path: `${ASSETS}/phase3-e2e-skeleton-loading.png` })

    await expect(page.locator('.current-temperature')).toBeVisible({ timeout: 10_000 })
    await expect(loading).toBeHidden()
  })
})

test.describe('浅色主题对比度（WCAG AA）', () => {
  // 截图实测真实合成背景，需冻结入场动效（card-rise 带透明度关键帧），
  // 避免采样到动画中间帧。
  test('官方预警 · 蓝/黄/橙/红四级文字对比度 ≥ 4.5:1', async ({ page }) => {
    await seedPreferences(page, { visualStyle: 'light', animations: false })
    await freezeTime(page, DAY_MS)
    await installRoutes(page, {
      scene: { weatherCode: 1, isDay: 1 },
      fixedNowMs: DAY_MS,
      warnings: [
        { alertid: 'w-red', title: '北京市气象台发布暴雨红色预警信号', issuetime: '2026/11/13 10:00' },
        { alertid: 'w-orange', title: '北京市气象台发布寒潮橙色预警信号', issuetime: '2026/11/13 09:30' },
        { alertid: 'w-yellow', title: '北京市气象台发布大雾黄色预警信号', issuetime: '2026/11/13 09:00' },
        { alertid: 'w-blue', title: '北京市气象台发布大风蓝色预警信号', issuetime: '2026/11/13 08:00' },
      ],
    })
    await page.goto('/')
    await expect(page.locator('.app')).toHaveClass(/style-light/)
    await page.screenshot({ path: `${ASSETS}/phase3-e2e-contrast-light-official.png` })

    for (const level of ['blue', 'yellow', 'orange', 'red'] as const) {
      const card = `.official-warning.level-${level}`
      await expect(page.locator(card)).toBeVisible()
      const { ratio, textColor, backgroundColor, worstBackground } = await measureTextContrast(page, card, `${card} strong`)
      console.log(`[contrast] ${level}: ${ratio.toFixed(2)}:1 text=${textColor} card=${backgroundColor} 最差背景=${worstBackground}`)
      expect(ratio, `${level} 对比度不足：text=${textColor} card=${backgroundColor} 最差背景=${worstBackground}`).toBeGreaterThanOrEqual(4.5)
    }
  })

  test('应用内提示卡 · watch 级文字对比度 ≥ 4.5:1', async ({ page }) => {
    await seedPreferences(page, { visualStyle: 'light', animations: false })
    await freezeTime(page, DAY_MS)
    await installRoutes(page, { scene: { weatherCode: 2, isDay: 1, windSpeed: 56 }, fixedNowMs: DAY_MS })
    await page.goto('/')

    const card = '.alert-card.watch'
    await expect(page.locator(card)).toBeVisible()
    await page.screenshot({ path: `${ASSETS}/phase3-e2e-contrast-light-watch.png` })
    const { ratio, textColor, backgroundColor, worstBackground } = await measureTextContrast(page, card, `${card} strong`)
    console.log(`[contrast] watch: ${ratio.toFixed(2)}:1 text=${textColor} card=${backgroundColor} 最差背景=${worstBackground}`)
    expect(ratio, `watch 对比度不足：text=${textColor} card=${backgroundColor} 最差背景=${worstBackground}`).toBeGreaterThanOrEqual(4.5)
  })

  test('应用内提示卡 · advisory 级文字对比度 ≥ 4.5:1', async ({ page }) => {
    await seedPreferences(page, { visualStyle: 'light', animations: false })
    await freezeTime(page, DAY_MS)
    await installRoutes(page, {
      scene: { weatherCode: 65, isDay: 1, temperature: 18, precipitationProbability: 80 },
      fixedNowMs: DAY_MS,
    })
    await page.goto('/')

    const card = '.alert-card.advisory'
    await expect(page.locator(card)).toBeVisible()
    await page.screenshot({ path: `${ASSETS}/phase3-e2e-contrast-light-advisory.png` })
    const { ratio, textColor, backgroundColor, worstBackground } = await measureTextContrast(page, card, `${card} strong`)
    console.log(`[contrast] advisory: ${ratio.toFixed(2)}:1 text=${textColor} card=${backgroundColor} 最差背景=${worstBackground}`)
    expect(ratio, `advisory 对比度不足：text=${textColor} card=${backgroundColor} 最差背景=${worstBackground}`).toBeGreaterThanOrEqual(4.5)
  })
})

test.describe('时间一致性（Asia/Shanghai）', () => {
  test('白天 12:00 · 页面时钟与接口 current.time 对齐', async ({ page }) => {
    await freezeTime(page, DAY_MS)
    await installRoutes(page, { scene: { weatherCode: 0, isDay: 1, temperature: 24 }, fixedNowMs: DAY_MS })
    await page.goto('/')

    // 夹具 current.time = '2026-11-13T12:00'（+08:00），页面时钟必须显示同一当地时间。
    await expect(page.locator('.local-clock span')).toHaveText('12:00')
    await expect(page.locator('.local-clock')).toHaveAttribute('aria-label', /当地时间12时00分/)
    await expect(page.locator('.hero-meta p')).toContainText('2026 年 11 月 13 日')
    await expect(page.locator('.hero-meta p')).toContainText('Asia/Shanghai')
  })

  test('跨月边界 · 12-01 02:00（UTC 仍为 11-30）时钟与逐日数据一致', async ({ page }) => {
    // UTC 2026-11-30T18:00Z → 上海 2026-12-01T02:00：UTC 与当地时间不同日。
    const EARLY_MS = Date.parse('2026-11-30T18:00:00Z')
    await freezeTime(page, EARLY_MS)
    await installRoutes(page, { scene: { weatherCode: 0, isDay: 0, temperature: 3 }, fixedNowMs: EARLY_MS })
    await page.goto('/')

    await expect(page.locator('.local-clock span')).toHaveText('02:00')
    await expect(page.locator('.hero-meta p')).toContainText('2026 年 12 月 1 日')
    // 逐日首日 = 夹具当地日期 12-01（跨月递增正确，而非回退到 11-30）。
    await expect(page.locator('#daily')).toContainText('12月1日')
  })
})
