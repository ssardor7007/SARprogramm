import { useEffect, type CSSProperties, type ReactNode } from 'react'
import type { BuildingPlanResult, FloorResult } from '../lib/buildingPlan'
import type { InstallerProfile } from '../lib/installerProfile'
import { CategoryIcon } from './icons'
import { PAGE_H, PAGE_W } from '../lib/pdfExport'
import {
  floorAreaM2,
  formatMoney,
  productSummary,
  type ProposalMeta,
  type ProposalTotals,
} from '../lib/proposal'

/*
 * Страницы коммерческого предложения — ровно A4 (794×1123 px). Все цвета заданы явно, а не
 * классами темы: КП для клиента всегда светлое и одинаковое, даже если на сайте включена
 * ночная тема. Разбивка по страницам считается заранее по оценочной высоте блоков.
 */

const INK = '#141a22'
const MUTED = '#5d6875'
const LINE = '#e3e7ee'
const SOFT = '#f5f7fa'
const FONT = "Manrope, 'Segoe UI', system-ui, -apple-system, sans-serif"

const PAD_X = 52
const CONTENT_TOP = 112
const CONTENT_BOTTOM = PAGE_H - 72
const CONTENT_H = CONTENT_BOTTOM - CONTENT_TOP

export interface FloorImage {
  dataUrl: string
  aspect: number
}

interface Props {
  profile: InstallerProfile
  meta: ProposalMeta
  result: BuildingPlanResult
  totals: ProposalTotals
  floorImages: Record<string, FloorImage>
  date: Date
  /** Для предпросмотра и снимка: ref на каждую страницу */
  pageRef?: (index: number, el: HTMLDivElement | null) => void
  onPageCount?: (n: number) => void
}

function alpha(hex: string, a: number) {
  const n = Math.round(a * 255)
    .toString(16)
    .padStart(2, '0')
  return `${hex}${n}`
}

function resolveAsset(url: string) {
  if (/^(https?:)?\/\//.test(url) || url.startsWith('data:')) return url
  const base = import.meta.env.BASE_URL
  return base.endsWith('/') ? base + url.replace(/^\//, '') : `${base}/${url.replace(/^\//, '')}`
}

function fmtDate(d: Date) {
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })
}

function initials(name: string) {
  const words = name.replace(/[«»"']/g, '').trim().split(/\s+/).filter(Boolean)
  return (words.length > 1 ? words[0][0] + words[1][0] : (words[0] ?? 'M').slice(0, 2)).toUpperCase()
}

function Logo({ profile, size, onDark }: { profile: InstallerProfile; size: number; onDark?: boolean }) {
  if (profile.logoDataUrl) {
    return (
      <div
        style={{
          width: size,
          height: size,
          borderRadius: size * 0.22,
          background: '#ffffff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: size * 0.1,
          boxSizing: 'border-box',
          boxShadow: onDark ? '0 6px 18px rgba(0,0,0,0.18)' : `inset 0 0 0 1px ${LINE}`,
          flex: 'none',
        }}
      >
        <img src={profile.logoDataUrl} alt="" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
      </div>
    )
  }
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.22,
        background: onDark ? 'rgba(255,255,255,0.14)' : profile.accent,
        color: '#ffffff',
        boxShadow: onDark ? 'inset 0 0 0 1px rgba(255,255,255,0.35)' : 'none',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: 800,
        fontSize: size * 0.38,
        letterSpacing: '0.02em',
        flex: 'none',
      }}
    >
      {initials(profile.company || profile.person || 'Монтаж')}
    </div>
  )
}

function Page({ children, pageRef, index }: { children: ReactNode; pageRef?: Props['pageRef']; index: number }) {
  return (
    <div
      ref={(el) => pageRef?.(index, el)}
      style={{
        width: PAGE_W,
        height: PAGE_H,
        position: 'relative',
        overflow: 'hidden',
        background: '#ffffff',
        color: INK,
        fontFamily: FONT,
        boxSizing: 'border-box',
        WebkitFontSmoothing: 'antialiased',
      }}
    >
      {children}
    </div>
  )
}

