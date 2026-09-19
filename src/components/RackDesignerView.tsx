import { useMemo, useState } from 'react'
import { CATEGORY_LABELS } from '../types'
import type { Category, Product } from '../types'
import { brandColor } from '../lib/brandTheme'
import { genId, usePersistedState } from '../lib/storage'
import { ProductImage } from './ProductImage'

interface Props {
  catalog: Product[]
}

/** Позиция в стойке — количество одинаковых юнитов вместо отдельной строки на каждый физический экземпляр. */
interface RackLine {
  id: string
  productId: string
  qty: number
  /** Высота в юнитах ОДНОГО экземпляра этой модели */
  unitsPerItem: number
}

const UNIT_PX = 22
const RACK_HEIGHTS = [12, 24, 42] as const
const CATEGORY_ORDER: Category[] = ['router', 'switch', 'ap', 'camera', 'nvr', 'other']

export function RackDesignerView({ catalog }: Props) {
  const [rackHeight, setRackHeight] = usePersistedState<(typeof RACK_HEIGHTS)[number]>('rack-height', 42)
  const [lines, setLines] = usePersistedState<RackLine[]>('rack-lines', [])
  const [search, setSearch] = useState('')
  const [brandFilter, setBrandFilter] = useState('all')
  const [dragIndex, setDragIndex] = useState<number | null>(null)

  const brands = useMemo(() => Array.from(new Set(catalog.map((p) => p.brand))).sort(), [catalog])

  const searchResults = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q && brandFilter === 'all') return []
    return catalog
      .filter((p) => (brandFilter === 'all' || p.brand === brandFilter) && `${p.brand} ${p.model}`.toLowerCase().includes(q))
      .slice(0, 30)
  }, [search, brandFilter, catalog])

  function qtyOf(productId: string) {
    return lines.find((l) => l.productId === productId)?.qty ?? 0
  }

  function addOne(product: Product) {
    setLines((prev) => {
      const existing = prev.find((l) => l.productId === product.id)
      if (existing) return prev.map((l) => (l.productId === product.id ? { ...l, qty: l.qty + 1 } : l))
      return [...prev, { id: genId('rack'), productId: product.id, qty: 1, unitsPerItem: 1 }]
    })
  }

  function removeOne(productId: string) {
    setLines((prev) =>
      prev.flatMap((l) => {
        if (l.productId !== productId) return [l]
        if (l.qty <= 1) return []
        return [{ ...l, qty: l.qty - 1 }]
      }),
    )
  }

  function removeLine(id: string) {
    setLines((prev) => prev.filter((l) => l.id !== id))
  }

  function setUnitsPerItem(id: string, units: number) {
    setLines((prev) => prev.map((l) => (l.id === id ? { ...l, unitsPerItem: Math.min(8, Math.max(1, units)) } : l)))
  }

  function moveLine(from: number, to: number) {
    setLines((prev) => {
      const next = [...prev]
      const [moved] = next.splice(from, 1)
      next.splice(to, 0, moved)
      return next
    })
  }

  const usedU = lines.reduce((sum, l) => sum + l.qty * l.unitsPerItem, 0)
  const totalItems = lines.reduce((sum, l) => sum + l.qty, 0)
  const totalPrice = lines.reduce((sum, l) => {
    const p = catalog.find((c) => c.id === l.productId)
    return sum + (p ? p.priceUSD * l.qty : 0)
  }, 0)
  const overCapacity = usedU > rackHeight
  const freeU = Math.max(0, rackHeight - usedU)

  const groupedLines = useMemo(() => {
    const groups = new Map<Category, RackLine[]>()
    for (const line of lines) {
      const p = catalog.find((c) => c.id === line.productId)
      if (!p) continue
      const arr = groups.get(p.category) ?? []
      arr.push(line)
      groups.set(p.category, arr)
    }
    return CATEGORY_ORDER.filter((c) => groups.has(c)).map((c) => ({ category: c, items: groups.get(c)! }))
  }, [lines, catalog])

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3 no-print">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Дизайнер стойки</h1>
          <p className="text-sm text-slate-500">
            Соберите проект как в UniFi Design Center — но из оборудования любого бренда каталога. Добавляйте
            позиции карточками, меняйте количество степпером, перетаскивайте группы для смены порядка.
          </p>
        </div>
        {lines.length > 0 && (
          <div className="flex gap-2">
            <button
              onClick={() => {
                if (confirm('Очистить текущий проект стойки?')) setLines([])
              }}
              className="rounded border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100"
            >
              Очистить стойку
            </button>
            <button
              onClick={() => window.print()}
              className="rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700"
            >
              Печать / сохранить как PDF
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
        {/* Picker */}
        <div className="no-print space-y-4">
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="mb-3 flex flex-wrap gap-2">
              <input
                className="min-w-[200px] flex-1 rounded border border-slate-300 px-2 py-1.5 text-sm"
                placeholder="Найти товар любого бренда — модель или название"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
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

            {searchResults.length > 0 ? (
              <div className="grid max-h-[28rem] grid-cols-2 gap-2 overflow-y-auto sm:grid-cols-3">
                {searchResults.map((p) => {
                  const qty = qtyOf(p.id)
                  return (
                    <div key={p.id} className="flex flex-col items-center rounded-lg border border-slate-200 p-2 text-center">
                      <ProductImage imageUrl={p.imageUrl} brand={p.brand} category={p.category} size="md" />
                      <div className="mt-1 line-clamp-2 text-xs font-medium text-slate-900">
                        {p.brand} {p.model}
                      </div>
                      <div className="text-xs text-slate-400">${p.priceUSD}</div>
                      <div className="mt-2 flex items-center gap-1.5">
                        <button
                          onClick={() => removeOne(p.id)}
                          disabled={qty === 0}
                          className="h-6 w-6 rounded border border-slate-300 text-sm leading-none hover:bg-slate-100 disabled:opacity-30"
                        >
                          −
                        </button>
                        <span className="w-5 text-center text-sm font-medium text-slate-900">{qty}</span>
                        <button
                          onClick={() => addOne(p)}
                          className="h-6 w-6 rounded border border-blue-300 text-sm leading-none text-blue-600 hover:bg-blue-50"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <p className="text-sm text-slate-400">Введите название/модель или выберите бренд, чтобы найти оборудование.</p>
            )}
          </div>

          {groupedLines.length > 0 && (
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <h2 className="mb-2 text-sm font-semibold text-slate-700">Список в стойке, по категориям</h2>
              <div className="space-y-4">
                {groupedLines.map(({ category, items }) => (
                  <div key={category}>
                    <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
                      {CATEGORY_LABELS[category]}
                    </div>
                    <div className="space-y-1">
                      {items.map((line) => {
                        const p = catalog.find((c) => c.id === line.productId)
                        if (!p) return null
                        const globalIndex = lines.indexOf(line)
                        return (
                          <div
                            key={line.id}
                            draggable
                            onDragStart={() => setDragIndex(globalIndex)}
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={() => {
                              if (dragIndex !== null && dragIndex !== globalIndex) moveLine(dragIndex, globalIndex)
                              setDragIndex(null)
                            }}
                            onDragEnd={() => setDragIndex(null)}
                            className="flex cursor-move items-center gap-2 rounded border border-slate-200 bg-slate-50 px-2 py-1.5 text-sm"
                          >
                            <span className="text-slate-300">⠿</span>
                            <span className="flex-1 truncate">
                              {p.brand} {p.model}
                            </span>
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => removeOne(p.id)}
                                className="h-5 w-5 rounded border border-slate-300 text-xs leading-none hover:bg-white"
                              >
                                −
                              </button>
                              <span className="w-6 text-center text-xs font-medium text-slate-700">{line.qty}</span>
                              <button
                                onClick={() => addOne(p)}
                                className="h-5 w-5 rounded border border-slate-300 text-xs leading-none hover:bg-white"
                              >
                                +
                              </button>
                            </div>
                            <div className="flex items-center gap-1 border-l border-slate-200 pl-2">
                              <button
                                onClick={() => setUnitsPerItem(line.id, line.unitsPerItem - 1)}
                                className="h-5 w-5 rounded border border-slate-300 text-xs leading-none hover:bg-white"
                                title="Высота одного экземпляра, U"
                              >
                                −
                              </button>
                              <span className="w-8 text-center text-xs text-slate-500">{line.unitsPerItem}U</span>
                              <button
                                onClick={() => setUnitsPerItem(line.id, line.unitsPerItem + 1)}
                                className="h-5 w-5 rounded border border-slate-300 text-xs leading-none hover:bg-white"
                                title="Высота одного экземпляра, U"
                              >
                                +
                              </button>
                            </div>
                            <button onClick={() => removeLine(line.id)} className="text-red-600 hover:underline">
                              Убрать
                            </button>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Rack elevation */}
        <div>
          <div className="no-print mb-3 flex items-center justify-between">
            <label className="text-sm font-medium text-slate-700">Высота стойки</label>
            <select
              className="rounded border border-slate-300 px-2 py-1 text-sm"
              value={rackHeight}
              onChange={(e) => setRackHeight(Number(e.target.value) as (typeof RACK_HEIGHTS)[number])}
            >
              {RACK_HEIGHTS.map((h) => (
                <option key={h} value={h}>
                  {h}U
                </option>
              ))}
            </select>
          </div>

          <div className="hidden print:block mb-3">
            <h1 className="text-lg font-semibold">Проект стойки {rackHeight}U</h1>
            <p className="text-sm text-slate-500">{new Date().toLocaleDateString('ru-RU')}</p>
          </div>

          <div className="mx-auto w-full max-w-[300px] rounded-md border-2 border-slate-800 bg-slate-900 p-1.5 print:break-inside-avoid">
            <div className="flex flex-col overflow-hidden rounded-sm bg-slate-950">
              {lines.map((line) => {
                const p = catalog.find((c) => c.id === line.productId)
                if (!p) return null
                const color = brandColor(p.brand)
                const heightU = line.qty * line.unitsPerItem
                return (
                  <div
                    key={line.id}
                    style={{ height: heightU * UNIT_PX, backgroundColor: `${color}22`, borderColor: color }}
                    className="flex items-center gap-2 border-b border-l-4 px-2 text-white"
                  >
                    <span className="shrink-0 rounded bg-black/30 px-1 text-[10px] leading-4">{heightU}U</span>
                    <span className="truncate text-xs font-medium">
                      {p.brand} {p.model}
                      {line.qty > 1 ? ` × ${line.qty}` : ''}
                    </span>
                  </div>
                )
              })}

              {!overCapacity && freeU > 0 && (
                <div
                  style={{ height: freeU * UNIT_PX, backgroundSize: `100% ${UNIT_PX}px` }}
                  className="bg-[repeating-linear-gradient(to_bottom,rgba(255,255,255,0.06)_0,rgba(255,255,255,0.06)_1px,transparent_1px,transparent_100%)] flex items-start justify-end p-1"
                >
                  <span className="text-[10px] text-slate-500">{freeU}U свободно</span>
                </div>
              )}
            </div>
          </div>

          {overCapacity && (
            <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
              Превышена высота стойки: {usedU}U из {rackHeight}U. Уберите позицию или выберите стойку выше.
            </div>
          )}

          <div className="mt-4 space-y-2 rounded-lg border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between text-sm text-slate-600">
              <span>Занято юнитов</span>
              <span className={overCapacity ? 'font-semibold text-red-600' : 'font-medium text-slate-900'}>
                {usedU} / {rackHeight}U
              </span>
            </div>
            <div className="flex items-center justify-between text-sm text-slate-600">
              <span>Позиций в стойке</span>
              <span className="font-medium text-slate-900">{totalItems}</span>
            </div>
            <div className="flex items-center justify-between border-t border-slate-100 pt-2 text-base">
              <span className="font-semibold text-slate-900">Итого оборудование</span>
              <span className="text-xl font-bold text-slate-900">${totalPrice.toLocaleString()}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
