import type { Product } from '../types'
import { hasPoeOut, productFacts, productText } from './productFacts'

/* ───────────────────────── PoE-бюджет ───────────────────────── */

export type PoeClass = 'af' | 'at' | 'bt'

export interface PoeDeviceType {
  id: string
  label: string
  /** Типичное потребление устройства, Вт */
  watts: number
  cls: PoeClass
  hint: string
}

export const POE_CLASS_LABEL: Record<PoeClass, string> = {
  af: '802.3af (PoE, до 15,4 Вт)',
  at: '802.3at (PoE+, до 30 Вт)',
  bt: '802.3bt (PoE++ / Hi-PoE, до 60–90 Вт)',
}

export const POE_DEVICE_TYPES: PoeDeviceType[] = [
  { id: 'ap5', label: 'Точка доступа Wi‑Fi 5', watts: 12, cls: 'af', hint: 'EAP225, UAP AC PRO, cAP ac' },
  { id: 'ap6', label: 'Точка доступа Wi‑Fi 6', watts: 18, cls: 'at', hint: 'EAP650, U6 LR, DS-3WAP622' },
  { id: 'ap7', label: 'Точка доступа Wi‑Fi 7', watts: 25, cls: 'at', hint: 'EAP772, U7 PRO' },
  { id: 'cam', label: 'IP-камера', watts: 7, cls: 'af', hint: 'купольная или цилиндрическая' },
  { id: 'camir', label: 'Камера с ИК и подогревом', watts: 13, cls: 'af', hint: 'уличная, ночная подсветка' },
  { id: 'ptz', label: 'PTZ-камера', watts: 40, cls: 'bt', hint: 'поворотная, нужен Hi-PoE' },
  { id: 'phone', label: 'IP-телефон', watts: 5, cls: 'af', hint: 'настольный SIP-телефон' },
  { id: 'intercom', label: 'IP-домофон / панель', watts: 9, cls: 'af', hint: 'вызывная панель, монитор' },
  { id: 'other', label: 'Другое устройство', watts: 10, cls: 'af', hint: 'контроллер, датчик, терминал' },
]

export interface PoeRow {
  typeId: string
  qty: number
  watts: number
}

export interface PoeInput {
  rows: PoeRow[]
  /** Запас по мощности, % */
  headroomPct: number
  /** Запас свободных портов, % */
  sparePortsPct: number
}

export const DEFAULT_POE_INPUT: PoeInput = {
  rows: [
    { typeId: 'ap6', qty: 6, watts: 18 },
    { typeId: 'cam', qty: 8, watts: 7 },
    { typeId: 'phone', qty: 4, watts: 5 },
  ],
  headroomPct: 20,
  sparePortsPct: 15,
}

export interface PoeSuggestion {
  product: Product
  qty: number
  totalUSD: number
  /** Сколько Вт и портов останется свободными */
  freeW: number
  freePorts: number
}

export interface PoeResult {
  devices: number
  consumptionW: number
  requiredW: number
  requiredPorts: number
  needBt: boolean
  needGigabit: boolean
  maxClass: PoeClass
  suggestions: PoeSuggestion[]
}

const CLASS_ORDER: PoeClass[] = ['af', 'at', 'bt']

function supportsBt(p: Product) {
  return /802\.3\s*(?:af\/at\/)?bt|\/bt\b|PoE\+\+|РоЕ\+\+|Hi-PoE|bt type/i.test(productText(p))
}