function RunningHeader({ profile, meta, page, total }: { profile: InstallerProfile; meta: ProposalMeta; page: number; total: number }) {
  return (
    <div
      style={{
        position: 'absolute',
        left: PAD_X,
        right: PAD_X,
        top: 36,
        height: 44,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: `1px solid ${LINE}`,
        paddingBottom: 14,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <Logo profile={profile} size={34} />
        <div>
          <div style={{ fontSize: 13, fontWeight: 700 }}>{profile.company || 'Ваша компания'}</div>
          <div style={{ fontSize: 10.5, color: MUTED }}>Коммерческое предложение {meta.number}</div>
        </div>
      </div>
      <div style={{ fontSize: 10.5, color: MUTED, letterSpacing: '0.04em' }}>
        Стр. {page} из {total}
      </div>
    </div>
  )
}

function RunningFooter({ profile }: { profile: InstallerProfile }) {
  const parts = [profile.person, profile.phone, profile.email, profile.website, profile.address].filter(Boolean)
  return (
    <div
      style={{
        position: 'absolute',
        left: PAD_X,
        right: PAD_X,
        bottom: 34,
        borderTop: `1px solid ${LINE}`,
        paddingTop: 12,
        fontSize: 10,
        color: MUTED,
        display: 'flex',
        gap: 14,
        flexWrap: 'wrap',
      }}
    >
      {parts.map((p, i) => (
        <span key={i}>
          {i > 0 && <span style={{ color: LINE, marginRight: 14 }}>|</span>}
          {p}
        </span>
      ))}
    </div>
  )
}

function WifiArcs({ color }: { color: string }) {
  return (
    <svg width="520" height="520" viewBox="0 0 520 520" style={{ position: 'absolute', right: -130, top: -120 }} aria-hidden="true">
      {[70, 130, 190, 250].map((r, i) => (
        <circle key={r} cx="260" cy="260" r={r} fill="none" stroke={color} strokeOpacity={0.1 - i * 0.018} strokeWidth={34} />
      ))}
      <circle cx="260" cy="260" r="22" fill={color} fillOpacity={0.12} />
    </svg>
  )
}

function Metric({ value, label, accent }: { value: string; label: string; accent: string }) {
  return (
    <div style={{ flex: 1, background: SOFT, borderRadius: 14, padding: '18px 18px 16px', borderTop: `3px solid ${accent}` }}>
      <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 11, color: MUTED, marginTop: 8, lineHeight: 1.35 }}>{label}</div>
    </div>
  )
}

