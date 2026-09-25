import { useTheme } from '../lib/theme'
import { MoonIcon, SunIcon } from './NavIcons'

/** Кнопка «день/ночь» в шапке. Показывает, куда переключит: ночью — солнце, днём — луна. */
export function ThemeToggle() {
  const { theme, toggle } = useTheme('light')
  const next = theme === 'dark' ? 'дневную' : 'ночную'
  return (
    <button
      onClick={toggle}
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[var(--border)] text-[var(--text-muted)] hover:bg-black/5 hover:text-[var(--text)]"
      aria-label={`Включить ${next} тему`}
      title={`Включить ${next} тему`}
    >
      {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
    </button>
  )
}
