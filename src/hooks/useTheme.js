import { useState, useEffect } from 'react'

export function useTheme() {
  const [theme, setThemeRaw] = useState(() =>
    localStorage.getItem('fiscapp-theme') || 'dark'
  )

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('fiscapp-theme', theme)
  }, [theme])

  const toggle = () => setThemeRaw(t => t === 'dark' ? 'light' : 'dark')

  return { theme, toggle, isDark: theme === 'dark' }
}