function Cover({ profile, meta, result, totals, date, validUntil }: Omit<Props, 'floorImages' | 'pageRef' | 'onPageCount'> & { validUntil: Date }) {
  const accent = profile.accent
  const floorsWithAps = result.perFloor.filter((f) => f.aps.length > 0)
  const area = Math.round(result.perFloor.reduce((s, f) => s + floorAreaM2(f), 0))
  const included = [
    'Подбор оборудования под нагрузку объекта',
    'Расчёт покрытия Wi‑Fi по плану этажей',
    totals.cableUSD > 0 ? 'Кабельные трассы и коммутация' : 'Коммутация и шлюз в интернет',
    totals.installUSD > 0 ? 'Монтаж, настройка и сдача сети' : 'Схема размещения для монтажа',
  ]
  const components = [
    'оборудование',
    totals.cableUSD > 0 ? 'кабельные трассы' : '',
    totals.installUSD > 0 ? 'монтаж и настройка' : '',
  ].filter(Boolean)
  return (
    <>
      <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 468, background: accent, overflow: 'hidden' }}>
        <WifiArcs color="#ffffff" />
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(160deg, rgba(255,255,255,0.08), rgba(0,0,0,0.22))' }} />
        <div style={{ position: 'absolute', left: PAD_X, right: PAD_X, top: 44, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, color: '#ffffff' }}>
            <Logo profile={profile} size={52} onDark />
            <div>
              <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: '-0.01em' }}>{profile.company || 'Ваша компания'}</div>
              {profile.address && <div style={{ fontSize: 11.5, opacity: 0.75, marginTop: 2 }}>{profile.address}</div>}
            </div>
          </div>
          <div style={{ textAlign: 'right', color: '#ffffff', fontSize: 11.5, lineHeight: 1.6 }}>
            <div style={{ opacity: 0.7 }}>№ {meta.number}</div>
            <div style={{ opacity: 0.7 }}>{fmtDate(date)}</div>
          </div>
        </div>
        <div style={{ position: 'absolute', left: PAD_X, right: 180, top: 176, color: '#ffffff' }}>
          <div style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: '0.26em', opacity: 0.72 }}>КОММЕРЧЕСКОЕ ПРЕДЛОЖЕНИЕ</div>
          <div style={{ fontSize: 42, fontWeight: 800, lineHeight: 1.08, letterSpacing: '-0.03em', marginTop: 16 }}>
            Беспроводная сеть Wi‑Fi под ключ
          </div>
          <div style={{ fontSize: 17, marginTop: 16, opacity: 0.9, lineHeight: 1.45 }}>
            {meta.objectName ? `для объекта «${meta.objectName}»` : 'для вашего объекта'}
            {meta.objectAddress && <span style={{ opacity: 0.8 }}> · {meta.objectAddress}</span>}
          </div>
        </div>
      </div>

      <div
        style={{
          position: 'absolute',
          left: PAD_X,
          right: PAD_X,
          top: 418,
          background: '#ffffff',
          borderRadius: 16,
          boxShadow: '0 18px 40px rgba(16, 24, 40, 0.12), 0 2px 6px rgba(16,24,40,0.06)',
          padding: '22px 26px',
          display: 'flex',
          gap: 24,
        }}
      >
        {[
          ['Подготовлено для', meta.clientName || '—'],
          ['Ответственный', [profile.person, profile.position].filter(Boolean).join(', ') || '—'],
          ['Предложение действительно до', fmtDate(validUntil)],
        ].map(([k, v], i) => (
          <div key={k} style={{ flex: 1, borderLeft: i > 0 ? `1px solid ${LINE}` : 'none', paddingLeft: i > 0 ? 24 : 0 }}>
            <div style={{ fontSize: 10.5, color: MUTED, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{k}</div>
            <div style={{ fontSize: 14.5, fontWeight: 700, marginTop: 6, lineHeight: 1.3 }}>{v}</div>
          </div>
        ))}
      </div>

      <div style={{ position: 'absolute', left: PAD_X, right: PAD_X, top: 552, display: 'flex', gap: 14 }}>
        <Metric accent={accent} value={String(floorsWithAps.length || result.perFloor.length)} label="этажей в проекте" />
        <Metric accent={accent} value={String(result.totalAPCount)} label="точек доступа Wi‑Fi" />
        <Metric accent={accent} value={area > 0 ? `${area.toLocaleString('ru-RU')}` : '—'} label="м² площадь покрытия" />
        <Metric accent={accent} value={`${Math.ceil(result.totalCableM).toLocaleString('ru-RU')}`} label="м кабельных трасс" />
      </div>

      <div
        style={{
          position: 'absolute',
          left: PAD_X,
          right: PAD_X,
          top: 686,
          borderRadius: 16,
          background: alpha(accent, 0.07),
          border: `1px solid ${alpha(accent, 0.18)}`,
          padding: '22px 26px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: accent }}>Стоимость проекта</div>
          <div style={{ fontSize: 12, color: MUTED, marginTop: 6 }}>Включает: {components.join(', ')}</div>
        </div>
        <div style={{ fontSize: 34, fontWeight: 800, letterSpacing: '-0.02em', color: INK }}>{formatMoney(totals.totalUSD, meta)}</div>
      </div>

      <div style={{ position: 'absolute', left: PAD_X, right: PAD_X, top: 800 }}>
        <div style={{ fontSize: 13, lineHeight: 1.7, color: '#2b3440', maxHeight: 112, overflow: 'hidden' }}>{meta.intro}</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 28px', marginTop: 18 }}>
          {included.map((item) => (
            <div key={item} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12.5, fontWeight: 600 }}>
              <span
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: 20,
                  background: alpha(accent, 0.12),
                  color: accent,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flex: 'none',
                }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="m5 12.5 4.5 4.5L19 7.5" />
                </svg>
              </span>
              {item}
            </div>
          ))}
        </div>
      </div>

      <div
        style={{
          position: 'absolute',
          left: PAD_X,
          right: PAD_X,
          bottom: 40,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
          borderTop: `1px solid ${LINE}`,
          paddingTop: 16,
        }}
      >
        <div style={{ fontSize: 11, color: MUTED, lineHeight: 1.6 }}>
          <div style={{ color: INK, fontWeight: 700, fontSize: 12.5 }}>{profile.person || profile.company || 'Ваш менеджер'}</div>
          {profile.position && <div>{profile.position}</div>}
        </div>
        <div style={{ fontSize: 11, color: MUTED, lineHeight: 1.6, textAlign: 'right' }}>
          {profile.phone && <div style={{ color: INK, fontWeight: 700, fontSize: 12.5 }}>{profile.phone}</div>}
          <div>{[profile.email, profile.website].filter(Boolean).join(' · ')}</div>
        </div>
      </div>
    </>
  )
}

