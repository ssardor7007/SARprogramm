import { useMemo, useState } from 'react'
import { CATEGORY_LABELS, type Product, type QuoteLine } from '../types'
import { useQuoteLines, useQuoteMeta } from '../lib/cart'
import { COMPANY_NAME, telegramShareLink, whatsappLink } from '../lib/contacts'
import { STOCK_TONE, alternativesInCategory, findBestMatch, stockLabel } from '../lib/matching'
import { useMoney } from '../lib/money'
import { productSummary } from '../lib/proposal'
import { factChips, productText } from '../lib/productFacts'
import { genId } from '../lib/storage'
import { downloadXlsx, safeFileName } from '../lib/xlsx'
import { ComparisonCard } from './ComparisonCard'
import { CloseIcon } from './NavIcons'
import { ProductDetailDialog } from './ProductDetailDialog'
import { ProductImage } from './ProductImage'
import { ProposalDialog } from './ProposalDialog'

interface Props {
  catalog: Product[]
  onOpenCatalog?: () => void
}

const btn = 'rounded-lg border border-[var(--border)] px-3 py-2 text-sm font-medium text-[var(--text)] hover:bg-black/5'

function QtyStepper({ qty, onChange }: { qty: number; onChange: (n: number) => void }) {
  return (
    <div className="inline-flex items-center rounded-lg border border-[var(--border)]">
      <button type="button" onClick={() => onChange(Math.max(1, qty - 1))} className="h-8 w-8 text-[var(--text-muted)] hover:bg-black/5" aria-label="Меньше">
        −
      </button>
      <input
        className="h-8 w-12 border-x border-[var(--border)] bg-transparent text-center text-sm text-[var(--text)]"
        inputMode="numeric"
        value={qty}
        aria-label="Количество"
        onChange={(e) => onChange(Math.max(1, Math.round(Number(e.target.value.replace(/\D/g, '')) || 1)))}
      />
      <button type="button" onClick={() => onChange(qty + 1)} className="h-8 w-8 text-[var(--text-muted)] hover:bg-black/5" aria-label="Больше">
        +
      </button>
    </div>
  )
}

