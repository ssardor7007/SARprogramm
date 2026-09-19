import type { Product } from '../types'
import { genId } from './storage'

const STORAGE_KEY = 'sar-net-compare:rack-lines'

export interface RackLine {
  id: string
  productId: string
  qty: number
  /** Высота в юнитах ОДНОГО экземпляра этой модели */
  unitsPerItem: number
}

function loadRackLines(): RackLine[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    return JSON.parse(raw) as RackLine[]
  } catch {
    return []
  }
}

function saveRackLines(lines: RackLine[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(lines))
  } catch {
    // хранилище недоступно (приватный режим и т.п.) — молча игнорируем
  }
}

/**
 * Добавляет товары (например, готовый вариант из «Подбора по объекту») в текущий проект стойки —
 * количество суммируется с уже имеющимися позициями того же товара, а не дублирует строки.
 */
export function addProductsToRack(items: { product?: Product; qty: number }[]) {
  const lines = loadRackLines()
  for (const { product, qty } of items) {
    if (!product || qty <= 0) continue
    const existing = lines.find((l) => l.productId === product.id)
    if (existing) existing.qty += qty
    else lines.push({ id: genId('rack'), productId: product.id, qty, unitsPerItem: 1 })
  }
  saveRackLines(lines)
}