function SectionTitle({ kicker, title, sub, accent }: { kicker: string; title: string; sub?: string; accent: string }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.22em', color: accent }}>{kicker}</div>
      <div style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-0.02em', marginTop: 6 }}>{title}</div>
      {sub && <div style={{ fontSize: 12, color: MUTED, marginTop: 6, lineHeight: 1.5 }}>{sub}</div>}
    </div>
  )
}

function Legend() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 10.5, color: MUTED }}>
      <span>Слабый сигнал</span>
      <span style={{ width: 90, height: 8, borderRadius: 8, background: 'linear-gradient(90deg, #ef4444, #eab308, #22c55e)' }} />
      <span>Сильный</span>
    </div>
  )
}

const FLOOR_IMG_W = PAGE_W - PAD_X * 2
const FLOOR_IMG_MAX_H = 330

function floorImageBox(img?: FloorImage) {
  const aspect = img?.aspect ?? 0.55
  const h = Math.min(FLOOR_IMG_MAX_H, FLOOR_IMG_W * aspect)
  return { w: h / aspect, h }
}

function FloorCard({ f, img, accent }: { f: FloorResult; img?: FloorImage; accent: string }) {
  const box = floorImageBox(img)
  const area = Math.round(floorAreaM2(f))
  const chips = [
    `${f.aps.length} × ${f.apProduct ? `${f.apProduct.brand} ${f.apProduct.model}` : 'точка доступа'}`,
    area > 0 ? `${area} м²` : '',
    f.floor.rooms.length ? `${f.floor.rooms.length} помещ.` : '',
  ].filter(Boolean)
  return (
    <div style={{ marginBottom: 22 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ fontSize: 15, fontWeight: 800 }}>{f.floor.name}</div>
        <div style={{ display: 'flex', gap: 6 }}>
          {chips.map((c) => (
            <span key={c} style={{ fontSize: 10.5, fontWeight: 600, padding: '4px 10px', borderRadius: 20, background: alpha(accent, 0.08), color: accent }}>
              {c}
            </span>
          ))}
        </div>
      </div>
      <div
        style={{
          width: FLOOR_IMG_W,
          height: box.h,
          borderRadius: 14,
          overflow: 'hidden',
          border: `1px solid ${LINE}`,
          background: '#ffffff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {img?.dataUrl ? (
          <img src={img.dataUrl} alt="" style={{ width: box.w, height: box.h, display: 'block' }} />
        ) : (
          <span style={{ fontSize: 11, color: MUTED }}>План этажа готовится…</span>
        )}
      </div>
    </div>
  )
}

