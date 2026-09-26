import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { BuildingPlanResult } from '../lib/buildingPlan'
import { ACCENT_PRESETS, readLogoFile, useInstallerProfile } from '../lib/installerProfile'
import { PAGE_H, PAGE_W, exportPagesToPdf } from '../lib/pdfExport'
import {
  DEFAULT_PROPOSAL_META,
  buildProposalTotals,
  formatMoney,
  newProposalNumber,
  renderFloorImage,
  type ProposalMeta,
} from '../lib/proposal'
import { usePersistedState } from '../lib/storage'
import { CloseIcon } from './NavIcons'
import { ProposalPages, type FloorImage } from './ProposalPages'

interface Props {
  result: BuildingPlanResult
  onClose: () => void
}

const inputCls =
  'mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent)]'

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-[var(--text-muted)]">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[11px] leading-snug text-[var(--text-muted)]">{hint}</span>}
    </label>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3 border-b border-[var(--border)] pb-5">
      <h3 className="text-sm font-semibold text-[var(--text)]">{title}</h3>
      {children}
    </section>
  )
}

/**
 * Коммерческое предложение по «Плану здания» от имени монтажника: слева реквизиты и условия,
 * справа живой предпросмотр страниц, «Скачать PDF» собирает файл прямо в браузере.
 */
