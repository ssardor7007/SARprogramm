import { CATEGORY_LABELS, type Product } from '../types'
import {
  CABLE_PRICE_PER_M_USD,
  CANVAS_H_M,
  CANVAS_W_M,
  HEATMAP_STEP_M,
  computeHeatmapGrid,
  type BuildingPlanResult,
  type FloorResult,
} from './buildingPlan'

/** Данные КП, которые относятся к конкретному объекту/клиенту (хранятся в проекте). */
export interface ProposalMeta {
  clientName: string
  objectName: string
  objectAddress: string
  number: string
  validDays: number
  /** Наценка монтажника на оборудование, % — клиенту не показывается, уже заложена в цены */
  markupPct: number
  installUSD: number
  installNote: string
  includeCable: boolean
  currency: 'USD' | 'UZS'
  uzsRate: number
  intro: string
  terms: string
}

export function newProposalNumber(date = new Date()) {
  const ymd = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`
  return `КП-${ymd}-${Math.floor(1000 + Math.random() * 9000)}`
}

export const DEFAULT_PROPOSAL_META: ProposalMeta = {
  clientName: '',
  objectName: '',
  objectAddress: '',
  number: '',
  validDays: 14,
  markupPct: 0,
  installUSD: 0,
  installNote: 'Монтаж точек доступа и коммутации, прокладка кабеля, настройка и сдача сети',
  includeCable: true,
  currency: 'USD',
  uzsRate: 12700,
  intro:
    'Мы подготовили для вас решение по беспроводной сети: подобрали оборудование под нагрузку объекта, рассчитали количество и места установки точек доступа по плану каждого этажа и проверили покрытие Wi-Fi с учётом материалов стен.',
  terms: [
    'Срок поставки оборудования — 3–5 рабочих дней после предоплаты.',
    'Монтаж и настройка — по согласованному графику после поставки.',
    'Гарантия на оборудование — от производителя; на монтажные работы — 12 месяцев.',
    'Оплата: 70% предоплата, 30% после сдачи объекта.',
  ].join('\n'),
}

export interface ProposalLine {
  product: Product
  qty: number
  unitUSD: number
  totalUSD: number
}

export interface ProposalTotals {
  lines: ProposalLine[]
  equipmentUSD: number
  cableM: number
  cableUSD: number
  installUSD: number
  totalUSD: number
}

/** Позиции КП из результата «Плана здания»: одинаковые модели на разных этажах складываются. */
export function buildProposalTotals(result: BuildingPlanResult, meta: ProposalMeta): ProposalTotals {
  const k = 1 + Math.max(0, meta.markupPct) / 100
  const byId = new Map<string, { product: Product; qty: number }>()
  const add = (product: Product | undefined, qty: number) => {
    if (!product || qty <= 0) return
    const cur = byId.get(product.id)
    if (cur) cur.qty += qty
    else byId.set(product.id, { product, qty })
  }
  for (const f of result.perFloor) add(f.apProduct, f.aps.length)
  for (const f of result.perFloor) if (f.aps.length > 0) add(f.switchProduct, f.switchQty)
  add(result.routerProduct, 1)
  add(result.controllerProduct, 1)

  const lines = [...byId.values()].map(({ product, qty }) => {
    const unitUSD = product.priceUSD * k
    return { product, qty, unitUSD, totalUSD: unitUSD * qty }
  })
  const equipmentUSD = lines.reduce((s, l) => s + l.totalUSD, 0)
  const cableM = meta.includeCable ? Math.ceil(result.totalCableM) : 0
  const cableUSD = cableM * CABLE_PRICE_PER_M_USD * k
  const installUSD = Math.max(0, meta.installUSD)
  return { lines, equipmentUSD, cableM, cableUSD, installUSD, totalUSD: equipmentUSD + cableUSD + installUSD }
}

export function formatMoney(usd: number, meta: Pick<ProposalMeta, 'currency' | 'uzsRate'>, opts: { exact?: boolean } = {}) {
  if (meta.currency === 'UZS') {
    const sum = Math.round((usd * meta.uzsRate) / 100) * 100
    return `${sum.toLocaleString('ru-RU')} сум`
  }
  const digits = opts.exact && usd < 1000 ? 2 : 0
  return `$${usd.toLocaleString('ru-RU', { minimumFractionDigits: digits, maximumFractionDigits: digits })}`
}

export function floorAreaM2(f: FloorResult) {
  return f.floor.rooms.reduce((s, r) => s + r.w * r.h, 0)
}

/** Служебные поля прайса (закупочные цены, остатки) — клиенту в КП их показывать нельзя. */
const INTERNAL_SPEC = /цен|ндс|сум|price|стоимост|остат|склад|закуп/i

/** Короткое описание товара для строки спецификации: категория и 1–2 ключевые характеристики. */
export function productSummary(p: Product) {
  const entries = Object.entries(p.specs).filter(([k, v]) => v && !INTERNAL_SPEC.test(k))
  const specs = entries
    .filter(([, v]) => v.length < 40)
    .slice(0, 2)
    .map(([k, v]) => `${k}: ${v}`)
  if (specs.length === 0) {
    // В прайсе у многих позиций вместо полей — один длинный абзац «Характеристики»:
    // берём из него первую фразу (до запятой/«Порты»).
    const long = entries.find(([, v]) => v.length >= 40)?.[1]
    const first = long?.split(/,|\sПорты|\sСкорость/)[0].replace(/\s+/g, ' ').trim()
    if (first) specs.push(first.length > 90 ? `${first.slice(0, 88)}…` : first)
  }
  return [CATEGORY_LABELS[p.category], ...specs].join(' · ')
}

function resolveAsset(url: string) {
  if (/^(https?:)?\/\//.test(url) || url.startsWith('data:')) return url
  const base = import.meta.env.BASE_URL
  return base.endsWith('/') ? base + url.replace(/^\//, '') : `${base}/${url.replace(/^\//, '')}`
}

function loadImage(src: string): Promise<HTMLImageElement | undefined> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => resolve(undefined)
    img.src = src
  })
}

