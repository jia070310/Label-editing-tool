import {
  Download,
  AlignCenter,
  AlignCenterVertical,
  AlignEndVertical,
  AlignLeft,
  AlignRight,
  AlignStartVertical,
  Bold,
  Copy,
  Italic,
  Languages,
  Layers,
  Lock,
  Eraser,
  Printer,
  Redo2,
  RotateCw,
  Save,
  Trash2,
  Underline,
  Undo2,
  Strikethrough,
  ClipboardPaste,
  SquareMousePointer,
  Unlock,
  House,
} from 'lucide-react'
import type { LabelElement, LabelSettings, TableCell, TextElement } from '../types'
import {
  hasTextDecoration,
  toggleTextDecoration,
} from '../utils/textStyle'
import { VariableInsertButton } from './VariableInsertButton'

type CellStylePatch = Partial<
  Pick<
    TableCell,
    | 'textAlign'
    | 'verticalAlign'
    | 'fontWeight'
    | 'fontStyle'
    | 'textDecoration'
    | 'color'
  >
>

type TableFontState = {
  fontFamily: string
  fontSize: number
  fontWeight: TableCell['fontWeight']
  fontStyle: TableCell['fontStyle']
  textDecoration: TableCell['textDecoration']
  color: string
}

const FONT_OPTIONS = [
  { value: 'SimHei, "Microsoft YaHei", sans-serif', label: '黑体' },
  { value: '"SimSun", serif', label: '宋体' },
  { value: '"Microsoft YaHei", sans-serif', label: '微软雅黑' },
  { value: 'Arial, sans-serif', label: 'Arial' },
] as const

interface Props {
  zoom: number
  onZoom: (z: number) => void
  canUndo: boolean
  canRedo: boolean
  onUndo: () => void
  onRedo: () => void
  onDelete: () => void
  onCopy: () => void
  onPaste: () => void
  onSelectAll: () => void
  onRotate: () => void
  onPrint: () => void
  onBatchPrint: () => void
  onSave: () => void
  onExportTemplate: () => void
  onHome: () => void
  onOpenSettings: () => void
  selected: LabelElement | null
  onUpdateSelected: (patch: Partial<LabelElement>) => void
  settings: LabelSettings
  locked: boolean
  onToggleLock: () => void
  canTranslateCell: boolean
  translating: boolean
  onTranslateCell: () => void
  canRemoveTranslation: boolean
  onRemoveTranslationCell: () => void
  canInsertVariable: boolean
  onInsertVariable: (name: string) => void
  tableCellStyle: CellStylePatch | null
  onUpdateTableCellStyle: (patch: CellStylePatch) => void
  tableFont: TableFontState | null
  onSetTableFontSize: (size: number) => void
}

