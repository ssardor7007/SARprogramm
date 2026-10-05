import type { Product } from '../types'

/**
 * Ключевые параметры товара, вытащенные из свободного текста прайса.
 *
 * В прайсах поставщиков характеристики — одна строка «Характеристики» вперемешку
 * на русском и английском («Порты: 8 × гигабитных портов PoE+ …», «L2. Unmanaged.
 * 8 10/100M RJ45 PoE ports …», «● 16 x 10/100Mbps PoE Ports …»). Отсюда берутся
 * фильтры каталога, строки сравнения и подбор коммутатора в PoE-калькуляторе,
 * поэтому разбор осторожный: чего не нашли — того нет (undefined), а не «0».
 */
export interface ProductFacts {
  /** Портов PoE на выход (без «PoE In») */
  poePorts?: number
  /** Общий бюджет PoE, Вт */
  poeBudgetW?: number
  /** Всего портов, как их называет производитель («24-портовый») */
  ports?: number
  sfp: boolean
  /** SFP+/10G-аплинки или 10G-порты */
  has10G: boolean
  /** Мультигигабит 2.5G */
  has25G: boolean
  managed?: 'unmanaged' | 'smart' | 'managed' | 'l3'
  wifi?: WifiGen
  outdoor: boolean
  rackmount: boolean
  /** PoE-порты только 10/100 Мбит/с — годятся для камер и телефонов, но не для точек доступа Wi‑Fi 5/6/7 */
  fastPoe: boolean
  /** Дальность (оптика, радиомосты, SFP), км */
  rangeKm?: number
  /** Подтип для «Прочего»: SFP-модуль, патч-корд, инжектор… */
  kind?: OtherKind
}

export type WifiGen = 'Wi-Fi 4' | 'Wi-Fi 5' | 'Wi-Fi 6' | 'Wi-Fi 6E' | 'Wi-Fi 7'

export type OtherKind =
  | 'sfp'
  | 'patchcord'
  | 'splitter'
  | 'odf'
  | 'fiber-accessory'
  | 'fiber-tool'
  | 'injector'
  | 'controller'
  | 'bridge'
  | 'lte'
  | 'rack-kit'
  | 'misc'

export const OTHER_KIND_LABELS: Record<OtherKind, string> = {
  sfp: 'SFP-модули и DAC',
  patchcord: 'Оптические патч-корды и пигтейлы',
  splitter: 'Оптические сплиттеры (PLC)',
  odf: 'Оптические кроссы и муфты',
  'fiber-accessory': 'Аксессуары для оптики',
  'fiber-tool': 'Инструмент и приборы для оптики',
  injector: 'PoE-инжекторы',
  controller: 'Контроллеры',
  bridge: 'Радиомосты и CPE',
  lte: '4G/5G-роутеры',
  'rack-kit': 'Крепления в стойку',
  misc: 'Прочее',
}

/** Короткие подписи подтипов для «чипсов» на карточке. */
export const OTHER_KIND_SHORT: Record<OtherKind, string> = {
  sfp: 'SFP',
  patchcord: 'Патч-корд',
  splitter: 'Сплиттер',
  odf: 'Кросс / муфта',
  'fiber-accessory': 'Аксессуар',
  'fiber-tool': 'Инструмент',
  injector: 'Инжектор',
  controller: 'Контроллер',
  bridge: 'Радиомост',
  lte: '4G/5G',
  'rack-kit': 'Крепление',
  misc: 'Прочее',
}

export const MANAGED_LABELS: Record<NonNullable<ProductFacts['managed']>, string> = {
  unmanaged: 'Неуправляемый',
  smart: 'Smart / облачный',
  managed: 'Управляемый L2/L2+',
  l3: 'Управляемый L3',
}

/** Служебные строки прайса — не показываем их как характеристики. */
export const INTERNAL_SPEC = /цен|ндс|сум|price|стоимост|остат|склад|закуп/i

