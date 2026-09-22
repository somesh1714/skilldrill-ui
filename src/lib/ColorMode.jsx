import { createContext, useContext, useMemo, useState, useEffect } from 'react'

const ColorModeContext = createContext({ mode: 'light', toggle: () => {} })
export const useColorMode = () => useContext(ColorModeContext)

export function ColorModeProvider({ children }) {
  const [mode, setMode] = useState(() => {
    try {
      const saved = localStorage.getItem('mh.mode')
      if (saved === 'light' || saved === 'dark') return saved
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
    } catch {
      return 'light'
    }
  })

  useEffect(() => {
    try { localStorage.setItem('mh.mode', mode) } catch { /* private mode */ }
    document.body.classList.toggle('mh-dark', mode === 'dark')
    document.body.classList.toggle('mh-light', mode === 'light')
  }, [mode])

  const value = useMemo(
    () => ({ mode, toggle: () => setMode((m) => (m === 'dark' ? 'light' : 'dark')) }),
    [mode],
  )
  return <ColorModeContext.Provider value={value}>{children}</ColorModeContext.Provider>
}
