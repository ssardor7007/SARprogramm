import type { CompetitorProduct, Product } from '../types'

/**
 * Подбор лучшего аналога из своего каталога для товара конкурента.
 * 1) если у товара конкурента указан recommendedOwnId — берём его;
 * 2) иначе ищем среди своих товаров той же категории ближайший по цене
 *    и категории цены (грубая эвристика, чтобы список никогда не был пустым).
 */
export function findBestMatch(
  competitor: CompetitorProduct,
  ownCatalog: Product[],
): Product | undefined {
  if (competitor.recommendedOwnId) {
    const exact = ownCatalog.find((p) => p.id === competitor.recommendedOwnId)
    if (exact) return exact
  }

  const sameCategory = ownCatalog.filter((p) => p.category === competitor.category)
  if (sameCategory.length === 0) return undefined

  const samePriceTier = sameCategory.filter((p) => p.priceCategory === competitor.priceCategory)
  const pool = samePriceTier.length > 0 ? samePriceTier : sameCategory

  return pool.reduce((closest, candidate) => {
    const closestDiff = Math.abs(closest.priceUSD - competitor.priceUSD)
    const candidateDiff = Math.abs(candidate.priceUSD - competitor.priceUSD)
    return candidateDiff < closestDiff ? candidate : closest
  })
}

export function alternativesInCategory(category: Product['category'], ownCatalog: Product[]) {
  return ownCatalog.filter((p) => p.category === category)
}

export function stockLabel(stock: number): { text: string; tone: 'ok' | 'low' | 'out' } {
  if (stock <= 0) return { text: 'Нет в наличии', tone: 'out' }
  if (stock <= 5) return { text: `Осталось мало: ${stock} шт.`, tone: 'low' }
  return { text: `В наличии: ${stock} шт.`, tone: 'ok' }
}
