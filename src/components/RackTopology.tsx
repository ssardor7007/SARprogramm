import { CATEGORY_LABELS, type Category, type Product } from '../types'
import type { RackLine } from '../lib/rackCart'
import { ProductImage } from './ProductImage'

/** Точки доступа и камеры не в шкафу — подключаются к его портам кабелем, поэтому здесь их и рисуем «веткой». */
const WALL_MOUNTED_CATEGORIES = new Set<Category>(['ap', 'camera'])

interface Props {
  catalog: Product[]
  lines: RackLine[]
}

/** Схема подключений справа от шкафа: веткой расходится к оборудованию, которое стоит на объекте. */
export function RackTopology({ catalog, lines }: Props) {
  const groups = new Map<Category, { line: RackLine; product: Product }[]>()
  for (const line of lines) {
    const p = catalog.find((c) => c.id === line.productId)
    if (!p || !WALL_MOUNTED_CATEGORIES.has(p.category)) continue
    const arr = groups.get(p.category) ?? []
    arr.push({ line, product: p })
    groups.set(p.category, arr)
  }
  const entries = Array.from(groups.entries())
  if (entries.length === 0) return null

  return (
    <div className="relative flex flex-col gap-4 pl-6">
      {entries.length > 1 && <div className="absolute left-0 top-4 bottom-4 w-px bg-slate-300" />}
      {entries.map(([category, items]) => (
        <div key={category} className="relative">
          <div className="absolute -left-6 top-4 h-px w-6 bg-slate-300" />
          <div className="w-60 rounded-lg border border-slate-200 bg-white p-3">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">{CATEGORY_LABELS[category]}</div>
            <div className="space-y-2">
              {items.map(({ line, product: p }) => (
                <div key={line.id} className="flex items-center gap-2 text-sm">
                  <ProductImage imageUrl={p.imageUrl} brand={p.brand} category={p.category} size="xs" />
                  <span className="min-w-0 flex-1 truncate text-slate-700">
                    {p.brand} {p.model}
                  </span>
                  <span className="shrink-0 text-xs text-slate-400">× {line.qty}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
