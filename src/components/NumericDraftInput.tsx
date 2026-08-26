import { useState } from 'react'

interface Props {
  value: number
  min?: number
  max?: number
  decimals?: number
  onCommit: (value: number) => void
  className?: string
}

export function NumericDraftInput({
  value,
  min = -Infinity,
  max = Infinity,
  decimals = 2,
  onCommit,
  className,
}: Props) {
  const [draft, setDraft] = useState<string | null>(null)
  const formatted = Number(value.toFixed(decimals))
  const display = draft ?? String(formatted)

  const commit = () => {
    const raw = draft?.trim() ?? ''
    setDraft(null)
    if (raw === '' || raw === '-' || raw === '.') return
    const n = Number(raw)
    if (!Number.isFinite(n)) return
    onCommit(Math.min(max, Math.max(min, n)))
  }

  return (
    <input
      type="text"
      inputMode="decimal"
      className={className}
      value={display}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault()
          e.currentTarget.blur()
        }
      }}
    />
  )
}