export function QuoteView({ catalog, onOpenCatalog }: Props) {
  const money = useMoney()
  const { lines, setLines } = useQuoteLines()
  const [meta, setMeta] = useQuoteMeta()
  const [search, setSearch] = useState('')
  const [showPdf, setShowPdf] = useState(false)
  const [openProduct, setOpenProduct] = useState<Product | null>(null)

  const byId = useMemo(() => new Map(catalog.map((p) => [p.id, p])), [catalog])
  const resolved = lines
    .map((l) => ({ line: l, offer: byId.get(l.productId), reference: l.referenceProductId ? byId.get(l.referenceProductId) : undefined }))
    .filter((x): x is { line: QuoteLine; offer: Product; reference: Product | undefined } => Boolean(x.offer))

  const searchResults = (() => {
    const words = search.trim().toLowerCase().split(/\s+/).filter(Boolean)
    if (!words.length) return []
    return catalog.filter((p) => words.every((w) => `${p.brand} ${productText(p)}`.toLowerCase().includes(w))).slice(0, 8)
  })()

  function addDirect(product: Product) {
    setLines((prev) => {
      const i = prev.findIndex((l) => l.productId === product.id && !l.referenceProductId)
      if (i === -1) return [...prev, { id: genId('line'), productId: product.id, qty: 1 }]
      const next = [...prev]
      next[i] = { ...next[i], qty: next[i].qty + 1 }
      return next
    })
    setSearch('')
  }

  function addAnalog(reference: Product) {
    const match = findBestMatch(reference, catalog)
    if (!match) return
    setLines((prev) => [...prev, { id: genId('line'), referenceProductId: reference.id, productId: match.id, qty: 1 }])
    setSearch('')
  }

  const updateLine = (id: string, patch: Partial<QuoteLine>) => setLines((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)))
  const removeLine = (id: string) => setLines((prev) => prev.filter((l) => l.id !== id))

  const total = resolved.reduce((s, x) => s + x.offer.priceUSD * x.line.qty, 0)
  const units = resolved.reduce((s, x) => s + x.line.qty, 0)
  const referenceTotal = resolved.reduce((s, x) => s + (x.reference ? x.reference.priceUSD * x.line.qty : 0), 0)
  const offerForReferenced = resolved.reduce((s, x) => s + (x.reference ? x.offer.priceUSD * x.line.qty : 0), 0)

  function messageText() {
    const parts = [`Коммерческое предложение ${COMPANY_NAME}${meta.clientName ? ` для ${meta.clientName}` : ''}`, '']
    resolved.forEach(({ line, offer }, i) => parts.push(`${i + 1}. ${offer.brand} ${offer.model} × ${line.qty} — ${money.fmt(offer.priceUSD * line.qty)}`))
    parts.push('', `Итого: ${money.fmt(total)}`)
    return parts.join('\n')
  }

  async function exportExcel() {
    const uzs = money.currency === 'UZS'
    const price = (usd: number) => (uzs ? Math.round(usd * money.rate) : usd)
    await downloadXlsx(safeFileName(`КП ${meta.clientName || COMPANY_NAME} ${new Date().toLocaleDateString('ru-RU')}`), [
      {
        name: 'Спецификация',
        title: `Коммерческое предложение${meta.clientName ? ` — ${meta.clientName}` : ''}`,
        meta: [
          `Дата: ${new Date().toLocaleDateString('ru-RU')}`,
          uzs ? `Цены в сумах по курсу ${money.rate.toLocaleString('ru-RU')} сум за $1` : 'Цены в долларах США',
        ],
        columns: [
          { header: '№', width: 5, kind: 'int' },
          { header: 'Бренд', width: 14 },
          { header: 'Модель', width: 26 },
          { header: 'Категория', width: 18 },
          { header: 'Описание', width: 60 },
          { header: 'Кол-во', width: 8, kind: 'int' },
          { header: uzs ? 'Цена, сум' : 'Цена, $', width: 14, kind: uzs ? 'money' : 'usd' },
          { header: uzs ? 'Сумма, сум' : 'Сумма, $', width: 15, kind: uzs ? 'money' : 'usd' },
        ],
        rows: resolved.map(({ line, offer }, i) => [
          i + 1,
          offer.brand,
          offer.model,
          CATEGORY_LABELS[offer.category],
          productSummary(offer),
          line.qty,
          price(offer.priceUSD),
          price(offer.priceUSD * line.qty),
        ]),
        totals: [[null, 'Итого', null, null, null, units, null, price(total)]],
      },
    ])
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-[var(--text)]">Коммерческое предложение</h1>
          <p className="max-w-2xl text-sm text-[var(--text-muted)]">
            Собирайте позиции из каталога и калькуляторов — или впишите модель из списка клиента, и мы подберём аналог. Готовое КП — в PDF от вашего имени, в Excel или сразу в мессенджер.
          </p>
        </div>
        {resolved.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                // В PDF — та же валюта и курс, что сейчас на сайте; в окне КП их можно поменять
                setMeta((prev) => ({ ...prev, currency: money.currency, uzsRate: money.rate }))
                setShowPdf(true)
              }}
              className="rounded-lg px-4 py-2 text-sm font-semibold"
              style={{ backgroundColor: 'var(--accent)', color: 'var(--accent-ink)' }}
            >
              КП в PDF
            </button>
            <button type="button" onClick={exportExcel} className={btn}>
              Excel
            </button>
            <a href={whatsappLink(messageText())} target="_blank" rel="noreferrer" className="rounded-lg border border-emerald-600 px-3 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-50">
              WhatsApp
            </a>
            <a href={telegramShareLink(messageText())} target="_blank" rel="noreferrer" className={btn}>
              Telegram
            </a>
          </div>
        )}
      </div>

      <div className="mb-5 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
        <div className="grid gap-3 md:grid-cols-[260px_minmax(0,1fr)]">
          <label className="block">
            <span className="text-xs font-medium text-[var(--text-muted)]">Клиент / объект</span>
            <input
              className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)]"
              placeholder="ООО «Ромашка», офис в Ташкенте"
              value={meta.clientName}
              onChange={(e) => setMeta((prev) => ({ ...prev, clientName: e.target.value }))}
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-[var(--text-muted)]">Добавить товар: наша модель или модель из списка клиента</span>
            <input
              className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)]"
              placeholder="Например: EAP650, U6-LR, TL-SG3428MP или «PoE 24»"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
        </div>
        {searchResults.length > 0 && (
          <div className="mt-3 divide-y divide-[var(--border)] overflow-hidden rounded-xl border border-[var(--border)]">
            {searchResults.map((p) => {
              const analog = findBestMatch(p, catalog)
              return (
                <div key={p.id} className="flex flex-wrap items-center gap-3 px-3 py-2">
                  <ProductImage imageUrl={p.imageUrl} brand={p.brand} category={p.category} size="sm" />
                  <div className="min-w-0 flex-1 text-sm">
                    <span className="font-medium text-[var(--text)]">
                      {p.brand} {p.model}
                    </span>{' '}
                    <span className="text-[var(--text-muted)]">· {money.fmt(p.priceUSD)}</span>
                  </div>
                  <button type="button" onClick={() => addDirect(p)} className="rounded-lg px-3 py-1.5 text-xs font-semibold" style={{ backgroundColor: 'var(--accent)', color: 'var(--accent-ink)' }}>
                    + В КП
                  </button>
                  {analog && (
                    <button type="button" onClick={() => addAnalog(p)} className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-[var(--text)] hover:bg-black/5" title={`Аналог: ${analog.brand} ${analog.model}`}>
                      Заменить аналогом · {analog.brand}
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        )}
        {search.trim() && searchResults.length === 0 && <p className="mt-2 text-sm text-[var(--text-muted)]">Не нашли такую модель в каталоге — проверьте написание.</p>}
      </div>

      {resolved.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[var(--border)] px-6 py-12 text-center">
          <p className="text-sm text-[var(--text-muted)]">КП пока пустое. Добавляйте товары кнопкой «В КП» в каталоге, в калькуляторах или поиском выше.</p>
          {onOpenCatalog && (
            <button type="button" onClick={onOpenCatalog} className="mt-4 rounded-lg px-4 py-2 text-sm font-semibold" style={{ backgroundColor: 'var(--accent)', color: 'var(--accent-ink)' }}>
              Перейти в каталог
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
            {resolved.map(({ line, offer, reference }) =>
              reference ? (
                <div key={line.id} className="border-b border-[var(--border)] p-3 last:border-0">
                  <ComparisonCard
                    reference={reference}
                    offer={offer}
                    alternatives={alternativesInCategory(offer.category, catalog)}
                    qty={line.qty}
                    onQtyChange={(qty) => updateLine(line.id, { qty })}
                    onOfferChange={(id) => updateLine(line.id, { productId: id })}
                    onRemove={() => removeLine(line.id)}
                  />
                </div>
              ) : (
                <div key={line.id} className="flex flex-wrap items-center gap-3 border-b border-[var(--border)] px-4 py-3 last:border-0">
                  <button type="button" onClick={() => setOpenProduct(offer)} className="shrink-0" aria-label={`Подробнее: ${offer.model}`}>
                    <ProductImage imageUrl={offer.imageUrl} brand={offer.brand} category={offer.category} size="md" />
                  </button>
                  <div className="min-w-[180px] flex-1">
                    <button type="button" onClick={() => setOpenProduct(offer)} className="text-left text-sm font-medium text-[var(--text)] hover:underline">
                      {offer.brand} {offer.model}
                    </button>
                    <div className="mt-0.5 flex flex-wrap gap-1">
                      {factChips(offer).map((c) => (
                        <span key={c} className="rounded bg-[var(--surface-alt)] px-1.5 py-0.5 text-[10.5px] text-[var(--text-muted)]">
                          {c}
                        </span>
                      ))}
                      <span className={`rounded px-1.5 py-0.5 text-[10.5px] font-medium ${STOCK_TONE[stockLabel(offer.stock).tone]}`}>{stockLabel(offer.stock).text}</span>
                    </div>
                  </div>
                  <QtyStepper qty={line.qty} onChange={(qty) => updateLine(line.id, { qty })} />
                  <div className="w-36 text-right">
                    <div className="text-sm font-semibold text-[var(--text)]">{money.fmt(offer.priceUSD * line.qty)}</div>
                    <div className="text-[11px] text-[var(--text-muted)]">
                      {money.fmt(offer.priceUSD)} × {line.qty}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeLine(line.id)}
                    className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--text-muted)] hover:bg-black/5"
                    aria-label={`Убрать ${offer.model} из КП`}
                  >
                    <CloseIcon className="h-3.5 w-3.5" />
                  </button>
                </div>
              ),
            )}
          </div>

          <div className="mt-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-[var(--text-muted)]">
              <span>
                Позиций: {resolved.length} · единиц: {units}
              </span>
              <button
                type="button"
                onClick={() => {
                  if (confirm('Очистить КП? Все позиции будут удалены.')) setLines([])
                }}
                className="text-[var(--text-muted)] hover:underline"
              >
                Очистить КП
              </button>
            </div>
            <div className="mt-1 flex items-center justify-between">
              <span className="text-lg font-semibold text-[var(--text)]">Итого</span>
              <span className="text-2xl font-bold text-[var(--text)]">{money.fmt(total)}</span>
            </div>
            {referenceTotal > 0 && (
              <div className={`mt-1 text-sm font-medium ${offerForReferenced <= referenceTotal ? 'text-emerald-700' : 'text-amber-700'}`}>
                {offerForReferenced <= referenceTotal
                  ? `По позициям из списка клиента выгода: ${money.fmt(referenceTotal - offerForReferenced)}`
                  : `По позициям из списка клиента дороже на ${money.fmt(offerForReferenced - referenceTotal)} — обоснуйте разницу плюсами товаров`}
              </div>
            )}
          </div>
        </>
      )}

      {showPdf && (
        <ProposalDialog source={{ kind: 'list', items: resolved.map((x) => ({ product: x.offer, qty: x.line.qty })) }} onClose={() => setShowPdf(false)} />
      )}
      {openProduct && <ProductDetailDialog key={openProduct.id} product={openProduct} catalog={catalog} onClose={() => setOpenProduct(null)} />}
    </div>
  )
}
