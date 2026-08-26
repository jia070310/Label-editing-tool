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
