import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ErrorBoundary } from './components/ErrorBoundary'
import { reportClientError } from './utils/feedback'

function hideBootSplash() {
  const splash = document.getElementById('boot-splash')
  if (!splash) return
  splash.classList.add('is-hidden')
  window.setTimeout(() => splash.remove(), 320)
}

function setBootText(text: string) {
  const el = document.getElementById('boot-splash-text')
  if (el) el.textContent = text
}

window.addEventListener('error', (ev) => {
  void reportClientError(ev.error || ev.message, { kind: 'window-error' })
})
window.addEventListener('unhandledrejection', (ev) => {
  void reportClientError(ev.reason, { kind: 'unhandledrejection' })
})

async function boot() {
  const rootEl = document.getElementById('root')
  if (!rootEl) return

  try {
    setBootText('正在加载界面…')
    const [{ default: App }] = await Promise.all([
      import('./App'),
      // 让启动页至少露一小会儿，避免一闪而过
      new Promise((r) => setTimeout(r, 280)),
    ])

    setBootText('即将完成…')
    createRoot(rootEl).render(
      <StrictMode>
        <ErrorBoundary>
          <App />
        </ErrorBoundary>
      </StrictMode>,
    )

    // 等首帧绘制后再收起启动页
    requestAnimationFrame(() => {
      requestAnimationFrame(() => hideBootSplash())
    })
  } catch (err) {
    console.error(err)
    void reportClientError(err, { kind: 'boot-failure' })
    setBootText('启动失败，请重启应用')
  }
}

boot()
