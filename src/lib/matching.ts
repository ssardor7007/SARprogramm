import type { Product } from '../types'

/**
 * Подбор лучшей альтернативы товару в едином каталоге.
 * 1) если у товара указан alternativeId — берём его;
 * 2) иначе ищем среди товаров той же категории (другого бренда) ближайший
 *    по цене и ценовой категории, эвристика на случай, когда пара не задана вручную.
 */
export function findBestMatch(reference: Product, catalog: Product[]): Product | undefined {
  if (reference.alternativeId) {
    const exact = catalog.find((p) => p.id === reference.alternativeId)
    if (exact) return exact
  }

  const sameCategory = catalog.filter((p) => p.category === reference.category && p.id !== reference.id)
  if (sameCategory.length === 0) return undefined

  const otherBrand = sameCategory.filter((p) => p.brand !== reference.brand)
  const pool = otherBrand.length > 0 ? otherBrand : sameCategory

  const samePriceTier = pool.filter((p) => p.priceCategory === reference.priceCategory)
  const finalPool = samePriceTier.length > 0 ? samePriceTier : pool

  return finalPool.reduce((closest, candidate) => {
    const closestDiff = Math.abs(closest.priceUSD - reference.priceUSD)
    const candidateDiff = Math.abs(candidate.priceUSD - reference.priceUSD)
    return candidateDiff < closestDiff ? candidate : closest
  })
}

export function alternativesInCategory(category: Product['category'], catalog: Product[]) {
  return catalog.filter((p) => p.category === category)
}

export function stockLabel(stock: number): { text: string; tone: 'ok' | 'low' | 'out' } {
  if (stock <= 0) return { text: 'Нет в наличии', tone: 'out' }
  if (stock <= 5) return { text: `Осталось мало: ${stock} шт.`, tone: 'low' }
  return { text: `В наличии: ${stock} шт.`, tone: 'ok' }
}
