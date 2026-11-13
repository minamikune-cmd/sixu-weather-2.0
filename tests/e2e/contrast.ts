// 文字对比度测量：在页面内用 canvas 把计算样式颜色归一化为 sRGB 像素，
// 再按 WCAG 相对亮度公式计算对比度。
// 半透明卡片背景按「叠加在白色上」取值——浅色主题下真实页面底色只会更暗，
// 因此得到的是最坏情况对比度，通过即满足 WCAG AA（≥4.5:1）。
import type { Page } from '@playwright/test'

export interface ContrastResult {
  /** WCAG 对比度（1–21）。 */
  ratio: number
  /** strong/标题元素的计算颜色（序列化字符串，便于失败诊断）。 */
  textColor: string
  /** 卡片计算背景色（可能带 alpha）。 */
  backgroundColor: string
}

export async function measureTextContrast(
  page: Page,
  cardSelector: string,
  textSelector: string,
): Promise<ContrastResult> {
  return page.evaluate(
    ({ cardSelector: cardSel, textSelector: textSel }) => {
      const card = document.querySelector<HTMLElement>(cardSel)
      const text = document.querySelector<HTMLElement>(textSel)
      if (!card || !text) throw new Error(`contrast probe missing: ${cardSel} / ${textSel}`)
      const canvas = document.createElement('canvas')
      canvas.width = 1
      canvas.height = 1
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('2d context unavailable')

      const SENTINEL = '#010203'
      const toRgb = (color: string, base?: string): [number, number, number] => {
        ctx.clearRect(0, 0, 1, 1)
        if (base) {
          ctx.fillStyle = base
          ctx.fillRect(0, 0, 1, 1)
        }
        ctx.fillStyle = SENTINEL
        ctx.fillStyle = color
        // 浏览器拒绝的颜色会静默保留哨兵值——显式失败，避免假通过。
        if (ctx.fillStyle === SENTINEL) throw new Error(`canvas rejected color: ${color}`)
        ctx.fillRect(0, 0, 1, 1)
        const pixel = ctx.getImageData(0, 0, 1, 1).data
        return [pixel[0], pixel[1], pixel[2]]
      }
      const luminance = ([r, g, b]: [number, number, number]): number => {
        const channel = (value: number): number => {
          const v = value / 255
          return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
        }
        return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
      }

      const background = toRgb(getComputedStyle(card).backgroundColor, '#ffffff')
      const foreground = toRgb(getComputedStyle(text).color)
      const back = luminance(background)
      const fore = luminance(foreground)
      const ratio = (Math.max(back, fore) + 0.05) / (Math.min(back, fore) + 0.05)
      return {
        ratio,
        textColor: getComputedStyle(text).color,
        backgroundColor: getComputedStyle(card).backgroundColor,
      }
    },
    { cardSelector, textSelector },
  )
}
