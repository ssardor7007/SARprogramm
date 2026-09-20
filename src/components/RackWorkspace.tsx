import { useMemo, useState } from 'react'
import { CATEGORY_LABELS } from '../types'
import type { Category, Product } from '../types'
import type { RackLine } from '../lib/rackCart'
import { isRackMountable } from '../lib/rackMount'
import { genId, usePersistedState } from '../lib/storage'
import { ProductImage } from './ProductImage'
import { RackElevation } from './RackElevation'

interface Props {
  catalog: Product[]
}

const RACK_HEIGHTS = [12, 24, 42] as const
const CATEGORY_ORDER: Category[] = ['router', 'switch', 'ap', 'camera', 'nvr', 'other']

/** Интерактивная рабочая область серверного шкафа — поиск/добавление оборудования, сам шкаф и то, что
 * подключено к нему, но стоит на объекте. Встраивается в «План здания», как физическая часть проекта. */
export function RackWorkspace({ catalog }: Props) {
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

  function productOf(line: RackLine): Product | undefined {
    return catalog.find((c) => c.id === line.productId)
  }

  const rackLines = lines.filter((l) => {
    const p = productOf(l)
    return p !== undefined && isRackMountable(p)
  })
  const wallLines = lines.filter((l) => {
    const p = productOf(l)
    return p !== undefined && !isRackMountable(p)
  })

  const usedU = rackLines.reduce((sum, l) => sum + l.qty * l.unitsPerItem, 0)
  const totalItems = lines.reduce((sum, l) => sum + l.qty, 0)
  const totalPrice = lines.reduce((sum, l) => {
    const p = catalog.find((c) => c.id === l.productId)
    return sum + (p ? p.priceUSD * l.qty : 0)
  }, 0)
  const overCapacity = usedU > rackHeight

  function groupByCategory(list: RackLine[]) {
    const groups = new Map<Category, RackLine[]>()
    for (const line of list) {
      const p = catalog.find((c) => c.id === line.productId)
      if (!p) continue
      const arr = groups.get(p.category) ?? []
      arr.push(line)
      groups.set(p.category, arr)
    }
    return CATEGORY_ORDER.filter((c) => groups.has(c)).map((c) => ({ category: c, items: groups.get(c)! }))
  }

  const groupedRackLines = useMemo(() => groupByCategory(rackLines), [rackLines, catalog])
  const groupedWallLines = useMemo(() => groupByCategory(wallLines), [wallLines, catalog])

  return (
    <div>
      {lines.length > 0 && (
        <div className="no-print mb-3 flex justify-end">
          <button
            onClick={() => {
              if (confirm('Очистить текущий проект шкафа?')) setLines([])
            }}
            className="rounded border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100"
          >
            Очистить шкаф
          </button>
        </div>
      )}

      {/* Рабочая область в три колонки — каждая со своей прокруткой, как в UniFi Design Center: не листаем всю
          страницу, а прокручиваем только тот блок, который сейчас смотрим. */}
      <div className="flex flex-col gap-4 overflow-x-auto pb-2 print:flex-col lg:flex-row">
        {/* Колонка 1: поиск/добавление оборудования в шкаф + список того, что уже добавлено */}
        <div
          className="flex w-full shrink-0 flex-col rounded-lg border border-slate-200 bg-white print:h-auto print:max-h-none print:w-full print:overflow-visible lg:w-[22rem]"
          style={{ height: 'min(72vh, 640px)' }}
        >
          <div className="no-print shrink-0 border-b border-slate-100 p-3">
            <div className="flex flex-wrap gap-2">
              <input
                className="min-w-[160px] flex-1 rounded border border-slate-300 px-2 py-1.5 text-sm"
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
          </div>

          <div className="flex-1 overflow-y-auto p-3 print:overflow-visible">
            {searchResults.length > 0 ? (
              <div className="no-print mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-2">
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
              <p className="no-print mb-4 text-sm text-slate-400">
                Введите название/модель или выберите бренд, чтобы найти оборудование.
              </p>
            )}

            {groupedRackLines.length > 0 && (
              <div>
                <h2 className="mb-1 text-sm font-semibold text-slate-700">Список в шкафу, по категориям</h2>
                <p className="mb-3 text-xs text-slate-400">
                  Роутеры, коммутаторы, NVR и аксессуары, которые физически монтируются в серверный шкаф.
                </p>
                <div className="space-y-4">
                  {groupedRackLines.map(({ category, items }) => (
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
                              <span className="no-print text-slate-300">⠿</span>
                              <span className="flex-1 truncate">
                                {p.brand} {p.model}
                              </span>
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => removeOne(p.id)}
                                  className="no-print h-5 w-5 rounded border border-slate-300 text-xs leading-none hover:bg-white"
                                >
                                  −
                                </button>
                                <span className="w-6 text-center text-xs font-medium text-slate-700">{line.qty}</span>
                                <button
                                  onClick={() => addOne(p)}
                                  className="no-print h-5 w-5 rounded border border-slate-300 text-xs leading-none hover:bg-white"
                                >
                                  +
                                </button>
                              </div>
                              <div className="no-print flex items-center gap-1 border-l border-slate-200 pl-2">
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
                              <button onClick={() => removeLine(line.id)} className="no-print text-red-600 hover:underline">
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
        </div>

        {/* Колонка 2: сам шкаф — прокручивается независимо, если юнитов больше, чем помещается на экране */}
        <div
          className="flex w-full shrink-0 flex-col rounded-lg border border-slate-200 bg-white print:h-auto print:max-h-none print:w-full print:overflow-visible lg:w-[22rem]"
          style={{ height: 'min(72vh, 640px)' }}
        >
          <div className="hidden shrink-0 p-3 print:block">
            <h1 className="text-lg font-semibold">Проект шкафа {rackHeight}U</h1>
            <p className="text-sm text-slate-500">{new Date().toLocaleDateString('ru-RU')}</p>
          </div>

          <div className="flex-1 overflow-y-auto p-3 print:overflow-visible">
            <RackElevation catalog={catalog} lines={lines} rackHeight={rackHeight} />
          </div>

          <div className="no-print flex shrink-0 items-center justify-between border-t border-slate-100 px-3 py-2">
            <span className="text-sm font-medium text-slate-700">Шкаф 1</span>
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
        </div>

        {/* Колонка 3: оборудование, подключённое к шкафу, но стоящее на объекте — тоже со своей прокруткой */}
        <div
          className="flex w-full shrink-0 flex-col rounded-lg border border-slate-200 bg-white print:h-auto print:max-h-none print:w-full print:overflow-visible lg:w-[22rem]"
          style={{ height: 'min(72vh, 640px)' }}
        >
          <div className="shrink-0 border-b border-slate-100 p-3">
            <h2 className="text-sm font-semibold text-slate-700">Устанавливается на объекте — не в шкафу</h2>
            <p className="mt-1 text-xs text-slate-400">
              Точки доступа, камеры и настольные модели без крепления в стойку (по характеристикам товара) — стоят
              на объекте и подключаются кабелем к порту коммутатора. В юниты шкафа не входят, но учтены в общей
              смете ниже.
            </p>
          </div>
          <div className="flex-1 overflow-y-auto p-3 print:overflow-visible">
            {groupedWallLines.length > 0 ? (
              <div className="space-y-4">
                {groupedWallLines.map(({ category, items }) => (
                  <div key={category}>
                    <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
                      {CATEGORY_LABELS[category]}
                    </div>
                    <div className="space-y-1">
                      {items.map((line) => {
                        const p = catalog.find((c) => c.id === line.productId)
                        if (!p) return null
                        return (
                          <div
                            key={line.id}
                            className="flex items-center gap-2 rounded border border-slate-200 bg-slate-50 px-2 py-1.5 text-sm"
                          >
                            <ProductImage imageUrl={p.imageUrl} brand={p.brand} category={p.category} size="xs" />
                            <span className="min-w-0 flex-1 truncate">
                              {p.brand} {p.model}
                            </span>
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => removeOne(p.id)}
                                className="no-print h-5 w-5 rounded border border-slate-300 text-xs leading-none hover:bg-white"
                              >
                                −
                              </button>
                              <span className="w-6 text-center text-xs font-medium text-slate-700">{line.qty}</span>
                              <button
                                onClick={() => addOne(p)}
                                className="no-print h-5 w-5 rounded border border-slate-300 text-xs leading-none hover:bg-white"
                              >
                                +
                              </button>
                            </div>
                            <button onClick={() => removeLine(line.id)} className="no-print text-red-600 hover:underline">
                              Убрать
                            </button>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-400">
                Найдите точку доступа или камеру в поиске слева и добавьте её — она появится здесь.
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="mt-4 space-y-2 rounded-lg border border-slate-200 bg-white p-4">
        <div className="flex items-center justify-between text-sm text-slate-600">
          <span>Занято юнитов</span>
          <span className={overCapacity ? 'font-semibold text-red-600' : 'font-medium text-slate-900'}>
            {usedU} / {rackHeight}U
          </span>
        </div>
        <div className="flex items-center justify-between text-sm text-slate-600">
          <span>Позиций в проекте</span>
          <span className="font-medium text-slate-900">{totalItems}</span>
        </div>
        {wallLines.length > 0 && (
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>из них вне шкафа (без крепления в стойку)</span>
            <span>{wallLines.reduce((sum, l) => sum + l.qty, 0)}</span>
          </div>
        )}
        <div className="flex items-center justify-between border-t border-slate-100 pt-2 text-base">
          <span className="font-semibold text-slate-900">Итого оборудование</span>
          <span className="text-xl font-bold text-slate-900">${totalPrice.toLocaleString()}</span>
        </div>
      </div>
    </div>
  )
}
