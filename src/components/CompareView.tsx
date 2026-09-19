import { useMemo, useState } from 'react'
import type { CompetitorProduct, Product, QuoteLine } from '../types'
import { alternativesInCategory, findBestMatch } from '../lib/matching'
import { genId } from '../lib/storage'
import { ComparisonCard } from './ComparisonCard'

interface Props {
  competitorCatalog: CompetitorProduct[]
  ownCatalog: Product[]
}

export function CompareView({ competitorCatalog, ownCatalog }: Props) {
  const [lines, setLines] = useState<QuoteLine[]>([])
  const [search, setSearch] = useState('')
  const [clientName, setClientName] = useState('')

  const searchResults = useMemo(() => {
    if (!search.trim()) return []
    const q = search.trim().toLowerCase()
    return competitorCatalog
      .filter((p) => `${p.brand} ${p.model}`.toLowerCase().includes(q))
      .slice(0, 8)
  }, [search, competitorCatalog])

  function addCompetitorItem(cp: CompetitorProduct) {
    const match = findBestMatch(cp, ownCatalog)
    if (!match) {
      alert('В своём каталоге нет товаров в этой категории — сначала добавьте аналог в «Мой каталог».')
      return
    }
    setLines((prev) => [...prev, { id: genId('line'), competitorProductId: cp.id, ownProductId: match.id, qty: 1 }])
    setSearch('')
  }

  function addOwnItemDirectly(product: Product) {
    setLines((prev) => [...prev, { id: genId('line'), ownProductId: product.id, qty: 1 }])
  }

  function updateLine(id: string, patch: Partial<QuoteLine>) {
    setLines((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)))
  }

  function removeLine(id: string) {
    setLines((prev) => prev.filter((l) => l.id !== id))
  }

  const total = lines.reduce((sum, l) => {
    const own = ownCatalog.find((p) => p.id === l.ownProductId)
    return sum + (own ? own.priceUSD * l.qty : 0)
  }, 0)

  const competitorTotal = lines.reduce((sum, l) => {
    if (!l.competitorProductId) return sum
    const cp = competitorCatalog.find((p) => p.id === l.competitorProductId)
    return sum + (cp ? cp.priceUSD * l.qty : 0)
  }, 0)

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3 no-print">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Сравнение и коммерческое предложение</h1>
          <p className="text-sm text-slate-500">
            Внесите список оборудования, который принёс клиент — система подберёт аналоги из вашего каталога.
          </p>
        </div>
        {lines.length > 0 && (
          <button
            onClick={() => window.print()}
            className="rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700"
          >
            Печать / сохранить как PDF
          </button>
        )}
      </div>

      <div className="mb-6 rounded-lg border border-slate-200 bg-white p-4 no-print">
        <div className="mb-3">
          <label className="block text-sm font-medium text-slate-700">Клиент / объект (для шапки КП)</label>
          <input
            className="mt-1 w-full max-w-sm rounded border border-slate-300 px-2 py-1.5 text-sm"
            placeholder="Например: ТОО «Ромашка», офис в Ташкенте"
            value={clientName}
            onChange={(e) => setClientName(e.target.value)}
          />
        </div>
        <label className="block text-sm font-medium text-slate-700">Найти товар конкурента из списка клиента</label>
        <input
          className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
          placeholder="Например: RG-EG105G или Ubiquiti U6-LR"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {searchResults.length > 0 && (
          <div className="mt-2 divide-y divide-slate-100 rounded border border-slate-200">
            {searchResults.map((cp) => (
              <button
                key={cp.id}
                onClick={() => addCompetitorItem(cp)}
                className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-slate-50"
              >
                <span>
                  <span className="font-medium">{cp.brand} {cp.model}</span>{' '}
                  <span className="text-slate-400">${cp.priceUSD}</span>
                </span>
                <span className="text-blue-600">+ добавить</span>
              </button>
            ))}
          </div>
        )}
        {search.trim() && searchResults.length === 0 && (
          <p className="mt-2 text-sm text-slate-400">
            Не найдено в каталоге конкурентов. Добавьте его во вкладке «Конкуренты», либо выберите свой товар напрямую ниже.
          </p>
        )}

        <details className="mt-3">
          <summary className="cursor-pointer text-sm font-medium text-blue-600">
            + добавить свой товар в КП напрямую (без сравнения)
          </summary>
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {ownCatalog.map((p) => (
              <button
                key={p.id}
                onClick={() => addOwnItemDirectly(p)}
                className="rounded border border-slate-200 px-2 py-1.5 text-left text-xs hover:bg-slate-50"
              >
                {p.brand} {p.model}
              </button>
            ))}
          </div>
        </details>
      </div>

      {lines.length === 0 ? (
        <p className="text-sm text-slate-400 no-print">Список пуст. Найдите товар конкурента выше, чтобы начать.</p>
      ) : (
        <div>
          <div className="hidden print:block mb-4">
            <h1 className="text-xl font-semibold">Коммерческое предложение</h1>
            {clientName && <p className="text-slate-600">{clientName}</p>}
            <p className="text-sm text-slate-400">{new Date().toLocaleDateString('ru-RU')}</p>
          </div>

          <div className="space-y-3">
            {lines.map((line) => {
              const own = ownCatalog.find((p) => p.id === line.ownProductId)
              if (!own) return null
              const competitor = line.competitorProductId
                ? competitorCatalog.find((p) => p.id === line.competitorProductId)
                : undefined
              const alternatives = alternativesInCategory(own.category, ownCatalog)
              return (
                <ComparisonCard
                  key={line.id}
                  competitor={competitor}
                  own={own}
                  ownAlternatives={alternatives}
                  qty={line.qty}
                  onQtyChange={(qty) => updateLine(line.id, { qty })}
                  onOwnChange={(ownId) => updateLine(line.id, { ownProductId: ownId })}
                  onRemove={() => removeLine(line.id)}
                />
              )
            })}
          </div>

          <div className="mt-6 rounded-lg border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between text-sm text-slate-500">
              <span>Позиций: {lines.length}</span>
              {competitorTotal > 0 && <span>Сумма по списку клиента (ориентировочно): ${competitorTotal.toLocaleString()}</span>}
            </div>
            <div className="mt-1 flex items-center justify-between">
              <span className="text-lg font-semibold text-slate-900">Итого наше предложение</span>
              <span className="text-2xl font-bold text-slate-900">${total.toLocaleString()}</span>
            </div>
            {competitorTotal > 0 && (
              <div className={`mt-1 text-sm font-medium ${total <= competitorTotal ? 'text-emerald-700' : 'text-amber-700'}`}>
                {total <= competitorTotal
                  ? `Выгода клиента: $${(competitorTotal - total).toLocaleString()}`
                  : `Дороже списка клиента на $${(total - competitorTotal).toLocaleString()} — используйте плюсы товаров выше, чтобы обосновать разницу`}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
