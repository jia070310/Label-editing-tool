import { useCallback, useRef, useState } from 'react'

export function useHistory<T>(initial: T) {
  const [past, setPast] = useState<T[]>([])
  const [present, setPresent] = useState<T>(initial)
  const [future, setFuture] = useState<T[]>([])
  const presentRef = useRef(present)
  presentRef.current = present

  const set = useCallback((value: T | ((prev: T) => T), record = true) => {
    setPresent((prev) => {
      const next =
        typeof value === 'function' ? (value as (p: T) => T)(prev) : value
      // 引用未变则跳过，避免无意义重渲染
      if (Object.is(next, prev)) return prev
      if (record) {
        setPast((p) => [...p.slice(-49), prev])
        setFuture([])
      }
      return next
    })
  }, [])

  const checkpoint = useCallback(() => {
    const snapshot = presentRef.current
    setPast((p) => {
      if (p.length > 0 && Object.is(p[p.length - 1], snapshot)) return p
      return [...p.slice(-49), snapshot]
    })
    setFuture([])
  }, [])

  const reset = useCallback((value: T) => {
    setPast([])
    setFuture([])
    setPresent(value)
  }, [])

  const undo = useCallback(() => {
    setPast((p) => {
      if (p.length === 0) return p
      const previous = p[p.length - 1]
      setFuture((f) => [presentRef.current, ...f])
      setPresent(previous)
      return p.slice(0, -1)
    })
  }, [])

  const redo = useCallback(() => {
    setFuture((f) => {
      if (f.length === 0) return f
      const next = f[0]
      setPast((p) => [...p, presentRef.current])
      setPresent(next)
      return f.slice(1)
    })
  }, [])

  return {
    state: present,
    set,
    checkpoint,
    reset,
    undo,
    redo,
    canUndo: past.length > 0,
    canRedo: future.length > 0,
  }
}
