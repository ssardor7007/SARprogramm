import { CATEGORY_LABELS, PRICE_CATEGORY_LABELS } from '../types'
import type { CompetitorProduct, Product } from '../types'
import { stockLabel } from '../lib/matching'
import { ProductImage } from './ProductImage'

interface Props {
  competitor?: CompetitorProduct
  own: Product
  ownAlternatives: Product[]
  qty: number
  onQtyChange: (qty: number) => void
  onOwnChange: (ownId: string) => void
  onRemove: () => void
}

const stockToneClass: Record<'ok' | 'low' | 'out', string> = {
  ok: 'text-emerald-700 bg-emerald-50',
  low: 'text-amber-700 bg-amber-50',
  out: 'text-red-700 bg-red-50',
}

export function ComparisonCard({ competitor, own, ownAlternatives, qty, onQtyChange, onOwnChange, onRemove }: Props) {
  const stock = stockLabel(own.stock)
  const specKeys = Array.from(new Set([...(competitor ? Object.keys(competitor.specs) : []), ...Object.keys(own.specs)]))
  const priceDiff = competitor ? own.priceUSD - competitor.priceUSD : undefined

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 print:break-inside-avoid">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">
          {CATEGORY_LABELS[own.category]}
        </span>
        <button onClick={onRemove} className="no-print text-sm text-red-600 hover:underline">
          Убрать из КП
        </button>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-4">
        {competitor && (
          <>
            <div className="flex items-center gap-2">
              <ProductImage imageUrl={competitor.imageUrl} brand={competitor.brand} category={competitor.category} />
              <div className="text-sm">
                <div className="text-xs text-slate-400">Из списка клиента</div>
                <div className="font-medium text-slate-700">
                  {competitor.brand} {competitor.model}
                </div>
                <div className="text-slate-400">${competitor.priceUSD}</div>
              </div>
            </div>
            <span className="text-xl text-slate-300">→</span>
          </>
        )}
        <ProductImage imageUrl={own.imageUrl} brand={own.brand} category={own.category} />
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-3">
        <div className="no-print flex-1 min-w-[220px]">
          <label className="block text-xs font-medium text-slate-500">Наш вариант</label>
          <select
            className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
            value={own.id}
            onChange={(e) => onOwnChange(e.target.value)}
          >
            {ownAlternatives.map((alt) => (
              <option key={alt.id} value={alt.id}>
                {alt.brand} {alt.model} — ${alt.priceUSD}
              </option>
            ))}
          </select>
        </div>
        <div className="hidden print:block font-semibold text-slate-900">
          Наш вариант: {own.brand} {own.model}
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500">Кол-во</label>
          <input
            type="number"
            min={1}
            className="no-print mt-1 w-20 rounded border border-slate-300 px-2 py-1.5 text-sm"
            value={qty}
            onChange={(e) => onQtyChange(Math.max(1, Number(e.target.value)))}
          />
          <span className="hidden print:inline">{qty} шт.</span>
        </div>
        <div className="ml-auto text-right">
          <div className="text-lg font-semibold text-slate-900">${(own.priceUSD * qty).toLocaleString()}</div>
          <div className="text-xs text-slate-400">
            ${own.priceUSD} × {qty} · {PRICE_CATEGORY_LABELS[own.priceCategory]}
          </div>
        </div>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className={`rounded px-2 py-0.5 text-xs font-medium ${stockToneClass[stock.tone]}`}>{stock.text}</span>
        {priceDiff !== undefined && (
          <span
            className={`rounded px-2 py-0.5 text-xs font-medium ${
              priceDiff <= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
            }`}
          >
            {priceDiff <= 0
              ? `Дешевле на $${Math.abs(priceDiff).toLocaleString()} за штуку`
              : `Дороже на $${priceDiff.toLocaleString()} за штуку`}
          </span>
        )}
      </div>

      {specKeys.length > 0 && (
        <table className="mb-3 w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-slate-400">
              <th className="w-1/3 py-1 font-normal">Характеристика</th>
              {competitor && <th className="w-1/3 py-1 font-normal">{competitor.brand}</th>}
              <th className="w-1/3 py-1 font-normal">{own.brand}</th>
            </tr>
          </thead>
          <tbody>
            {specKeys.map((key) => (
              <tr key={key} className="border-t border-slate-100">
                <td className="py-1 pr-2 text-slate-500">{key}</td>
                {competitor && <td className="py-1 pr-2 text-slate-700">{competitor.specs[key] ?? '—'}</td>}
                <td className="py-1 text-slate-900">{own.specs[key] ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {(own.pros.length > 0 || own.cons.length > 0) && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {own.pros.length > 0 && (
            <div>
              <div className="mb-1 text-xs font-medium text-emerald-700">Плюсы нашего варианта</div>
              <ul className="space-y-0.5 text-sm text-slate-700">
                {own.pros.map((pro, i) => (
                  <li key={i}>+ {pro}</li>
                ))}
              </ul>
            </div>
          )}
          {own.cons.length > 0 && (
            <div>
              <div className="mb-1 text-xs font-medium text-amber-700">Минусы</div>
              <ul className="space-y-0.5 text-sm text-slate-700">
                {own.cons.map((con, i) => (
                  <li key={i}>− {con}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
      {competitor?.notes && (
        <div className="mt-2 rounded bg-blue-50 px-2 py-1 text-xs text-blue-800">{competitor.notes}</div>
      )}
    </div>
  )
}
