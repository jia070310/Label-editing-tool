import { useEffect, useMemo, useRef, useState } from 'react'
import { FileUp, Loader2, Printer, X } from 'lucide-react'
import type { LabelElement, LabelSettings } from '../types'
import { parseCsvText } from '../utils/csv'
import { DEFAULT_PRINT_DPI } from '../utils/print'
import {
  buildSampleCsv,
  extractVariablesFromElements,
  type DataRow,
} from '../utils/variables'
import {
  captureLabelFromElements,
  printBatchLabels,
} from '../utils/renderLabel'
import { isElectronApp } from '../utils/electron'
import { translateZhToEn } from '../utils/translate'
import {
  buildRowSources,
  collectUniqueSources,
  countReadyRows,
  findTranslationSlots,
  formatTranslationsFromSources,
  orderSourcesForPreview,
  prepareBatchElements,
  printReadyRequirement,
  rowStatusFromSources,
} from '../utils/batchTranslate'

/** UI 刷新间隔：翻译过程中合并更新，减少跳动 */
const UI_FLUSH_MS = 1200
/** 预览仅在「当前行译完 / 全部译完 / 切行」时刷新 */

interface Props {
  open: boolean
  elements: LabelElement[]
  settings: LabelSettings
  onClose: () => void
}

interface PrinterInfo {
  name: string
  displayName?: string
  isDefault?: boolean
}

