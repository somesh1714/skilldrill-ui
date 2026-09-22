import { useCallback, useEffect, useState } from 'react'

const KEY = 'mh.solved.v1'

function read() {
  try { return JSON.parse(localStorage.getItem(KEY) || '{}') } catch { return {} }
}
function write(v) {
  try { localStorage.setItem(KEY, JSON.stringify(v)) } catch { /* ignore */ }
}

// Tiny pub/sub so every mounted checkbox and progress bar stays in sync.
const listeners = new Set()
function broadcast(v) { listeners.forEach((fn) => fn(v)) }

export function useProgress() {
  const [solved, setSolved] = useState(read)

  useEffect(() => {
    listeners.add(setSolved)
    return () => { listeners.delete(setSolved) }
  }, [])

  const toggle = useCallback((id) => {
    const next = { ...read() }
    if (next[id]) delete next[id]
    else next[id] = Date.now()
    write(next)
    broadcast(next)
  }, [])

  const reset = useCallback(() => { write({}); broadcast({}) }, [])

  return { solved, toggle, reset, count: Object.keys(solved).length }
}

export const problemKey = (topicId, name) => `${topicId}::${name}`
