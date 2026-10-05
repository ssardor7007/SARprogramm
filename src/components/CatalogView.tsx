import { useMemo, useState } from 'react'
import { CATEGORY_LABELS } from '../types'
import type { Category, Product } from '../types'
import { COMPARE_LIMIT, useCompare, useQuoteLines } from '../lib/cart'
import { visibleBrands, visibleCategories } from '../lib/features'
import { STOCK_TONE, stockLabel } from '../lib/matching'
import { useMoney } from '../lib/money'
import { OTHER_KIND_LABELS, factChips, hasPoeOut, productFacts, productText, type OtherKind } from '../lib/productFacts'
import { downloadXlsx } from '../lib/xlsx'
import { CompareDialog } from './CompareDialog'
import { CheckIcon, CloseIcon } from './NavIcons'
import { ProductDetailDialog } from './ProductDetailDialog'
import { ProductForm } from './ProductForm'
import { ProductImage } from './ProductImage'

interface Props {
  items: Product[]
  onSave: (p: Product) => void
  onRemove: (id: string) => void
  onReset: () => void
}

interface Facet {
  id: string
  /** Чипсы одной группы взаимоисключающие (PoE / без PoE), разные группы складываются через «И». */
  group: string
  label: string
  test: (p: Product) => boolean
}

const ports = (p: Product) => productFacts(p).ports ?? 0
const mount = (p: Product) => `${p.model} ${p.specs['Характеристики'] ?? ''}`

const FACETS: Partial<Record<Category, Facet[]>> = {
  switch: [
    { id: 'poe', group: 'poe', label: 'С PoE', test: hasPoeOut },
    { id: 'nopoe', group: 'poe', label: 'Без PoE', test: (p) => !hasPoeOut(p) },
    { id: 'managed', group: 'mgmt', label: 'Управляемые', test: (p) => ['managed', 'l3'].includes(productFacts(p).managed ?? '') },
    { id: 'smart', group: 'mgmt', label: 'Smart / облачные', test: (p) => productFacts(p).managed === 'smart' },
    { id: 'unmanaged', group: 'mgmt', label: 'Неуправляемые', test: (p) => productFacts(p).managed === 'unmanaged' },
    { id: 'p10', group: 'ports', label: 'до 10 портов', test: (p) => ports(p) > 0 && ports(p) <= 10 },
    { id: 'p18', group: 'ports', label: '16–20 портов', test: (p) => ports(p) > 10 && ports(p) <= 20 },
    { id: 'p28', group: 'ports', label: '24–28 портов', test: (p) => ports(p) > 20 && ports(p) <= 30 },
    { id: 'p48', group: 'ports', label: '48+ портов', test: (p) => ports(p) > 30 },
    { id: 'sfp', group: 'uplink', label: 'SFP-аплинк', test: (p) => productFacts(p).sfp },
    { id: '10g', group: 'uplink', label: '10G', test: (p) => productFacts(p).has10G },
    { id: 'rack', group: 'rack', label: 'В стойку', test: (p) => productFacts(p).rackmount },
  ],
  ap: [
    { id: 'wifi7', group: 'wifi', label: 'Wi‑Fi 7', test: (p) => productFacts(p).wifi === 'Wi-Fi 7' },
    { id: 'wifi6', group: 'wifi', label: 'Wi‑Fi 6 / 6E', test: (p) => ['Wi-Fi 6', 'Wi-Fi 6E'].includes(productFacts(p).wifi ?? '') },
    { id: 'wifi5', group: 'wifi', label: 'Wi‑Fi 5', test: (p) => productFacts(p).wifi === 'Wi-Fi 5' },
    { id: 'wifi4', group: 'wifi', label: 'Wi‑Fi 4', test: (p) => productFacts(p).wifi === 'Wi-Fi 4' },
    { id: 'indoor', group: 'place', label: 'Для помещений', test: (p) => !productFacts(p).outdoor },
    { id: 'outdoor', group: 'place', label: 'Уличные', test: (p) => productFacts(p).outdoor },
    { id: 'ceiling', group: 'mount', label: 'Потолочные', test: (p) => /потолочн|ceiling|celling/i.test(mount(p)) },
    { id: 'wall', group: 'mount', label: 'Настенные', test: (p) => /настенн|wall|розеточн/i.test(mount(p)) },
  ],
  router: [
    { id: 'wifi', group: 'wifi', label: 'С Wi‑Fi', test: (p) => Boolean(productFacts(p).wifi) },
    { id: 'lte', group: 'lte', label: '4G / 5G', test: (p) => /4G|5G|LTE/i.test(mount(p)) },
    { id: 'fiber', group: 'uplink', label: 'SFP / 10G', test: (p) => productFacts(p).sfp || productFacts(p).has10G },
    { id: 'rack', group: 'rack', label: 'В стойку', test: (p) => productFacts(p).rackmount },
  ],
}

