import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import {
  APP_AUTHOR,
  APP_DISPLAY_NAME,
  APP_REPO_URL,
  APP_VERSION,
} from '../utils/appInfo'

interface Props {
  open: boolean
  onClose: () => void
}

export function AboutDialog({ open, onClose }: Props) {
  const [version, setVersion] = useState(APP_VERSION)

  useEffect(() => {
    if (!open) return
    let cancelled = false
    void (async () => {
      try {
        const v = await window.electronAPI?.getAppVersion?.()
        if (!cancelled && v) setVersion(v)
      } catch {
        /* keep fallback */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [open])

  if (!open) return null

  const openRepo = async () => {
    try {
      if (window.electronAPI?.openExternal) {
        await window.electronAPI.openExternal(APP_REPO_URL)
        return
      }
    } catch {
      /* fallback below */
    }
    window.open(APP_REPO_URL, '_blank', 'noopener,noreferrer')
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-card about-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="about-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h2 id="about-title">关于</h2>
          <button className="modal-close" onClick={onClose} aria-label="关闭">
            <X size={18} />
          </button>
        </div>
        <div className="modal-body about-body">
          <div className="about-mark" aria-hidden>
            <svg
              viewBox="0 0 24 24"
              width="28"
              height="28"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M7 7h10v10H7z" />
              <path d="M3 7h4" />
              <path d="M17 7h4" />
              <path d="M7 3v4" />
              <path d="M7 17v4" />
            </svg>
          </div>
          <h3 className="about-name">{APP_DISPLAY_NAME}</h3>
          <p className="about-version">版本 {version}</p>
          <p className="about-desc">
            桌面端标签编辑与打印工具，支持表格、条码、二维码与批量打印。
          </p>
          <dl className="about-info">
            <div>
              <dt>作者</dt>
              <dd>{APP_AUTHOR}</dd>
            </div>
            <div>
              <dt>仓库</dt>
              <dd>
                <button
                  type="button"
                  className="about-link"
                  onClick={() => void openRepo()}
                  title={APP_REPO_URL}
                >
                  {APP_REPO_URL}
                </button>
              </dd>
            </div>
          </dl>
          <p className="about-meta">© Lemon Label</p>
        </div>
        <div className="modal-footer">
          <button className="btn-create" type="button" onClick={onClose}>
            确定
          </button>
        </div>
      </div>
    </div>
  )
}
