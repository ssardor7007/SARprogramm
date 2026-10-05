import type { QuoteLine } from '../types'
import { DEFAULT_LIST_INTRO, DEFAULT_PROPOSAL_META, type ProposalMeta } from './proposal'
import { createSharedState, genId } from './storage'

/** До 4 товаров в сравнении — больше колонок на экране уже не читается. */
export const COMPARE_LIMIT = 4

const compareStore = createSharedState<string[]>('compare-ids', [])
const quoteStore = createSharedState<QuoteLine[]>('quote-lines', [])

export function useCompare() {
  const [ids, setIds] = compareStore.use()
  return {
    ids,
    has: (id: string) => ids.includes(id),
    /** false — если сравнение уже заполнено */
    toggle: (id: string) => {
      if (ids.includes(id)) {
        setIds(ids.filter((x) => x !== id))
        return true
      }
      if (ids.length >= COMPARE_LIMIT) return false
      setIds([...ids, id])
      return true
    },
    /** Добавляет сразу несколько (например, товар и его аналог); false — если всё не поместилось. */
    addMany: (add: string[]) => {
      let ok = true
      setIds((prev) => {
        const next = [...prev]
        for (const id of add) {
          if (next.includes(id)) continue
          if (next.length >= COMPARE_LIMIT) {
            ok = false
            continue
          }
          next.push(id)
        }
        return next
      })
      return ok
    },
    remove: (id: string) => setIds((prev) => prev.filter((x) => x !== id)),
    clear: () => setIds([]),
  }
}

export function useQuoteLines() {
  const [lines, setLines] = quoteStore.use()
  return {
    lines,
    setLines,
    count: lines.reduce((s, l) => s + l.qty, 0),
    qtyOf: (productId: string) => lines.filter((l) => l.productId === productId && !l.referenceProductId).reduce((s, l) => s + l.qty, 0),
    /** Добавляет товар в КП; если такой уже есть (без «аналога конкурента») — увеличивает количество. */
    add: (productId: string, qty = 1) =>
      setLines((prev) => {
        const i = prev.findIndex((l) => l.productId === productId && !l.referenceProductId)
        if (i === -1) return [...prev, { id: genId('line'), productId, qty }]
        const next = [...prev]
        next[i] = { ...next[i], qty: next[i].qty + qty }
        return next
      }),
  }
}

const quoteMetaStore = createSharedState<ProposalMeta>('quote-proposal-meta', {
  ...DEFAULT_PROPOSAL_META,
  installNote: 'Монтаж и настройка оборудования, сдача сети',
  intro: DEFAULT_LIST_INTRO,
})

/** Реквизиты КП из вкладки «Коммерческое предложение» — общие для списка и окна PDF. */
export function useQuoteMeta() {
  return quoteMetaStore.use()
}