export function productText(p: Product) {
  const specs = Object.entries(p.specs)
    .filter(([k]) => !INTERNAL_SPEC.test(k))
    .map(([k, v]) => (k === 'Характеристики' ? v : `${k}: ${v}`))
    .join(' ')
  return `${p.model} ${p.series ?? ''} ${specs}`.replace(/\s+/g, ' ')
}

// Число портов не должно быть хвостом другого числа: «RJ45 PoE» — это не 45 PoE-портов,
// «10/100M» — не 100, «WK-PS206 Poe» — не 6. Отсюда запрет на букву/цифру/дробь слева.
const NUM = String.raw`(?<![\w/,+-])(?<!\d\.)(\d{1,2})(?![\d/.,])`
// Конец слова для кириллицы: \b в JS-регулярках кириллицу не считает буквами.
const EOW = String.raw`(?![a-zа-яё])`
// Слова, которые могут стоять между количеством и «PoE»/«порт»: «8 × гигабитных портов RJ45 PoE+»,
// «4 10/100M RJ45 PoE ports», «16 портов 1G PoE.at», «24 гигабитных Ethernet-порта c функцией РоЕ».
const TOK = String.raw`(?:гигабитн[а-яё]*|мультигигабитн[а-яё]*|gigabit|fast\s*ethernet|ethernet|[\d/.,]+\s*(?:Mbps|Мбит\/с|Гбит\/с|M|G)${EOW}|RJ-?45|[cс]\s+функцией)`
const PORT_WORD = String.raw`(?:(?:ethernet|WAN\/LAN|WAN|LAN|RJ-?45)?-?порт[а-яё]*|ports?${EOW})`
const POE_WORD = String.raw`(?:Hi-)?(?:PoE|РоЕ|POE)`
const POE_COUNT = new RegExp(
  String.raw`${NUM}\s*[×xх*]?\s*(?:(?:${TOK}|${PORT_WORD})[\s,]*){0,4}${POE_WORD}(?:\+\+|\+)?(?![+]|\s*\(?In${EOW})`,
  'gi',
)
const PORT_COUNT = new RegExp(
  String.raw`${NUM}\s*[×xх*]?\s*(?:(?:${TOK}|${POE_WORD}\+*|uplink)[\s,]*){0,4}(?:${PORT_WORD}|GE${EOW}|gigabit\s+ethernet${EOW})`,
  'gi',
)

function sectionAfter(text: string, label: string, stops: string[]) {
  const i = text.search(new RegExp(`${label}\\s*:`, 'i'))
  if (i < 0) return undefined
  const rest = text.slice(i).replace(new RegExp(`^${label}\\s*:`, 'i'), '')
  const stop = rest.search(new RegExp(`(?:${stops.join('|')})\\s*:`, 'i'))
  return stop < 0 ? rest : rest.slice(0, stop)
}

function poePortsFrom(p: Product, text: string): number | undefined {
  if (/^нет/i.test(p.specs['PoE-бюджет'] ?? '')) return 0
  const structured = p.specs['Портов']
  if (structured) {
    const m = structured.match(/(\d{1,2})\s*x\s*[a-zа-яё\s]*PoE/i)
    if (m) return Number(m[1])
  }
  const portsSection = sectionAfter(text, 'Порты', ['Спецификация', 'Скорость', 'Особенности'])
  if (portsSection) {
    const counts = [...portsSection.matchAll(POE_COUNT)].map((m) => Number(m[1]))
    if (counts.length) return counts.reduce((s, n) => s + n, 0)
  }
  const counts = [...text.matchAll(POE_COUNT)].map((m) => Number(m[1])).filter((n) => n > 0 && n <= 52)
  if (counts.length) return Math.max(...counts)
  // Модели, где число PoE-портов есть только в названии: Dahua PFS3006-4ET-60, MikroTik CRS328-24P,
  // Tenda TEF1109P-8-102W, Wi-Tek «WI-PCES306G V2 Cloud Poe 4+2 GB»
  const model =
    p.model.match(/-(\d{1,2})(?:ET|P)(?![a-z])/i) ??
    p.model.match(/P-(\d{1,2})-\d{2,3}W/i) ??
    p.model.match(/Poe\s*(\d{1,2})\s*(?:\+|MB|Gb)/i)
  if (model) return Number(model[1])
  return undefined
}

