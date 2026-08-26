import { memo, useEffect, useRef } from 'react'
import type { CSSProperties, MouseEvent as ReactMouseEvent } from 'react'
import type {
  BarcodeElement,
  LabelElement,
  LineElement,
  QrcodeElement,
  RectElement,
  ResizeHandle,
  TextElement,
  CellPos,
} from '../types'
import { TableView } from './TableView'
import { BarcodeView } from './BarcodeView'
import { QrcodeView } from './QrcodeView'
import { mmStyle, ptStyle } from '../utils/dpi'

const HANDLES: ResizeHandle[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']

function visibleResizeHandles(type: LabelElement['type']): ResizeHandle[] {
  if (type === 'line') return []
  if (type === 'rect') return HANDLES.filter((h) => h !== 'w' && h !== 'e')
  return HANDLES
}

interface Props {
  element: LabelElement
  selected: boolean
  zIndex: number
  selectedCells: CellPos[]
  editingCell: CellPos | null
  onMouseDown: (e: ReactMouseEvent, id: string) => void
  onResizeStart: (e: ReactMouseEvent, id: string, handle: ResizeHandle) => void
  onRotateStart: (e: ReactMouseEvent, id: string) => void
  onSelectCell: (id: string, pos: CellPos, multi: boolean) => void
  onStartEditCell: (pos: CellPos) => void
  onCommitCellEdit: (
    id: string,
    row: number,
    col: number,
    content: string,
  ) => void
  onCellEditInput: (content: string) => void
  onCancelEditCell: () => void
  onChangeText: (id: string, content: string) => void
  zoom: number
  onTableGridResizeStart: () => void
  onTableColWidth: (id: string, index: number, width: number) => void
  onTableRowHeight: (id: string, index: number, height: number) => void
  onTableResizeColInRows: (
    id: string,
    leftIndex: number,
    leftWidth: number,
    rowStart: number,
    rowEndExclusive: number,
  ) => void
  onTableResizeRowInCols: (
    id: string,
    topIndex: number,
    topHeight: number,
    colStart: number,
    colEndExclusive: number,
  ) => void
  onTableMoveColBoundaryInRows: (
    id: string,
    leftIndex: number,
    leftWidth: number,
    rowStart: number,
    rowEndExclusive: number,
  ) => void
  onTableMoveRowBoundaryInCols: (
    id: string,
    topIndex: number,
    topHeight: number,
    colStart: number,
    colEndExclusive: number,
  ) => void
  onTableMoveStart: (e: ReactMouseEvent, id: string) => void
  onInsertTableRows: (
    id: string,
    row: number,
    count: number,
    where: 'above' | 'below',
  ) => void
  onInsertTableCols: (
    id: string,
    col: number,
    count: number,
    where: 'left' | 'right',
  ) => void
  onDeleteTableRows: (id: string, row: number, count: number) => void
  onDeleteTableCols: (id: string, col: number, count: number) => void
}

function TextView({
  el,
  onChange,
}: {
  el: TextElement
  onChange: (content: string) => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const focusedRef = useRef(false)

  useEffect(() => {
    if (!ref.current || focusedRef.current) return
    if (ref.current.innerText !== el.content) {
      ref.current.innerText = el.content
    }
  }, [el.content, el.id])

  return (
    <div
      ref={ref}
      className="text-el"
      contentEditable
      suppressContentEditableWarning
      style={{
        fontFamily: el.fontFamily,
        fontSize: ptStyle(el.fontSize),
        fontWeight: el.fontWeight,
        fontStyle: el.fontStyle,
        textDecoration: el.textDecoration,
        color: el.color,
        textAlign: el.textAlign,
        letterSpacing: mmStyle(el.letterSpacing),
        lineHeight: el.lineHeight,
      }}
      onFocus={() => {
        focusedRef.current = true
      }}
      onBlur={(e) => {
        focusedRef.current = false
        onChange(e.currentTarget.innerText)
      }}
    />
  )
}
function RectView({ el }: { el: RectElement }) {
  return (
    <div
      className="rect-el"
      style={{
        background: el.fill,
        border: `${mmStyle(el.strokeWidth)} solid ${el.stroke}`,
      }}
    />
  )
}

function LineView({ el }: { el: LineElement }) {
  return (
    <div
      className="line-el"
      style={{ background: el.stroke, height: '100%' }}
    />
  )
}

function BarcodeViewWrapper({ el }: { el: BarcodeElement }) {
  return <BarcodeView element={el} />
}

function QrViewWrapper({ el, zoom }: { el: QrcodeElement; zoom: number }) {
  return <QrcodeView element={el} zoom={zoom} />
}

export const ElementView = memo(function ElementView(props: Props) {
  const { element, selected, zIndex } = props
  const style: CSSProperties = {
    left: mmStyle(element.x),
    top: mmStyle(element.y),
    width: mmStyle(element.width),
    height: mmStyle(
      Math.max(element.height, element.type === 'line' ? 0.3 : 1),
    ),
    transform: element.rotation ? `rotate(${element.rotation}deg)` : undefined,
    transformOrigin:
      element.type === 'rect' || element.type === 'line'
        ? 'center center'
        : undefined,
    cursor: element.locked ? 'not-allowed' : 'move',
    zIndex: selected ? zIndex + 1000 : zIndex,
  }

  const handleMouseDown = (e: ReactMouseEvent) => {
    e.stopPropagation()
    props.onMouseDown(e, element.id)
  }

  return (
    <div
      className={`element ${selected ? 'selected' : ''}`}
      data-element-id={element.id}
      style={style}
      onMouseDown={handleMouseDown}
    >
      {element.type === 'text' && (
        <TextView
          el={element}
          onChange={(content) => props.onChangeText(element.id, content)}
        />
      )}
      {element.type === 'table' && (
        <TableView
          element={element}
          selected={selected}
          selectedCells={props.selectedCells}
          editingCell={props.editingCell}
          zoom={props.zoom}
          onSelectCell={(pos, multi) =>
            props.onSelectCell(element.id, pos, multi)
          }
          onStartEdit={props.onStartEditCell}
          onCommitEdit={(row, col, content) =>
            props.onCommitCellEdit(element.id, row, col, content)
          }
          onEditInput={props.onCellEditInput}
          onCancelEdit={props.onCancelEditCell}
          onGridResizeStart={props.onTableGridResizeStart}
          onGridResizeCol={(index, width) =>
            props.onTableColWidth(element.id, index, width)
          }
          onGridResizeRow={(index, height) =>
            props.onTableRowHeight(element.id, index, height)
          }
          onGridResizeColInRows={(
            leftIndex,
            leftWidth,
            rowStart,
            rowEndExclusive,
          ) =>
            props.onTableResizeColInRows(
              element.id,
              leftIndex,
              leftWidth,
              rowStart,
              rowEndExclusive,
            )
          }
          onGridResizeRowInCols={(
            topIndex,
            topHeight,
            colStart,
            colEndExclusive,
          ) =>
            props.onTableResizeRowInCols(
              element.id,
              topIndex,
              topHeight,
              colStart,
              colEndExclusive,
            )
          }
          onGridMoveColBoundaryInRows={(
            leftIndex,
            leftWidth,
            rowStart,
            rowEndExclusive,
          ) =>
            props.onTableMoveColBoundaryInRows(
              element.id,
              leftIndex,
              leftWidth,
              rowStart,
              rowEndExclusive,
            )
          }
          onGridMoveRowBoundaryInCols={(
            topIndex,
            topHeight,
            colStart,
            colEndExclusive,
          ) =>
            props.onTableMoveRowBoundaryInCols(
              element.id,
              topIndex,
              topHeight,
              colStart,
              colEndExclusive,
            )
          }
          onTableMoveStart={(e) => props.onTableMoveStart(e, element.id)}
          onInsertRows={(row, count, where) =>
            props.onInsertTableRows(element.id, row, count, where)
          }
          onInsertCols={(col, count, where) =>
            props.onInsertTableCols(element.id, col, count, where)
          }
          onDeleteRows={(row, count) =>
            props.onDeleteTableRows(element.id, row, count)
          }
          onDeleteCols={(col, count) =>
            props.onDeleteTableCols(element.id, col, count)
          }
        />
      )}
      {element.type === 'rect' && <RectView el={element} />}
      {element.type === 'line' && <LineView el={element} />}
      {element.type === 'barcode' && <BarcodeViewWrapper el={element} />}
      {element.type === 'qrcode' && (
        <QrViewWrapper el={element} zoom={props.zoom} />
      )}

      {selected && !element.locked && (
        <div className="element-handles">
          <div className="element-frame" />
          {visibleResizeHandles(element.type).map((h) => (
            <div
              key={h}
              className={`handle ${h}`}
              onMouseDown={(e) => props.onResizeStart(e, element.id, h)}
            />
          ))}
          {(element.type === 'rect' || element.type === 'line') && (
            <>
              <div
                className="handle rotate-end rotate-w"
                title="拖动旋转"
                onMouseDown={(e) => props.onRotateStart(e, element.id)}
              />
              <div
                className="handle rotate-end rotate-e"
                title="拖动旋转"
                onMouseDown={(e) => props.onRotateStart(e, element.id)}
              />
            </>
          )}
        </div>
      )}
    </div>
  )
})