const COLS: CSSProperties[] = [
  { width: 26, textAlign: 'left' },
  { width: 58 },
  { flex: 1 },
  { width: 66, textAlign: 'center', whiteSpace: 'nowrap' },
  { width: 104, textAlign: 'right' },
  { width: 112, textAlign: 'right' },
]

function TableHeader({ accent }: { accent: string }) {
  const labels = ['№', '', 'Наименование', 'Кол-во', 'Цена', 'Сумма']
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: '0.1em',
        textTransform: 'uppercase',
        color: accent,
        padding: '0 0 10px',
        borderBottom: `2px solid ${accent}`,
      }}
    >
      {labels.map((l, i) => (
        <div key={i} style={COLS[i]}>
          {l}
        </div>
      ))}
    </div>
  )
}

function Row({ n, photo, title, sub, qty, price, sum }: { n: number; photo?: ReactNode; title: string; sub: string; qty: string; price: string; sum: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: `1px solid ${LINE}`, fontSize: 12 }}>
      <div style={{ ...COLS[0], color: MUTED, fontWeight: 600 }}>{n}</div>
      <div style={COLS[1]}>
        <div
          style={{
            width: 52,
            height: 46,
            borderRadius: 10,
            border: `1px solid ${LINE}`,
            background: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
          }}
        >
          {photo}
        </div>
      </div>
      <div style={{ ...COLS[2], minWidth: 0 }}>
        <div style={{ fontSize: 12.5, fontWeight: 700, lineHeight: 1.3 }}>{title}</div>
        <div style={{ fontSize: 10.5, color: MUTED, marginTop: 3, lineHeight: 1.4, maxHeight: 30, overflow: 'hidden' }}>{sub}</div>
      </div>
      <div style={{ ...COLS[3], fontWeight: 600 }}>{qty}</div>
      <div style={{ ...COLS[4], color: '#2b3440' }}>{price}</div>
      <div style={{ ...COLS[5], fontWeight: 700 }}>{sum}</div>
    </div>
  )
}

function ServiceIcon({ kind, accent }: { kind: 'cable' | 'install'; accent: string }) {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={accent} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {kind === 'cable' ? (
        <path d="M4 18c3 0 3-4 6-4s3 4 6 4 2-3 4-3M7 6h4v5H7zM13 6h4v5h-4zM9 3v3M15 3v3" />
      ) : (
        <path d="M14.5 6.5a3.5 3.5 0 0 1-4.6 4.6L4 17l3 3 5.9-5.9a3.5 3.5 0 0 1 4.6-4.6l-2.3 2.3-2-2Z" />
      )}
    </svg>
  )
}

function Totals({ meta, totals, accent }: { meta: ProposalMeta; totals: ProposalTotals; accent: string }) {
  const rows: [string, number][] = [['Оборудование', totals.equipmentUSD]]
  if (totals.cableUSD > 0) rows.push(['Кабельные трассы', totals.cableUSD])
  if (totals.installUSD > 0) rows.push(['Монтаж и пусконаладка', totals.installUSD])
  return (
    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 18 }}>
      <div style={{ width: 360 }}>
        {rows.map(([k, v]) => (
          <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, padding: '6px 0', color: '#2b3440' }}>
            <span>{k}</span>
            <span style={{ fontWeight: 600 }}>{formatMoney(v, meta)}</span>
          </div>
        ))}
        <div
          style={{
            marginTop: 10,
            borderRadius: 14,
            background: accent,
            color: '#ffffff',
            padding: '16px 20px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.12em' }}>ИТОГО</span>
          <span style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-0.01em' }}>{formatMoney(totals.totalUSD, meta)}</span>
        </div>
        {meta.currency === 'UZS' && (
          <div style={{ fontSize: 10, color: MUTED, marginTop: 6, textAlign: 'right' }}>
            Пересчёт по курсу {meta.uzsRate.toLocaleString('ru-RU')} сум за $1
          </div>
        )}
      </div>
    </div>
  )
}

