import { createRoot, type Root } from 'react-dom/client'
import { LabelSheetStatic } from '../components/LabelSheetStatic'
import type { LabelElement, LabelSettings } from '../types'
import {
  captureLabelImage,
  DEFAULT_PRINT_DPI,
  printLabelImage,
  type PrintOptions,
} from './print'
import {
  applyVariablesToElements,
  type DataRow,
} from './variables'

function waitForRender(ms = 120): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => setTimeout(resolve, ms))
    })
  })
}

export async function mountLabelSheet(
  elements: LabelElement[],
  settings: LabelSettings,
): Promise<{
  sheet: HTMLElement
  unmount: () => void
}> {
  const host = document.createElement('div')
  host.style.cssText =
    'position:fixed;left:-20000px;top:0;pointer-events:none;z-index:-1;'
  document.body.appendChild(host)

  let root: Root | null = null
  const sheet = await new Promise<HTMLElement>((resolve) => {
    root = createRoot(host)
    root.render(
      <LabelSheetStatic
        elements={elements}
        settings={settings}
        onMounted={(el) => resolve(el)}
      />,
    )
  })

  await waitForRender()

  return {
    sheet,
    unmount: () => {
      root?.unmount()
      host.remove()
    },
  }
}

export async function captureLabelFromElements(
  elements: LabelElement[],
  settings: LabelSettings,
  dpi = DEFAULT_PRINT_DPI,
): Promise<string> {
  const { sheet, unmount } = await mountLabelSheet(elements, settings)
  try {
    return await captureLabelImage(sheet, settings, dpi)
  } finally {
    unmount()
  }
}

export async function printBatchLabels(
  templateElements: LabelElement[],
  settings: LabelSettings,
  rows: DataRow[],
  options: PrintOptions & {
    onProgress?: (current: number, total: number) => void
    /** 自定义每行元素准备（如变量 + 预翻译）；默认仅替换变量 */
    prepareElements?: (
      template: LabelElement[],
      row: DataRow,
      index: number,
    ) => LabelElement[]
  } = {},
): Promise<void> {
  const dpi = options.dpi ?? DEFAULT_PRINT_DPI
  const prepare =
    options.prepareElements ??
    ((template, row) => applyVariablesToElements(template, row))
  for (let i = 0; i < rows.length; i++) {
    const elements = prepare(templateElements, rows[i], i)
    const dataUrl = await captureLabelFromElements(elements, settings, dpi)
    await printLabelImage(dataUrl, settings, {
      ...options,
      silent: options.silent ?? true,
    })
    options.onProgress?.(i + 1, rows.length)
  }
}