function poeBudgetFrom(p: Product, text: string): number | undefined {
  const structured = p.specs['PoE-бюджет']
  if (structured) {
    const m = structured.match(/(\d{2,4})/)
    if (m) return Number(m[1])
  }
  const patterns = [
    /бюджет(?:ом)?\s*(?:мощности\s*)?(?:PoE|РоЕ)?\s*(?:до\s*)?(\d{2,4})\s*(?:Вт|W)/i,
    /(?:PoE|РоЕ)[- ]бюджет\s*(\d{2,4})\s*(?:Вт|W|Ватт)/i,
    /power\s*budget\s*(?:of\s*)?(?:up\s*to\s*)?(\d{2,4})\s*W/i,
    /(\d{2,4})\s*W\s*Power budget/i,
    /максимальная мощность питания (?:РоЕ|PoE)\s*(\d{2,4})\s*Вт/i,
    /Max\.?\s*(\d{2,4})\s*W\s*PoE output/i,
    /Whole-device (?:PoE )?power of (\d{2,4})\s*W/i,
  ]
  for (const re of patterns) {
    const m = text.match(re)
    if (m) return Number(m[1])
  }
  const model = p.model.match(/-(\d{2,3})W?$/)
  if (model && /PoE|ET-|P-/i.test(`${p.model} ${text}`)) return Number(model[1])
  return undefined
}

function portsFrom(p: Product, text: string, poePorts?: number): number | undefined {
  const structured = p.specs['Портов'] ?? p.specs['WAN/LAN портов']
  if (structured) {
    const counts = [...structured.matchAll(/(\d{1,2})\s*x/gi)].map((m) => Number(m[1]))
    if (counts.length) return counts.reduce((s, n) => s + n, 0)
  }
  const named = text.match(/(?<![\w/.,+-])(\d{1,2})-порт(?:овый|ов)/i) ?? text.match(/(?<![\w/.,+-])(\d{1,2})[- ]Port(?![a-z])/i)
  if (named) return Number(named[1])
  const wiTek = p.model.match(/Poe\s*(\d{1,2})\s*\+\s*(\d)/i)
  if (wiTek) return Number(wiTek[1]) + Number(wiTek[2])
  const scope = sectionAfter(text, 'Порты', ['Спецификация', 'Скорость', 'Особенности']) ?? text
  const counts = [...scope.matchAll(PORT_COUNT)].map((m) => Number(m[1])).filter((n) => n > 0)
  const sum = counts.reduce((s, n) => s + n, 0)
  if (sum > 0 && sum <= 56) return sum
  return poePorts || undefined
}

const GIGABIT_POE =
  /(?:гигабитн[а-яё]*|gigabit|1000\s*M(?:bps)?|10\/100\/1000\s*(?:M(?:bps)?)?|100\/1000\s*M?|1G|2[.,]5\s*(?:G|Гбит\/с)|мультигигабитн[а-яё]*)\s*(?:RJ-?45\s*)?(?:порт[а-яё]*\s*)?(?:RJ-?45\s*)?(?:Hi-)?(?:PoE|РоЕ|POE)/i
const FAST_POE =
  /(?:порт[а-яё]*\s*)?(?:10\/100(?![\d/])\s*(?:Мбит\/с|M(?:bps)?)?|fast\s*ethernet|(?<![\d/])100\s?(?:Mbps|Мбит\/с))\s*(?:RJ-?45\s*)?(?:порт[а-яё]*\s*)?(?:RJ-?45\s*)?(?:Hi-)?(?:PoE|РоЕ|POE)/i

