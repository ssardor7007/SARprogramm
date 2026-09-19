import { BRANDS, CATEGORY_LABELS, type Brand, type Category } from '../types'

/**
 * Переключатель раздела видеонаблюдения (камеры/NVR). Площадка теперь
 * охватывает оба направления — сетевое оборудование и видеонаблюдение —
 * поэтому по умолчанию включено. Верните false, если снова нужно сузить
 * фокус только на сети.
 */
export const SHOW_VIDEO_SURVEILLANCE = true

const VIDEO_CATEGORIES: Category[] = ['camera', 'nvr']

export function visibleCategories(): Category[] {
  const all = Object.keys(CATEGORY_LABELS) as Category[]
  return SHOW_VIDEO_SURVEILLANCE ? all : all.filter((c) => !VIDEO_CATEGORIES.includes(c))
}

export function visibleBrands(): readonly Brand[] {
  if (SHOW_VIDEO_SURVEILLANCE) return BRANDS
  return BRANDS.filter((b) => b !== 'Hikvision' && b !== 'Dahua')
}
