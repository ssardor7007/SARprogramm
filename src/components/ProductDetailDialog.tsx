import { useState } from 'react'
import { CATEGORY_LABELS, type Product } from '../types'
import { COMPARE_LIMIT, useCompare, useQuoteLines } from '../lib/cart'
import { COMPANY_NAME, telegramShareLink, whatsappLink } from '../lib/contacts'
import { STOCK_TONE, similarProducts, stockLabel } from '../lib/matching'
import { useMoney } from '../lib/money'
import { MANAGED_LABELS, OTHER_KIND_LABELS, factChips, productFacts, specSections } from '../lib/productFacts'
import { Dialog } from './Dialog'
import { CheckIcon } from './NavIcons'
import { ProductImage } from './ProductImage'

interface Props {
  product: Product
  catalog: Product[]
  onClose: () => void
  onOpenCompare?: () => void
}

function keyFacts(p: Product): [string, string][] {
  const f = productFacts(p)
  const rows: [string, string][] = [['Категория', f.kind ? OTHER_KIND_LABELS[f.kind] : CATEGORY_LABELS[p.category]]]
  if (p.series) rows.push(['Серия', p.series])
  if (f.ports) rows.push(['Портов', String(f.ports)])
  if (f.poePorts) rows.push(['Портов PoE', String(f.poePorts)])
  if (f.poeBudgetW) rows.push(['Бюджет PoE', `${f.poeBudgetW} Вт`])
  if (p.category === 'switch' || p.category === 'router') {
    const up = [f.has10G ? '10G SFP+' : '', !f.has10G && f.sfp ? 'SFP 1G' : '', f.has25G ? '2.5G' : ''].filter(Boolean)
    if (up.length) rows.push(['Аплинк / скорость', up.join(', ')])
  }
  if (f.managed) rows.push(['Управление', MANAGED_LABELS[f.managed]])
  if (f.wifi) rows.push(['Стандарт Wi‑Fi', f.wifi])
  if (p.category === 'ap') rows.push(['Исполнение', f.outdoor ? 'Уличная' : 'Для помещений'])
  if (f.rangeKm) rows.push(['Дальность', `до ${f.rangeKm} км`])
  if (f.rackmount && p.category !== 'other') rows.push(['Монтаж', 'В стойку 19"/13"'])
  return rows
}