function otherFacets(items: Product[]): Facet[] {
  const kinds = new Map<OtherKind, number>()
  for (const p of items) {
    if (p.category !== 'other') continue
    const k = productFacts(p).kind ?? 'misc'
    kinds.set(k, (kinds.get(k) ?? 0) + 1)
  }
  return [...kinds.keys()]
    .filter((k) => k !== 'misc')
    .map((k) => ({ id: `kind-${k}`, group: 'kind', label: OTHER_KIND_LABELS[k], test: (p: Product) => productFacts(p).kind === k }))
}

type SortKey = 'default' | 'price-asc' | 'price-desc' | 'name' | 'stock'

const SORT_LABELS: Record<SortKey, string> = {
  default: 'Сначала в наличии',
  'price-asc': 'Сначала дешевле',
  'price-desc': 'Сначала дороже',
  name: 'По названию',
  stock: 'Больше на складе',
}

const PAGE = 36

const chipCls = (active: boolean) =>
  `shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
    active ? 'border-transparent' : 'border-[var(--border)] text-[var(--text-muted)] hover:bg-black/5'
  }`
const chipStyle = (active: boolean) => (active ? { backgroundColor: 'var(--accent)', color: 'var(--accent-ink)' } : undefined)

export function CatalogView({ items, onSave, onRemove, onReset }: Props) {
  const money = useMoney()
  const compare = useCompare()
  const quote = useQuoteLines()
  const [search, setSearch] = useState('')
  const [brandFilter, setBrandFilter] = useState<string>('all')
  const [categoryFilter, setCategoryFilter] = useState<Category | 'all'>('all')
  const [facetIds, setFacetIds] = useState<string[]>([])
  const [inStockOnly, setInStockOnly] = useState(false)
  const [sort, setSort] = useState<SortKey>('default')
  const [limit, setLimit] = useState(PAGE)
  const [openProduct, setOpenProduct] = useState<Product | null>(null)
  const [showCompare, setShowCompare] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)
  const [editing, setEditing] = useState<Product | undefined>()
  const [showForm, setShowForm] = useState(false)
  const [manage, setManage] = useState(false)

  const brands = useMemo(() => visibleBrands().filter((b) => items.some((p) => p.brand === b)), [items])
  const categories = useMemo(() => visibleCategories().filter((c) => items.some((p) => p.category === c)), [items])
  const facets = categoryFilter === 'other' ? otherFacets(items) : categoryFilter === 'all' ? [] : (FACETS[categoryFilter] ?? [])
  const activeFacets = facets.filter((f) => facetIds.includes(f.id))

  const filtered = (() => {
    const words = search.trim().toLowerCase().split(/\s+/).filter(Boolean)
    const list = items.filter((p) => {
      if (!visibleCategories().includes(p.category)) return false
      if (brandFilter !== 'all' && p.brand !== brandFilter) return false
      if (categoryFilter !== 'all' && p.category !== categoryFilter) return false
      if (inStockOnly && p.stock <= 0) return false
      if (activeFacets.some((f) => !f.test(p))) return false
      if (words.length) {
        const hay = `${p.brand} ${productText(p)}`.toLowerCase()
        if (!words.every((w) => hay.includes(w))) return false
      }
      return true
    })
    const byStock = (a: Product, b: Product) => Number(b.stock > 0) - Number(a.stock > 0)
    const sorted = [...list]
    if (sort === 'default') sorted.sort(byStock)
    if (sort === 'price-asc') sorted.sort((a, b) => a.priceUSD - b.priceUSD)
    if (sort === 'price-desc') sorted.sort((a, b) => b.priceUSD - a.priceUSD)
    if (sort === 'name') sorted.sort((a, b) => `${a.brand} ${a.model}`.localeCompare(`${b.brand} ${b.model}`, 'ru'))
    if (sort === 'stock') sorted.sort((a, b) => b.stock - a.stock)
    return sorted
  })()

  const shown = filtered.slice(0, limit)

  function resetPaging() {
    setLimit(PAGE)
  }

  function toggleFacet(f: Facet) {
    resetPaging()
    setFacetIds((prev) => (prev.includes(f.id) ? prev.filter((id) => id !== f.id) : [...prev.filter((id) => facets.find((x) => x.id === id)?.group !== f.group), f.id]))
  }

  function toggleCompare(id: string) {
    if (!compare.toggle(id)) setNotice(`В сравнении уже ${COMPARE_LIMIT} товара — уберите один, чтобы добавить новый.`)
    else setNotice(null)
  }

  async function exportPriceList() {
    setExporting(true)
    try {
      const date = new Date().toLocaleDateString('ru-RU')
      const scope = [brandFilter !== 'all' ? brandFilter : '', categoryFilter !== 'all' ? CATEGORY_LABELS[categoryFilter] : '', ...activeFacets.map((f) => f.label)]
        .filter(Boolean)
        .join(', ')
      await downloadXlsx(`Прайс SAR ${date}${scope ? ` — ${scope}` : ''}`.replace(/[\\/:*?"<>|]+/g, ' '), [
        {
          name: 'Прайс',
          title: 'Прайс-лист SAR — сетевое оборудование',
          meta: [
            `Дата: ${date}${scope ? ` · Отбор: ${scope}` : ''}`,
            `Цены в сумах — по курсу ${money.rate.toLocaleString('ru-RU')} сум за $1. Наличие — на момент выгрузки.`,
          ],
          columns: [
            { header: '№', width: 5, kind: 'int' },
            { header: 'Бренд', width: 14 },
            { header: 'Модель', width: 28 },
            { header: 'Категория', width: 20 },
            { header: 'Ключевые параметры', width: 30 },
            { header: 'Цена, сум', width: 14, kind: 'money' },
            { header: 'Цена, $', width: 11, kind: 'usd' },
            { header: 'Наличие, шт.', width: 12, kind: 'int' },
            { header: 'Описание', width: 80 },
          ],
          rows: filtered.map((p, i) => [
            i + 1,
            p.brand,
            p.model,
            productFacts(p).kind ? OTHER_KIND_LABELS[productFacts(p).kind!] : CATEGORY_LABELS[p.category],
            factChips(p).join(' · '),
            Math.round(p.priceUSD * money.rate),
            p.priceUSD,
            p.stock,
            productText(p).replace(p.model, '').trim(),
          ]),
        },
      ])
    } finally {
      setExporting(false)
    }
  }

  const compareItems = compare.ids.map((id) => items.find((p) => p.id === id)).filter((p): p is Product => Boolean(p))

  return (
    <div className={compare.ids.length > 0 ? 'pb-24' : undefined}>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-[var(--text)]">Каталог</h1>
          <p className="text-sm text-[var(--text-muted)]">
            {items.length} товаров · {brands.length} брендов · цены в {money.currency === 'UZS' ? 'сумах' : 'долларах'}, наличие на складе в Ташкенте
          </p>
        </div>
        <button
          type="button"
          onClick={exportPriceList}
          disabled={exporting || filtered.length === 0}
          className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm font-medium text-[var(--text)] hover:bg-black/5 disabled:opacity-50"
        >
          {exporting ? 'Готовлю файл…' : `Скачать прайс в Excel (${filtered.length})`}
        </button>
      </div>

      <div className="mb-3 flex flex-wrap gap-2">
        <input
          className="min-w-[220px] flex-1 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)] placeholder:text-[var(--text-muted)]"
          placeholder="Поиск: модель, бренд или параметр — «PoE 24», «Wi‑Fi 6», «SFP 20 км»"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value)
            resetPaging()
          }}
          aria-label="Поиск по каталогу"
        />
        <select
          className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 py-2 text-sm text-[var(--text)]"
          value={brandFilter}
          onChange={(e) => {
            setBrandFilter(e.target.value)
            resetPaging()
          }}
          aria-label="Бренд"
        >
          <option value="all">Все бренды</option>
          {brands.map((b) => (
            <option key={b} value={b}>
              {b}
            </option>
          ))}
        </select>
        <select
          className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 py-2 text-sm text-[var(--text)]"
          value={sort}
          onChange={(e) => setSort(e.target.value as SortKey)}
          aria-label="Сортировка"
        >
          {(Object.keys(SORT_LABELS) as SortKey[]).map((k) => (
            <option key={k} value={k}>
              {SORT_LABELS[k]}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-2 rounded-lg border border-[var(--border)] px-3 py-2 text-sm text-[var(--text)]">
          <input
            type="checkbox"
            checked={inStockOnly}
            onChange={(e) => {
              setInStockOnly(e.target.checked)
              resetPaging()
            }}
          />
          Только в наличии
        </label>
      </div>

      <div className="mb-2 flex gap-2 overflow-x-auto pb-1">
        {(['all', ...categories] as (Category | 'all')[]).map((c) => {
          const count = c === 'all' ? items.filter((p) => visibleCategories().includes(p.category)).length : items.filter((p) => p.category === c).length
          return (
            <button
              key={c}
              type="button"
              onClick={() => {
                setCategoryFilter(c)
                setFacetIds([])
                resetPaging()
              }}
              className={chipCls(categoryFilter === c)}
              style={chipStyle(categoryFilter === c)}
            >
              {c === 'all' ? 'Все категории' : CATEGORY_LABELS[c]} · {count}
            </button>
          )
        })}
      </div>

      {facets.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-1.5 rounded-xl bg-[var(--surface-alt)] p-2">
          {facets.map((f) => {
            const active = facetIds.includes(f.id)
            return (
              <button key={f.id} type="button" onClick={() => toggleFacet(f)} className={chipCls(active)} style={chipStyle(active)} aria-pressed={active}>
                {f.label}
              </button>
            )
          })}
          {facetIds.length > 0 && (
            <button type="button" onClick={() => setFacetIds([])} className="px-2 text-xs text-[var(--text-muted)] hover:underline">
              Сбросить
            </button>
          )}
        </div>
      )}

      <div className="mb-3 flex items-center justify-between text-xs text-[var(--text-muted)]">
        <span>
          Найдено: <b className="text-[var(--text)]">{filtered.length}</b>
        </span>
        {notice && <span className="rounded bg-amber-50 px-2 py-1 text-amber-800">{notice}</span>}
      </div>

      {filtered.length === 0 ? (
        <p className="rounded-xl border border-dashed border-[var(--border)] py-10 text-center text-sm text-[var(--text-muted)]">
          Ничего не найдено — попробуйте убрать фильтры или изменить запрос.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {shown.map((p) => {
            const stock = stockLabel(p.stock)
            const inCompare = compare.has(p.id)
            const inQuote = quote.qtyOf(p.id)
            return (
              <div key={p.id} className="flex flex-col rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3 transition-shadow hover:shadow-md">
                <button type="button" onClick={() => setOpenProduct(p)} className="flex flex-1 flex-col text-left" aria-label={`Подробнее: ${p.brand} ${p.model}`}>
                  <span className="mb-2 flex w-full justify-center">
                    <ProductImage imageUrl={p.imageUrl} brand={p.brand} category={p.category} size="lg" />
                  </span>
                  <span className="text-xs text-[var(--text-muted)]">{p.brand}</span>
                  <span className="text-sm font-medium leading-snug text-[var(--text)]">{p.model}</span>
                  <span className="mt-1 flex flex-wrap gap-1">
                    {factChips(p).map((c) => (
                      <span key={c} className="rounded bg-[var(--surface-alt)] px-1.5 py-0.5 text-[10.5px] text-[var(--text-muted)]">
                        {c}
                      </span>
                    ))}
                  </span>
                  <span className="mt-auto flex flex-wrap items-center justify-between gap-x-2 gap-y-1 pt-2">
                    <span className="font-semibold text-[var(--text)]">{money.fmt(p.priceUSD)}</span>
                    <span className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${STOCK_TONE[stock.tone]}`}>{stock.text}</span>
                  </span>
                </button>
                <div className="no-print mt-2 flex flex-wrap items-center gap-1.5 border-t border-[var(--border)] pt-2">
                  <button
                    type="button"
                    onClick={() => quote.add(p.id)}
                    className="flex-1 whitespace-nowrap rounded-lg px-2 py-1.5 text-xs font-semibold"
                    style={{ backgroundColor: 'var(--accent)', color: 'var(--accent-ink)' }}
                  >
                    {inQuote > 0 ? `В КП · ${inQuote}` : 'В КП'}
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleCompare(p.id)}
                    aria-pressed={inCompare}
                    title={inCompare ? 'Убрать из сравнения' : 'Добавить к сравнению'}
                    className={`flex flex-1 items-center justify-center gap-1 whitespace-nowrap rounded-lg border px-2 py-1.5 text-xs font-medium sm:flex-none ${
                      inCompare ? 'border-[var(--accent)] text-[var(--accent)]' : 'border-[var(--border)] text-[var(--text-muted)] hover:bg-black/5'
                    }`}
                  >
                    {inCompare && <CheckIcon className="h-3.5 w-3.5" />}
                    Сравнить
                  </button>
                </div>
                {manage && (
                  <div className="no-print mt-2 flex gap-3 border-t border-[var(--border)] pt-2 text-xs">
                    <button
                      onClick={() => {
                        setEditing(p)
                        setShowForm(true)
                      }}
                      className="text-blue-600 hover:underline"
                    >
                      Изменить
                    </button>
                    <button
                      onClick={() => {
                        if (confirm(`Удалить ${p.brand} ${p.model}?`)) onRemove(p.id)
                      }}
                      className="text-red-600 hover:underline"
                    >
                      Удалить
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {filtered.length > shown.length && (
        <div className="mt-5 flex justify-center">
          <button
            type="button"
            onClick={() => setLimit((l) => l + PAGE)}
            className="rounded-lg border border-[var(--border)] px-5 py-2 text-sm font-medium text-[var(--text)] hover:bg-black/5"
          >
            Показать ещё {Math.min(PAGE, filtered.length - shown.length)} из {filtered.length - shown.length}
          </button>
        </div>
      )}

      <div className="no-print mt-6 border-t border-[var(--border)] pt-3">
        {manage ? (
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => {
                setEditing(undefined)
                setShowForm(true)
              }}
              className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
            >
              + Добавить товар
            </button>
            <button
              onClick={() => {
                if (confirm('Сбросить каталог к демо-данным? Ваши изменения будут потеряны.')) onReset()
              }}
              className="rounded border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100"
            >
              Сбросить к демо
            </button>
            <button onClick={() => setManage(false)} className="ml-auto text-sm text-[var(--text-muted)] hover:underline">
              Скрыть управление
            </button>
          </div>
        ) : (
          <button onClick={() => setManage(true)} className="text-sm text-[var(--text-muted)] hover:underline">
            Управление каталогом (добавить/изменить/удалить)
          </button>
        )}
      </div>

      {compareItems.length > 0 && (
        <div className="no-print fixed inset-x-0 bottom-4 z-40 flex justify-start pl-3 pr-20 sm:justify-center sm:px-20">
          <div className="flex max-w-full items-center gap-2 rounded-2xl border border-[var(--border)] bg-[var(--surface)] py-2 pl-3 pr-2 shadow-xl">
            <span className="hidden text-xs font-medium text-[var(--text-muted)] sm:inline">Сравнение</span>
            <div className="hidden -space-x-2 sm:flex">
              {compareItems.map((p) => (
                <span key={p.id} className="rounded-lg ring-2 ring-[var(--surface)]" title={`${p.brand} ${p.model}`}>
                  <ProductImage imageUrl={p.imageUrl} brand={p.brand} category={p.category} size="sm" />
                </span>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setShowCompare(true)}
              className="rounded-xl px-4 py-2 text-sm font-semibold"
              style={{ backgroundColor: 'var(--accent)', color: 'var(--accent-ink)' }}
            >
              Сравнить ({compareItems.length})
            </button>
            <button
              type="button"
              onClick={compare.clear}
              className="flex h-9 w-9 items-center justify-center rounded-full text-[var(--text-muted)] hover:bg-black/5"
              aria-label="Очистить сравнение"
            >
              <CloseIcon />
            </button>
          </div>
        </div>
      )}

      {openProduct && (
        <ProductDetailDialog
          key={openProduct.id}
          product={openProduct}
          catalog={items}
          onClose={() => setOpenProduct(null)}
          onOpenCompare={() => {
            setOpenProduct(null)
            setShowCompare(true)
          }}
        />
      )}
      {showCompare && (
        <CompareDialog
          catalog={items}
          onClose={() => setShowCompare(false)}
          onOpenProduct={(p) => {
            setShowCompare(false)
            setOpenProduct(p)
          }}
        />
      )}
      {showForm && <ProductForm initial={editing} catalog={items} onSave={onSave} onClose={() => setShowForm(false)} />}
    </div>
  )
}
