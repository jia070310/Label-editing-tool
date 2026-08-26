import type { LabelElement } from '../types'

export function normalizeRotation(deg: number): number {
  const n = Math.round(deg) % 360
  return n < 0 ? n + 360 : n
}

export function rotateElementBy90(el: LabelElement): Partial<LabelElement> {
  return { rotation: normalizeRotation(el.rotation + 90) }
}

export function setElementRotation(rotation: number): Partial<LabelElement> {
  return { rotation: normalizeRotation(rotation) }
}

export function canRotateElement(el: LabelElement | null): el is LabelElement {
  return !!el && (el.type === 'rect' || el.type === 'line') && !el.locked
}
