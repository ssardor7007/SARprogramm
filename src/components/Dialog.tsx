import { useEffect, useRef, type ReactNode } from 'react'
import { CloseIcon } from './NavIcons'

interface Props {
  title: ReactNode
  subtitle?: ReactNode
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
  /** Ширина панели на десктопе */
  size?: 'md' | 'lg' | 'xl'
  label: string
}

const WIDTH = { md: 'max-w-xl', lg: 'max-w-4xl', xl: 'max-w-6xl' }

/** Общее модальное окно приложения: тёмная подложка, закрытие по Esc и клику мимо, тема день/ночь. */
export function Dialog({ title, subtitle, onClose, children, footer, size = 'lg', label }: Props) {
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    panelRef.current?.focus()
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [onClose])

  return (
    <div className="no-print fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label={label}>
      <div className="absolute inset-0" style={{ backgroundColor: 'rgba(3, 6, 14, 0.6)' }} onClick={onClose} />
      <div
        ref={panelRef}
        tabIndex={-1}
        className={`relative flex max-h-[92vh] w-full ${WIDTH[size]} flex-col overflow-hidden rounded-t-2xl bg-[var(--surface)] shadow-2xl outline-none sm:rounded-2xl`}
      >
        <header className="flex items-start justify-between gap-3 border-b border-[var(--border)] px-5 py-3.5">
          <div className="min-w-0">
            <h2 className="truncate text-base font-semibold text-[var(--text)]">{title}</h2>
            {subtitle && <div className="mt-0.5 text-xs text-[var(--text-muted)]">{subtitle}</div>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[var(--text-muted)] hover:bg-black/5"
            aria-label="Закрыть"
          >
            <CloseIcon />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
        {footer && <footer className="border-t border-[var(--border)] bg-[var(--surface)] px-5 py-3">{footer}</footer>}
      </div>
    </div>
  )
}
