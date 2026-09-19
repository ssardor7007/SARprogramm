import { useMemo, useState } from 'react'
import type { Product } from '../types'
import { brandColor } from '../lib/brandTheme'
import { genId, usePersistedState } from '../lib/storage'
import { ProductImage } from './ProductImage'

interface Props {
  catalog: Product[]
}

interface RackItem {
  id: string
  productId: string
  units: number
}

const UNIT_PX = 22
const RACK_HEIGHTS = [12, 24, 42] as const

export function RackDesignerView({ catalog }: Props) {
  const [rackHeight, setRackHeight] = usePersistedState<(typeof RACK_HEIGHTS)[number]>('rack-height', 42)
  const [items, setItems] = usePersistedState<RackItem[]>('rack-items', [])
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

  function addItem(product: Product) {
    setItems((prev) => [...prev, { id: genId('rack'), productId: product.id, units: 1 }])
  }

  function removeItem(id: string) {
    setItems((prev) => prev.filter((i) => i.id !== id))
  }

  function setUnits(id: string, units: number) {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, units: Math.min(8, Math.max(1, units)) } : i)))
  }

  function moveItem(from: number, to: number) {
    setItems((prev) => {
      const next = [...prev]
      const [moved] = next.splice(from, 1)
      next.splice(to, 0, moved)
      return next
    })
  }

  const usedU = items.reduce((sum, i) => sum + i.units, 0)
  const totalPrice = items.reduce((sum, i) => {
    const p = catalog.find((c) => c.id === i.productId)
    return sum + (p ? p.priceUSD : 0)
  }, 0)
  const overCapacity = usedU > rackHeight
  const freeU = Math.max(0, rackHeight - usedU)

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3 no-print">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Дизайнер стойки</h1>
          <p className="text-sm text-slate-500">
            Соберите проект как в UniFi Design Center — но из оборудования любого бренда каталога. Добавляйте
            позиции, перетаскивайте для смены порядка, подгоняйте высоту в юнитах.
          </p>
        </div>
        {items.length > 0 && (
          <div className="flex gap-2">
            <button
              onClick={() => {
                if (confirm('Очистить текущий проект стойки?')) setItems([])
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

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_300px]">
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
              <div className="max-h-80 divide-y divide-slate-100 overflow-y-auto rounded border border-slate-200">
                {searchResults.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => addItem(p)}
                    className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-slate-50"
                  >
                    <ProductImage imageUrl={p.imageUrl} brand={p.brand} category={p.category} size="sm" />
                    <span className="flex-1">
                      <span className="font-medium text-slate-900">
                        {p.brand} {p.model}
                      </span>{' '}
                      <span className="text-slate-400">${p.priceUSD}</span>
                    </span>
                    <span className="text-blue-600">+ в стойку</span>
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-400">Введите название/модель или выберите бренд, чтобы найти оборудование.</p>
            )}
          </div>

          {items.length > 0 && (
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <h2 className="mb-2 text-sm font-semibold text-slate-700">Список в стойке (сверху вниз — так же, как в элевации справа)</h2>
              <div className="space-y-1">
                {items.map((item, i) => {
                  const p = catalog.find((c) => c.id === item.productId)
                  if (!p) return null
                  return (
                    <div
                      key={item.id}
                      draggable
                      onDragStart={() => setDragIndex(i)}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={() => {
                        if (dragIndex !== null && dragIndex !== i) moveItem(dragIndex, i)
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
                          onClick={() => setUnits(item.id, item.units - 1)}
                          className="h-5 w-5 rounded border border-slate-300 text-xs leading-none hover:bg-white"
                        >
                          −
                        </button>
                        <span className="w-8 text-center text-xs text-slate-500">{item.units}U</span>
                        <button
                          onClick={() => setUnits(item.id, item.units + 1)}
                          className="h-5 w-5 rounded border border-slate-300 text-xs leading-none hover:bg-white"
                        >
                          +
                        </button>
                      </div>
                      <button onClick={() => removeItem(item.id)} className="text-red-600 hover:underline">
                        Убрать
                      </button>
                    </div>
                  )
                })}
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
              {items.map((item) => {
                const p = catalog.find((c) => c.id === item.productId)
                if (!p) return null
                const color = brandColor(p.brand)
                return (
                  <div
                    key={item.id}
                    style={{ height: item.units * UNIT_PX, backgroundColor: `${color}22`, borderColor: color }}
                    className="flex items-center gap-2 border-b border-l-4 px-2 text-white"
                  >
                    <span className="shrink-0 rounded bg-black/30 px-1 text-[10px] leading-4">{item.units}U</span>
                    <span className="truncate text-xs font-medium">
                      {p.brand} {p.model}
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
              <span className="font-medium text-slate-900">{items.length}</span>
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