function fastPoeFrom(p: Product, text: string) {
  if (GIGABIT_POE.test(text)) return false
  if (FAST_POE.test(text)) return true
  // «16 10/100M RJ45 ports» без явного «PoE» рядом — основная гребёнка портов всё равно 100 Мбит/с
  const fastPorts = text.match(/(?<![\w/.,])(\d{1,2})\s*[x×]?\s*10\/100M?\s*(?:RJ-?45\s*)?ports?/i)
  if (fastPorts && Number(fastPorts[1]) >= 4) return true
  // Wi-Tek пишет скорость в названии: «Poe 8+2 MB» — 100 Мбит/с, «GB» — гигабит
  return /Poe[^,]*\bMB\b/i.test(p.model) && !/\bGB\b/i.test(p.model)
}

function managedFrom(text: string): ProductFacts['managed'] {
  if (/неуправляем|unmanaged/i.test(text)) return 'unmanaged'
  if (/\bL3\b|Lite L3|третьего уровня/i.test(text)) return 'l3'
  if (/L2\+|full managed|управляемый (?:PoE-)?коммутатор|управляемый L2/i.test(text)) return 'managed'
  if (/smart|easy managed|easy smart|cloud|облачн/i.test(text)) return 'smart'
  if (/managed|управляем/i.test(text)) return 'managed'
  if (/VLAN|SNMP|Omada SDN/i.test(text)) return 'smart'
  if (/plug\s*(?:and|и|&)\s*play|настольный (?:гигабитный )?коммутатор/i.test(text)) return 'unmanaged'
  return undefined
}

function wifiFrom(p: Product, text: string): WifiGen | undefined {
  if (/Wi-?Fi\s*7|\bBE\d{3,5}\b|802\.11be/i.test(text)) return 'Wi-Fi 7'
  if (/Wi-?Fi\s*6E|\bAXE\d+/i.test(text)) return 'Wi-Fi 6E'
  if (/Wi-?Fi\s*6|\bAX\d{3,5}\b|802\.11ax|11AX|\bcAP ax\b|\(CAP AX\)/i.test(text)) return 'Wi-Fi 6'
  if (/\bAC\d{3,5}\b|802\.11\s*ac|Wi-?Fi\s*5|WIFI5|\bac\b/i.test(text)) return 'Wi-Fi 5'
  if (/\bN\d{3}\b|802\.11\s*b\/g\/n|802\.11n|2[.,]4\s*ГГц/i.test(text)) return 'Wi-Fi 4'
  const m = p.model
  if (/^EAP7|^U7/i.test(m)) return 'Wi-Fi 7'
  if (/^EAP6|^U6/i.test(m)) return 'Wi-Fi 6'
  if (/^EAP2|^UAP AC/i.test(m)) return 'Wi-Fi 5'
  return undefined
}

function rangeFrom(p: Product, text: string): number | undefined {
  const km = text.match(/(?<![\d/.,])(\d{1,3}(?:[.,]\d)?)\s*(?:км|km)(?![a-zа-яё])/i)
  if (km) return Number(km[1].replace(',', '.'))
  const sfpModel = p.model.match(/SFP-[\d.]+G-(\d{1,3})-1[35][15]0/i)
  if (sfpModel) return Number(sfpModel[1])
  if (p.category !== 'other' || !/bridge|мост|CPE|transmi/i.test(text)) return undefined
  const m = text.match(/(?<![\w/.,])(\d{3,4})\s*m(?![a-zA-Z])/)
  return m ? Number(m[1]) / 1000 : undefined
}

