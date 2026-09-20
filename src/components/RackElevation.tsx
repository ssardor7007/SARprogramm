import { brandColor } from '../lib/brandTheme'
import type { RackLine } from '../lib/rackCart'
import type { Category, Product } from '../types'
import { ProductImage } from './ProductImage'

const UNIT_PX = 28

/** Точки доступа и камеры монтируются на стене/потолке объекта, а не в шкаф — не занимают юниты. */
const WALL_MOUNTED_CATEGORIES = new Set<Category>(['ap', 'camera'])
function isRackMountable(category: Category) {
  return !WALL_MOUNTED_CATEGORIES.has(category)
}

interface Props {
  catalog: Product[]
  lines: RackLine[]
  rackHeight: number
}

/** Визуальный серверный шкаф (elevation view) — общий вид для «Дизайнера серверного шкафа» и «Плана здания». */
export function RackElevation({ catalog, lines, rackHeight }: Props) {
  const rackLines = lines.filter((l) => {
    const p = catalog.find((c) => c.id === l.productId)
    return p !== undefined && isRackMountable(p.category)
  })
  const usedU = rackLines.reduce((sum, l) => sum + l.qty * l.unitsPerItem, 0)
  const overCapacity = usedU > rackHeight
  const freeU = Math.max(0, rackHeight - usedU)

  return (
    <div>
      <div className="mx-auto w-full max-w-[300px] rounded-md border-2 border-slate-800 bg-slate-900 p-1.5 print:break-inside-avoid">
        <div className="flex flex-col overflow-hidden rounded-sm bg-slate-950">
          {rackLines.map((line) => {
            const p = catalog.find((c) => c.id === line.productId)
            if (!p) return null
            const color = brandColor(p.brand)
            const heightU = line.qty * line.unitsPerItem
            return (
              <div
                key={line.id}
                style={{ height: heightU * UNIT_PX, backgroundColor: `${color}22`, borderColor: color }}
                className="flex items-center gap-1.5 border-b border-l-4 px-1.5 text-white"
              >
                <ProductImage imageUrl={p.imageUrl} brand={p.brand} category={p.category} size="xs" />
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
          Превышена высота шкафа: {usedU}U из {rackHeight}U. Уберите позицию или выберите шкаф выше.
        </div>
      )}
    </div>
  )
}
