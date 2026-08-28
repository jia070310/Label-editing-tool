import { useEffect, useRef } from 'react'
import type { MouseEvent as ReactMouseEvent } from 'react'
import type { CellPos, LabelElement, LabelSettings, ResizeHandle } from '../types'
import { mmStyle, mmToPx } from '../utils/dpi'
import { ElementView } from './ElementView'

const EMPTY_CELLS: CellPos[] = []

const noop = () => {}
const noopMouse = (_e: ReactMouseEvent, _id: string) => {}
const noopResize = (
  _e: ReactMouseEvent,
  _id: string,
  _handle: ResizeHandle,
) => {}
const noopRotate = (_e: ReactMouseEvent, _id: string) => {}
const noopSelect = (_id: string, _pos: CellPos, _multi: boolean) => {}
const noopCommit = (
  _id: string,
  _row: number,
  _col: number,
  _content: string,
) => {}
const noopText = (_a: string, _b?: string) => {}
const noopGrid = (_id: string, _index: number, _value: number) => {}
const noopResizeColInRows = (
  _id: string,
  _leftIndex: number,
  _leftWidth: number,
  _rowStart: number,
  _rowEndExclusive: number,
) => {}
const noopResizeRowInCols = (
  _id: string,
  _topIndex: number,
  _topHeight: number,
  _colStart: number,
  _colEndExclusive: number,
) => {}
const noopResizeTopEdgeInCols = (
  _id: string,
  _topHeight: number,
  _colStart: number,
  _colEndExclusive: number,
) => {}
const noopMoveColBoundaryInRows = (
  _id: string,
  _leftIndex: number,
  _leftWidth: number,
  _rowStart: number,
  _rowEndExclusive: number,
) => {}
const noopMoveRowBoundaryInCols = (
  _id: string,
  _topIndex: number,
  _topHeight: number,
  _colStart: number,
  _colEndExclusive: number,
) => {}
const noopMove = (_e: ReactMouseEvent, _id: string) => {}
const noopInsertRows = (
  _id: string,
  _row: number,
  _count: number,
  _where: 'above' | 'below',
) => {}
const noopInsertCols = (
  _id: string,
  _col: number,
  _count: number,
  _where: 'left' | 'right',
) => {}
const noopDeleteRows = (_id: string, _row: number, _count: number) => {}
const noopDeleteCols = (_id: string, _col: number, _count: number) => {}

interface Props {
  elements: LabelElement[]
  settings: LabelSettings
  onMounted?: (sheet: HTMLElement) => void
}

export function LabelSheetStatic({ elements, settings, onMounted }: Props) {
  const sheetRef = useRef<HTMLDivElement>(null)

  const sheetRadius =
    settings.shape === 'circle'
      ? '50%'
      : settings.shape === 'round-rect'
        ? mmStyle(3)
        : '0'

  useEffect(() => {
    if (sheetRef.current) onMounted?.(sheetRef.current)
  }, [elements, settings, onMounted])

  return (
    <div
      ref={sheetRef}
      className="label-sheet label-sheet-static"
      style={{
        width: mmToPx(settings.width),
        height: mmToPx(settings.height),
        borderRadius: sheetRadius,
      }}
    >
      {elements.map((el, index) => (
        <ElementView
          key={el.id}
          element={el}
          zIndex={index + 1}
          selected={false}
          selectedCells={EMPTY_CELLS}
          editingCell={null}
          zoom={1}
          onMouseDown={noopMouse}
          onResizeStart={noopResize}
          onRotateStart={noopRotate}
          onSelectCell={noopSelect}
          onStartEditCell={noop}
          onCommitCellEdit={noopCommit}
          onCellEditInput={noopText}
          onCancelEditCell={noop}
          onChangeText={noopText}
          onTableGridResizeStart={noop}
          onTableColWidth={noopGrid}
          onTableRowHeight={noopGrid}
          onTableResizeColInRows={noopResizeColInRows}
          onTableResizeRowInCols={noopResizeRowInCols}
          onTableResizeTopEdgeInCols={noopResizeTopEdgeInCols}
          onTableMoveColBoundaryInRows={noopMoveColBoundaryInRows}
          onTableMoveRowBoundaryInCols={noopMoveRowBoundaryInCols}
          onTableMoveStart={noopMove}
          onInsertTableRows={noopInsertRows}
          onInsertTableCols={noopInsertCols}
          onDeleteTableRows={noopDeleteRows}
          onDeleteTableCols={noopDeleteCols}
        />
      ))}
    </div>
  )
}