export function TopToolbar({
  zoom,
  onZoom,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onDelete,
  onCopy,
  onPaste,
  onSelectAll,
  onRotate,
  onPrint,
  onBatchPrint,
  onSave,
  onExportTemplate,
  onHome,
  onOpenSettings,
  selected,
  onUpdateSelected,
  settings,
  locked,
  onToggleLock,
  canTranslateCell,
  translating,
  onTranslateCell,
  canRemoveTranslation,
  onRemoveTranslationCell,
  canInsertVariable,
  onInsertVariable,
  tableCellStyle,
  onUpdateTableCellStyle,
  tableFont,
  onSetTableFontSize,
}: Props) {
  const text = selected?.type === 'text' ? (selected as TextElement) : null
  const canEditFont = !!text || !!tableFont
  const fontFamily =
    text?.fontFamily ?? tableFont?.fontFamily ?? 'SimHei, "Microsoft YaHei", sans-serif'
  const fontSize = text?.fontSize ?? tableFont?.fontSize ?? 11
  const fontWeight = text?.fontWeight ?? tableFont?.fontWeight ?? 'normal'
  const fontStyle = text?.fontStyle ?? tableFont?.fontStyle ?? 'normal'
  const textDecoration =
    text?.textDecoration ?? tableFont?.textDecoration ?? 'none'
  const textColor = text?.color ?? tableFont?.color ?? '#111111'

  const setFontFamily = (family: string) => {
    if (text) onUpdateSelected({ fontFamily: family } as Partial<TextElement>)
    else if (tableFont) onUpdateSelected({ fontFamily: family })
  }

  const setFontSize = (size: number) => {
    if (!Number.isFinite(size)) return
    if (text) onUpdateSelected({ fontSize: size } as Partial<TextElement>)
    else if (tableFont) onSetTableFontSize(size)
  }

  const applyFontPatch = (patch: CellStylePatch & Partial<TextElement>) => {
    if (text) onUpdateSelected(patch as Partial<TextElement>)
    else if (tableFont) onUpdateTableCellStyle(patch)
  }
  const canAlignText = !!text
  const canAlignCell = !!tableCellStyle
  const canAlign = canAlignText || canAlignCell
  const canRotate =
    !!selected &&
    (selected.type === 'rect' || selected.type === 'line') &&
    !selected.locked

  const textAlign =
    text?.textAlign ?? tableCellStyle?.textAlign ?? 'left'
  const verticalAlign = tableCellStyle?.verticalAlign ?? 'middle'

  const setTextAlign = (align: TextElement['textAlign']) => {
    if (text) onUpdateSelected({ textAlign: align } as Partial<TextElement>)
    else if (tableCellStyle)
      onUpdateTableCellStyle({ textAlign: align })
  }

  const setVerticalAlign = (align: TableCell['verticalAlign']) => {
    if (tableCellStyle) onUpdateTableCellStyle({ verticalAlign: align })
  }

  return (
    <>
      <div className="top-toolbar">
        <div className="toolbar-group">
          <button className="tool-btn" title="返回首页" onClick={onHome}>
            <House size={16} />
            <span className="label">首页</span>
          </button>
          <div className="toolbar-divider" />
          <button className="tool-btn" title="保存" onClick={onSave}>
            <Save size={16} />
            <span className="label">保存</span>
          </button>
          <button
            className="tool-btn"
            title="导出模板文件"
            onClick={onExportTemplate}
          >
            <Download size={16} />
            <span className="label">导出</span>
          </button>
          <button className="tool-btn" title="删除" onClick={onDelete}>
            <Trash2 size={16} />
          </button>
          <button className="tool-btn" title="复制" onClick={onCopy}>
            <Copy size={16} />
          </button>
          <button className="tool-btn" title="粘贴" onClick={onPaste}>
            <ClipboardPaste size={16} />
          </button>
          <div className="toolbar-divider" />
          <button className="tool-btn" title="撤销" disabled={!canUndo} onClick={onUndo}>
            <Undo2 size={16} />
          </button>
          <button className="tool-btn" title="重做" disabled={!canRedo} onClick={onRedo}>
            <Redo2 size={16} />
          </button>
          <button className="tool-btn" title="全选" onClick={onSelectAll}>
            <SquareMousePointer size={16} />
          </button>
          <button
            className="tool-btn"
            title="旋转 90°"
            disabled={!canRotate}
            onClick={onRotate}
          >
            <RotateCw size={16} />
          </button>
          <div className="toolbar-divider" />
          <button className="tool-btn" title="标签设置" onClick={onOpenSettings}>
            <span className="label">标签设置</span>
            <span className="label muted">
              {settings.width}×{settings.height}mm
            </span>
          </button>
          <select
            value={Math.round(zoom * 100)}
            onChange={(e) => onZoom(Number(e.target.value) / 100)}
            style={{ height: 28, borderRadius: 6, border: '1px solid var(--border)' }}
          >
            {[50, 75, 100, 125, 150, 184, 200, 250].map((z) => (
              <option key={z} value={z}>
                {z}%
              </option>
            ))}
          </select>
          <button className="tool-btn" title="锁定" onClick={onToggleLock}>
            {locked ? <Lock size={16} /> : <Unlock size={16} />}
          </button>
        </div>
        <div className="toolbar-group">
          <button className="tool-btn" title="批量打印（变量数据）" onClick={onBatchPrint}>
            <Layers size={16} />
            <span className="label">批量</span>
          </button>
          <button className="tool-btn primary" onClick={onPrint}>
            <Printer size={16} />
            <span className="label">打印</span>
          </button>
        </div>
      </div>

      <div className="format-bar">
        <select
          value={fontFamily}
          disabled={!canEditFont}
          onChange={(e) => setFontFamily(e.target.value)}
        >
          {FONT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <input
          type="number"
          value={fontSize}
          disabled={!canEditFont}
          min={6}
          max={72}
          style={{ width: 48 }}
          onChange={(e) => setFontSize(Number(e.target.value))}
        />
        <button
          className={`tool-btn ${fontWeight === 'bold' ? 'active' : ''}`}
          disabled={!canEditFont}
          title="加粗"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() =>
            applyFontPatch({
              fontWeight: fontWeight === 'bold' ? 'normal' : 'bold',
            })
          }
        >
          <Bold size={15} />
        </button>
        <button
          className={`tool-btn ${fontStyle === 'italic' ? 'active' : ''}`}
          disabled={!canEditFont}
          title="斜体"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() =>
            applyFontPatch({
              fontStyle: fontStyle === 'italic' ? 'normal' : 'italic',
            })
          }
        >
          <Italic size={15} />
        </button>
        <button
          className={`tool-btn ${hasTextDecoration(textDecoration, 'underline') ? 'active' : ''}`}
          disabled={!canEditFont}
          title="下划线"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() =>
            applyFontPatch({
              textDecoration: toggleTextDecoration(textDecoration, 'underline'),
            })
          }
        >
          <Underline size={15} />
        </button>
        <button
          className={`tool-btn ${hasTextDecoration(textDecoration, 'line-through') ? 'active' : ''}`}
          disabled={!canEditFont}
          title="删除线"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() =>
            applyFontPatch({
              textDecoration: toggleTextDecoration(
                textDecoration,
                'line-through',
              ),
            })
          }
        >
          <Strikethrough size={15} />
        </button>
        <input
          type="color"
          disabled={!canEditFont}
          value={textColor}
          onChange={(e) => applyFontPatch({ color: e.target.value })}
          title="文字颜色"
        />
        <button
          className={`tool-btn ${text?.textAlign === 'left' || (canAlignCell && textAlign === 'left') ? 'active' : ''}`}
          disabled={!canAlign}
          title="左对齐"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => setTextAlign('left')}
        >
          <AlignLeft size={15} />
        </button>
        <button
          className={`tool-btn ${text?.textAlign === 'center' || (canAlignCell && textAlign === 'center') ? 'active' : ''}`}
          disabled={!canAlign}
          title="水平居中"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => setTextAlign('center')}
        >
          <AlignCenter size={15} />
        </button>
        <button
          className={`tool-btn ${text?.textAlign === 'right' || (canAlignCell && textAlign === 'right') ? 'active' : ''}`}
          disabled={!canAlign}
          title="右对齐"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => setTextAlign('right')}
        >
          <AlignRight size={15} />
        </button>
        {canAlignCell && (
          <>
            <div className="toolbar-divider" />
            <button
              className={`tool-btn ${verticalAlign === 'top' ? 'active' : ''}`}
              title="顶对齐"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => setVerticalAlign('top')}
            >
              <AlignStartVertical size={15} />
            </button>
            <button
              className={`tool-btn ${verticalAlign === 'middle' ? 'active' : ''}`}
              title="垂直居中"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => setVerticalAlign('middle')}
            >
              <AlignCenterVertical size={15} />
            </button>
            <button
              className={`tool-btn ${verticalAlign === 'bottom' ? 'active' : ''}`}
              title="底对齐"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => setVerticalAlign('bottom')}
            >
              <AlignEndVertical size={15} />
            </button>
          </>
        )}
        <div className="toolbar-divider" />
        <VariableInsertButton
          disabled={!canInsertVariable}
          onInsert={onInsertVariable}
        />
        <button
          className="tool-btn translate-btn"
          title="翻译选中单元格中文为英文（多选时批量翻译各格首行）"
          disabled={!canTranslateCell || translating}
          onMouseDown={(e) => e.preventDefault()}
          onClick={onTranslateCell}
        >
          <Languages size={15} />
          <span className="label">{translating ? '翻译中…' : '翻译 EN'}</span>
        </button>
        <button
          className="tool-btn translate-btn"
          title="去掉选中单元格下方的英文翻译行（支持多选）"
          disabled={!canRemoveTranslation || translating}
          onMouseDown={(e) => e.preventDefault()}
          onClick={onRemoveTranslationCell}
        >
          <Eraser size={15} />
          <span className="label">去翻译</span>
        </button>
        <label className="coord-field">
          X
          <input
            type="number"
            step={0.1}
            disabled={!selected}
            value={selected ? Number(selected.x.toFixed(1)) : 0}
            onChange={(e) => onUpdateSelected({ x: Number(e.target.value) })}
          />
        </label>
        <label className="coord-field">
          Y
          <input
            type="number"
            step={0.1}
            disabled={!selected}
            value={selected ? Number(selected.y.toFixed(1)) : 0}
            onChange={(e) => onUpdateSelected({ y: Number(e.target.value) })}
          />
        </label>
        <label className="coord-field">
          W
          <input
            type="number"
            step={0.1}
            disabled={!selected}
            value={selected ? Number(selected.width.toFixed(1)) : 0}
            onChange={(e) => onUpdateSelected({ width: Number(e.target.value) })}
          />
        </label>
        <label className="coord-field">
          H
          <input
            type="number"
            step={0.1}
            disabled={!selected}
            value={selected ? Number(selected.height.toFixed(1)) : 0}
            onChange={(e) => onUpdateSelected({ height: Number(e.target.value) })}
          />
        </label>
      </div>
    </>
  )
}
