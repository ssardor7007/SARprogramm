import {
  CATEGORY_LABELS,
  COMPETITOR_BRANDS,
  OWN_BRANDS,
  type Category,
  type CompetitorBrand,
  type CompetitorProduct,
  type OwnBrand,
  type Product,
} from '../types'

/**
 * Пока компания фокусируется только на сетевом оборудовании, раздел
 * видеонаблюдения (камеры/NVR, Vitek/Hikvision, Dahua) скрыт из интерфейса.
 * Все данные и компоненты на месте — верните true, когда будете готовы
 * снова продавать видеонаблюдение через этот инструмент.
 */
export const SHOW_VIDEO_SURVEILLANCE = false

const VIDEO_CATEGORIES: Category[] = ['camera', 'nvr']

export function visibleCategories(): Category[] {
  const all = Object.keys(CATEGORY_LABELS) as Category[]
  return SHOW_VIDEO_SURVEILLANCE ? all : all.filter((c) => !VIDEO_CATEGORIES.includes(c))
}

export function visibleOwnBrands(): readonly OwnBrand[] {
  return SHOW_VIDEO_SURVEILLANCE ? OWN_BRANDS : OWN_BRANDS.filter((b) => b === 'TP-Link')
}

export function visibleCompetitorBrands(): readonly CompetitorBrand[] {
  return SHOW_VIDEO_SURVEILLANCE ? COMPETITOR_BRANDS : COMPETITOR_BRANDS.filter((b) => b !== 'Dahua')
}

export function filterOwnProducts(items: Product[]): Product[] {
  return SHOW_VIDEO_SURVEILLANCE ? items : items.filter((p) => !VIDEO_CATEGORIES.includes(p.category))
}

export function filterCompetitorProducts(items: CompetitorProduct[]): CompetitorProduct[] {
  return SHOW_VIDEO_SURVEILLANCE ? items : items.filter((p) => !VIDEO_CATEGORIES.includes(p.category))
}
