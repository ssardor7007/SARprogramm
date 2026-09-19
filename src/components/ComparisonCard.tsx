import { CATEGORY_LABELS, PRICE_CATEGORY_LABELS } from '../types'
import type { Product } from '../types'
import { stockLabel } from '../lib/matching'
import { ProductImage } from './ProductImage'

interface Props {
  reference?: Product
  offer: Product
  alternatives: Product[]
  qty: number
  onQtyChange: (qty: number) => void
  onOfferChange: (id: string) => void
  onRemove: () => void
}

const stockToneClass: Record<'ok' | 'low' | 'out', string> = {
  ok: 'text-emerald-700 bg-emerald-50',
  low: 'text-amber-700 bg-amber-50',
  out: 'text-red-700 bg-red-50',
}

export function ComparisonCard({ reference, offer, alternatives, qty, onQtyChange, onOfferChange, onRemove }: Props) {
  const stock = stockLabel(offer.stock)
  const specKeys = Array.from(new Set([...(reference ? Object.keys(reference.specs) : []), ...Object.keys(offer.specs)]))
  const priceDiff = reference ? offer.priceUSD - reference.priceUSD : undefined

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 print:break-inside-avoid">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">
          {CATEGORY_LABELS[offer.category]}
        </span>
        <button onClick={onRemove} className="no-print text-sm text-red-600 hover:underline">
          Убрать из КП
        </button>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-4">
        {reference && (
          <>
            <div className="flex items-center gap-2">
              <ProductImage imageUrl={reference.imageUrl} brand={reference.brand} category={reference.category} />
              <div className="text-sm">
                <div className="text-xs text-slate-400">Ориентир</div>
                <div className="font-medium text-slate-700">
                  {reference.brand} {reference.model}
                </div>
                <div className="text-slate-400">${reference.priceUSD}</div>
              </div>
            </div>
            <span className="text-xl text-slate-300">→</span>
          </>
        )}
        <ProductImage imageUrl={offer.imageUrl} brand={offer.brand} category={offer.category} />
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-3">
        <div className="no-print flex-1 min-w-[220px]">
          <label className="block text-xs font-medium text-slate-500">Наше предложение</label>
          <select
            className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
            value={offer.id}
            onChange={(e) => onOfferChange(e.target.value)}
          >
            {alternatives.map((alt) => (
              <option key={alt.id} value={alt.id}>
                {alt.brand} {alt.model} — ${alt.priceUSD}
              </option>
            ))}
          </select>
        </div>
        <div className="hidden print:block font-semibold text-slate-900">
          Предложение: {offer.brand} {offer.model}
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
          <div className="text-lg font-semibold text-slate-900">${(offer.priceUSD * qty).toLocaleString()}</div>
          <div className="text-xs text-slate-400">
            ${offer.priceUSD} × {qty} · {PRICE_CATEGORY_LABELS[offer.priceCategory]}
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
              {reference && <th className="w-1/3 py-1 font-normal">{reference.brand}</th>}
              <th className="w-1/3 py-1 font-normal">{offer.brand}</th>
            </tr>
          </thead>
          <tbody>
            {specKeys.map((key) => (
              <tr key={key} className="border-t border-slate-100">
                <td className="py-1 pr-2 text-slate-500">{key}</td>
                {reference && <td className="py-1 pr-2 text-slate-700">{reference.specs[key] ?? '—'}</td>}
                <td className="py-1 text-slate-900">{offer.specs[key] ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {(offer.pros.length > 0 || offer.cons.length > 0) && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {offer.pros.length > 0 && (
            <div>
              <div className="mb-1 text-xs font-medium text-emerald-700">Плюсы</div>
              <ul className="space-y-0.5 text-sm text-slate-700">
                {offer.pros.map((pro, i) => (
                  <li key={i}>+ {pro}</li>
                ))}
              </ul>
            </div>
          )}
          {offer.cons.length > 0 && (
            <div>
              <div className="mb-1 text-xs font-medium text-amber-700">Минусы</div>
              <ul className="space-y-0.5 text-sm text-slate-700">
                {offer.cons.map((con, i) => (
                  <li key={i}>− {con}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
      {reference?.notes && <div className="mt-2 rounded bg-blue-50 px-2 py-1 text-xs text-blue-800">{reference.notes}</div>}
    </div>
  )
}