/** Вырезанное без фона фото точки доступа (products/cutout/…png), иначе обычное фото. */
async function loadApImage(p: Product | undefined) {
  if (!p?.imageUrl) return undefined
  const m = p.imageUrl.match(/^\/?products\/(?:[^/]+\/)*([^/]+)\.(?:png|jpe?g|webp)$/i)
  return (m && (await loadImage(resolveAsset(`products/cutout/${m[1]}.png`)))) || loadImage(resolveAsset(p.imageUrl))
}

const HEAT_STOPS: [number, number, number][] = [
  [239, 68, 68],
  [234, 179, 8],
  [34, 197, 94],
]

function heat(s: number) {
  const [c1, c2] = s <= 0.5 ? [HEAT_STOPS[0], HEAT_STOPS[1]] : [HEAT_STOPS[1], HEAT_STOPS[2]]
  const t = s <= 0.5 ? s / 0.5 : (s - 0.5) / 0.5
  const c = c1.map((v, i) => Math.round(v + (c2[i] - v) * t))
  return `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${(0.16 + s * 0.46).toFixed(2)})`
}

const ROOM_FILL: Record<string, string> = {
  open: '#e8edf3',
  drywall: '#dbe8fb',
  brick: '#fbefcf',
  concrete: '#dfe4ea',
}

/**
 * Рисует этаж для КП: комнаты, карта покрытия, кабельные трассы, коммутатор и фото точек
 * доступа. Кадр обрезается по занятой части плана, чтобы этаж не терялся на пустом поле 40×24 м.
 */
