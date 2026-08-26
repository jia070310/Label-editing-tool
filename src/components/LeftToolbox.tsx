import {
  Type,
  Table2,
  Square,
  Minus,
  Barcode,
  QrCode,
  Image,
  Calendar,
  TriangleAlert,
} from 'lucide-react'
import type { ElementType } from '../types'

export type AddType = ElementType | 'image' | 'date' | 'warning'

const ITEMS: { type: AddType; label: string; icon: typeof Type }[] = [
  { type: 'text', label: '文本', icon: Type },
  { type: 'barcode', label: '条码', icon: Barcode },
  { type: 'qrcode', label: '二维码', icon: QrCode },
  { type: 'image', label: '图片', icon: Image },
  { type: 'line', label: '线条', icon: Minus },
  { type: 'rect', label: '矩形', icon: Square },
  { type: 'date', label: '日期', icon: Calendar },
  { type: 'table', label: '表格', icon: Table2 },
  { type: 'warning', label: '警示语', icon: TriangleAlert },
]

interface Props {
  onAdd: (type: AddType) => void
}

export function LeftToolbox({ onAdd }: Props) {
  return (
    <aside className="left-toolbox">
      {ITEMS.map((item) => {
        const Icon = item.icon
        return (
          <button
            key={item.type}
            className="toolbox-item"
            title={`添加${item.label}`}
            onClick={() => onAdd(item.type)}
          >
            <Icon />
            <span>{item.label}</span>
          </button>
        )
      })}
    </aside>
  )
}
