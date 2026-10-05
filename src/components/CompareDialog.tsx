import { useState } from 'react'
import { CATEGORY_LABELS, type Product } from '../types'
import { useCompare, useQuoteLines } from '../lib/cart'
import { STOCK_TONE, stockLabel } from '../lib/matching'
import { useMoney } from '../lib/money'
import { MANAGED_LABELS, OTHER_KIND_LABELS, productFacts, productText } from '../lib/productFacts'
import { downloadXlsx, safeFileName } from '../lib/xlsx'
import { Dialog } from './Dialog'
import { CloseIcon } from './NavIcons'
import { ProductImage } from './ProductImage'

interface Props {
  catalog: Product[]
  onClose: () => void
  onOpenProduct: (p: Product) => void
}

type Row = { label: string; values: string[]; numeric?: number[]; better?: 'min' | 'max' }

function buildRows(items: Product[], fmt: (usd: number) => string): Row[] {
  const facts = items.map(productFacts)
  const rows: Row[] = [
    { label: 'Цена', values: items.map((p) => fmt(p.priceUSD)), numeric: items.map((p) => p.priceUSD), better: 'min' },
    { label: 'Наличие', values: items.map((p) => stockLabel(p.stock).text), numeric: items.map((p) => p.stock), better: 'max' },
    { label: 'Бренд', values: items.map((p) => p.brand) },
    { label: 'Тип', values: items.map((p, i) => (facts[i].kind ? OTHER_KIND_LABELS[facts[i].kind!] : CATEGORY_LABELS[p.category])) },
    { label: 'Портов', values: facts.map((f) => (f.ports ? String(f.ports) : '—')), numeric: facts.map((f) => f.ports ?? NaN), better: 'max' },
    { label: 'Портов PoE', values: facts.map((f) => (f.poePorts ? String(f.poePorts) : '—')), numeric: facts.map((f) => f.poePorts ?? NaN), better: 'max' },
    {
      label: 'Бюджет PoE',
      values: facts.map((f) => (f.poeBudgetW ? `${f.poeBudgetW} Вт` : '—')),
      numeric: facts.map((f) => f.poeBudgetW ?? NaN),
      better: 'max',
    },
    {
      label: 'Аплинк / скорость',
      values: facts.map((f) => [f.has10G ? '10G SFP+' : f.sfp ? 'SFP' : '', f.has25G ? '2.5G' : ''].filter(Boolean).join(', ') || '—'),
    },
    { label: 'Управление', values: facts.map((f) => (f.managed ? MANAGED_LABELS[f.managed] : '—')) },
    { label: 'Wi‑Fi', values: facts.map((f) => f.wifi ?? '—') },
    { label: 'Исполнение', values: items.map((p, i) => (p.category === 'ap' || facts[i].outdoor ? (facts[i].outdoor ? 'Уличное' : 'Для помещений') : '—')) },
    { label: 'Дальность', values: facts.map((f) => (f.rangeKm ? `до ${f.rangeKm} км` : '—')), numeric: facts.map((f) => f.rangeKm ?? NaN), better: 'max' },
  ]
  // Строки, где у всех прочерк, не показываем вовсе
  return rows.filter((r) => r.values.some((v) => v !== '—'))
}

function bestIndex(row: Row): number[] {
  if (!row.numeric || !row.better) return []
  const vals = row.numeric.filter((n) => Number.isFinite(n))
  if (vals.length < 2) return []
  const target = row.better === 'min' ? Math.min(...vals) : Math.max(...vals)
  if (vals.every((v) => v === target)) return []
  return row.numeric.map((n, i) => (n === target ? i : -1)).filter((i) => i >= 0)
}

