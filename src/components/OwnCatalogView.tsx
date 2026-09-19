import { useMemo, useState } from 'react'
import { CATEGORY_LABELS, PRICE_CATEGORY_LABELS } from '../types'
import type { Category, Product } from '../types'
import { stockLabel } from '../lib/matching'
import { OwnProductForm } from './OwnProductForm'
import { ProductImage } from './ProductImage'

interface Props {
  items: Product[]
  onSave: (p: Product) => void
  onRemove: (id: string) => void
  onReset: () => void
}

const stockToneClass: Record<'ok' | 'low' | 'out', string> = {
  ok: 'text-emerald-700 bg-emerald-50',
  low: 'text-amber-700 bg-amber-50',
  out: 'text-red-700 bg-red-50',
}

export function OwnCatalogView({ items, onSave, onRemove, onReset }: Props) {
  const [brandFilter, setBrandFilter] = useState<string>('all')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [editing, setEditing] = useState<Product | undefined>()
  const [showForm, setShowForm] = useState(false)

  const brands = useMemo(() => Array.from(new Set(items.map((p) => p.brand))), [items])

  const filtered = items.filter(
    (p) => (brandFilter === 'all' || p.brand === brandFilter) && (categoryFilter === 'all' || p.category === categoryFilter),
  )

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Мой каталог</h1>
          <p className="text-sm text-slate-500">TP-Link, Vitek, Hikvision — то, что вы продаёте и держите на складе.</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => {
              if (confirm('Сбросить каталог к демо-данным? Ваши изменения будут потеряны.')) onReset()
            }}
            className="rounded border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100"
          >
            Сбросить к демо
          </button>
          <button
            onClick={() => {
              setEditing(undefined)
              setShowForm(true)
            }}
            className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
          >
            + Добавить товар
          </button>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-3">
        <select
          className="rounded border border-slate-300 px-2 py-1.5 text-sm"
          value={brandFilter}
          onChange={(e) => setBrandFilter(e.target.value)}
        >
          <option value="all">Все бренды</option>
          {brands.map((b) => (
            <option key={b} value={b}>
              {b}
            </option>
          ))}
        </select>
        <select
          className="rounded border border-slate-300 px-2 py-1.5 text-sm"
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
        >
          <option value="all">Все категории</option>
          {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-3 py-2 text-left font-medium text-slate-600">Товар</th>
              <th className="px-3 py-2 text-left font-medium text-slate-600">Категория</th>
              <th className="px-3 py-2 text-left font-medium text-slate-600">Цена</th>
              <th className="px-3 py-2 text-left font-medium text-slate-600">Остаток</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.map((p) => {
              const stock = stockLabel(p.stock)
              return (
                <tr key={p.id} className="hover:bg-slate-50">
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-3">
                      <ProductImage imageUrl={p.imageUrl} brand={p.brand} category={p.category} size="sm" />
                      <div>
                        <div className="font-medium text-slate-900">
                          {p.brand} {p.model}
                        </div>
                        {p.series && <div className="text-xs text-slate-500">{p.series}</div>}
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-2 text-slate-600">{CATEGORY_LABELS[p.category as Category]}</td>
                  <td className="px-3 py-2 text-slate-600">
                    ${p.priceUSD}
                    <div className="text-xs text-slate-400">{PRICE_CATEGORY_LABELS[p.priceCategory]}</div>
                  </td>
                  <td className="px-3 py-2">
                    <span className={`rounded px-2 py-0.5 text-xs font-medium ${stockToneClass[stock.tone]}`}>
                      {stock.text}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right whitespace-nowrap">
                    <button
                      onClick={() => {
                        setEditing(p)
                        setShowForm(true)
                      }}
                      className="mr-2 text-blue-600 hover:underline"
                    >
                      Изменить
                    </button>
                    <button
                      onClick={() => {
                        if (confirm(`Удалить ${p.brand} ${p.model}?`)) onRemove(p.id)
                      }}
                      className="text-red-600 hover:underline"
                    >
                      Удалить
                    </button>
                  </td>
                </tr>
              )
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-slate-400">
                  Ничего не найдено
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showForm && (
        <OwnProductForm initial={editing} onSave={onSave} onClose={() => setShowForm(false)} />
      )}
    </div>
  )
}