export async function renderFloorImage(f: FloorResult, accent: string, widthPx = 1400) {
  const pts: { x: number; y: number }[] = [f.floor.switchPoint, ...f.aps.map((a) => a.pos)]
  for (const r of f.floor.rooms) pts.push({ x: r.x, y: r.y }, { x: r.x + r.w, y: r.y + r.h })
  const pad = 1.5
  const x0 = Math.max(0, Math.min(...pts.map((p) => p.x)) - pad)
  const y0 = Math.max(0, Math.min(...pts.map((p) => p.y)) - pad)
  const x1 = Math.min(CANVAS_W_M, Math.max(...pts.map((p) => p.x)) + pad)
  const y1 = Math.min(CANVAS_H_M, Math.max(...pts.map((p) => p.y)) + pad)
  const wM = Math.max(8, x1 - x0)
  const hM = Math.max(5, y1 - y0)
  const s = widthPx / wM
  const canvas = document.createElement('canvas')
  canvas.width = widthPx
  canvas.height = Math.round(hM * s)
  const ctx = canvas.getContext('2d')
  if (!ctx) return { dataUrl: '', aspect: hM / wM }
  const X = (m: number) => (m - x0) * s
  const Y = (m: number) => (m - y0) * s

  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.strokeStyle = '#eef1f5'
  ctx.lineWidth = 1
  for (let gx = Math.ceil(x0); gx <= x1; gx++) {
    ctx.beginPath()
    ctx.moveTo(X(gx), 0)
    ctx.lineTo(X(gx), canvas.height)
    ctx.stroke()
  }
  for (let gy = Math.ceil(y0); gy <= y1; gy++) {
    ctx.beginPath()
    ctx.moveTo(0, Y(gy))
    ctx.lineTo(canvas.width, Y(gy))
    ctx.stroke()
  }

  for (const r of f.floor.rooms) {
    ctx.fillStyle = ROOM_FILL[r.wallMaterial] ?? ROOM_FILL.open
    ctx.fillRect(X(r.x), Y(r.y), r.w * s, r.h * s)
  }

  const cell = HEATMAP_STEP_M * s
  for (const c of computeHeatmapGrid(f.floor, f.aps)) {
    if (c.strength < 0.04) continue
    ctx.fillStyle = heat(Math.min(1, c.strength))
    ctx.fillRect(X(c.x - HEATMAP_STEP_M / 2), Y(c.y - HEATMAP_STEP_M / 2), cell + 0.6, cell + 0.6)
  }

  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  for (const r of f.floor.rooms) {
    ctx.strokeStyle = '#8795a8'
    ctx.lineWidth = Math.max(2, s * 0.08)
    ctx.strokeRect(X(r.x), Y(r.y), r.w * s, r.h * s)
    const fs = Math.max(13, Math.min(s * 0.62, (r.w * s) / Math.max(6, r.name.length * 0.62)))
    ctx.fillStyle = '#243041'
    ctx.font = `600 ${fs}px Manrope, system-ui, sans-serif`
    ctx.fillText(r.name, X(r.x + r.w / 2), Y(r.y + r.h / 2) - fs * 0.45)
    ctx.fillStyle = '#5b6678'
    ctx.font = `500 ${fs * 0.78}px Manrope, system-ui, sans-serif`
    ctx.fillText(`${Math.round(r.w * r.h * 10) / 10} м²`, X(r.x + r.w / 2), Y(r.y + r.h / 2) + fs * 0.6)
  }

  ctx.setLineDash([s * 0.35, s * 0.25])
  ctx.lineWidth = Math.max(1.5, s * 0.06)
  ctx.strokeStyle = accent
  ctx.globalAlpha = 0.7
  for (const a of f.aps) {
    ctx.beginPath()
    ctx.moveTo(X(a.pos.x), Y(a.pos.y))
    ctx.lineTo(X(f.floor.switchPoint.x), Y(f.floor.switchPoint.y))
    ctx.stroke()
  }
  ctx.globalAlpha = 1
  ctx.setLineDash([])

  const sw = s * 1.1
  const sx = X(f.floor.switchPoint.x) - sw / 2
  const sy = Y(f.floor.switchPoint.y) - sw / 2
  ctx.fillStyle = '#1f2937'
  ctx.beginPath()
  ctx.roundRect(sx, sy, sw, sw, sw * 0.18)
  ctx.fill()
  ctx.fillStyle = '#ffffff'
  for (let i = 0; i < 3; i++) ctx.fillRect(sx + sw * 0.2, sy + sw * (0.24 + i * 0.2), sw * 0.6, sw * 0.1)

  const apImg = await loadApImage(f.apProduct)
  const size = s * 1.7
  for (const a of f.aps) {
    const cx = X(a.pos.x)
    const cy = Y(a.pos.y)
    ctx.save()
    ctx.shadowColor = 'rgba(15, 23, 42, 0.45)'
    ctx.shadowBlur = size * 0.18
    ctx.shadowOffsetY = size * 0.05
    if (apImg) {
      const k = Math.min(size / apImg.width, size / apImg.height)
      ctx.drawImage(apImg, cx - (apImg.width * k) / 2, cy - (apImg.height * k) / 2, apImg.width * k, apImg.height * k)
    } else {
      ctx.fillStyle = accent
      ctx.beginPath()
      ctx.arc(cx, cy, size * 0.3, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.restore()
  }

  return { dataUrl: canvas.toDataURL('image/png'), aspect: canvas.height / canvas.width }
}