export function ProductDetailDialog({ product, catalog, onClose, onOpenCompare }: Props) {
  const [current, setCurrent] = useState(product)
  const money = useMoney()
  const compare = useCompare()
  const quote = useQuoteLines()
  const [notice, setNotice] = useState<string | null>(null)
  const p = current
  const stock = stockLabel(p.stock)
  const sections = specSections(p)
  const similar = similarProducts(p, catalog, 4)
  const inQuote = quote.qtyOf(p.id)
  const title = `${p.brand} ${p.model}`
  const shareText = `${title} — ${money.fmt(p.priceUSD)}${p.stock > 0 ? `, в наличии ${p.stock} шт.` : ''}. Каталог ${COMPANY_NAME}:`

  function toggleCompare(id: string) {
    const ok = compare.toggle(id)
    if (!ok) setNotice(`В сравнении уже ${COMPARE_LIMIT} товара — уберите один, чтобы добавить новый.`)
    else setNotice(null)
  }

  return (
    <Dialog
      label={title}
      title={title}
      subtitle={[p.brand, p.series, CATEGORY_LABELS[p.category]].filter(Boolean).join(' · ')}
      onClose={onClose}
      size="lg"
      footer={
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => quote.add(p.id)}
            className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold"
            style={{ backgroundColor: 'var(--accent)', color: 'var(--accent-ink)' }}
          >
            {inQuote > 0 ? `В КП: ${inQuote} шт. · ещё +1` : 'Добавить в КП'}
          </button>
          <button
            type="button"
            onClick={() => toggleCompare(p.id)}
            aria-pressed={compare.has(p.id)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-3 py-2 text-sm font-medium text-[var(--text)] hover:bg-black/5"
          >
            {compare.has(p.id) && <CheckIcon className="h-4 w-4" />}
            {compare.has(p.id) ? 'В сравнении' : 'Сравнить'}
          </button>
          {compare.ids.length > 1 && onOpenCompare && (
            <button type="button" onClick={onOpenCompare} className="text-sm font-medium text-[var(--accent)] hover:underline">
              Открыть сравнение ({compare.ids.length})
            </button>
          )}
          <span className="ml-auto flex gap-2">
            <a
              href={whatsappLink(`Здравствуйте! Интересует ${title}. Подскажите наличие и цену.`)}
              target="_blank"
              rel="noreferrer"
              className="rounded-lg border border-emerald-600 px-3 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-50"
            >
              Спросить в WhatsApp
            </a>
            <a
              href={telegramShareLink(shareText)}
              target="_blank"
              rel="noreferrer"
              className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm font-medium text-[var(--text)] hover:bg-black/5"
            >
              Переслать в Telegram
            </a>
          </span>
        </div>
      }
    >
      <div className="grid gap-6 p-5 md:grid-cols-[260px_minmax(0,1fr)]">
        <div className="flex flex-col items-center gap-3">
          <ProductImage imageUrl={p.imageUrl} brand={p.brand} category={p.category} size="xl" />
          <div className="flex flex-wrap justify-center gap-1.5">
            {factChips(p).map((c) => (
              <span key={c} className="rounded-full bg-[var(--surface-alt)] px-2.5 py-1 text-[11px] font-medium text-[var(--text-muted)]">
                {c}
              </span>
            ))}
          </div>
        </div>

        <div className="min-w-0">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <div className="text-3xl font-bold tracking-tight text-[var(--text)]">{money.fmt(p.priceUSD)}</div>
              <div className="mt-1 text-xs text-[var(--text-muted)]">
                {money.currency === 'UZS'
                  ? `≈ $${p.priceUSD.toLocaleString('ru-RU')} · курс ${money.rate.toLocaleString('ru-RU')} сум/$`
                  : `≈ ${Math.round(p.priceUSD * money.rate).toLocaleString('ru-RU')} сум`}
              </div>
            </div>
            <span className={`rounded-md px-2 py-1 text-xs font-semibold ${STOCK_TONE[stock.tone]}`}>{stock.text}</span>
          </div>
          {notice && <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">{notice}</p>}

          <dl className="mt-5 grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
            {keyFacts(p).map(([k, v]) => (
              <div key={k} className="flex justify-between gap-3 border-b border-[var(--border)] pb-1.5">
                <dt className="text-[var(--text-muted)]">{k}</dt>
                <dd className="text-right font-medium text-[var(--text)]">{v}</dd>
              </div>
            ))}
          </dl>

          {sections.length > 0 && (
            <div className="mt-5 space-y-2.5">
              <h3 className="text-sm font-semibold text-[var(--text)]">Характеристики</h3>
              {sections.map((s, i) => (
                <div key={i} className="text-sm leading-relaxed text-[var(--text)]">
                  {s.label && <span className="font-semibold">{s.label}: </span>}
                  {s.bullets ? (
                    <ul className="ml-4 list-disc space-y-0.5">
                      {s.bullets.map((b, j) => (
                        <li key={j}>{b}</li>
                      ))}
                    </ul>
                  ) : (
                    <span className="text-[var(--text-muted)]">{s.text}</span>
                  )}
                </div>
              ))}
            </div>
          )}

          {(p.pros.length > 0 || p.cons.length > 0) && (
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {p.pros.length > 0 && (
                <div className="rounded-xl bg-emerald-50 p-3 text-sm">
                  <div className="mb-1 font-semibold text-emerald-700">Плюсы</div>
                  <ul className="ml-4 list-disc space-y-0.5 text-[var(--text)]">
                    {p.pros.map((x) => (
                      <li key={x}>{x}</li>
                    ))}
                  </ul>
                </div>
              )}
              {p.cons.length > 0 && (
                <div className="rounded-xl bg-amber-50 p-3 text-sm">
                  <div className="mb-1 font-semibold text-amber-700">Учтите</div>
                  <ul className="ml-4 list-disc space-y-0.5 text-[var(--text)]">
                    {p.cons.map((x) => (
                      <li key={x}>{x}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {similar.length > 0 && (
        <div className="border-t border-[var(--border)] bg-[var(--surface-alt)] px-5 py-4">
          <h3 className="mb-3 text-sm font-semibold text-[var(--text)]">Аналоги и альтернативы</h3>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {similar.map((s) => (
              <div key={s.id} className="flex flex-col rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3">
                <button type="button" onClick={() => setCurrent(s)} className="flex flex-1 flex-col items-start text-left">
                  <ProductImage imageUrl={s.imageUrl} brand={s.brand} category={s.category} size="md" />
                  <span className="mt-2 text-[11px] text-[var(--text-muted)]">{s.brand}</span>
                  <span className="text-sm font-medium leading-snug text-[var(--text)]">{s.model}</span>
                  <span className="mt-1 text-sm font-semibold text-[var(--text)]">{money.fmt(s.priceUSD)}</span>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setNotice(compare.addMany([p.id, s.id]) ? null : `В сравнении уже ${COMPARE_LIMIT} товара — уберите один, чтобы добавить новый.`)
                  }
                  className="mt-2 self-start text-xs font-medium text-[var(--accent)] hover:underline"
                >
                  {compare.has(s.id) ? 'В сравнении' : 'Сравнить с этим'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </Dialog>
  )
}