export function BatchPrintDialog({
  open,
  elements,
  settings,
  onClose,
}: Props) {
  const [csvText, setCsvText] = useState('')
  const [rows, setRows] = useState<DataRow[]>([])
  const [headers, setHeaders] = useState<string[]>([])
  const [previewIndex, setPreviewIndex] = useState(0)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [loadingPreview, setLoadingPreview] = useState(false)
  const [printing, setPrinting] = useState(false)
  const [progress, setProgress] = useState({ current: 0, total: 0 })
  const [error, setError] = useState('')
  const [dpi, setDpi] = useState(DEFAULT_PRINT_DPI)
  const [printers, setPrinters] = useState<PrinterInfo[]>([])
  const [deviceName, setDeviceName] = useState('')
  const [autoTranslate, setAutoTranslate] = useState(true)
  /** 展示用缓存（低频刷新） */
  const [translationCache, setTranslationCache] = useState<
    Record<string, string>
  >({})
  const [failedSources, setFailedSources] = useState<string[]>([])
  const [translateProgress, setTranslateProgress] = useState({
    done: 0,
    total: 0,
  })
  const [translating, setTranslating] = useState(false)
  /** 用于触发当前预览行译完后刷新预览 */
  const [previewReadyTick, setPreviewReadyTick] = useState(0)

  const fileRef = useRef<HTMLInputElement>(null)
  const translateGenRef = useRef(0)
  /** 实时完整缓存（翻译循环写入，不直接驱动 React） */
  const liveCacheRef = useRef<Record<string, string>>({})
  const failedRef = useRef<Set<string>>(new Set())
  const flushTimerRef = useRef<number | null>(null)
  const progressTimerRef = useRef<number | null>(null)
  const bodyScrollRef = useRef<HTMLDivElement>(null)
  const previewHardKeyRef = useRef('')
  const previewReadyKeyRef = useRef('')
  const previewIndexRef = useRef(previewIndex)
  previewIndexRef.current = previewIndex
  const desktop = isElectronApp()

  const templateVars = useMemo(
    () => extractVariablesFromElements(elements),
    [elements],
  )

  const translationSlots = useMemo(
    () => findTranslationSlots(elements),
    [elements],
  )

  const needsTranslate = autoTranslate && translationSlots.length > 0

  const rowSources = useMemo(() => {
    if (!needsTranslate) return rows.map(() => [] as string[])
    return buildRowSources(elements, translationSlots, rows)
  }, [needsTranslate, elements, translationSlots, rows])

  const failedSet = useMemo(() => new Set(failedSources), [failedSources])

  const readyRowCount = useMemo(() => {
    if (!needsTranslate) return rows.length
    return countReadyRows(rowSources, translationCache, failedSet)
  }, [needsTranslate, rows.length, rowSources, translationCache, failedSet])

  const requiredReady = printReadyRequirement(rows.length)
  const canPrintByTranslate = !needsTranslate || readyRowCount >= requiredReady

  const restoreScroll = () => {
    const top = bodyScrollRef.current?.scrollTop ?? 0
    requestAnimationFrame(() => {
      if (bodyScrollRef.current) bodyScrollRef.current.scrollTop = top
    })
  }

  const publishUiFromLive = () => {
    const scrollTop = bodyScrollRef.current?.scrollTop ?? 0
    setTranslationCache({ ...liveCacheRef.current })
    setFailedSources([...failedRef.current])
    requestAnimationFrame(() => {
      if (bodyScrollRef.current) bodyScrollRef.current.scrollTop = scrollTop
    })
  }

  const scheduleUiFlush = () => {
    if (flushTimerRef.current != null) return
    flushTimerRef.current = window.setTimeout(() => {
      flushTimerRef.current = null
      publishUiFromLive()
    }, UI_FLUSH_MS)
  }

  const scheduleProgress = (done: number, total: number) => {
    if (progressTimerRef.current != null) return
    progressTimerRef.current = window.setTimeout(() => {
      progressTimerRef.current = null
      setTranslateProgress({ done, total })
    }, 400)
  }

  useEffect(() => {
    if (!open) return
    setError('')
    setPreviewIndex(0)
    if (!csvText.trim()) {
      setCsvText(buildSampleCsv(templateVars))
    }
  }, [open, templateVars])

  useEffect(() => {
    if (!open) return
    const parsed = parseCsvText(csvText)
    setHeaders(parsed.headers)
    setRows(parsed.rows)
    setPreviewIndex(0)
  }, [csvText, open])

  useEffect(() => {
    if (!open || !desktop) return
    window.electronAPI
      ?.getPrinters()
      .then((list) => {
        const arr = (list || []) as PrinterInfo[]
        setPrinters(arr)
        const def = arr.find((p) => p.isDefault) || arr[0]
        if (def) setDeviceName(def.name)
      })
      .catch(() => setPrinters([]))
  }, [open, desktop])

  // 后台预翻译：结果先进 liveCache，UI 低频刷新
  useEffect(() => {
    if (!open || !needsTranslate || rows.length === 0) {
      setTranslating(false)
      setTranslateProgress({ done: 0, total: 0 })
      return
    }

    const gen = ++translateGenRef.current
    liveCacheRef.current = {}
    failedRef.current = new Set()
    previewReadyKeyRef.current = ''
    setTranslationCache({})
    setFailedSources([])

    const allSources = collectUniqueSources(elements, translationSlots, rows)
    const previewSources =
      rowSources[Math.min(previewIndex, Math.max(rows.length - 1, 0))] ?? []
    const sources = orderSourcesForPreview(allSources, previewSources)

    setTranslateProgress({ done: 0, total: sources.length })
    if (sources.length === 0) {
      setTranslating(false)
      return
    }

    let cancelled = false
    setTranslating(true)

    ;(async () => {
      let done = 0
      for (const source of sources) {
        if (cancelled || translateGenRef.current !== gen) return
        try {
          const en = await translateZhToEn(source)
          if (cancelled || translateGenRef.current !== gen) return
          liveCacheRef.current[source] = en
          failedRef.current.delete(source)
        } catch {
          if (cancelled || translateGenRef.current !== gen) return
          failedRef.current.add(source)
        }
        done += 1
        scheduleProgress(done, sources.length)
        scheduleUiFlush()

        // 当前预览行译完 → 立刻刷新一次 UI + 触发预览
        const idx = Math.min(previewIndexRef.current, rows.length - 1)
        const previewSrcs = rowSources[idx] ?? []
        const readyKey = `${gen}:${idx}`
        if (
          previewReadyKeyRef.current !== readyKey &&
          previewSrcs.length > 0 &&
          rowStatusFromSources(
            previewSrcs,
            liveCacheRef.current,
            failedRef.current,
          ) === 'ready'
        ) {
          previewReadyKeyRef.current = readyKey
          if (flushTimerRef.current != null) {
            window.clearTimeout(flushTimerRef.current)
            flushTimerRef.current = null
          }
          publishUiFromLive()
          setPreviewReadyTick((n) => n + 1)
        }

        // 让出主线程，避免卡 UI
        await new Promise<void>((r) => {
          if (typeof requestIdleCallback === 'function') {
            requestIdleCallback(() => r(), { timeout: 120 })
          } else {
            setTimeout(r, 40)
          }
        })
      }

      if (!cancelled && translateGenRef.current === gen) {
        if (flushTimerRef.current != null) {
          window.clearTimeout(flushTimerRef.current)
          flushTimerRef.current = null
        }
        if (progressTimerRef.current != null) {
          window.clearTimeout(progressTimerRef.current)
          progressTimerRef.current = null
        }
        publishUiFromLive()
        setTranslateProgress({ done: sources.length, total: sources.length })
        setTranslating(false)
        setPreviewReadyTick((n) => n + 1)
      }
    })()

    return () => {
      cancelled = true
      if (flushTimerRef.current != null) {
        window.clearTimeout(flushTimerRef.current)
        flushTimerRef.current = null
      }
      if (progressTimerRef.current != null) {
        window.clearTimeout(progressTimerRef.current)
        progressTimerRef.current = null
      }
    }
    // previewIndex 变化不重启整批翻译；仅启动时按当时预览行排序
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, needsTranslate, rows, elements, translationSlots, rowSources])

  // 预览：切行 / DPI / 数据变化立即刷；翻译中仅在「当前行就绪或全部完成」时刷
  useEffect(() => {
    if (!open || rows.length === 0) {
      setPreviewUrl(null)
      setLoadingPreview(false)
      return
    }

    const hardKey = `${previewIndex}:${dpi}:${rows.length}:${needsTranslate}`
    const hardChange = previewHardKeyRef.current !== hardKey
    previewHardKeyRef.current = hardKey

    const idx = Math.min(previewIndex, rows.length - 1)
    const previewSrcs = rowSources[idx] ?? []
    const rowReady =
      !needsTranslate ||
      rowStatusFromSources(previewSrcs, translationCache, failedSet) ===
        'ready'

    // 翻译进行中：只在换行/DPI 或「当前行刚译完 / 全部结束」时刷新预览
    // 避免缓存每 1.2s 刷新时反复跑 html2canvas
    if (needsTranslate && translating && !hardChange) {
      // previewReadyTick 变化时允许进入；用 ref 记录上次已处理的 tick
      // 这里靠 hardChange=false + 下面逻辑：仅当当前行已就绪时刷新
      if (!rowReady) return
    }

    let cancelled = false
    let idleId: number | null = null
    let timeoutId: number | null = null

    if (hardChange) setLoadingPreview(true)

    const cacheForPreview =
      needsTranslate && translating ? liveCacheRef.current : translationCache

    const merged = prepareBatchElements(
      elements,
      rows[idx],
      needsTranslate ? translationSlots : [],
      cacheForPreview,
    )

    const run = () => {
      if (cancelled) return
      captureLabelFromElements(merged, settings, dpi)
        .then((url) => {
          if (!cancelled) {
            setPreviewUrl(url)
            restoreScroll()
          }
        })
        .catch(() => {
          if (!cancelled) setError('生成预览失败')
        })
        .finally(() => {
          if (!cancelled) setLoadingPreview(false)
        })
    }

    // 把昂贵的 html2canvas 放到空闲帧，避免跟翻译抢主线程
    const raf = requestAnimationFrame(() => {
      if (typeof requestIdleCallback === 'function') {
        idleId = requestIdleCallback(run, { timeout: 400 })
      } else {
        timeoutId = window.setTimeout(run, 0)
      }
    })

    return () => {
      cancelled = true
      cancelAnimationFrame(raf)
      if (idleId != null && typeof cancelIdleCallback === 'function') {
        cancelIdleCallback(idleId)
      }
      if (timeoutId != null) window.clearTimeout(timeoutId)
    }
  }, [
    open,
    rows,
    previewIndex,
    elements,
    settings,
    dpi,
    needsTranslate,
    translationSlots,
    translating,
    previewReadyTick,
    // 翻译结束后才跟 translationCache；翻译中靠 previewReadyTick
    translating ? null : translationCache,
    rowSources,
    failedSet,
  ])

  if (!open) return null

  const handleFile = (file: File) => {
    const reader = new FileReader()
    reader.onload = () => {
      setCsvText(String(reader.result ?? ''))
      setError('')
    }
    reader.onerror = () => setError('读取文件失败')
    reader.readAsText(file, 'UTF-8')
  }

  const downloadSample = () => {
    const blob = new Blob([buildSampleCsv(templateVars)], {
      type: 'text/csv;charset=utf-8',
    })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = '标签数据模板.csv'
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const doBatchPrint = async () => {
    if (rows.length === 0 || printing) return
    if (!desktop) {
      setError('批量打印请使用桌面版（npm run desktop）')
      return
    }
    if (!canPrintByTranslate) {
      setError(
        `请等待翻译完成至少 ${requiredReady} 条后再打印（当前 ${readyRowCount}/${requiredReady}）`,
      )
      return
    }
    // 打印用最新 live 缓存，避免刚译完 UI 还没刷完
    const printCache = { ...liveCacheRef.current, ...translationCache }
    setPrinting(true)
    setError('')
    setProgress({ current: 0, total: rows.length })
    try {
      await printBatchLabels(elements, settings, rows, {
        dpi,
        deviceName: deviceName || undefined,
        silent: true,
        onProgress: (current, total) => setProgress({ current, total }),
        prepareElements: (template, row) =>
          prepareBatchElements(
            template,
            row,
            needsTranslate ? translationSlots : [],
            printCache,
          ),
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : '批量打印失败')
    } finally {
      setPrinting(false)
    }
  }

  const visibleRows = rows.slice(0, 8)

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-card batch-print-dialog"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h2>批量打印 · 变量数据</h2>
          <button className="modal-close" onClick={onClose} aria-label="关闭">
            <X size={18} />
          </button>
        </div>

        <div className="modal-body batch-print-body" ref={bodyScrollRef}>
          <div className="batch-print-help">
            <p>
              在标签文本、表格单元格、条码/二维码中使用 <code>{'{{字段名}}'}</code>{' '}
              作为变量，然后导入 CSV 表格批量生成。
            </p>
            {templateVars.length > 0 ? (
              <p className="batch-vars">
                模板变量：
                {templateVars.map((v) => (
                  <code key={v}>{'{{' + v + '}}'}</code>
                ))}
              </p>
            ) : (
              <p className="hint">
                当前模板未检测到变量。示例：品名：{'{{品名}}'}、条码值 {'{{条码}}'}
              </p>
            )}
            {translationSlots.length > 0 ? (
              <p className="hint">
                检测到 {translationSlots.length} 处「中英双行」内容，启用自动翻译后会按每行数据后台翻译，打印时直接带入。
              </p>
            ) : (
              <p className="hint">
                模板中暂无翻译行。请先在编辑器里对单元格点「翻译 EN」，批量打印才会自动更新英文。
              </p>
            )}
          </div>

          <div className="batch-print-toolbar">
            <button type="button" className="btn-secondary" onClick={downloadSample}>
              下载 CSV 模板
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => fileRef.current?.click()}
            >
              <FileUp size={14} />
              导入 CSV/TXT
            </button>
            <label className="batch-translate-toggle">
              <input
                type="checkbox"
                checked={autoTranslate}
                disabled={translationSlots.length === 0}
                onChange={(e) => setAutoTranslate(e.target.checked)}
              />
              自动翻译英文
            </label>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,.txt,.tsv,text/csv,text/plain"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) handleFile(f)
                e.target.value = ''
              }}
            />
          </div>

          <textarea
            className="batch-csv-input"
            value={csvText}
            placeholder="粘贴 CSV 数据，第一行为表头&#10;品名,规格,条码&#10;商品A,100cm,123456789012"
            onChange={(e) => setCsvText(e.target.value)}
          />

          {rows.length > 0 && (
            <div className="batch-data-preview">
              <div className="batch-data-header">
                <span>
                  共 {rows.length} 条数据
                  {needsTranslate && (
                    <>
                      {' · '}
                      翻译 {readyRowCount}/{rows.length} 条就绪
                      {translating && (
                        <em className="batch-translate-progress">
                          （后台 {translateProgress.done}/
                          {translateProgress.total}）
                        </em>
                      )}
                    </>
                  )}
                </span>
                <label>
                  预览第
                  <input
                    type="number"
                    min={1}
                    max={rows.length}
                    value={previewIndex + 1}
                    onChange={(e) =>
                      setPreviewIndex(
                        Math.max(
                          0,
                          Math.min(rows.length - 1, Number(e.target.value) - 1),
                        ),
                      )
                    }
                  />
                  条
                </label>
              </div>
              <div className="batch-table-wrap">
                <table className="batch-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      {headers.map((h) => (
                        <th key={h}>{h}</th>
                      ))}
                      {needsTranslate && <th>英文翻译</th>}
                      {needsTranslate && <th>状态</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {visibleRows.map((row, i) => {
                      const sources = rowSources[i] ?? []
                      const status = needsTranslate
                        ? rowStatusFromSources(
                            sources,
                            translationCache,
                            failedSet,
                          )
                        : 'ready'
                      const enText = needsTranslate
                        ? formatTranslationsFromSources(
                            sources,
                            translationCache,
                          )
                        : ''
                      return (
                        <tr
                          key={i}
                          className={i === previewIndex ? 'active' : undefined}
                          onClick={() => setPreviewIndex(i)}
                        >
                          <td>{i + 1}</td>
                          {headers.map((h) => (
                            <td key={h}>{row[h] ?? ''}</td>
                          ))}
                          {needsTranslate && (
                            <td className="batch-en-cell" title={enText}>
                              {enText ||
                                (status === 'pending' ? '翻译中…' : '—')}
                            </td>
                          )}
                          {needsTranslate && (
                            <td>
                              {status === 'ready' && (
                                <span className="batch-status ok">已译</span>
                              )}
                              {status === 'pending' && (
                                <span className="batch-status pending">
                                  等待
                                </span>
                              )}
                              {status === 'error' && (
                                <span className="batch-status err">失败</span>
                              )}
                            </td>
                          )}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
                {rows.length > 8 && (
                  <p className="hint">
                    仅显示前 8 行，打印时将处理全部 {rows.length} 条
                  </p>
                )}
              </div>
            </div>
          )}

          <div className="batch-preview-row">
            <div className="print-preview-wrap batch-label-preview">
              {previewUrl && (
                <img
                  src={previewUrl}
                  alt="批量预览"
                  className={`print-preview-img${loadingPreview ? ' is-updating' : ''}`}
                  style={{
                    aspectRatio: `${settings.width} / ${settings.height}`,
                  }}
                />
              )}
              {loadingPreview && (
                <div className="print-preview-loading batch-preview-overlay">
                  <Loader2 size={24} className="spin" />
                  <span>{previewUrl ? '更新预览…' : '生成预览…'}</span>
                </div>
              )}
              {!loadingPreview && !previewUrl && rows.length === 0 && (
                <span className="print-preview-loading">导入数据后显示预览</span>
              )}
            </div>

            <div className="print-options">
              <div className="print-option-row">
                <label>打印机 DPI</label>
                <select
                  value={dpi}
                  onChange={(e) => setDpi(Number(e.target.value))}
                >
                  <option value={203}>203（常见热敏）</option>
                  <option value={300}>300</option>
                  <option value={600}>600</option>
                </select>
              </div>
              {desktop && printers.length > 0 && (
                <div className="print-option-row">
                  <label>打印机</label>
                  <select
                    value={deviceName}
                    onChange={(e) => setDeviceName(e.target.value)}
                  >
                    {printers.map((p) => (
                      <option key={p.name} value={p.name}>
                        {p.displayName || p.name}
                        {p.isDefault ? '（默认）' : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              {needsTranslate && (
                <p className="hint" style={{ margin: 0 }}>
                  打印需至少 {requiredReady} 条翻译就绪
                  （当前 {readyRowCount}/{requiredReady}）
                </p>
              )}
            </div>
          </div>

          {printing && (
            <p className="batch-progress">
              正在打印 {progress.current} / {progress.total} …
            </p>
          )}
          {error && <p className="form-error">{error}</p>}
        </div>

        <div className="modal-footer print-dialog-footer">
          <button className="btn-secondary" onClick={onClose} disabled={printing}>
            取消
          </button>
          <button
            className="btn-create"
            disabled={
              rows.length === 0 ||
              printing ||
              (!previewUrl && loadingPreview) ||
              !canPrintByTranslate
            }
            title={
              !canPrintByTranslate
                ? `请等待翻译完成至少 ${requiredReady} 条`
                : undefined
            }
            onClick={doBatchPrint}
          >
            {printing ? (
              <>
                <Loader2 size={16} className="spin" />
                批量打印中…
              </>
            ) : translating && needsTranslate ? (
              <>
                <Loader2 size={16} className="spin" />
                翻译中 {readyRowCount}/{requiredReady}
              </>
            ) : (
              <>
                <Printer size={16} />
                批量打印 {rows.length > 0 ? `(${rows.length} 张)` : ''}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
