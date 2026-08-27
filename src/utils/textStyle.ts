import type { CSSProperties } from 'react'

export type TextDecorationStyle =
  | 'none'
  | 'underline'
  | 'line-through'
  | 'underline line-through'

export function hasTextDecoration(
  value: string | undefined,
  kind: 'underline' | 'line-through',
): boolean {
  return (value ?? 'none').includes(kind)
}

export function toggleTextDecoration(
  value: string | undefined,
  kind: 'underline' | 'line-through',
): TextDecorationStyle {
  const parts = new Set(
    (value ?? 'none').split(/\s+/).filter((p) => p && p !== 'none'),
  )
  if (parts.has(kind)) parts.delete(kind)
  else parts.add(kind)
  const next = (['underline', 'line-through'] as const)
    .filter((k) => parts.has(k))
    .join(' ')
  return (next || 'none') as TextDecorationStyle
}

/**
 * 黑体等中文字体常无独立粗体/斜体字形，仅设 font-weight/font-style 效果很弱。
 * 用合成加粗（描边阴影）与 oblique + 轻微 skew，保证编辑与打印预览都可见。
 * skew 只应作用在文字节点，勿加在表格单元格（会连带边框倾斜）。
 */
export function textEmphasisStyle(
  fontWeight: 'normal' | 'bold' | string | undefined,
  fontStyle: 'normal' | 'italic' | string | undefined,
  options?: { skew?: boolean },
): CSSProperties {
  const bold = fontWeight === 'bold' || fontWeight === '700'
  const italic = fontStyle === 'italic' || fontStyle === 'oblique'
  const skew = options?.skew !== false
  const style: CSSProperties = {
    fontWeight: bold ? 700 : 400,
    fontStyle: italic ? 'oblique' : 'normal',
    fontSynthesis: 'weight style',
  }
  if (bold) {
    // 横向阴影模拟加粗，html2canvas / 热敏打印更稳
    style.textShadow =
      '0.45px 0 0 currentColor, -0.45px 0 0 currentColor, 0 0.35px 0 currentColor'
    style.WebkitTextStroke = '0.012em currentColor'
  }
  if (italic && skew) {
    style.transform = 'skewX(-9deg)'
    style.transformOrigin = 'center center'
  }
  return style
}

export function textEmphasisClassName(
  fontWeight: 'normal' | 'bold' | string | undefined,
  fontStyle: 'normal' | 'italic' | string | undefined,
): string {
  const bold = fontWeight === 'bold' || fontWeight === '700'
  const italic = fontStyle === 'italic' || fontStyle === 'oblique'
  return [
    bold ? 'text-emph-bold' : '',
    italic ? 'text-emph-italic' : '',
  ]
    .filter(Boolean)
    .join(' ')
}
