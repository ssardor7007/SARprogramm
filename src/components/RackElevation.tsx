import type { CSSProperties } from 'react'
import { brandColor } from '../lib/brandTheme'
import type { RackLine } from '../lib/rackCart'
import { isRackMountable } from '../lib/rackMount'
import type { Product } from '../types'
import { ProductImage } from './ProductImage'

const UNIT_PX = 56

/** Перфорация на боковых рейках шкафа — ряд отверстий под крепёжные винты, как у настоящей стойки. */
const RAIL_HOLES_STYLE: CSSProperties = {
  backgroundImage: 'radial-gradient(circle, rgba(0,0,0,0.45) 1.2px, transparent 1.6px)',
  backgroundSize: '100% 14px',
  backgroundPosition: 'center',
}

interface Props {
  catalog: Product[]
  lines: RackLine[]
  rackHeight: number
}

/** Визуальный серверный шкаф (elevation view), встроенный в «Дизайнер серверного шкафа» на «Плане здания». */
export function RackElevation({ catalog, lines, rackHeight }: Props) {
  const rackLines = lines.filter((l) => {
    const p = catalog.find((c) => c.id === l.productId)
    return p !== undefined && isRackMountable(p)
  })
  const usedU = rackLines.reduce((sum, l) => sum + l.qty * l.unitsPerItem, 0)
  const overCapacity = usedU > rackHeight
  const freeU = Math.max(0, rackHeight - usedU)

  return (
    <div>
      <div className="mx-auto w-full max-w-[320px] print:break-inside-avoid">
        {/* Верхняя крышка шкафа — вентиляционные прорези и шильд */}
        <div className="flex items-center justify-between rounded-t-lg border-2 border-b-0 border-slate-600 bg-gradient-to-b from-slate-300 to-slate-400 px-2.5 py-1">
          <div className="flex gap-[3px]">
            {Array.from({ length: 12 }).map((_, i) => (
              <span key={i} className="h-2 w-[2.5px] rounded-full bg-slate-600/50" />
            ))}
          </div>
          <span className="text-[8px] font-bold tracking-wider text-slate-500">SAR</span>
        </div>

        {/* Корпус — боковые перфорированные рейки и стек юнитов */}
        <div className="flex border-2 border-slate-600 bg-slate-950">
          <div className="w-[7px] shrink-0 border-r border-slate-800 bg-slate-300" style={RAIL_HOLES_STYLE} />

          <div className="flex flex-1 flex-col overflow-hidden">
            {rackLines.map((line) => {
              const p = catalog.find((c) => c.id === line.productId)
              if (!p) return null
              const color = brandColor(p.brand)
              const heightU = line.qty * line.unitsPerItem
              return (
                <div
                  key={line.id}
                  style={{ height: heightU * UNIT_PX, borderColor: color }}
                  className="relative overflow-hidden border-b border-slate-800 border-l-4 bg-gradient-to-b from-slate-100 to-slate-200"
                >
                  <ProductImage imageUrl={p.imageUrl} brand={p.brand} category={p.category} size="fill" />

                  {/* винты крепления юнита в углах */}
                  <span className="absolute left-1 top-1 h-1.5 w-1.5 rounded-full bg-slate-400 shadow-inner" />
                  <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-slate-400 shadow-inner" />

                  <span className="absolute left-1/2 top-1 -translate-x-1/2 rounded bg-black/50 px-1 text-[9px] leading-4 text-white">
                    {heightU}U
                  </span>

                  <div className="absolute inset-x-0 bottom-0 truncate bg-black/70 px-1.5 py-0.5 text-[10px] font-medium leading-tight text-white">
                    {p.brand} {p.model}
                    {line.qty > 1 ? ` × ${line.qty}` : ''}
                  </div>
                </div>
              )
            })}

            {!overCapacity && freeU > 0 && (
              <div
                style={{ height: freeU * UNIT_PX, backgroundSize: `100% ${UNIT_PX}px` }}
                className="flex items-start justify-end bg-[repeating-linear-gradient(to_bottom,rgba(255,255,255,0.05)_0,rgba(255,255,255,0.05)_1px,transparent_1px,transparent_100%)] p-1"
              >
                <span className="text-[10px] text-slate-500">{freeU}U свободно</span>
              </div>
            )}
          </div>

          <div className="w-[7px] shrink-0 border-l border-slate-800 bg-slate-300" style={RAIL_HOLES_STYLE} />
        </div>

        {/* Нижняя крышка / ножки шкафа */}
        <div className="h-2.5 rounded-b-lg border-2 border-t-0 border-slate-600 bg-gradient-to-b from-slate-400 to-slate-500" />
      </div>

      {overCapacity && (
        <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          Превышена высота шкафа: {usedU}U из {rackHeight}U. Уберите позицию или выберите шкаф выше.
        </div>
      )}
    </div>
  )
}
