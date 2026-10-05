import type { Product } from '../types'
import { hasPoeOut, productFacts } from './productFacts'

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

/** Цвет плашки наличия (тема день/ночь подменяет палитру emerald/amber/red) */
export const STOCK_TONE: Record<'ok' | 'low' | 'out', string> = {
  ok: 'text-emerald-700 bg-emerald-50',
  low: 'text-amber-700 bg-amber-50',
  out: 'text-red-700 bg-red-50',
}

export function stockLabel(stock: number): { text: string; tone: 'ok' | 'low' | 'out' } {
  if (stock <= 0) return { text: 'Нет в наличии', tone: 'out' }
  if (stock <= 5) return { text: `Осталось мало: ${stock} шт.`, tone: 'low' }
  return { text: `В наличии: ${stock} шт.`, tone: 'ok' }
}

/**
 * Похожие товары других брендов для карточки товара: та же категория и тот же «класс»
 * (PoE/без PoE и число портов у коммутатора, поколение Wi-Fi и улица/помещение у точки
 * доступа, подтип у «прочего»), ближе всего по цене.
 */
export function similarProducts(reference: Product, catalog: Product[], limit = 4): Product[] {
  const rf = productFacts(reference)
  const score = (p: Product) => {
    const f = productFacts(p)
    let s = 0
    if (p.brand !== reference.brand) s += 2
    if (reference.category === 'switch') {
      if (hasPoeOut(p) === hasPoeOut(reference)) s += 3
      if (rf.ports && f.ports) s += Math.max(0, 2 - Math.abs(Math.log2(f.ports / rf.ports)))
    } else if (reference.category === 'ap') {
      if (f.wifi && f.wifi === rf.wifi) s += 3
      if (f.outdoor === rf.outdoor) s += 2
    } else if (reference.category === 'other') {
      if (f.kind === rf.kind) s += 4
    }
    const priceGap = Math.abs(Math.log((p.priceUSD + 1) / (reference.priceUSD + 1)))
    return s - priceGap * 1.5
  }
  return catalog
    .filter((p) => p.category === reference.category && p.id !== reference.id)
    .map((p) => ({ p, s: score(p) }))
    .sort((a, b) => b.s - a.s)
    .slice(0, limit)
    .map((x) => x.p)
}