export function calcPoe(input: PoeInput, catalog: Product[]): PoeResult {
  const rows = input.rows.filter((r) => r.qty > 0)
  const devices = rows.reduce((s, r) => s + r.qty, 0)
  const consumptionW = rows.reduce((s, r) => s + r.qty * Math.max(0, r.watts), 0)
  const requiredW = Math.ceil(consumptionW * (1 + Math.max(0, input.headroomPct) / 100))
  const requiredPorts = devices === 0 ? 0 : Math.ceil(devices * (1 + Math.max(0, input.sparePortsPct) / 100))
  const maxClass = rows.reduce<PoeClass>((m, r) => {
    const cls = r.watts > 30 ? 'bt' : r.watts > 15.4 ? 'at' : (POE_DEVICE_TYPES.find((t) => t.id === r.typeId)?.cls ?? 'af')
    return CLASS_ORDER.indexOf(cls) > CLASS_ORDER.indexOf(m) ? cls : m
  }, 'af')
  const needBt = maxClass === 'bt'
  // Точке доступа нужен гигабитный порт: на 100 Мбит/с Wi‑Fi 5/6/7 упирается в провод
  const needGigabit = rows.some((r) => r.typeId.startsWith('ap'))

  const suggestions: PoeSuggestion[] = []
  if (devices > 0) {
    for (const p of catalog) {
      if (p.category !== 'switch' || !hasPoeOut(p)) continue
      const f = productFacts(p)
      if (!f.poePorts || !f.poeBudgetW) continue
      if (needBt && !supportsBt(p)) continue
      if (needGigabit && f.fastPoe) continue
      // Минимальное число одинаковых коммутаторов, которое закрывает и порты, и мощность
      const qty = Math.max(Math.ceil(requiredPorts / f.poePorts), Math.ceil(requiredW / f.poeBudgetW), 1)
      if (qty > 4) continue
      suggestions.push({
        product: p,
        qty,
        totalUSD: qty * p.priceUSD,
        freeW: qty * f.poeBudgetW - requiredW,
        freePorts: qty * f.poePorts - requiredPorts,
      })
    }
    suggestions.sort((a, b) => Number(b.product.stock > 0) - Number(a.product.stock > 0) || a.qty - b.qty || a.totalUSD - b.totalUSD)
  }
  // Одна строка на модель + разнообразие брендов в первых строках
  const seenBrands = new Set<string>()
  const top: PoeSuggestion[] = []
  for (const s of suggestions) {
    if (top.length >= 4) break
    if (seenBrands.has(s.product.brand) && top.length < 3) continue
    seenBrands.add(s.product.brand)
    top.push(s)
  }
  for (const s of suggestions) {
    if (top.length >= 4) break
    if (!top.includes(s)) top.push(s)
  }
  top.sort((a, b) => a.totalUSD - b.totalUSD)
  return { devices, consumptionW, requiredW, requiredPorts, needBt, needGigabit, maxClass, suggestions: top }
}

/* ───────────────────────── Кабель и СКС ───────────────────────── */

export interface CableInput {
  points: number
  avgLengthM: number
  reservePct: number
  /** sks — патч-панель + розетки; direct — коннекторы RJ-45 на обоих концах (камеры, точки доступа) */
  mode: 'sks' | 'direct'
  panelPorts: 24 | 48
  outletPorts: 1 | 2
}

export const DEFAULT_CABLE_INPUT: CableInput = { points: 24, avgLengthM: 35, reservePct: 15, mode: 'sks', panelPorts: 24, outletPorts: 2 }

export interface CableResult {
  cableM: number
  boxes: number
  maxLineM: number
  overLimit: boolean
  items: { label: string; qty: number; unit: string; note?: string }[]
}

/** Бухта витой пары — 305 м */
export const BOX_M = 305

