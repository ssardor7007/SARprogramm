import { useMemo, useState } from 'react'
import { CATEGORY_LABELS } from '../types'
import type { CompetitorProduct, Product } from '../types'
import { findBestMatch } from '../lib/matching'
import { CompetitorProductForm } from './CompetitorProductForm'
import { ProductImage } from './ProductImage'

interface Props {
  items: CompetitorProduct[]
  ownCatalog: Product[]
  onSave: (p: CompetitorProduct) => void
  onRemove: (id: string) => void
  onReset: () => void
}

export function CompetitorCatalogView({ items, ownCatalog, onSave, onRemove, onReset }: Props) {
  const [brandFilter, setBrandFilter] = useState<string>('all')
  const [editing, setEditing] = useState<CompetitorProduct | undefined>()
  const [showForm, setShowForm] = useState(false)

  const brands = useMemo(() => Array.from(new Set(items.map((p) => p.brand))), [items])
  const filtered = items.filter((p) => brandFilter === 'all' || p.brand === brandFilter)

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Оборудование конкурентов</h1>
          <p className="text-sm text-slate-500">
            Ruijie, Tenda, Ubiquiti, MikroTik, Dahua и другое — то, что приносят клиенты в своих списках.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => {
              if (confirm('Сбросить список конкурентов к демо-данным?')) onReset()
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

      <div className="mb-4">
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
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-3 py-2 text-left font-medium text-slate-600">Товар конкурента</th>
              <th className="px-3 py-2 text-left font-medium text-slate-600">Категория</th>
              <th className="px-3 py-2 text-left font-medium text-slate-600">Цена</th>
              <th className="px-3 py-2 text-left font-medium text-slate-600">Наш аналог</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.map((p) => {
              const match = findBestMatch(p, ownCatalog)
              return (
                <tr key={p.id} className="hover:bg-slate-50">
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-3">
                      <ProductImage imageUrl={p.imageUrl} brand={p.brand} category={p.category} size="sm" />
                      <div className="font-medium text-slate-900">
                        {p.brand} {p.model}
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-2 text-slate-600">{CATEGORY_LABELS[p.category]}</td>
                  <td className="px-3 py-2 text-slate-600">${p.priceUSD}</td>
                  <td className="px-3 py-2">
                    {match ? (
                      <span className="rounded bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
                        {match.brand} {match.model}
                      </span>
                    ) : (
                      <span className="text-xs text-slate-400">нет аналога в категории</span>
                    )}
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
        <CompetitorProductForm
          initial={editing}
          ownCatalog={ownCatalog}
          onSave={onSave}
          onClose={() => setShowForm(false)}
        />
      )}
    </div>
  )
}
