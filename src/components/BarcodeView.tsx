import { useEffect, useRef, useState } from 'react'
import JsBarcode from 'jsbarcode'
import type { BarcodeElement } from '../types'
import { useDebouncedValue } from '../hooks/useDebouncedValue'

interface Props {
  element: BarcodeElement
}

export function BarcodeView({ element }: Props) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [error, setError] = useState<string | null>(null)
  const debouncedValue = useDebouncedValue(element.value, 180)
  const debouncedFormat = useDebouncedValue(element.format ?? 'CODE128', 180)
  const debouncedShowText = useDebouncedValue(element.showText, 180)

  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return

    svg.innerHTML = ''
    const value = debouncedValue.trim()
    if (!value) {
      setError(null)
      return
    }

    try {
      JsBarcode(svg, value, {
        format: debouncedFormat,
        displayValue: debouncedShowText,
        margin: 2,
        width: 2,
        height: 48,
        fontSize: 14,
        fontOptions: 'bold',
        textMargin: 2,
        background: '#ffffff',
        lineColor: '#000000',
        valid: (valid) => {
          if (!valid) setError('条码内容不符合格式要求')
        },
      })
      setError(null)
    } catch {
      setError('无法生成条码，请检查内容与格式')
    }
  }, [debouncedValue, debouncedShowText, debouncedFormat])

  if (!element.value.trim()) {
    return (
      <div className="barcode-el barcode-el--empty">
        <span className="code-placeholder">请输入条码内容</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="barcode-el barcode-el--error">
        <span className="code-error">{error}</span>
        <span className="code-error-value">{element.value}</span>
      </div>
    )
  }

  return (
    <div className="barcode-el">
      <svg ref={svgRef} className="barcode-svg" role="img" aria-label={element.value} />
    </div>
  )
}