export function calcCable(input: CableInput): CableResult {
  const points = Math.max(0, Math.round(input.points))
  // +1 м на разделку на двух концах линии
  const perLine = (Math.max(0, input.avgLengthM) + 1) * (1 + Math.max(0, input.reservePct) / 100)
  const cableM = Math.ceil(points * perLine)
  // Из бухты 305 м режутся целые линии: остаток короче линии в дело не идёт
  const linesPerBox = Math.max(1, Math.floor(BOX_M / Math.max(1, perLine)))
  const boxes = points === 0 ? 0 : perLine > BOX_M ? Math.ceil(cableM / BOX_M) : Math.ceil(points / linesPerBox)
  const maxLineM = Math.round(input.avgLengthM * 1.3)
  const items: CableResult['items'] = [{ label: 'Кабель витая пара', qty: boxes, unit: 'бухт по 305 м', note: `${cableM} м с запасом` }]
  if (input.mode === 'sks') {
    const panels = Math.ceil(points / input.panelPorts)
    items.push(
      { label: `Патч-панель ${input.panelPorts} порта`, qty: panels, unit: 'шт.' },
      { label: input.outletPorts === 2 ? 'Розетка RJ-45 двойная' : 'Розетка RJ-45 одинарная', qty: Math.ceil(points / input.outletPorts), unit: 'шт.' },
      { label: 'Патч-корд 0,5–1 м (панель → коммутатор)', qty: points, unit: 'шт.' },
      { label: 'Патч-корд 2–3 м (розетка → устройство)', qty: points, unit: 'шт.' },
      { label: 'Кабельный органайзер 1U', qty: panels, unit: 'шт.' },
      { label: 'Место в шкафу под панели и органайзеры', qty: panels * 2, unit: 'U' },
    )
  } else {
    const connectors = Math.ceil(points * 2 * 1.15)
    items.push(
      { label: 'Коннектор RJ-45', qty: connectors, unit: 'шт.', note: '+15% на брак при обжиме' },
      { label: 'Защитный колпачок', qty: connectors, unit: 'шт.' },
    )
  }
  return { cableM, boxes, maxLineM, overLimit: maxLineM > 90, items }
}

/* ───────────────────────── Оптический бюджет ───────────────────────── */

export type Wavelength = 1310 | 1490 | 1550
export const FIBER_ATTENUATION: Record<Wavelength, number> = { 1310: 0.35, 1490: 0.25, 1550: 0.22 }
export const CONNECTOR_LOSS = 0.5
export const SPLICE_LOSS = 0.1

export const SPLITTER_LOSS: Record<string, number> = {
  '1x2': 3.8,
  '1x4': 7.4,
  '1x8': 10.5,
  '1x16': 13.8,
  '1x32': 17.2,
  '1x64': 21.0,
}

export interface BudgetPreset {
  id: string
  label: string
  budgetDb: number
  /** Минимальное затухание линии, чтобы не перегрузить приёмник */
  minLossDb: number
}

export const BUDGET_PRESETS: BudgetPreset[] = [
  { id: 'sfp3', label: 'SFP 1G, до 3 км', budgetDb: 9, minLossDb: 0 },
  { id: 'sfp20', label: 'SFP 1G, до 20 км', budgetDb: 15, minLossDb: 0 },
  { id: 'sfp40', label: 'SFP 1G, до 40 км', budgetDb: 20, minLossDb: 3 },
  { id: 'sfp80', label: 'SFP 1G, до 80 км', budgetDb: 24, minLossDb: 8 },
  { id: 'gponb', label: 'GPON, класс B+', budgetDb: 28, minLossDb: 13 },
  { id: 'gponc', label: 'GPON, класс C+', budgetDb: 32, minLossDb: 17 },
]

export interface FiberInput {
  lengthKm: number
  wavelength: Wavelength
  connectors: number
  splices: number
  splitters: string[]
  marginDb: number
  presetId: string
}

export const DEFAULT_FIBER_INPUT: FiberInput = { lengthKm: 5, wavelength: 1310, connectors: 2, splices: 4, splitters: [], marginDb: 3, presetId: 'sfp20' }

export interface FiberResult {
  fiberDb: number
  connectorDb: number
  spliceDb: number
  splitterDb: number
  totalDb: number
  budgetDb: number
  reserveDb: number
  verdict: 'ok' | 'tight' | 'fail'
  overload: boolean
  sfp: Product[]
  splitters: Product[]
}

