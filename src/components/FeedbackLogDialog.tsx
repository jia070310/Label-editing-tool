import { useEffect, useState } from 'react'
import { Loader2, MessageSquareWarning, X } from 'lucide-react'
import { exportFeedbackLog } from '../utils/feedback'
import { isElectronApp } from '../utils/electron'

interface Props {
  open: boolean
  onClose: () => void
}

export function FeedbackLogDialog({ open, onClose }: Props) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [donePath, setDonePath] = useState('')
  const desktop = isElectronApp()

  useEffect(() => {
    if (!open) return
    setError('')
    setDonePath('')
  }, [open])

  if (!open) return null

  const doExport = async () => {
    if (busy) return
    setBusy(true)
    setError('')
    setDonePath('')
    try {
      const result = await exportFeedbackLog()
      if (result?.cancelled) {
        setBusy(false)
        return
      }
      if (!result?.ok || !result.path) {
        throw new Error('导出失败')
      }
      setDonePath(result.path)
    } catch (e) {
      setError(e instanceof Error ? e.message : '导出失败')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-card feedback-dialog"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h2>导出反馈日志</h2>
          <button className="modal-close" onClick={onClose} aria-label="关闭">
            <X size={18} />
          </button>
        </div>

        <div className="modal-body">
          <p className="feedback-hint">
            仅在本机保存文本日志（应用日志、打印日志、系统信息），不联网上传。
            导出后可将文件发给开发者排查。不含模板内容与标签图像。
          </p>
          {!desktop && (
            <p className="form-error">请使用桌面版（安装包 / npm run desktop）导出。</p>
          )}
          {error && <p className="form-error">{error}</p>}
          {donePath && (
            <p className="feedback-done">
              已保存到：{donePath}
            </p>
          )}
        </div>

        <div className="modal-footer split">
          <button className="btn-secondary" onClick={onClose} disabled={busy}>
            关闭
          </button>
          <button
            className="btn-create"
            onClick={doExport}
            disabled={!desktop || busy}
          >
            {busy ? (
              <>
                <Loader2 size={16} className="spin" />
                导出中…
              </>
            ) : (
              <>
                <MessageSquareWarning size={16} />
                导出日志
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