function Terms({ meta, accent }: { meta: ProposalMeta; accent: string }) {
  const lines = meta.terms.split('\n').map((l) => l.trim()).filter(Boolean)
  return (
    <div style={{ marginTop: 28 }}>
      <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 10 }}>Условия</div>
      {lines.map((l, i) => (
        <div key={i} style={{ display: 'flex', gap: 10, fontSize: 12, lineHeight: 1.6, color: '#2b3440', marginBottom: 4 }}>
          <span style={{ width: 6, height: 6, borderRadius: 6, background: accent, marginTop: 7, flex: 'none' }} />
          <span>{l.replace(/^[•\-–]\s*/, '')}</span>
        </div>
      ))}
    </div>
  )
}

function Signature({ profile, date, accent }: { profile: InstallerProfile; date: Date; accent: string }) {
  return (
    <div style={{ marginTop: 34, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 30 }}>
      <div style={{ fontSize: 12, lineHeight: 1.6, color: '#2b3440' }}>
        <div style={{ color: MUTED }}>С уважением,</div>
        <div style={{ fontSize: 14, fontWeight: 800, color: INK }}>{profile.person || '—'}</div>
        <div>{[profile.position, profile.company].filter(Boolean).join(', ')}</div>
        <div style={{ color: MUTED }}>{[profile.phone, profile.email].filter(Boolean).join(' · ')}</div>
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 22 }}>
        <div style={{ width: 170 }}>
          <div style={{ borderBottom: `1px solid ${INK}`, height: 36 }} />
          <div style={{ fontSize: 10, color: MUTED, marginTop: 6 }}>подпись · {fmtDate(date)}</div>
        </div>
        <div
          style={{
            width: 74,
            height: 74,
            borderRadius: 74,
            border: `1.5px dashed ${alpha(accent, 0.5)}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 10,
            color: alpha(accent, 0.8),
            fontWeight: 700,
          }}
        >
          М.П.
        </div>
      </div>
    </div>
  )
}

interface Block {
  h: number
  node: ReactNode
  /** строка таблицы — при переносе на новую страницу повторяем шапку */
  tableRow?: boolean
}

function paginate(blocks: Block[], tableHeader: ReactNode, tableHeaderH: number) {
  const pages: ReactNode[][] = [[]]
  let used = 0
  let inTable = false
  for (const b of blocks) {
    const need = b.h + (b.tableRow && !inTable ? tableHeaderH : 0)
    if (used + need > CONTENT_H && used > 0) {
      pages.push([])
      used = 0
      inTable = false
    }
    if (b.tableRow && !inTable) {
      pages[pages.length - 1].push(<div key={`th-${pages.length}-${used}`}>{tableHeader}</div>)
      used += tableHeaderH
      inTable = true
    }
    if (!b.tableRow) inTable = false
    pages[pages.length - 1].push(b.node)
    used += b.h
  }
  return pages
}

export function ProposalPages({ profile, meta, result, totals, floorImages, date, pageRef, onPageCount }: Props) {
  const accent = profile.accent
  const validUntil = new Date(date.getTime() + Math.max(1, meta.validDays) * 86_400_000)

  const floorBlocks: Block[] = [
    {
      h: 104,
      node: (
        <div key="ft">
          <SectionTitle
            accent={accent}
            kicker="РЕШЕНИЕ"
            title="Покрытие Wi‑Fi по этажам"
            sub="Точки доступа расставлены по плану каждого этажа; цвет показывает расчётный уровень сигнала с учётом стен."
          />
          <div style={{ marginTop: -6, marginBottom: 16 }}>
            <Legend />
          </div>
        </div>
      ),
    },
    ...result.perFloor
      .filter((f) => f.aps.length > 0)
      .map((f) => ({
        h: floorImageBox(floorImages[f.floor.id]).h + 58,
        node: <FloorCard key={f.floor.id} f={f} img={floorImages[f.floor.id]} accent={accent} />,
      })),
  ]

  const specBlocks: Block[] = [
    {
      h: 92,
      node: (
        <SectionTitle
          key="st"
          accent={accent}
          kicker="СПЕЦИФИКАЦИЯ"
          title="Оборудование и работы"
          sub="Цены указаны за единицу с учётом поставки; итоговая сумма — ниже."
        />
      ),
    },
    ...totals.lines.map((l, i) => {
      return {
        h: 64,
        tableRow: true,
        node: (
          <Row
            key={l.product.id}
            n={i + 1}
            photo={
              l.product.imageUrl ? (
                <img src={resolveAsset(l.product.imageUrl)} alt="" style={{ maxWidth: 44, maxHeight: 40, objectFit: 'contain' }} />
              ) : (
                <div style={{ width: 24, height: 24, color: accent }}>
                  <CategoryIcon category={l.product.category} />
                </div>
              )
            }
            title={`${l.product.brand} ${l.product.model}`}
            sub={productSummary(l.product)}
            qty={`${l.qty} шт.`}
            price={formatMoney(l.unitUSD, meta, { exact: true })}
            sum={formatMoney(l.totalUSD, meta)}
          />
        ),
      }
    }),
  ]
  let serviceN = totals.lines.length
  if (totals.cableUSD > 0) {
    serviceN += 1
    const cableN = serviceN
    specBlocks.push({
      h: 64,
      tableRow: true,
      node: (
        <Row
          key="cable"
          n={cableN}
          photo={<ServiceIcon kind="cable" accent={accent} />}
          title="Кабель витая пара и трассы"
          sub="От точек доступа до коммутаторов и магистраль между этажами, с запасом на разделку"
          qty={`${totals.cableM} м`}
          price={formatMoney(totals.cableUSD / Math.max(1, totals.cableM), meta, { exact: true })}
          sum={formatMoney(totals.cableUSD, meta)}
        />
      ),
    })
  }
  if (totals.installUSD > 0) {
    const installN = serviceN + 1
    specBlocks.push({
      h: 64,
      tableRow: true,
      node: (
        <Row
          key="install"
          n={installN}
          photo={<ServiceIcon kind="install" accent={accent} />}
          title="Монтаж и пусконаладка"
          sub={meta.installNote || 'Монтаж оборудования и настройка сети'}
          qty="1 компл."
          price={formatMoney(totals.installUSD, meta)}
          sum={formatMoney(totals.installUSD, meta)}
        />
      ),
    })
  }
  const termsLines = meta.terms.split('\n').filter((l) => l.trim()).reduce((s, l) => s + Math.ceil(l.length / 92), 0)
  specBlocks.push({ h: 190, node: <Totals key="totals" meta={meta} totals={totals} accent={accent} /> })
  // Условия и подпись — один блок: подпись никогда не остаётся одна на последней странице.
  specBlocks.push({
    h: 58 + termsLines * 20 + 118,
    node: (
      <div key="close">
        <Terms meta={meta} accent={accent} />
        <Signature profile={profile} date={date} accent={accent} />
      </div>
    ),
  })
  // Этажи и спецификация идут одним потоком: спецификация начинается сразу под последним
  // этажом, а не с новой полупустой страницы.
  const flow = floorBlocks.length > 1 ? [...floorBlocks, { h: 14, node: <div key="gap" style={{ height: 14 }} /> }, ...specBlocks] : specBlocks
  const bodyPages = paginate(flow, <TableHeader accent={accent} />, 30)
  const total = 1 + bodyPages.length
  useEffect(() => onPageCount?.(total), [total, onPageCount])

  return (
    <>
      <Page index={0} pageRef={pageRef}>
        <Cover profile={profile} meta={meta} result={result} totals={totals} date={date} validUntil={validUntil} />
      </Page>
      {bodyPages.map((content, i) => (
        <Page key={i} index={i + 1} pageRef={pageRef}>
          <RunningHeader profile={profile} meta={meta} page={i + 2} total={total} />
          <div style={{ position: 'absolute', left: PAD_X, right: PAD_X, top: CONTENT_TOP }}>{content}</div>
          <RunningFooter profile={profile} />
        </Page>
      ))}
    </>
  )
}
