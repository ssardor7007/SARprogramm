export type Category =
  | 'router'
  | 'switch'
  | 'ap'
  | 'camera'
  | 'nvr'
  | 'other'

export const CATEGORY_LABELS: Record<Category, string> = {
  router: 'Роутер / шлюз',
  switch: 'Коммутатор',
  ap: 'Точка доступа Wi-Fi',
  camera: 'IP-камера',
  nvr: 'Видеорегистратор (NVR)',
  other: 'Прочее',
}

export type PriceCategory = 'budget' | 'mid' | 'premium'

export const PRICE_CATEGORY_LABELS: Record<PriceCategory, string> = {
  budget: 'Бюджетный',
  mid: 'Средний',
  premium: 'Премиум',
}

export const OWN_BRANDS = ['TP-Link', 'Vitek', 'Hikvision'] as const
export type OwnBrand = (typeof OWN_BRANDS)[number]

export const COMPETITOR_BRANDS = [
  'Ruijie',
  'Tenda',
  'Ubiquiti (UniFi)',
  'MikroTik',
  'Dahua',
  'Другое',
] as const
export type CompetitorBrand = (typeof COMPETITOR_BRANDS)[number]

export interface BaseProduct {
  id: string
  brand: string
  series?: string
  category: Category
  model: string
  /** свободные пары характеристика -> значение, для гибкого сравнения */
  specs: Record<string, string>
  priceUSD: number
  priceCategory: PriceCategory
  notes?: string
}

export interface Product extends BaseProduct {
  brand: OwnBrand
  stock: number
  pros: string[]
  cons: string[]
}

export interface CompetitorProduct extends BaseProduct {
  brand: CompetitorBrand
  /** id товара из своего каталога, вручную подобранный как лучший аналог */
  recommendedOwnId?: string
}

export interface QuoteLine {
  id: string
  competitorProductId?: string
  ownProductId: string
  qty: number
}
