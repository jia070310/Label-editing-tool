import type {
  BarcodeFormat,
  CellPos,
  LabelElement,
  QrErrorCorrection,
  TableCell,
  TableElement,
} from '../types'
import { canMerge, canSplit } from '../utils/table'
import { hasTextDecoration, toggleTextDecoration } from '../utils/textStyle'
import { normalizeRotation, rotateElementBy90 } from '../utils/rotate'
import { NumericDraftInput } from './NumericDraftInput'

interface Props {
  selected: LabelElement | null
  selectedCells: CellPos[]
  onUpdate: (patch: Partial<LabelElement>, record?: boolean) => void
  onUpdateCommit?: () => void
  onMerge: () => void
  onSplit: () => void
  onSetRows: (n: number) => void
  onSetCols: (n: number) => void
  onSetRowHeight: (index: number, h: number) => void
  onSetColWidth: (index: number, w: number) => void
  onUpdateCellStyle: (patch: Record<string, unknown>) => void
  onUpdateCellContent: (content: string, record?: boolean) => void
  onUpdateCellCommit?: () => void
  onTranslateCell: () => void
  onRemoveTranslationCell: () => void
  canRemoveTranslation: boolean
  translating: boolean
  onSetTableFontSize: (size: number) => void
}

export function RightPanel({
  selected,
  selectedCells,
  onUpdate,
  onUpdateCommit,
  onMerge,
  onSplit,
  onSetRows,
  onSetCols,
  onSetRowHeight,
  onSetColWidth,
  onUpdateCellStyle,
  onUpdateCellContent,
  onUpdateCellCommit,
  onTranslateCell,
  onRemoveTranslationCell,
  canRemoveTranslation,
  translating,
  onSetTableFontSize,
}: Props) {
  if (!selected) {
    return (
      <aside className="right-panel">
        <div className="panel-tabs">
          <button className="active">属性</button>
        </div>
        <div className="panel-body">
          <div className="empty-hint">选择画布上的元素以编辑属性</div>
        </div>
      </aside>
    )
  }

  if (selected.type === 'table') {
    const table = selected as TableElement
    const safeCells = selectedCells.filter(
      (p) =>
        p.row >= 0 &&
        p.col >= 0 &&
        p.row < table.rows &&
        p.col < table.cols &&
        !!table.cells[p.row]?.[p.col],
    )
    const activeCell =
      safeCells.length > 0
        ? table.cells[safeCells[0].row][safeCells[0].col]
        : null
    const splitPos = safeCells[0]
    const mergeEnabled = canMerge(table, safeCells)
    const splitEnabled = splitPos ? canSplit(table, splitPos) : false

    return (
      <aside className="right-panel">
        <div className="panel-tabs">
          <button className="active">属性</button>
        </div>
        <div className="panel-body">
          <div className="panel-section">
            <h4>单元格操作</h4>
            <div className="btn-pair">
              <button disabled={!mergeEnabled} onClick={onMerge}>
                合并单元格
              </button>
              <button disabled={!splitEnabled} onClick={onSplit}>
                拆分单元格
              </button>
            </div>
            <p className="hint">按住 Ctrl 多选单元格后可合并</p>
          </div>

          <div className="panel-section">
            <h4>边框</h4>
            <div className="panel-row">
              <label>线宽 (mm)</label>
              <input
                type="number"
                step={0.05}
                min={0}
                max={5}
                value={table.borderWidth}
                onChange={(e) => {
                  const v = parseFloat(e.target.value)
                  if (!Number.isFinite(v) || v < 0) return
                  onUpdate({ borderWidth: Math.round(v * 100) / 100 })
                }}
              />
            </div>
            <div className="panel-row">
              <label>颜色</label>
              <input
                type="color"
                value={table.borderColor}
                onChange={(e) => onUpdate({ borderColor: e.target.value })}
              />
            </div>
          </div>

          <div className="panel-section">
            <h4>表格结构</h4>
            <div className="panel-row">
              <label>行数</label>
              <div className="counter">
                <button
                  disabled={table.rows <= 1}
                  onClick={() => onSetRows(table.rows - 1)}
                >
                  −
                </button>
                <span>{table.rows}</span>
                <button
                  disabled={table.rows >= 40}
                  onClick={() => onSetRows(table.rows + 1)}
                >
                  +
                </button>
              </div>
            </div>
            <div className="panel-row">
              <label>列数</label>
              <div className="counter">
                <button
                  disabled={table.cols <= 1}
                  onClick={() => onSetCols(table.cols - 1)}
                >
                  −
                </button>
                <span>{table.cols}</span>
                <button
                  disabled={table.cols >= 20}
                  onClick={() => onSetCols(table.cols + 1)}
                >
                  +
                </button>
              </div>
            </div>
            <p className="hint">最多 40 行 × 20 列。改行列后无效选区会自动清除。</p>
          </div>

          <div className="panel-section">
            <h4>字体</h4>
            <div className="panel-row">
              <label>字体</label>
              <select
                value={table.fontFamily}
                onChange={(e) => onUpdate({ fontFamily: e.target.value })}
              >
                <option value='SimHei, "Microsoft YaHei", sans-serif'>黑体</option>
                <option value='"SimSun", serif'>宋体</option>
                <option value='"Microsoft YaHei", sans-serif'>微软雅黑</option>
                <option value="Arial, sans-serif">Arial</option>
              </select>
            </div>
            <div className="panel-row">
              <label>字号 (pt)</label>
              <input
                type="number"
                min={6}
                max={72}
                value={
                  activeCell?.fontSize ?? table.cells[0]?.[0]?.fontSize ?? 9
                }
                onChange={(e) => {
                  const size = Number(e.target.value)
                  if (Number.isFinite(size)) onSetTableFontSize(size)
                }}
              />
            </div>
            {safeCells.length > 1 ? (
              <p className="hint">
                字号将应用到已选的 {safeCells.length} 个单元格
              </p>
            ) : safeCells.length === 0 ? (
              <p className="hint">未选单元格时，字号应用到整张表</p>
            ) : null}
            <div className="panel-row panel-row-top">
              <label>样式</label>
              <div className="font-style-group">
                {(() => {
                  const sample = activeCell ?? table.cells[0]?.[0]
                  const weight = sample?.fontWeight ?? 'normal'
                  const style = sample?.fontStyle ?? 'normal'
                  const deco = sample?.textDecoration ?? 'none'
                  const color = sample?.color ?? '#111111'
                  return (
                    <>
                      <button
                        type="button"
                        className={weight === 'bold' ? 'active' : undefined}
                        onClick={() =>
                          onUpdateCellStyle({
                            fontWeight: weight === 'bold' ? 'normal' : 'bold',
                          })
                        }
                      >
                        加粗
                      </button>
                      <button
                        type="button"
                        className={style === 'italic' ? 'active' : undefined}
                        onClick={() =>
                          onUpdateCellStyle({
                            fontStyle: style === 'italic' ? 'normal' : 'italic',
                          })
                        }
                      >
                        斜体
                      </button>
                      <button
                        type="button"
                        className={
                          hasTextDecoration(deco, 'underline') ? 'active' : undefined
                        }
                        onClick={() =>
                          onUpdateCellStyle({
                            textDecoration: toggleTextDecoration(deco, 'underline'),
                          })
                        }
                      >
                        下划线
                      </button>
                      <button
                        type="button"
                        className={
                          hasTextDecoration(deco, 'line-through')
                            ? 'active'
                            : undefined
                        }
                        onClick={() =>
                          onUpdateCellStyle({
                            textDecoration: toggleTextDecoration(
                              deco,
                              'line-through',
                            ),
                          })
                        }
                      >
                        删除线
                      </button>
                      <input
                        type="color"
                        value={color}
                        title="文字颜色"
                        onChange={(e) =>
                          onUpdateCellStyle({ color: e.target.value })
                        }
                      />
                    </>
                  )
                })()}
              </div>
            </div>
            <p className="hint">
              也可使用顶部格式栏的 B / I / U 按钮；未选单元格时样式应用到整张表
            </p>
          </div>

          {activeCell && safeCells.length >= 1 && (
              <div className="panel-section">
                <h4>对齐</h4>
                <div className="align-btn-group">
                  <span className="align-group-label">水平</span>
                  {(
                    [
                      ['left', '左'],
                      ['center', '中'],
                      ['right', '右'],
                    ] as const
                  ).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      className={
                        activeCell.textAlign === value ? 'active' : undefined
                      }
                      onClick={() => onUpdateCellStyle({ textAlign: value })}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <div className="align-btn-group">
                  <span className="align-group-label">垂直</span>
                  {(
                    [
                      ['top', '顶'],
                      ['middle', '中'],
                      ['bottom', '底'],
                    ] as const
                  ).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      className={
                        activeCell.verticalAlign === value ? 'active' : undefined
                      }
                      onClick={() =>
                        onUpdateCellStyle({
                          verticalAlign: value as TableCell['verticalAlign'],
                        })
                      }
                    >
                      {label}
                    </button>
                  ))}
                </div>
                {safeCells.length > 1 && (
                  <p className="hint">已选 {safeCells.length} 个单元格，对齐将批量应用</p>
                )}
              </div>
          )}

          {activeCell && safeCells.length === 1 && (
            <div className="panel-section">
              <h4>单元格文字</h4>
              <textarea
                className="cell-content-input"
                value={activeCell.content}
                placeholder="输入中文，点击下方翻译"
                onChange={(e) => onUpdateCellContent(e.target.value, false)}
                onBlur={() => onUpdateCellCommit?.()}
              />
              <div className="translate-btn-row">
                <button
                  className="translate-cell-btn"
                  disabled={translating}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={onTranslateCell}
                >
                  {translating ? '翻译中…' : '翻译为英文'}
                </button>
                <button
                  className="translate-cell-btn secondary"
                  disabled={!canRemoveTranslation || translating}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={onRemoveTranslationCell}
                >
                  去掉翻译
                </button>
              </div>
              <p className="hint">
                中文在上、英文在下显示。可先在单元格中选中部分文字再翻译。
              </p>
            </div>
          )}

          {safeCells.length > 1 && (
            <div className="panel-section">
              <h4>批量翻译</h4>
              <div className="translate-btn-row">
                <button
                  className="translate-cell-btn"
                  disabled={translating}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={onTranslateCell}
                >
                  {translating
                    ? '翻译中…'
                    : `翻译已选 ${safeCells.length} 格`}
                </button>
                <button
                  className="translate-cell-btn secondary"
                  disabled={!canRemoveTranslation || translating}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={onRemoveTranslationCell}
                >
                  去掉翻译
                </button>
              </div>
              <p className="hint">
                将对每个已选单元格的首行中文翻译为英文；「去掉翻译」会批量清除英文行。
              </p>
            </div>
          )}

          {safeCells.length >= 1 && (
            <div className="panel-section">
              <h4>单元格样式</h4>
              <div className="panel-row">
                <label>背景</label>
                <input
                  type="color"
                  onChange={(e) =>
                    onUpdateCellStyle({ backgroundColor: e.target.value })
                  }
                />
              </div>
            </div>
          )}

          <div className="panel-section">
            <h4>行高设置 (mm)</h4>
            <div className="row-height-list">
              {table.rowHeights.map((h, i) => (
                <div className="row-height-item" key={i}>
                  <span>行 {i + 1}</span>
                  <NumericDraftInput
                    value={h}
                    min={2}
                    onCommit={(n) => onSetRowHeight(i, n)}
                  />
                  <span>mm</span>
                </div>
              ))}
            </div>
          </div>

          <div className="panel-section">
            <h4>列宽设置 (mm)</h4>
            <div className="row-height-list">
              {table.colWidths.map((w, i) => (
                <div className="row-height-item" key={i}>
                  <span>列 {i + 1}</span>
                  <NumericDraftInput
                    value={w}
                    min={4}
                    onCommit={(n) => onSetColWidth(i, n)}
                  />
                  <span>mm</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </aside>
    )
  }

  return (
    <aside className="right-panel">
      <div className="panel-tabs">
        <button className="active">属性</button>
      </div>
      <div className="panel-body">
        <div className="panel-section">
          <h4>位置与尺寸</h4>
          {(['x', 'y', 'width', 'height'] as const).map((key) => (
            <div className="panel-row" key={key}>
              <label>{key.toUpperCase()} (mm)</label>
              <NumericDraftInput
                value={selected[key]}
                decimals={1}
                min={key === 'width' || key === 'height' ? 1 : 0}
                onCommit={(n) => {
                  onUpdate({ [key]: n }, false)
                  onUpdateCommit?.()
                }}
              />
            </div>
          ))}
        </div>
        {(selected.type === 'rect' || selected.type === 'line') && (
          <div className="panel-section">
            <h4>旋转</h4>
            <div className="panel-row">
              <label>角度 (°)</label>
              <NumericDraftInput
                value={selected.rotation}
                decimals={0}
                min={0}
                max={359}
                onCommit={(n) => {
                  onUpdate({ rotation: normalizeRotation(n) }, false)
                  onUpdateCommit?.()
                }}
              />
            </div>
            <div className="panel-row">
              <label>快捷</label>
              <button
                type="button"
                className="panel-btn"
                onClick={() => {
                  onUpdate(rotateElementBy90(selected))
                  onUpdateCommit?.()
                }}
              >
                顺时针 90°
              </button>
            </div>
            <p className="hint">也可拖动两端的旋转手柄调整角度。</p>
          </div>
        )}
        {selected.type === 'text' && (
          <div className="panel-section">
            <h4>文本内容</h4>
            <textarea
              style={{
                width: '100%',
                minHeight: 80,
                border: '1px solid var(--border)',
                borderRadius: 6,
                padding: 8,
                resize: 'vertical',
              }}
              value={selected.content}
              onChange={(e) => onUpdate({ content: e.target.value }, false)}
              onBlur={() => onUpdateCommit?.()}
            />
            <p className="hint">
              可用 {'{{品名}}'} 等变量；顶部「变量」可插入。文本、表格、条码均支持，再点「批量」导入 CSV。
            </p>
          </div>
        )}
        {(selected.type === 'barcode' || selected.type === 'qrcode') && (
          <div className="panel-section">
            <h4>内容</h4>
            <div className="panel-row">
              <label>数值</label>
              <input
                type="text"
                value={selected.value}
                onChange={(e) => onUpdate({ value: e.target.value }, false)}
                onBlur={() => onUpdateCommit?.()}
              />
            </div>
            <p className="hint">
              可填 {'{{品名}}'} 等变量，顶部「变量」可插入；配合「批量」打印。
            </p>
            {selected.type === 'barcode' && (
              <>
                <div className="panel-row">
                  <label>格式</label>
                  <select
                    value={selected.format ?? 'CODE128'}
                    onChange={(e) =>
                      onUpdate({
                        format: e.target.value as BarcodeFormat,
                      })
                    }
                  >
                    <option value="CODE128">CODE128（通用）</option>
                    <option value="EAN13">EAN-13（商品条码）</option>
                    <option value="EAN8">EAN-8</option>
                    <option value="UPC">UPC-A</option>
                    <option value="CODE39">CODE39</option>
                  </select>
                </div>
                <div className="panel-row">
                  <label>显示文字</label>
                  <input
                    type="checkbox"
                    checked={selected.showText}
                    onChange={(e) => onUpdate({ showText: e.target.checked })}
                  />
                </div>
              </>
            )}
            {selected.type === 'qrcode' && (
              <div className="panel-row">
                <label>纠错级别</label>
                <select
                  value={selected.errorCorrection ?? 'M'}
                  onChange={(e) =>
                    onUpdate({
                      errorCorrection: e.target.value as QrErrorCorrection,
                    })
                  }
                >
                  <option value="L">L（7%）</option>
                  <option value="M">M（15%）</option>
                  <option value="Q">Q（25%）</option>
                  <option value="H">H（30%）</option>
                </select>
              </div>
            )}
          </div>
        )}
      </div>
    </aside>
  )
}
