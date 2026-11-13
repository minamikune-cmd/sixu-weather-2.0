// 文字对比度测量：以页面真实渲染结果为基准。
// 1. 截取景口截图（含天空渐变、氛围层、暗角、玻璃模糊与卡片半透明背景的最终合成）；
// 2. 在隔离页面用 canvas 解码截图，取卡片内部、排除文字及所有子元素后的中位色，
//    作为标题文字的真实最终背景色；
// 3. 计算样式文字色经 canvas 归一化为 sRGB，按 WCAG 相对亮度公式计算对比度。
// 不再把卡片背景假设合成在纯白色上——玻璃透明度、真实天气背景全部来自实测像素。
import type { Page } from '@playwright/test'

export interface ContrastResult {
  /** WCAG 对比度（1–21）。 */
  ratio: number
  /** 标题元素的计算颜色（序列化字符串，便于失败诊断）。 */
  textColor: string
  /** 卡片计算背景色（可能带 alpha）。 */
  backgroundColor: string
  /** 实测合成后的最终背景色（卡片处真实渲染像素的中位色）。 */
  effectiveBackground: string
}

interface Rect {
  x: number
  y: number
  width: number
  height: number
}

/** 在应用页面内收集卡片 / 文字几何信息、计算颜色与遮挡区域。 */
async function probePageGeometry(page: Page, cardSelector: string, textSelector: string) {
  return page.evaluate(
    ({ cardSelector: cardSel, textSelector: textSel }) => {
      const card = document.querySelector<HTMLElement>(cardSel)
      const text = document.querySelector<HTMLElement>(textSel)
      if (!card || !text) throw new Error(`contrast probe missing: ${cardSel} / ${textSel}`)
      const toRect = (el: Element): Rect => {
        const r = el.getBoundingClientRect()
        return { x: r.x, y: r.y, width: r.width, height: r.height }
      }
      // 卡片内部所有子元素区域都要排除（卡片自身即采样区，不应排除），
      // 确保采样点只落在纯背景上。
      const occluders = Array.from(card.querySelectorAll('*')).map(toRect)
      const cardStyle = getComputedStyle(card)
      return {
        card: toRect(card),
        text: toRect(text),
        occluders,
        textColor: getComputedStyle(text).color,
        backgroundColor: cardStyle.backgroundColor,
        borderLeftWidth: Number.parseFloat(cardStyle.borderLeftWidth) || 0,
        devicePixelRatio: window.devicePixelRatio || 1,
      }
    },
    { cardSelector, textSelector },
  )
}

/** 在隔离页面解码截图并采样真实合成背景色、归一化文字色。 */
async function analyzeScreenshot(
  page: Page,
  pngBase64: string,
  geometry: Awaited<ReturnType<typeof probePageGeometry>>,
) {
  const holder = await page.context().newPage()
  try {
    return await holder.evaluate(
      async ({ png, probe }) => {
        const image = new Image()
        image.src = `data:image/png;base64,${png}`
        await image.decode()
        const canvas = document.createElement('canvas')
        canvas.width = image.naturalWidth
        canvas.height = image.naturalHeight
        const ctx = canvas.getContext('2d', { willReadFrequently: true })
        if (!ctx) throw new Error('2d context unavailable')
        ctx.drawImage(image, 0, 0)

        const dpr = probe.devicePixelRatio
        const toImageRect = (r: Rect) => ({
          x: Math.round(r.x * dpr),
          y: Math.round(r.y * dpr),
          width: Math.round(r.width * dpr),
          height: Math.round(r.height * dpr),
        })
        // 卡片背景采样区：向内缩 2 CSS px，左侧再避开彩色边框；
        // 排除所有子元素（扩 2 px 覆盖文字抗锯齿溢出）。
        const inset = 2
        const region = toImageRect(probe.card)
        const left = region.x + Math.round((probe.borderLeftWidth + inset) * dpr)
        const top = region.y + inset * dpr
        const right = region.x + region.width - inset * dpr
        const bottom = region.y + region.height - inset * dpr
        const blocked = probe.occluders.map((r) => {
          const b = toImageRect(r)
          const pad = 2 * dpr
          return { x: b.x - pad, y: b.y - pad, width: b.width + pad * 2, height: b.height + pad * 2 }
        })
        const isBlocked = (x: number, y: number): boolean =>
          blocked.some((b) => x >= b.x && x < b.x + b.width && y >= b.y && y < b.y + b.height)

        const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data
        const channelSample: { r: number[]; g: number[]; b: number[] } = { r: [], g: [], b: [] }
        const stride = Math.max(1, Math.round(dpr)) // 约每 1 CSS px 取一个采样点
        for (let y = top; y < bottom; y += stride) {
          for (let x = left; x < right; x += stride) {
            if (isBlocked(x, y)) continue
            const offset = (y * canvas.width + x) * 4
            channelSample.r.push(pixels[offset])
            channelSample.g.push(pixels[offset + 1])
            channelSample.b.push(pixels[offset + 2])
          }
        }
        if (channelSample.r.length < 16) {
          throw new Error('contrast probe sampled too few background pixels')
        }
        // 背景色占采样区绝大多数，逐通道中位数即真实合成背景。
        const median = (values: number[]): number => {
          const sorted = [...values].sort((a, b) => a - b)
          return sorted[Math.floor(sorted.length / 2)]
        }
        const background: [number, number, number] = [
          median(channelSample.r),
          median(channelSample.g),
          median(channelSample.b),
        ]

        const SENTINEL = '#010203'
        const toRgb = (color: string): [number, number, number] => {
          ctx.clearRect(0, 0, 1, 1)
          ctx.fillStyle = SENTINEL
          ctx.fillStyle = color
          // 浏览器拒绝的颜色会静默保留哨兵值——显式失败，避免假通过。
          if (ctx.fillStyle === SENTINEL) throw new Error(`canvas rejected color: ${color}`)
          ctx.fillRect(0, 0, 1, 1)
          const pixel = ctx.getImageData(0, 0, 1, 1).data
          return [pixel[0], pixel[1], pixel[2]]
        }
        const foreground = toRgb(probe.textColor)
        return { foreground, background }
      },
      { png: pngBase64, probe: geometry },
    )
  } finally {
    await holder.close()
  }
}

export async function measureTextContrast(
  page: Page,
  cardSelector: string,
  textSelector: string,
): Promise<ContrastResult> {
  const geometry = await probePageGeometry(page, cardSelector, textSelector)
  // 视口截图：像素即浏览器最终合成结果（天空渐变、氛围层、暗角、玻璃模糊全部包含）。
  const screenshot = await page.screenshot({ type: 'png' })
  const { foreground, background } = await analyzeScreenshot(page, screenshot.toString('base64'), geometry)

  const luminance = ([r, g, b]: [number, number, number]): number => {
    const channel = (value: number): number => {
      const v = value / 255
      return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
    }
    return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
  }
  const back = luminance(background)
  const fore = luminance(foreground)
  const ratio = (Math.max(back, fore) + 0.05) / (Math.min(back, fore) + 0.05)
  const toCss = ([r, g, b]: [number, number, number]): string => `rgb(${r}, ${g}, ${b})`
  return {
    ratio,
    textColor: geometry.textColor,
    backgroundColor: geometry.backgroundColor,
    effectiveBackground: toCss(background),
  }
}
