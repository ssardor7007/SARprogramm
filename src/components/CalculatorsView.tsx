import { useState, type ReactNode } from 'react'
import type { Product } from '../types'
import {
  BANDWIDTH_PROFILES,
  BOX_M,
  BUDGET_PRESETS,
  CONNECTOR_LOSS,
  DEFAULT_BANDWIDTH_INPUT,
  DEFAULT_CABLE_INPUT,
  DEFAULT_FIBER_INPUT,
  DEFAULT_POE_INPUT,
  FIBER_ATTENUATION,
  POE_CLASS_LABEL,
  POE_DEVICE_TYPES,
  SPLICE_LOSS,
  SPLITTER_LOSS,
  calcBandwidth,
  calcCable,
  calcFiber,
  calcPoe,
  type BandwidthInput,
  type CableInput,
  type FiberInput,
  type PoeInput,
  type Wavelength,
} from '../lib/calculators'
import { useQuoteLines } from '../lib/cart'
import { STOCK_TONE, stockLabel } from '../lib/matching'
import { useMoney } from '../lib/money'
import { factChips } from '../lib/productFacts'
import { usePersistedState } from '../lib/storage'
import { CloseIcon } from './NavIcons'
import { ProductDetailDialog } from './ProductDetailDialog'
import { ProductImage } from './ProductImage'

interface Props {
  catalog: Product[]
}

type CalcId = 'poe' | 'cable' | 'fiber' | 'bandwidth'

const CALCS: { id: CalcId; label: string; sub: string }[] = [
  { id: 'poe', label: 'PoE-бюджет', sub: 'мощность и коммутатор' },
  { id: 'cable', label: 'Кабель и СКС', sub: 'бухты, панели, розетки' },
  { id: 'fiber', label: 'Оптическая линия', sub: 'затухание и SFP' },
  { id: 'bandwidth', label: 'Интернет-канал', sub: 'скорость для объекта' },
]

const inputCls =
  'w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)] focus:border-[var(--accent)]'

function num(v: string, min = 0) {
  const n = Number(v.replace(',', '.'))
  return Number.isFinite(n) ? Math.max(min, n) : min
}