function otherKind(p: Product, text: string): OtherKind {
  const t = `${p.model} ${text}`
  if (/контроллер|Cloud Key|OC\d{3}/i.test(t)) return 'controller'
  if (/\bSFP|DAC|HK-SFP|модуль/i.test(t) && !/коммутатор|switch/i.test(t)) return 'sfp'
  if (/патч-?корд|pigteyl|пиктейл|pigtail|patch/i.test(t)) return 'patchcord'
  if (/PLC|сплиттер|splitter|делитель на/i.test(t)) return 'splitter'
  if (/ODF|кросс|kross|муфта/i.test(t)) return 'odf'
  if (/резак|скалыват|сварочн|стриппер|OTDR|рефлектометр|power\s*metr|лазер|VFL/i.test(t)) return 'fiber-tool'
  if (/адаптер|коннектор|кассета|лоток|tubing|рукав|LC-LC$|SC-LC$/i.test(t)) return 'fiber-accessory'
  if (/инжектор|injector|^POE\d/i.test(t)) return 'injector'
  if (/bridge|мост|CPE|LOCO|BEAM|NanoStation|репитер|повторител|Mesh-компонент/i.test(t)) return 'bridge'
  if (/4G|5G|LTE/i.test(t)) return 'lte'
  if (/RackMount|кронштейн/i.test(t)) return 'rack-kit'
  return 'misc'
}

const cache = new WeakMap<Product, ProductFacts>()

export function productFacts(p: Product): ProductFacts {
  const hit = cache.get(p)
  if (hit) return hit
  const text = productText(p)
  const poePorts = p.category === 'switch' || p.category === 'router' ? poePortsFrom(p, text) : undefined
  const facts: ProductFacts = {
    poePorts: poePorts && poePorts > 0 ? poePorts : undefined,
    poeBudgetW: p.category === 'switch' || p.category === 'router' ? poeBudgetFrom(p, text) : undefined,
    ports: p.category === 'switch' || p.category === 'router' ? portsFrom(p, text, poePorts) : undefined,
    sfp: /SFP|оптическ|fiber optic|\bSC\b|\d+S\+/i.test(text),
    has10G: /SFP\+|(?<!\d)10G|10\s*Гбит|10Gb|QSFP|\d+S\+/i.test(text),
    has25G: /2[.,]5\s*(?:G|Гбит)|мультигигабит/i.test(text),
    managed: p.category === 'switch' ? managedFrom(text) : undefined,
    wifi: p.category === 'ap' || p.category === 'router' ? wifiFrom(p, text) : undefined,
    outdoor: /outdoor|наружн|уличн|IP6[5-8]|-O\b|\(O\)/i.test(`${p.model} ${text}`),
    rackmount: /в стойку|rack|19"|1U\b|19-дюйм/i.test(text),
    fastPoe: p.category === 'switch' ? fastPoeFrom(p, text) : false,
    rangeKm: p.category === 'other' || p.category === 'switch' ? rangeFrom(p, text) : undefined,
    kind: p.category === 'other' ? otherKind(p, text) : undefined,
  }
  cache.set(p, facts)
  return facts
}

/** Есть ли у коммутатора реальные PoE-выходы (а не только «PoE In» для собственного питания). */
export function hasPoeOut(p: Product) {
  const f = productFacts(p)
  if (f.poePorts === 0) return false
  return (f.poePorts ?? 0) > 0 || (f.poeBudgetW ?? 0) > 0 || /PoE/i.test(p.model)
}

/** 1 порт, 2 порта, 5 портов */
export function plural(n: number, [one, few, many]: [string, string, string]) {
  const m10 = n % 10
  const m100 = n % 100
  if (m10 === 1 && m100 !== 11) return one
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few
  return many
}