export function calcFiber(input: FiberInput, catalog: Product[]): FiberResult {
  const preset = BUDGET_PRESETS.find((b) => b.id === input.presetId) ?? BUDGET_PRESETS[1]
  const fiberDb = Math.max(0, input.lengthKm) * FIBER_ATTENUATION[input.wavelength]
  const connectorDb = Math.max(0, input.connectors) * CONNECTOR_LOSS
  const spliceDb = Math.max(0, input.splices) * SPLICE_LOSS
  const splitterDb = input.splitters.reduce((s, r) => s + (SPLITTER_LOSS[r] ?? 0), 0)
  const totalDb = fiberDb + connectorDb + spliceDb + splitterDb
  const reserveDb = preset.budgetDb - totalDb
  const verdict = reserveDb >= input.marginDb ? 'ok' : reserveDb >= 0 ? 'tight' : 'fail'

  const sfp = catalog
    .filter((p) => productFacts(p).kind === 'sfp' && (productFacts(p).rangeKm ?? 0) >= input.lengthKm)
    .sort((a, b) => (productFacts(a).rangeKm ?? 0) - (productFacts(b).rangeKm ?? 0) || a.priceUSD - b.priceUSD)
    .slice(0, 4)
  const splitters = input.splitters.flatMap((r) =>
    catalog.filter((p) => productFacts(p).kind === 'splitter' && new RegExp(`\\b${r.replace('x', '[xх×]')}\\b`, 'i').test(`${p.model} ${productText(p)}`)).slice(0, 2),
  )
  return {
    fiberDb,
    connectorDb,
    spliceDb,
    splitterDb,
    totalDb,
    budgetDb: preset.budgetDb,
    reserveDb,
    verdict,
    overload: totalDb < preset.minLossDb,
    sfp,
    splitters,
  }
}

/* ───────────────────────── Интернет-канал ───────────────────────── */

export interface BandwidthProfile {
  id: string
  label: string
  /** Мбит/с на одного активного пользователя (download) */
  down: number
  /** Мбит/с на одного активного пользователя (upload) */
  up: number
}

export const BANDWIDTH_PROFILES: BandwidthProfile[] = [
  { id: 'office', label: 'Офисная работа (почта, 1С, браузер)', down: 2, up: 0.5 },
  { id: 'video', label: 'Видеозвонки (Zoom, Teams, Telegram)', down: 4, up: 3 },
  { id: 'heavy', label: 'Тяжёлые задачи (облака, дизайн, файлы)', down: 12, up: 4 },
  { id: 'guest', label: 'Гостевой Wi‑Fi (телефоны посетителей)', down: 1.5, up: 0.3 },
  { id: 'tv', label: 'Видео и IPTV (номера, зоны отдыха)', down: 8, up: 0.2 },
  { id: 'cams', label: 'Камеры с облачной записью', down: 0.1, up: 2 },
]

export interface BandwidthInput {
  counts: Record<string, number>
  /** Доля одновременно активных, % */
  concurrencyPct: number
}

export const DEFAULT_BANDWIDTH_INPUT: BandwidthInput = { counts: { office: 20, video: 5, guest: 15 }, concurrencyPct: 60 }

const TARIFF_STEPS = [20, 50, 100, 200, 300, 500, 1000, 2000, 5000, 10000]

export function calcBandwidth(input: BandwidthInput) {
  const k = Math.min(100, Math.max(10, input.concurrencyPct)) / 100
  let down = 0
  let up = 0
  let users = 0
  for (const p of BANDWIDTH_PROFILES) {
    const n = Math.max(0, input.counts[p.id] ?? 0)
    // Камеры пишут в облако постоянно — их одновременность не снижаем
    const factor = p.id === 'cams' ? 1 : k
    down += n * p.down * factor
    up += n * p.up * factor
    if (p.id !== 'cams') users += n
  }
  const downNeed = Math.ceil(down * 1.25)
  const upNeed = Math.ceil(up * 1.25)
  const tariff = TARIFF_STEPS.find((t) => t >= Math.max(downNeed, upNeed)) ?? TARIFF_STEPS[TARIFF_STEPS.length - 1]
  return { users, down: downNeed, up: upNeed, tariff, symmetric: upNeed > tariff * 0.4 }
}
