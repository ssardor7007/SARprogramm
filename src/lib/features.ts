import { BRANDS, CATEGORY_LABELS, type Brand, type Category } from '../types'

/**
 * Переключатель раздела видеонаблюдения (камеры/NVR). Сейчас площадка
 * охватывает только сетевое оборудование — Hikvision и Dahua остаются
 * в списке брендов ради их сетевых линеек (коммутаторы), но без
 * камер/NVR. Верните true, когда видеонаблюдение снова понадобится.
 */
export const SHOW_VIDEO_SURVEILLANCE = false

const VIDEO_CATEGORIES: Category[] = ['camera', 'nvr']

export function visibleCategories(): Category[] {
  const all = Object.keys(CATEGORY_LABELS) as Category[]
  return SHOW_VIDEO_SURVEILLANCE ? all : all.filter((c) => !VIDEO_CATEGORIES.includes(c))
}

export function visibleBrands(): readonly Brand[] {
  return BRANDS
}
