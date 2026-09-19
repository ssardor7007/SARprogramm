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

/** Единый список брендов на площадке — сетевое направление и видеонаблюдение. */
export const BRANDS = [
  'TP-Link',
  'Wi-Tek',
  'Hikvision',
  'Dahua',
  'Tenda',
  'Ubiquiti (UniFi)',
  'MikroTik',
  'Ruijie',
] as const
export type Brand = (typeof BRANDS)[number]

export interface Product {
  id: string
  brand: Brand
  series?: string
  category: Category
  model: string
  /** свободные пары характеристика -> значение, для гибкого сравнения */
  specs: Record<string, string>
  priceUSD: number
  priceCategory: PriceCategory
  notes?: string
  /** необязательное фото товара; без него показывается фирменная иконка категории */
  imageUrl?: string
  stock: number
  pros: string[]
  cons: string[]
  /** id другого товара в каталоге, вручную подобранный как лучшая альтернатива */
  alternativeId?: string
}

export interface QuoteLine {
  id: string
  referenceProductId?: string
  productId: string
  qty: number
}