function Card({ title, children, className = '' }: { title?: string; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 ${className}`}>
      {title && <h3 className="mb-3 text-sm font-semibold text-[var(--text)]">{title}</h3>}
      {children}
    </section>
  )
}

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-[var(--text-muted)]">{label}</span>
      <span className="mt-1 block">{children}</span>
      {hint && <span className="mt-1 block text-[11px] leading-snug text-[var(--text-muted)]">{hint}</span>}
    </label>
  )
}

function Big({ value, label, tone }: { value: string; label: string; tone?: 'ok' | 'warn' | 'bad' }) {
  const color = tone === 'ok' ? 'var(--ok)' : tone === 'warn' ? 'var(--warn)' : tone === 'bad' ? 'var(--danger)' : 'var(--text)'
  return (
    <div className="rounded-xl bg-[var(--surface-alt)] px-4 py-3">
      <div className="text-2xl font-bold tracking-tight" style={{ color }}>
        {value}
      </div>
      <div className="mt-0.5 text-xs text-[var(--text-muted)]">{label}</div>
    </div>
  )
}

function SuggestionRow({ product, qty, note, onOpen }: { product: Product; qty: number; note?: string; onOpen: (p: Product) => void }) {
  const money = useMoney()
  const quote = useQuoteLines()
  const stock = stockLabel(product.stock)
  const inQuote = quote.qtyOf(product.id)
  return (
    <div className="flex items-center gap-3 rounded-xl border border-[var(--border)] p-2.5">
      <button type="button" onClick={() => onOpen(product)} className="shrink-0" aria-label={`Подробнее: ${product.model}`}>
        <ProductImage imageUrl={product.imageUrl} brand={product.brand} category={product.category} size="md" />
      </button>
      <div className="min-w-0 flex-1">
        <button type="button" onClick={() => onOpen(product)} className="text-left text-sm font-medium leading-snug text-[var(--text)] hover:underline">
          {qty > 1 && <span className="text-[var(--accent)]">{qty} × </span>}
          {product.brand} {product.model}
        </button>
        <div className="mt-0.5 flex flex-wrap gap-1">
          {factChips(product).map((c) => (
            <span key={c} className="rounded bg-[var(--surface-alt)] px-1.5 py-0.5 text-[10.5px] text-[var(--text-muted)]">
              {c}
            </span>
          ))}
          <span className={`rounded px-1.5 py-0.5 text-[10.5px] font-medium ${STOCK_TONE[stock.tone]}`}>{stock.text}</span>
        </div>
        {note && <div className="mt-1 text-[11px] text-[var(--text-muted)]">{note}</div>}
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1.5">
        <span className="text-sm font-semibold text-[var(--text)]">{money.fmt(product.priceUSD * qty)}</span>
        <button
          type="button"
          onClick={() => quote.add(product.id, qty)}
          className="rounded-lg px-2.5 py-1 text-xs font-semibold"
          style={{ backgroundColor: 'var(--accent)', color: 'var(--accent-ink)' }}
        >
          {inQuote > 0 ? `В КП · ${inQuote}` : qty > 1 ? `В КП × ${qty}` : 'В КП'}
        </button>
      </div>
    </div>
  )
}

function PoeCalc({ catalog, onOpen }: { catalog: Product[]; onOpen: (p: Product) => void }) {
  const [input, setInput] = usePersistedState<PoeInput>('calc-poe', DEFAULT_POE_INPUT)
  const r = calcPoe(input, catalog)
  const usedTypes = new Set(input.rows.map((row) => row.typeId))
  const freeTypes = POE_DEVICE_TYPES.filter((t) => !usedTypes.has(t.id))

  const setRow = (i: number, patch: Partial<PoeInput['rows'][number]>) =>
    setInput((prev) => ({ ...prev, rows: prev.rows.map((row, j) => (j === i ? { ...row, ...patch } : row)) }))

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <Card title="Что питаем по PoE">
        <div className="space-y-2">
          {input.rows.map((row, i) => {
            const t = POE_DEVICE_TYPES.find((x) => x.id === row.typeId)
            return (
              <div key={row.typeId} className="grid grid-cols-[minmax(0,1fr)_74px_74px_32px] items-center gap-2">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-[var(--text)]">{t?.label ?? row.typeId}</div>
                  <div className="truncate text-[11px] text-[var(--text-muted)]">{t?.hint}</div>
                </div>
                <input className={inputCls} inputMode="numeric" aria-label="Количество" value={row.qty} onChange={(e) => setRow(i, { qty: Math.round(num(e.target.value)) })} />
                <div className="relative">
                  <input className={`${inputCls} pr-7`} inputMode="decimal" aria-label="Мощность, Вт" value={row.watts} onChange={(e) => setRow(i, { watts: num(e.target.value) })} />
                  <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[11px] text-[var(--text-muted)]">Вт</span>
                </div>
                <button
                  type="button"
                  onClick={() => setInput((prev) => ({ ...prev, rows: prev.rows.filter((_, j) => j !== i) }))}
                  className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--text-muted)] hover:bg-black/5"
                  aria-label="Убрать строку"
                >
                  <CloseIcon className="h-3.5 w-3.5" />
                </button>
              </div>
            )
          })}
          <div className="grid grid-cols-[minmax(0,1fr)_74px_74px_32px] text-[11px] text-[var(--text-muted)]">
            <span />
            <span className="text-center">шт.</span>
            <span className="text-center">на 1 устр.</span>
          </div>
        </div>
        {freeTypes.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {freeTypes.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setInput((prev) => ({ ...prev, rows: [...prev.rows, { typeId: t.id, qty: 1, watts: t.watts }] }))}
                className="rounded-full border border-dashed border-[var(--border)] px-2.5 py-1 text-xs text-[var(--text-muted)] hover:bg-black/5"
              >
                + {t.label}
              </button>
            ))}
          </div>
        )}
        <div className="mt-4 grid grid-cols-2 gap-3">
          <Field label="Запас мощности, %" hint="20–30% — чтобы коммутатор не работал на пределе">
            <input className={inputCls} inputMode="numeric" value={input.headroomPct} onChange={(e) => setInput((p) => ({ ...p, headroomPct: num(e.target.value) }))} />
          </Field>
          <Field label="Запас портов, %" hint="на новые устройства и замену">
            <input className={inputCls} inputMode="numeric" value={input.sparePortsPct} onChange={(e) => setInput((p) => ({ ...p, sparePortsPct: num(e.target.value) }))} />
          </Field>
        </div>
      </Card>

      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-3">
          <Big value={`${r.requiredW} Вт`} label={`бюджет PoE с запасом (потребление ${Math.round(r.consumptionW)} Вт)`} />
          <Big value={String(r.requiredPorts)} label={`PoE-портов (${r.devices} устройств + запас)`} />
          <Big value={r.maxClass === 'bt' ? 'PoE++' : r.maxClass === 'at' ? 'PoE+' : 'PoE'} label={POE_CLASS_LABEL[r.maxClass]} tone={r.needBt ? 'warn' : undefined} />
        </div>
        <Card title="Подходит из каталога">
          {r.devices === 0 ? (
            <p className="text-sm text-[var(--text-muted)]">Добавьте устройства слева — подберём коммутатор.</p>
          ) : r.suggestions.length === 0 ? (
            <p className="text-sm text-[var(--text-muted)]">
              Одной модели из каталога не хватает даже в 4 экземплярах. Разделите нагрузку на несколько шкафов или напишите нам — подберём под заказ.
            </p>
          ) : (
            <div className="space-y-2">
              {r.suggestions.map((s) => (
                <SuggestionRow
                  key={s.product.id}
                  product={s.product}
                  qty={s.qty}
                  onOpen={onOpen}
                  note={`Останется свободно: ${s.freePorts} портов PoE и ${s.freeW} Вт`}
                />
              ))}
            </div>
          )}
          {r.needGigabit && (
            <p className="mt-3 text-[11px] leading-snug text-[var(--text-muted)]">
              Есть точки доступа — показываем только коммутаторы с гигабитными PoE-портами: на 100 Мбит/с Wi‑Fi упрётся в кабель.
            </p>
          )}
          <p className="mt-2 text-[11px] leading-snug text-[var(--text-muted)]">
            Длина линии PoE — до 100 м; многие коммутаторы для видеонаблюдения держат до 250 м в режиме Extend на скорости 10 Мбит/с. Мощность устройств — типовая, точное значение смотрите в паспорте.
          </p>
        </Card>
      </div>
    </div>
  )
}

function CableCalc() {
  const [input, setInput] = usePersistedState<CableInput>('calc-cable', DEFAULT_CABLE_INPUT)
  const r = calcCable(input)
  const set = (patch: Partial<CableInput>) => setInput((p) => ({ ...p, ...patch }))
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <Card title="Параметры линий">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Количество линий (точек)">
            <input className={inputCls} inputMode="numeric" value={input.points} onChange={(e) => set({ points: Math.round(num(e.target.value)) })} />
          </Field>
          <Field label="Средняя длина линии, м" hint="от шкафа до точки по трассе">
            <input className={inputCls} inputMode="decimal" value={input.avgLengthM} onChange={(e) => set({ avgLengthM: num(e.target.value) })} />
          </Field>
          <Field label="Запас кабеля, %" hint="повороты, подъёмы, переделки">
            <input className={inputCls} inputMode="numeric" value={input.reservePct} onChange={(e) => set({ reservePct: num(e.target.value) })} />
          </Field>
          <Field label="Тип разводки">
            <select className={inputCls} value={input.mode} onChange={(e) => set({ mode: e.target.value as CableInput['mode'] })}>
              <option value="sks">СКС: патч-панель и розетки</option>
              <option value="direct">Прямые линии: RJ-45 на концах</option>
            </select>
          </Field>
          {input.mode === 'sks' && (
            <>
              <Field label="Патч-панель">
                <select className={inputCls} value={input.panelPorts} onChange={(e) => set({ panelPorts: Number(e.target.value) as 24 | 48 })}>
                  <option value={24}>24 порта (1U)</option>
                  <option value={48}>48 портов (2U)</option>
                </select>
              </Field>
              <Field label="Розетки">
                <select className={inputCls} value={input.outletPorts} onChange={(e) => set({ outletPorts: Number(e.target.value) as 1 | 2 })}>
                  <option value={2}>Двойные (2 × RJ-45)</option>
                  <option value={1}>Одинарные</option>
                </select>
              </Field>
            </>
          )}
        </div>
      </Card>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Big value={`${r.boxes} бухт`} label={`по ${BOX_M} м · всего ${r.cableM.toLocaleString('ru-RU')} м кабеля`} />
          <Big value={`${input.points} линий`} label={`≈ ${Math.round(input.avgLengthM)} м каждая`} tone={r.overLimit ? 'warn' : undefined} />
        </div>
        {r.overLimit && (
          <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800">
            Самые длинные линии могут выйти за 90 м — предел витой пары для Ethernet. Поставьте промежуточный коммутатор или используйте оптику.
          </p>
        )}
        <Card title="Спецификация материалов">
          <table className="w-full text-sm">
            <tbody>
              {r.items.map((it) => (
                <tr key={it.label} className="border-b border-[var(--border)] last:border-0">
                  <td className="py-2 pr-3 text-[var(--text)]">
                    {it.label}
                    {it.note && <div className="text-[11px] text-[var(--text-muted)]">{it.note}</div>}
                  </td>
                  <td className="whitespace-nowrap py-2 text-right font-semibold text-[var(--text)]">
                    {it.qty.toLocaleString('ru-RU')} <span className="font-normal text-[var(--text-muted)]">{it.unit}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-3 text-[11px] leading-snug text-[var(--text-muted)]">
            Бухты считаются целыми линиями: остаток короче линии в дело не идёт. Для PoE-камер и точек доступа берите медный кабель категории 5e/6, не CCA.
          </p>
        </Card>
      </div>
    </div>
  )
}

function FiberCalc({ catalog, onOpen }: { catalog: Product[]; onOpen: (p: Product) => void }) {
  const [input, setInput] = usePersistedState<FiberInput>('calc-fiber', DEFAULT_FIBER_INPUT)
  const r = calcFiber(input, catalog)
  const set = (patch: Partial<FiberInput>) => setInput((p) => ({ ...p, ...patch }))
  const fmtDb = (v: number) => `${v.toFixed(1).replace('.', ',')} дБ`
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <Card title="Параметры линии">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Длина линии, км">
            <input className={inputCls} inputMode="decimal" value={input.lengthKm} onChange={(e) => set({ lengthKm: num(e.target.value) })} />
          </Field>
          <Field label="Длина волны">
            <select className={inputCls} value={input.wavelength} onChange={(e) => set({ wavelength: Number(e.target.value) as Wavelength })}>
              {([1310, 1490, 1550] as Wavelength[]).map((w) => (
                <option key={w} value={w}>
                  {w} нм · {FIBER_ATTENUATION[w].toString().replace('.', ',')} дБ/км
                </option>
              ))}
            </select>
          </Field>
          <Field label="Разъёмных соединений" hint={`кроссы, патч-корды · ${CONNECTOR_LOSS.toString().replace('.', ',')} дБ каждое`}>
            <input className={inputCls} inputMode="numeric" value={input.connectors} onChange={(e) => set({ connectors: Math.round(num(e.target.value)) })} />
          </Field>
          <Field label="Сварок" hint={`${SPLICE_LOSS.toString().replace('.', ',')} дБ каждая`}>
            <input className={inputCls} inputMode="numeric" value={input.splices} onChange={(e) => set({ splices: Math.round(num(e.target.value)) })} />
          </Field>
          <Field label="Оборудование на концах">
            <select className={inputCls} value={input.presetId} onChange={(e) => set({ presetId: e.target.value })}>
              {BUDGET_PRESETS.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.label} · бюджет {b.budgetDb} дБ
                </option>
              ))}
            </select>
          </Field>
          <Field label="Эксплуатационный запас, дБ" hint="старение, ремонтные сварки">
            <input className={inputCls} inputMode="decimal" value={input.marginDb} onChange={(e) => set({ marginDb: num(e.target.value) })} />
          </Field>
        </div>
        <div className="mt-4">
          <span className="text-xs font-medium text-[var(--text-muted)]">Сплиттеры в линии (PON) — до двух каскадов</span>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {Object.keys(SPLITTER_LOSS).map((ratio) => {
              const count = input.splitters.filter((s) => s === ratio).length
              return (
                <button
                  key={ratio}
                  type="button"
                  onClick={() => set({ splitters: input.splitters.length < 2 ? [...input.splitters, ratio] : input.splitters })}
                  className="rounded-full border border-[var(--border)] px-2.5 py-1 text-xs text-[var(--text)] hover:bg-black/5"
                >
                  {ratio.replace('x', '×')} · {SPLITTER_LOSS[ratio].toString().replace('.', ',')} дБ{count > 0 ? ` (${count})` : ''}
                </button>
              )
            })}
            {input.splitters.length > 0 && (
              <button type="button" onClick={() => set({ splitters: [] })} className="px-2 text-xs text-[var(--text-muted)] hover:underline">
                Убрать сплиттеры
              </button>
            )}
          </div>
        </div>
      </Card>
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-3">
          <Big value={fmtDb(r.totalDb)} label="затухание линии" />
          <Big value={fmtDb(r.budgetDb)} label="бюджет оборудования" />
          <Big
            value={`${r.reserveDb >= 0 ? '+' : ''}${fmtDb(r.reserveDb)}`}
            label={r.verdict === 'ok' ? 'запас — линия заработает' : r.verdict === 'tight' ? 'запас меньше рекомендуемого' : 'бюджета не хватает'}
            tone={r.verdict === 'ok' ? 'ok' : r.verdict === 'tight' ? 'warn' : 'bad'}
          />
        </div>
        {r.overload && (
          <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800">
            Линия слишком «короткая» для этого оборудования: приёмник может перегрузиться. Поставьте оптический аттенюатор или модуль на меньшую дальность.
          </p>
        )}
        {r.verdict === 'fail' && (
          <p className="rounded-xl bg-red-50 px-3 py-2 text-xs text-red-800">
            Нужен модуль дальнего действия, меньше сплиттеров или меньше разъёмов на трассе.
          </p>
        )}
        <Card title="Из чего складывается затухание">
          <table className="w-full text-sm">
            <tbody>
              {[
                [`Волокно: ${input.lengthKm} км × ${FIBER_ATTENUATION[input.wavelength].toString().replace('.', ',')} дБ/км`, r.fiberDb],
                [`Разъёмы: ${input.connectors} × ${CONNECTOR_LOSS.toString().replace('.', ',')} дБ`, r.connectorDb],
                [`Сварки: ${input.splices} × ${SPLICE_LOSS.toString().replace('.', ',')} дБ`, r.spliceDb],
                ...(input.splitters.length ? [[`Сплиттеры: ${input.splitters.map((s) => s.replace('x', '×')).join(' + ')}`, r.splitterDb] as [string, number]] : []),
              ].map(([k, v]) => (
                <tr key={k as string} className="border-b border-[var(--border)] last:border-0">
                  <td className="py-2 text-[var(--text-muted)]">{k}</td>
                  <td className="py-2 text-right font-medium text-[var(--text)]">{fmtDb(v as number)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
        {(r.sfp.length > 0 || r.splitters.length > 0) && (
          <Card title="Подходит из каталога">
            <div className="space-y-2">
              {[...r.splitters, ...r.sfp].map((p) => (
                <SuggestionRow key={p.id} product={p} qty={1} onOpen={onOpen} />
              ))}
            </div>
          </Card>
        )}
      </div>
    </div>
  )
}

function BandwidthCalc() {
  const [input, setInput] = usePersistedState<BandwidthInput>('calc-bandwidth', DEFAULT_BANDWIDTH_INPUT)
  const r = calcBandwidth(input)
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <Card title="Кто пользуется интернетом">
        <div className="space-y-2">
          {BANDWIDTH_PROFILES.map((p) => (
            <div key={p.id} className="grid grid-cols-[minmax(0,1fr)_90px] items-center gap-3">
              <div>
                <div className="text-sm text-[var(--text)]">{p.label}</div>
                <div className="text-[11px] text-[var(--text-muted)]">
                  ≈ {p.down.toString().replace('.', ',')} / {p.up.toString().replace('.', ',')} Мбит/с на {p.id === 'cams' ? 'камеру' : 'человека'}
                </div>
              </div>
              <input
                className={inputCls}
                inputMode="numeric"
                aria-label={p.label}
                value={input.counts[p.id] ?? 0}
                onChange={(e) => setInput((prev) => ({ ...prev, counts: { ...prev.counts, [p.id]: Math.round(num(e.target.value)) } }))}
              />
            </div>
          ))}
        </div>
        <div className="mt-4">
          <Field label={`Одновременно онлайн: ${input.concurrencyPct}%`} hint="в офисе обычно 50–70%, в кафе и гостинице — 30–50%">
            <input
              type="range"
              min={10}
              max={100}
              step={5}
              value={input.concurrencyPct}
              onChange={(e) => setInput((prev) => ({ ...prev, concurrencyPct: Number(e.target.value) }))}
              className="w-full"
            />
          </Field>
        </div>
      </Card>
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-3">
          <Big value={`${r.tariff} Мбит/с`} label="рекомендуемый тариф" tone="ok" />
          <Big value={`${r.down}`} label="Мбит/с на загрузку" />
          <Big value={`${r.up}`} label="Мбит/с на отдачу" />
        </div>
        <Card>
          <ul className="ml-4 list-disc space-y-1.5 text-sm text-[var(--text)]">
            <li>Расчёт с запасом 25% на пиковую нагрузку и обновления.</li>
            {r.symmetric && <li>Отдача большая — выбирайте симметричный канал (оптика), а не ADSL/4G.</li>}
            {r.users > 150 && <li>Больше 150 пользователей — нужен производительный шлюз с балансировкой каналов (2 провайдера).</li>}
            <li>Роутер и точки доступа под это число пользователей подберёт «Подбор по объекту».</li>
          </ul>
        </Card>
      </div>
    </div>
  )
}

export function CalculatorsView({ catalog }: Props) {
  const [active, setActive] = usePersistedState<CalcId>('calc-active', 'poe')
  const [openProduct, setOpenProduct] = useState<Product | null>(null)
  return (
    <div>
      <div className="mb-4">
        <h1 className="text-xl font-semibold text-[var(--text)]">Калькуляторы монтажника</h1>
        <p className="text-sm text-[var(--text-muted)]">Быстрые расчёты на объекте — и сразу оборудование из каталога в коммерческое предложение.</p>
      </div>
      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {CALCS.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setActive(c.id)}
            aria-pressed={active === c.id}
            className="rounded-xl border px-3 py-2.5 text-left transition-colors"
            style={
              active === c.id
                ? { borderColor: 'var(--accent)', backgroundColor: 'var(--surface)', boxShadow: '0 0 0 1px var(--accent)' }
                : { borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }
            }
          >
            <div className="text-sm font-semibold text-[var(--text)]">{c.label}</div>
            <div className="text-[11px] text-[var(--text-muted)]">{c.sub}</div>
          </button>
        ))}
      </div>
      {active === 'poe' && <PoeCalc catalog={catalog} onOpen={setOpenProduct} />}
      {active === 'cable' && <CableCalc />}
      {active === 'fiber' && <FiberCalc catalog={catalog} onOpen={setOpenProduct} />}
      {active === 'bandwidth' && <BandwidthCalc />}
      {openProduct && <ProductDetailDialog key={openProduct.id} product={openProduct} catalog={catalog} onClose={() => setOpenProduct(null)} />}
    </div>
  )
}
