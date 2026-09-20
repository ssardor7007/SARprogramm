import { useMemo, useState } from 'react'
import type { Product, QuoteLine } from '../types'
import { COMPANY_ADDRESS, COMPANY_NAME, COMPANY_TAGLINE, WHATSAPP_DISPLAY, whatsappLink } from '../lib/contacts'
import { alternativesInCategory, findBestMatch } from '../lib/matching'
import { genId } from '../lib/storage'
import { ComparisonCard } from './ComparisonCard'

interface Props {
  catalog: Product[]
}

function formatQuoteNumber(date: Date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase()
  return `КП-${y}${m}${d}-${suffix}`
}

export function QuoteView({ catalog }: Props) {
  const [lines, setLines] = useState<QuoteLine[]>([])
  const [search, setSearch] = useState('')
  const [clientName, setClientName] = useState('')
  const [quoteDate] = useState(() => new Date())
  const [quoteNumber] = useState(() => formatQuoteNumber(quoteDate))

  const searchResults = useMemo(() => {
    if (!search.trim()) return []
    const q = search.trim().toLowerCase()
    return catalog.filter((p) => `${p.brand} ${p.model}`.toLowerCase().includes(q)).slice(0, 8)
  }, [search, catalog])

  function addReferenceItem(reference: Product) {
    const match = findBestMatch(reference, catalog)
    if (!match) {
      alert('В каталоге нет других товаров в этой категории — сначала добавьте их в «Каталог».')
      return
    }
    setLines((prev) => [...prev, { id: genId('line'), referenceProductId: reference.id, productId: match.id, qty: 1 }])
    setSearch('')
  }

  function addItemDirectly(product: Product) {
    setLines((prev) => [...prev, { id: genId('line'), productId: product.id, qty: 1 }])
  }

  function updateLine(id: string, patch: Partial<QuoteLine>) {
    setLines((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)))
  }

  function removeLine(id: string) {
    setLines((prev) => prev.filter((l) => l.id !== id))
  }

  const total = lines.reduce((sum, l) => {
    const p = catalog.find((p) => p.id === l.productId)
    return sum + (p ? p.priceUSD * l.qty : 0)
  }, 0)

  const referenceTotal = lines.reduce((sum, l) => {
    if (!l.referenceProductId) return sum
    const ref = catalog.find((p) => p.id === l.referenceProductId)
    return sum + (ref ? ref.priceUSD * l.qty : 0)
  }, 0)

  function buildWhatsappMessage() {
    const parts = [`Коммерческое предложение ${quoteNumber} от ${COMPANY_NAME}`]
    if (clientName) parts.push(`Клиент: ${clientName}`)
    parts.push('')
    for (const line of lines) {
      const offer = catalog.find((p) => p.id === line.productId)
      if (!offer) continue
      parts.push(`• ${offer.brand} ${offer.model} × ${line.qty} — $${(offer.priceUSD * line.qty).toLocaleString()}`)
    }
    parts.push('')
    parts.push(`Итого: $${total.toLocaleString()}`)
    return parts.join('\n')
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3 no-print">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Коммерческое предложение</h1>
          <p className="text-sm text-slate-500">
            Добавьте товары в предложение. Если клиент принёс список конкурента — впишите его модель, система сама
            подберёт наш аналог с характеристиками и ценой.
          </p>
        </div>
        {lines.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <a
              href={whatsappLink(buildWhatsappMessage())}
              target="_blank"
              rel="noreferrer"
              className="rounded border border-emerald-600 px-3 py-1.5 text-sm font-medium text-emerald-700 hover:bg-emerald-50"
            >
              Отправить в WhatsApp
            </a>
            <button
              onClick={() => window.print()}
              className="rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700"
            >
              Печать / сохранить как PDF
            </button>
          </div>
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
        <label className="block text-sm font-medium text-slate-700">Модель товара конкурента (необязательно)</label>
        <input
          className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
          placeholder="Например: RG-EG105G, Ubiquiti U6-LR или TL-SG3428MP"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {searchResults.length > 0 && (
          <div className="mt-2 divide-y divide-slate-100 rounded border border-slate-200">
            {searchResults.map((p) => (
              <button
                key={p.id}
                onClick={() => addReferenceItem(p)}
                className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-slate-50"
              >
                <span>
                  <span className="font-medium">{p.brand} {p.model}</span>{' '}
                  <span className="text-slate-400">${p.priceUSD}</span>
                </span>
                <span className="text-blue-600">+ добавить</span>
              </button>
            ))}
          </div>
        )}
        {search.trim() && searchResults.length === 0 && (
          <p className="mt-2 text-sm text-slate-400">
            Не найдено в каталоге. Добавьте его во вкладке «Каталог», либо выберите товар напрямую ниже.
          </p>
        )}

        <details className="mt-3">
          <summary className="cursor-pointer text-sm font-medium text-blue-600">+ добавить товар в КП напрямую</summary>
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {catalog.map((p) => (
              <button
                key={p.id}
                onClick={() => addItemDirectly(p)}
                className="rounded border border-slate-200 px-2 py-1.5 text-left text-xs hover:bg-slate-50"
              >
                {p.brand} {p.model}
              </button>
            ))}
          </div>
        </details>
      </div>

      {lines.length === 0 ? (
        <p className="text-sm text-slate-400 no-print">Список пуст. Впишите модель товара клиента выше, чтобы начать.</p>
      ) : (
        <div>
          <div className="hidden print:block mb-6 border-b-2 border-slate-900 pb-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div
                  className="flex h-11 w-11 items-center justify-center rounded-xl text-base font-extrabold text-white"
                  style={{ backgroundColor: '#2f5fe0' }}
                >
                  S
                </div>
                <div>
                  <p className="text-lg font-extrabold text-slate-900">{COMPANY_NAME}</p>
                  <p className="text-xs text-slate-500">{COMPANY_TAGLINE}</p>
                </div>
              </div>
              <div className="text-right text-sm text-slate-500">
                <p className="font-medium text-slate-900">{quoteNumber}</p>
                <p>{quoteDate.toLocaleDateString('ru-RU')}</p>
              </div>
            </div>
            <h1 className="mt-4 text-xl font-semibold text-slate-900">Коммерческое предложение</h1>
            {clientName && <p className="text-slate-600">Клиент / объект: {clientName}</p>}
          </div>

          <div className="space-y-3">
            {lines.map((line) => {
              const offer = catalog.find((p) => p.id === line.productId)
              if (!offer) return null
              const reference = line.referenceProductId
                ? catalog.find((p) => p.id === line.referenceProductId)
                : undefined
              const alternatives = alternativesInCategory(offer.category, catalog)
              return (
                <ComparisonCard
                  key={line.id}
                  reference={reference}
                  offer={offer}
                  alternatives={alternatives}
                  qty={line.qty}
                  onQtyChange={(qty) => updateLine(line.id, { qty })}
                  onOfferChange={(id) => updateLine(line.id, { productId: id })}
                  onRemove={() => removeLine(line.id)}
                />
              )
            })}
          </div>

          <div className="mt-6 rounded-lg border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between text-sm text-slate-500">
              <span>Позиций: {lines.length}</span>
              {referenceTotal > 0 && <span>Сумма по списку клиента (ориентировочно): ${referenceTotal.toLocaleString()}</span>}
            </div>
            <div className="mt-1 flex items-center justify-between">
              <span className="text-lg font-semibold text-slate-900">Итого наше предложение</span>
              <span className="text-2xl font-bold text-slate-900">${total.toLocaleString()}</span>
            </div>
            {referenceTotal > 0 && (
              <div className={`mt-1 text-sm font-medium ${total <= referenceTotal ? 'text-emerald-700' : 'text-amber-700'}`}>
                {total <= referenceTotal
                  ? `Выгода клиента: $${(referenceTotal - total).toLocaleString()}`
                  : `Дороже списка клиента на $${(total - referenceTotal).toLocaleString()} — используйте плюсы товаров выше, чтобы обосновать разницу`}
              </div>
            )}
          </div>

          <div className="hidden print:flex mt-8 items-center justify-between border-t border-slate-200 pt-3 text-xs text-slate-500">
            <span>{COMPANY_NAME} · {COMPANY_ADDRESS}</span>
            <span>WhatsApp: {WHATSAPP_DISPLAY}</span>
          </div>
        </div>
      )}
    </div>
  )
}
