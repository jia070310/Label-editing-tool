/** 与常见热敏打印机一致的设计/预览 DPI，编辑与打印 WYSIWYG */
export const DESIGN_DPI = 203

/** 1 mm 在设计 DPI 下的像素数 */
export const MM_TO_PX = DESIGN_DPI / 25.4

export function mmToPx(mm: number, dpi = DESIGN_DPI): number {
  return (mm / 25.4) * dpi
}

/** 将 pt 转为指定 DPI 下的 px（物理尺寸一致） */
export function ptToPx(pt: number, dpi = DESIGN_DPI): number {
  return (pt / 72) * dpi
}

export function mmStyle(mm: number, dpi = DESIGN_DPI): string {
  return `${mmToPx(mm, dpi)}px`
}

export function ptStyle(pt: number, dpi = DESIGN_DPI): string {
  return `${ptToPx(pt, dpi)}px`
}
