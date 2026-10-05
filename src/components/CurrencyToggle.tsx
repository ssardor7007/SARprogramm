import { useState } from 'react'
import { DEFAULT_UZS_RATE, useMoney, type Currency } from '../lib/money'

/** Валюта цен во всём приложении: сумы (как у местных магазинов) или доллары, плюс курс пересчёта. */
export function CurrencyToggle() {
  const money = useMoney()
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState('')

  const options: { id: Currency; label: string }[] = [
    { id: 'UZS', label: 'сум' },
    { id: 'USD', label: '$' },
  ]

  return (
    <div className="relative flex items-center">
      <div className="inline-flex rounded-full border border-[var(--border)] p-0.5" role="group" aria-label="Валюта цен">
        {options.map((o) => (
          <button
            key={o.id}
            type="button"
            onClick={() => money.setCurrency(o.id)}
            aria-pressed={money.currency === o.id}
            className="rounded-full px-2.5 py-1 text-xs font-semibold"
            style={money.currency === o.id ? { backgroundColor: 'var(--accent)', color: 'var(--accent-ink)' } : { color: 'var(--text-muted)' }}
          >
            {o.label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => {
            setDraft(String(money.rate))
            setOpen((v) => !v)
          }}
          className="rounded-full px-2 py-1 text-[11px] text-[var(--text-muted)] hover:bg-black/5"
          title="Курс пересчёта в сумы"
          aria-expanded={open}
        >
          {money.rate.toLocaleString('ru-RU')}
        </button>
      </div>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <form
            className="absolute right-0 top-full z-50 mt-2 w-64 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3 shadow-lg"
            onSubmit={(e) => {
              e.preventDefault()
              money.setRate(Number(draft.replace(/[^\d.]/g, '')) || DEFAULT_UZS_RATE)
              setOpen(false)
            }}
          >
            <label className="block text-xs font-medium text-[var(--text-muted)]">
              Курс, сум за $1
              <input
                autoFocus
                inputMode="decimal"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)]"
              />
            </label>
            <p className="mt-2 text-[11px] leading-snug text-[var(--text-muted)]">
              Цены в каталоге хранятся в долларах; при курсе {DEFAULT_UZS_RATE.toLocaleString('ru-RU')} сумы совпадают с прайсом поставщика (с НДС).
            </p>
            <div className="mt-3 flex justify-end gap-2">
              <button type="button" onClick={() => setDraft(String(DEFAULT_UZS_RATE))} className="rounded-lg px-2 py-1.5 text-xs text-[var(--text-muted)] hover:underline">
                По прайсу
              </button>
              <button type="submit" className="rounded-lg px-3 py-1.5 text-xs font-semibold" style={{ backgroundColor: 'var(--accent)', color: 'var(--accent-ink)' }}>
                Сохранить
              </button>
            </div>
          </form>
        </>
      )}
    </div>
  )
}
