import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import type { QrcodeElement } from '../types'
import { MM_TO_PX } from '../utils/dpi'
import { useDebouncedValue } from '../hooks/useDebouncedValue'

interface Props {
  element: QrcodeElement
  zoom: number
}

export function QrcodeView({ element, zoom }: Props) {
  const [svgMarkup, setSvgMarkup] = useState('')
  const [error, setError] = useState<string | null>(null)
  const debouncedValue = useDebouncedValue(element.value, 180)
  const debouncedEc = useDebouncedValue(element.errorCorrection ?? 'M', 180)

  useEffect(() => {
    const value = debouncedValue.trim()
    if (!value) {
      setSvgMarkup('')
      setError(null)
      return
    }

    const px = Math.max(
      64,
      Math.round(Math.min(element.width, element.height) * MM_TO_PX * zoom),
    )

    QRCode.toString(value, {
      type: 'svg',
      width: px,
      margin: 1,
      errorCorrectionLevel: debouncedEc,
      color: { dark: '#000000', light: '#ffffff' },
    })
      .then((svg) => {
        setSvgMarkup(svg)
        setError(null)
      })
      .catch(() => {
        setSvgMarkup('')
        setError('无法生成二维码，请检查内容')
      })
  }, [
    debouncedValue,
    debouncedEc,
    element.width,
    element.height,
    zoom,
  ])

  if (!element.value.trim()) {
    return (
      <div className="qrcode-el qrcode-el--empty">
        <span className="code-placeholder">请输入二维码内容</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="qrcode-el qrcode-el--error">
        <span className="code-error">{error}</span>
      </div>
    )
  }

  return (
    <div className="qrcode-el" title={element.value}>
      <div
        className="qrcode-svg-wrap"
        dangerouslySetInnerHTML={{ __html: svgMarkup }}
      />
    </div>
  )
}