export function CompareDialog({ catalog, onClose, onOpenProduct }: Props) {
  const compare = useCompare()
  const quote = useQuoteLines()
  const money = useMoney()
  const [onlyDiff, setOnlyDiff] = useState(false)
  const items = compare.ids.map((id) => catalog.find((p) => p.id === id)).filter((p): p is Product => Boolean(p))
  const rows = buildRows(items, money.fmt)
  const visible = onlyDiff ? rows.filter((r) => new Set(r.values).size > 1) : rows
  const cols = `150px repeat(${Math.max(1, items.length)}, minmax(0, 1fr))`
  const minWidth = 150 + Math.max(1, items.length) * 190

  async function exportExcel() {
    await downloadXlsx(safeFileName(`Сравнение ${items.map((p) => p.model).join(' vs ')}`).slice(0, 120), [
      {
        name: 'Сравнение',
        title: 'Сравнение оборудования',
        meta: [`Дата: ${new Date().toLocaleDateString('ru-RU')}`, `Валюта: ${money.currency === 'UZS' ? `сум (курс ${money.rate})` : 'USD'}`],
        columns: [{ header: 'Параметр', width: 22 }, ...items.map((p) => ({ header: `${p.brand} ${p.model}`, width: 34 }))],
        rows: [
          ...rows.map((r) => [r.label, ...r.values]),
          ['Описание', ...items.map((p) => productText(p).replace(p.model, '').trim())],
          ['Плюсы', ...items.map((p) => p.pros.join('; '))],
          ['Минусы', ...items.map((p) => p.cons.join('; '))],
        ],
      },
    ])
  }

  return (
    <Dialog
      label="Сравнение товаров"
      title="Сравнение товаров"
      subtitle={items.length < 2 ? 'Добавьте ещё хотя бы один товар кнопкой «Сравнить» в каталоге.' : `${items.length} товара · лучшие значения подсвечены`}
      onClose={onClose}
      size="xl"
      footer={
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-[var(--text)]">
            <input type="checkbox" checked={onlyDiff} onChange={(e) => setOnlyDiff(e.target.checked)} />
            Только различия
          </label>
          <button type="button" onClick={exportExcel} disabled={items.length === 0} className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm font-medium text-[var(--text)] hover:bg-black/5 disabled:opacity-50">
            Скачать в Excel
          </button>
          <button type="button" onClick={compare.clear} className="ml-auto text-sm text-[var(--text-muted)] hover:underline">
            Очистить сравнение
          </button>
        </div>
      }
    >
      {items.length === 0 ? (
        <p className="p-8 text-center text-sm text-[var(--text-muted)]">Сравнение пусто.</p>
      ) : (
        <div className="overflow-x-auto">
          <div style={{ minWidth }}>
            <div className="sticky top-0 z-10 grid border-b border-[var(--border)] bg-[var(--surface)]" style={{ gridTemplateColumns: cols }}>
              <div />
              {items.map((p) => (
                <div key={p.id} className="relative flex flex-col items-center gap-2 border-l border-[var(--border)] p-3 text-center">
                  <button
                    type="button"
                    onClick={() => compare.remove(p.id)}
                    className="absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-full text-[var(--text-muted)] hover:bg-black/5"
                    aria-label={`Убрать ${p.model} из сравнения`}
                  >
                    <CloseIcon className="h-3.5 w-3.5" />
                  </button>
                  <button type="button" onClick={() => onOpenProduct(p)} className="flex flex-col items-center gap-1.5">
                    <ProductImage imageUrl={p.imageUrl} brand={p.brand} category={p.category} size="lg" />
                    <span className="text-[11px] text-[var(--text-muted)]">{p.brand}</span>
                    <span className="text-sm font-semibold leading-snug text-[var(--text)] hover:underline">{p.model}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => quote.add(p.id)}
                    className="rounded-lg px-3 py-1 text-xs font-semibold"
                    style={{ backgroundColor: 'var(--accent)', color: 'var(--accent-ink)' }}
                  >
                    {quote.qtyOf(p.id) > 0 ? `В КП: ${quote.qtyOf(p.id)} · +1` : 'В КП'}
                  </button>
                </div>
              ))}
            </div>
            {visible.map((r) => {
              const best = bestIndex(r)
              return (
                <div key={r.label} className="grid border-b border-[var(--border)] text-sm" style={{ gridTemplateColumns: cols }}>
                  <div className="px-4 py-2.5 text-[var(--text-muted)]">{r.label}</div>
                  {r.values.map((v, i) =>
                    r.label === 'Наличие' ? (
                      <div key={i} className="border-l border-[var(--border)] px-3 py-2.5 text-center">
                        <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${STOCK_TONE[stockLabel(items[i].stock).tone]}`}>{v}</span>
                      </div>
                    ) : (
                      <div
                        key={i}
                        className={`border-l border-[var(--border)] px-3 py-2.5 text-center ${best.includes(i) ? 'font-semibold text-emerald-700' : 'text-[var(--text)]'}`}
                      >
                        {v}
                      </div>
                    ),
                  )}
                </div>
              )
            })}
            {!onlyDiff && (
              <div className="grid text-sm" style={{ gridTemplateColumns: cols }}>
                <div className="px-4 py-2.5 text-[var(--text-muted)]">Описание</div>
                {items.map((p) => (
                  <div key={p.id} className="border-l border-[var(--border)] px-3 py-2.5 text-xs leading-relaxed text-[var(--text-muted)]">
                    {productText(p).replace(p.model, '').trim() || '—'}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </Dialog>
  )
}