/** Короткие «чипсы» для карточки товара. */
export function factChips(p: Product): string[] {
  const f = productFacts(p)
  const chips: string[] = []
  if (p.category === 'switch' || p.category === 'router') {
    if (f.ports) chips.push(`${f.ports} ${plural(f.ports, ['порт', 'порта', 'портов'])}`)
    if (f.poePorts) chips.push(`${f.poePorts} PoE`)
    if (f.poeBudgetW) chips.push(`${f.poeBudgetW} Вт`)
    if (f.has10G) chips.push('10G')
    else if (f.has25G) chips.push('2.5G')
    else if (f.sfp) chips.push('SFP')
  }
  if (f.wifi) chips.push(f.wifi)
  if (f.outdoor && p.category !== 'other') chips.push('Уличная')
  if (p.category === 'other' && f.kind && f.kind !== 'misc') chips.push(OTHER_KIND_SHORT[f.kind])
  if (f.rangeKm && p.category === 'other') chips.push(`до ${f.rangeKm} км`)
  return chips.slice(0, 4)
}

/** Разбивает строку «Характеристики» на подписанные блоки для карточки товара. */
export function specSections(p: Product): { label?: string; text: string; bullets?: string[] }[] {
  const out: { label?: string; text: string; bullets?: string[] }[] = []
  for (const [k, v] of Object.entries(p.specs)) {
    if (INTERNAL_SPEC.test(k) || !v.trim()) continue
    if (k !== 'Характеристики') {
      out.push({ label: k, text: v })
      continue
    }
    const text = v.replace(/\s+/g, ' ').trim()
    if (/[●•*]\s/.test(text)) {
      const bullets = text
        .split(/\s*[●•]\s*|\s\*\s?|^\*\s?/)
        .map((s) => s.trim())
        .filter(Boolean)
      out.push({ text: '', bullets })
      continue
    }
    const labels = ['Порты', 'Скорость', 'Спецификация', 'Особенности', 'Uplink', 'Downlink', 'Функции', 'Габаритные размеры']
    const re = new RegExp(`(${labels.join('|')})\\s*:`, 'gi')
    const marks = [...text.matchAll(re)]
    if (marks.length === 0) {
      out.push({ text })
      continue
    }
    const head = text.slice(0, marks[0].index).replace(/[,.\s]+$/, '')
    if (head) out.push({ text: head })
    marks.forEach((m, i) => {
      const start = (m.index ?? 0) + m[0].length
      const end = i + 1 < marks.length ? marks[i + 1].index : text.length
      const body = text.slice(start, end).replace(/^[\s,.]+|[\s,.]+$/g, '')
      if (body) out.push({ label: m[1][0].toUpperCase() + m[1].slice(1), text: body })
    })
  }
  return out
}

/** Цена поставщика в сумах с НДС, если она есть в прайсе. */
export function priceUzsFromList(p: Product): number | undefined {
  const raw = p.specs['Цена с НДС (сум)']
  if (!raw) return undefined
  const n = Number(raw.replace(/[^\d]/g, ''))
  return n > 0 ? n : undefined
}

/** Типичное потребление точки доступа по PoE, Вт — по поколению Wi‑Fi. */
export function apPoeWatts(p?: Product): number {
  const wifi = p ? productFacts(p).wifi : undefined
  return wifi === 'Wi-Fi 7' ? 25 : wifi === 'Wi-Fi 6E' ? 20 : wifi === 'Wi-Fi 6' ? 18 : wifi === 'Wi-Fi 5' ? 12 : wifi === 'Wi-Fi 4' ? 8 : 15
}

/**
 * Сколько штук этого коммутатора нужно на portsNeeded PoE-устройств с общим потреблением
 * wattsNeeded: и по портам, и по бюджету PoE. Если число PoE-портов неизвестно — берём все порты.
 */
export function switchQtyFor(p: Product, portsNeeded: number, wattsNeeded = 0): number {
  if (portsNeeded <= 0) return 0
  const f = productFacts(p)
  const ports = f.poePorts ?? f.ports ?? 24
  const byPorts = Math.ceil(portsNeeded / Math.max(1, ports))
  const byPower = f.poeBudgetW && wattsNeeded > 0 ? Math.ceil(wattsNeeded / f.poeBudgetW) : 1
  return Math.max(1, byPorts, byPower)
}