export function ProposalDialog({ result, onClose }: Props) {
  const { profile, update } = useInstallerProfile()
  const [meta, setMeta] = usePersistedState<ProposalMeta>('proposal-meta', DEFAULT_PROPOSAL_META)
  // Номер КП придумываем один раз и сохраняем вместе с первым же изменением формы.
  const [fallbackNumber] = useState(newProposalNumber)
  const m = useMemo(() => ({ ...DEFAULT_PROPOSAL_META, ...meta, number: meta.number || fallbackNumber }), [meta, fallbackNumber])
  const patch = (p: Partial<ProposalMeta>) =>
    setMeta((prev) => ({ ...DEFAULT_PROPOSAL_META, ...prev, number: prev.number || fallbackNumber, ...p }))
  const [date] = useState(() => new Date())
  const [floorImages, setFloorImages] = useState<Record<string, FloorImage>>({})
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const [logoError, setLogoError] = useState<string | null>(null)
  const pagesRef = useRef<(HTMLDivElement | null)[]>([])
  const previewRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(0.5)
  const [pageCount, setPageCount] = useState(1)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !busy && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [busy, onClose])

  useEffect(() => {
    const el = previewRef.current
    if (!el) return
    const ro = new ResizeObserver(() => setScale(Math.min(0.9, Math.max(0.28, (el.clientWidth - 40) / PAGE_W))))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const floorsKey = JSON.stringify([
    profile.accent,
    result.perFloor.map((f) => [f.floor.id, f.floor.rooms, f.floor.switchPoint, f.aps.map((a) => [a.pos, a.radius]), f.apProduct?.id]),
  ])
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const next: Record<string, FloorImage> = {}
      for (const f of result.perFloor) {
        if (f.aps.length === 0) continue
        next[f.floor.id] = await renderFloorImage(f, profile.accent)
      }
      if (!cancelled) setFloorImages(next)
    })()
    return () => {
      cancelled = true
    }
    // floorsKey покрывает всё, что влияет на картинки этажей
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [floorsKey])

  const totals = useMemo(() => buildProposalTotals(result, m), [result, m])
  const hasEquipment = totals.lines.length > 0

  async function onLogo(file?: File) {
    setLogoError(null)
    if (!file) return
    try {
      update({ logoDataUrl: await readLogoFile(file) })
    } catch {
      setLogoError('Не удалось прочитать файл — выберите PNG или JPG.')
    }
  }

  async function download() {
    setBusy(true)
    setStatus('Собираю PDF…')
    try {
      const pages = pagesRef.current.filter((p): p is HTMLDivElement => Boolean(p))
      const safe = (s: string) => s.replace(/[\\/:*?"<>|]+/g, ' ').trim()
      const name = [m.number, m.clientName || m.objectName].filter(Boolean).map(safe).join(' ')
      await exportPagesToPdf(pages, `${name || 'Коммерческое предложение'}.pdf`)
      setStatus(`Готово: ${pages.length} стр. — файл скачан.`)
    } catch (e) {
      console.error(e)
      setStatus('Не удалось собрать PDF. Попробуйте ещё раз или обновите страницу.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="no-print fixed inset-0 z-50 flex items-stretch justify-center p-0 sm:p-4" role="dialog" aria-modal="true" aria-label="Коммерческое предложение">
      <div className="absolute inset-0" style={{ backgroundColor: 'rgba(3, 6, 14, 0.62)' }} onClick={() => !busy && onClose()} />
      <div className="relative flex h-full w-full max-w-7xl flex-col overflow-hidden bg-[var(--bg)] shadow-2xl sm:rounded-2xl">
        <header className="flex items-center justify-between gap-3 border-b border-[var(--border)] bg-[var(--surface)] px-5 py-3">
          <div>
            <h2 className="text-base font-semibold text-[var(--text)]">Коммерческое предложение для клиента</h2>
            <p className="text-xs text-[var(--text-muted)]">От вашего имени — с вашим логотипом, контактами и ценами. Реквизиты запоминаются.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="flex h-9 w-9 items-center justify-center rounded-full text-[var(--text-muted)] hover:bg-black/5"
            aria-label="Закрыть"
          >
            <CloseIcon />
          </button>
        </header>

        <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
          <div className="min-h-0 space-y-5 overflow-y-auto border-[var(--border)] bg-[var(--surface)] p-5 lg:w-[400px] lg:shrink-0 lg:border-r">
            <Section title="Ваши данные — от кого предложение">
              <Field label="Компания / бренд монтажника">
                <input className={inputCls} value={profile.company} onChange={(e) => update({ company: e.target.value })} placeholder="ООО «Сетевые решения»" />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Ваше имя">
                  <input className={inputCls} value={profile.person} onChange={(e) => update({ person: e.target.value })} placeholder="Алишер Каримов" />
                </Field>
                <Field label="Должность">
                  <input className={inputCls} value={profile.position} onChange={(e) => update({ position: e.target.value })} placeholder="Инженер-проектировщик" />
                </Field>
                <Field label="Телефон">
                  <input className={inputCls} value={profile.phone} onChange={(e) => update({ phone: e.target.value })} placeholder="+998 90 123 45 67" />
                </Field>
                <Field label="E-mail">
                  <input className={inputCls} value={profile.email} onChange={(e) => update({ email: e.target.value })} placeholder="info@company.uz" />
                </Field>
                <Field label="Сайт / Telegram">
                  <input className={inputCls} value={profile.website} onChange={(e) => update({ website: e.target.value })} placeholder="t.me/company" />
                </Field>
                <Field label="Город / адрес">
                  <input className={inputCls} value={profile.address} onChange={(e) => update({ address: e.target.value })} placeholder="Ташкент" />
                </Field>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-[var(--border)]" style={{ backgroundColor: '#ffffff' }}>
                  {profile.logoDataUrl ? (
                    <img src={profile.logoDataUrl} alt="Логотип" className="max-h-full max-w-full object-contain p-1" />
                  ) : (
                    <span className="text-[10px]" style={{ color: '#8a93a3' }}>
                      логотип
                    </span>
                  )}
                </div>
                <div className="space-y-1">
                  <label className="inline-flex cursor-pointer items-center rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-[var(--text)] hover:bg-black/5">
                    {profile.logoDataUrl ? 'Заменить логотип' : 'Загрузить логотип'}
                    <input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" className="sr-only" onChange={(e) => onLogo(e.target.files?.[0])} />
                  </label>
                  {profile.logoDataUrl && (
                    <button type="button" onClick={() => update({ logoDataUrl: undefined })} className="block text-xs text-[var(--text-muted)] hover:underline">
                      Убрать логотип
                    </button>
                  )}
                  {logoError && <p className="text-xs text-[var(--danger)]">{logoError}</p>}
                </div>
              </div>
              <div>
                <span className="text-xs font-medium text-[var(--text-muted)]">Фирменный цвет КП</span>
                <div className="mt-2 flex flex-wrap gap-2">
                  {ACCENT_PRESETS.map((a) => (
                    <button
                      key={a.id}
                      type="button"
                      title={a.label}
                      aria-label={a.label}
                      aria-pressed={profile.accent === a.color}
                      onClick={() => update({ accent: a.color })}
                      className="h-8 w-8 rounded-full"
                      style={{
                        backgroundColor: a.color,
                        boxShadow: profile.accent === a.color ? `0 0 0 2px var(--surface), 0 0 0 4px ${a.color}` : 'none',
                      }}
                    />
                  ))}
                </div>
              </div>
            </Section>

            <Section title="Клиент и объект">
              <Field label="Клиент (кому)">
                <input className={inputCls} value={m.clientName} onChange={(e) => patch({ clientName: e.target.value })} placeholder="ООО «Гранд Отель»" />
              </Field>
              <Field label="Объект">
                <input className={inputCls} value={m.objectName} onChange={(e) => patch({ objectName: e.target.value })} placeholder="Гостиница на 60 номеров" />
              </Field>
              <Field label="Адрес объекта">
                <input className={inputCls} value={m.objectAddress} onChange={(e) => patch({ objectAddress: e.target.value })} placeholder="Ташкент, ул. Амира Темура, 1" />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Номер КП">
                  <input className={inputCls} value={m.number} onChange={(e) => patch({ number: e.target.value })} />
                </Field>
                <Field label="Действует, дней">
                  <input type="number" min={1} className={inputCls} value={m.validDays} onChange={(e) => patch({ validDays: Math.max(1, Number(e.target.value) || 1) })} />
                </Field>
              </div>
            </Section>

            <Section title="Цены для клиента">
              <Field label="Ваша наценка на оборудование, %" hint="Клиент её не видит — она уже заложена в цены позиций.">
                <input type="number" min={0} className={inputCls} value={m.markupPct} onChange={(e) => patch({ markupPct: Math.max(0, Number(e.target.value) || 0) })} />
              </Field>
              <Field label="Монтаж и пусконаладка, $" hint="0 — строка монтажа в КП не появится.">
                <input type="number" min={0} className={inputCls} value={m.installUSD} onChange={(e) => patch({ installUSD: Math.max(0, Number(e.target.value) || 0) })} />
              </Field>
              {m.installUSD > 0 && (
                <Field label="Что входит в монтаж">
                  <input className={inputCls} value={m.installNote} onChange={(e) => patch({ installNote: e.target.value })} />
                </Field>
              )}
              <label className="flex items-center gap-2 text-sm text-[var(--text)]">
                <input type="checkbox" checked={m.includeCable} onChange={(e) => patch({ includeCable: e.target.checked })} />
                Включить кабельные трассы ({Math.ceil(result.totalCableM)} м)
              </label>
              <div>
                <span className="text-xs font-medium text-[var(--text-muted)]">Валюта КП</span>
                <div className="mt-1 inline-flex rounded-lg border border-[var(--border)] p-0.5">
                  {(['USD', 'UZS'] as const).map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => patch({ currency: c })}
                      className="rounded-md px-3 py-1 text-xs font-semibold"
                      style={m.currency === c ? { backgroundColor: 'var(--accent)', color: 'var(--accent-ink)' } : { color: 'var(--text-muted)' }}
                    >
                      {c === 'USD' ? 'Доллары $' : 'Сумы'}
                    </button>
                  ))}
                </div>
              </div>
              {m.currency === 'UZS' && (
                <Field label="Курс, сум за $1">
                  <input type="number" min={1} className={inputCls} value={m.uzsRate} onChange={(e) => patch({ uzsRate: Math.max(1, Number(e.target.value) || 1) })} />
                </Field>
              )}
              <div className="rounded-lg bg-[var(--surface-alt)] px-3 py-2 text-sm text-[var(--text)]">
                Итого для клиента: <b>{formatMoney(totals.totalUSD, m)}</b>
              </div>
            </Section>

            <Section title="Тексты">
              <Field label="Вступление на обложке">
                <textarea rows={4} className={inputCls} value={m.intro} onChange={(e) => patch({ intro: e.target.value })} />
              </Field>
              <Field label="Условия (каждое с новой строки)">
                <textarea rows={5} className={inputCls} value={m.terms} onChange={(e) => patch({ terms: e.target.value })} />
              </Field>
            </Section>
          </div>

          <div ref={previewRef} className="min-h-0 flex-1 overflow-auto p-5" style={{ backgroundColor: '#5b6272' }}>
            {!hasEquipment ? (
              <div className="mx-auto mt-16 max-w-sm rounded-xl p-5 text-center text-sm" style={{ backgroundColor: '#ffffff', color: '#334155' }}>
                На плане пока нет точек доступа. Постройте чертёж и нажмите «Расставить автоматически» — тогда появится что предложить клиенту.
              </div>
            ) : (
              <div style={{ width: PAGE_W * scale, height: (PAGE_H * pageCount + (24 / scale) * (pageCount - 1)) * scale, margin: '0 auto', overflow: 'hidden' }}>
                <div style={{ transform: `scale(${scale})`, transformOrigin: 'top left', width: PAGE_W }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 24 / scale }}>
                    <ProposalPages
                      profile={profile}
                      meta={m}
                      result={result}
                      totals={totals}
                      floorImages={floorImages}
                      date={date}
                      onPageCount={setPageCount}
                      pageRef={(i, el) => {
                        pagesRef.current[i] = el
                        pagesRef.current.length = Math.max(pagesRef.current.length, i + 1)
                      }}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border)] bg-[var(--surface)] px-5 py-3">
          <p className="text-xs text-[var(--text-muted)]" aria-live="polite">
            {status ?? (profile.company || profile.person ? 'Проверьте предпросмотр справа и скачайте файл.' : 'Заполните хотя бы название компании или своё имя — они будут в шапке КП.')}
          </p>
          <button
            type="button"
            onClick={download}
            disabled={busy || !hasEquipment}
            className="rounded-lg px-5 py-2.5 text-sm font-semibold shadow-sm disabled:opacity-50"
            style={{ backgroundColor: 'var(--accent)', color: 'var(--accent-ink)' }}
          >
            {busy ? 'Собираю PDF…' : 'Скачать PDF'}
          </button>
        </footer>
      </div>
    </div>
  )
}
