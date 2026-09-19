import { useState } from 'react'
import { CATEGORY_LABELS, COMPETITOR_BRANDS, PRICE_CATEGORY_LABELS } from '../types'
import type { Category, CompetitorBrand, CompetitorProduct, PriceCategory, Product } from '../types'
import { genId } from '../lib/storage'
import { Modal } from './Modal'
import { SpecsEditor } from './SpecsEditor'

interface Props {
  initial?: CompetitorProduct
  ownCatalog: Product[]
  onSave: (product: CompetitorProduct) => void
  onClose: () => void
}

const emptyProduct = (): CompetitorProduct => ({
  id: genId('cmp'),
  brand: 'Ruijie',
  category: 'router',
  model: '',
  specs: {},
  priceUSD: 0,
  priceCategory: 'mid',
})

export function CompetitorProductForm({ initial, ownCatalog, onSave, onClose }: Props) {
  const [product, setProduct] = useState<CompetitorProduct>(initial ?? emptyProduct())

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!product.model.trim()) return
    onSave(product)
    onClose()
  }

  const sameCategoryOwn = ownCatalog.filter((p) => p.category === product.category)

  return (
    <Modal title={initial ? 'Изменить товар конкурента' : 'Добавить товар конкурента'} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-slate-700">Бренд</label>
            <select
              className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
              value={product.brand}
              onChange={(e) => setProduct({ ...product, brand: e.target.value as CompetitorBrand })}
            >
              {COMPETITOR_BRANDS.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Категория</label>
            <select
              className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
              value={product.category}
              onChange={(e) =>
                setProduct({ ...product, category: e.target.value as Category, recommendedOwnId: undefined })
              }
            >
              {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700">Модель</label>
          <input
            className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
            value={product.model}
            onChange={(e) => setProduct({ ...product, model: e.target.value })}
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-slate-700">Цена, $</label>
            <input
              type="number"
              min={0}
              className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
              value={product.priceUSD}
              onChange={(e) => setProduct({ ...product, priceUSD: Number(e.target.value) })}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Ценовая категория</label>
            <select
              className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
              value={product.priceCategory}
              onChange={(e) => setProduct({ ...product, priceCategory: e.target.value as PriceCategory })}
            >
              {Object.entries(PRICE_CATEGORY_LABELS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700">Рекомендуемый аналог в своём каталоге</label>
          <select
            className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
            value={product.recommendedOwnId ?? ''}
            onChange={(e) => setProduct({ ...product, recommendedOwnId: e.target.value || undefined })}
          >
            <option value="">Подбирать автоматически</option>
            {sameCategoryOwn.map((p) => (
              <option key={p.id} value={p.id}>
                {p.brand} {p.model}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700">Ссылка на фото (необязательно)</label>
          <input
            className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
            placeholder="https://... — если не указано, покажется иконка категории"
            value={product.imageUrl ?? ''}
            onChange={(e) => setProduct({ ...product, imageUrl: e.target.value || undefined })}
          />
        </div>

        <SpecsEditor specs={product.specs} onChange={(specs) => setProduct({ ...product, specs })} />

        <div>
          <label className="block text-sm font-medium text-slate-700">Заметка (необязательно)</label>
          <input
            className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
            value={product.notes ?? ''}
            onChange={(e) => setProduct({ ...product, notes: e.target.value })}
          />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
          >
            Отмена
          </button>
          <button
            type="submit"
            className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Сохранить
          </button>
        </div>
      </form>
    </Modal>
  )
}
