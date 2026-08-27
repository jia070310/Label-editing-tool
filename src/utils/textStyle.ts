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
 * 粗体/斜体样式。不用阴影或描边模拟加粗（中文会糊成一团）。
 * 依赖 font-weight + font-synthesis；斜体可用轻微 skew（仅文字节点）。
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
  if (italic && skew) {
    style.transform = 'skewX(-8deg)'
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
