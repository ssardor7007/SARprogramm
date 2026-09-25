import { useCallback, useEffect, useState } from 'react'

export type Theme = 'light' | 'dark'

/** Общий ключ для всего сайта: выбор «день/ночь» на главной и в каталоге один и тот же.
 * Без префикса проекта — тема не должна переключаться вместе с проектом объекта. */
const THEME_KEY = 'sar-theme'
const THEME_EVENT = 'sar-theme-change'

export function readTheme(fallback: Theme): Theme {
  try {
    const value = localStorage.getItem(THEME_KEY)
    return value === 'light' || value === 'dark' ? value : fallback
  } catch {
    return fallback
  }
}

function paint(theme: Theme) {
  document.documentElement.dataset.theme = theme
}

export function setTheme(theme: Theme) {
  paint(theme)
  try {
    localStorage.setItem(THEME_KEY, theme)
  } catch {
    // хранилище недоступно — тема просто не запомнится
  }
  window.dispatchEvent(new CustomEvent(THEME_EVENT, { detail: theme }))
}

/** Текущая тема + переключатель. `fallback` — тема страницы, пока пользователь ничего не выбрал. */
export function useTheme(fallback: Theme = 'light') {
  const [theme, setState] = useState<Theme>(() => readTheme(fallback))

  useEffect(() => {
    paint(theme)
  }, [theme])

  useEffect(() => {
    const sync = () => setState(readTheme(fallback))
    window.addEventListener(THEME_EVENT, sync)
    window.addEventListener('storage', sync)
    return () => {
      window.removeEventListener(THEME_EVENT, sync)
      window.removeEventListener('storage', sync)
    }
  }, [fallback])

  const toggle = useCallback(() => setTheme(theme === 'dark' ? 'light' : 'dark'), [theme])
  return { theme, toggle }
}
