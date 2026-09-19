import { useMemo, useState } from 'react'
import { CATEGORY_LABELS } from '../types'
import type { Category, Product } from '../types'
import { visibleBrands, visibleCategories } from '../lib/features'
import { stockLabel } from '../lib/matching'
import { ProductForm } from './ProductForm'
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

export function CatalogView({ items, onSave, onRemove, onReset }: Props) {
  const [search, setSearch] = useState('')
  const [brandFilter, setBrandFilter] = useState<string>('all')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [editing, setEditing] = useState<Product | undefined>()
  const [showForm, setShowForm] = useState(false)
  const [manage, setManage] = useState(false)

  const brands = useMemo(() => visibleBrands().filter((b) => items.some((p) => p.brand === b)), [items])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return items.filter(
      (p) =>
        (brandFilter === 'all' || p.brand === brandFilter) &&
        (categoryFilter === 'all' || p.category === categoryFilter) &&
        (!q || `${p.brand} ${p.model} ${p.series ?? ''}`.toLowerCase().includes(q)),
    )
  }, [items, search, brandFilter, categoryFilter])

  return (
    <div>
      <div className="mb-4">
        <h1 className="text-xl font-semibold text-slate-900">Каталог</h1>
        <p className="text-sm text-slate-500">Все бренды площадки в одном месте — найдите товар, посмотрите цену и наличие.</p>
      </div>

      <div className="mb-4 flex flex-wrap gap-3">
        <input
          className="min-w-[220px] flex-1 rounded border border-slate-300 px-3 py-2 text-sm"
          placeholder="Поиск по модели или бренду"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="rounded border border-slate-300 px-2 py-2 text-sm"
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
          className="rounded border border-slate-300 px-2 py-2 text-sm"
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
        >
          <option value="all">Все категории</option>
          {visibleCategories().map((c) => (
            <option key={c} value={c}>
              {CATEGORY_LABELS[c]}
            </option>
          ))}
        </select>
      </div>

      {filtered.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-300 py-10 text-center text-sm text-slate-400">
          Ничего не найдено
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {filtered.map((p) => {
            const stock = stockLabel(p.stock)
            return (
              <div key={p.id} className="flex flex-col rounded-lg border border-slate-200 bg-white p-3">
                <div className="mb-2 flex justify-center">
                  <ProductImage imageUrl={p.imageUrl} brand={p.brand} category={p.category} size="lg" />
                </div>
                <div className="text-xs text-slate-400">{p.brand}</div>
                <div className="text-sm font-medium leading-snug text-slate-900">{p.model}</div>
                <div className="text-xs text-slate-500">{CATEGORY_LABELS[p.category as Category]}</div>
                <div className="mt-2 flex items-center justify-between gap-2">
                  <span className="font-semibold text-slate-900">${p.priceUSD}</span>
                  <span className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${stockToneClass[stock.tone]}`}>
                    {stock.text}
                  </span>
                </div>
                {manage && (
                  <div className="no-print mt-2 flex gap-3 border-t border-slate-100 pt-2 text-xs">
                    <button
                      onClick={() => {
                        setEditing(p)
                        setShowForm(true)
                      }}
                      className="text-blue-600 hover:underline"
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
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      <div className="no-print mt-6 border-t border-slate-200 pt-3">
        {manage ? (
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => {
                setEditing(undefined)
                setShowForm(true)
              }}
              className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
            >
              + Добавить товар
            </button>
            <button
              onClick={() => {
                if (confirm('Сбросить каталог к демо-данным? Ваши изменения будут потеряны.')) onReset()
              }}
              className="rounded border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100"
            >
              Сбросить к демо
            </button>
            <button onClick={() => setManage(false)} className="ml-auto text-sm text-slate-400 hover:underline">
              Скрыть управление
            </button>
          </div>
        ) : (
          <button onClick={() => setManage(true)} className="text-sm text-slate-400 hover:underline">
            Управление каталогом (добавить/изменить/удалить)
          </button>
        )}
      </div>

      {showForm && (
        <ProductForm initial={editing} catalog={items} onSave={onSave} onClose={() => setShowForm(false)} />
      )}
    </div>
  )
}
