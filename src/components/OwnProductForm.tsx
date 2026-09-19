import { useState } from 'react'
import { CATEGORY_LABELS, PRICE_CATEGORY_LABELS } from '../types'
import type { Category, OwnBrand, PriceCategory, Product } from '../types'
import { visibleCategories, visibleOwnBrands } from '../lib/features'
import { genId } from '../lib/storage'
import { Modal } from './Modal'
import { SpecsEditor } from './SpecsEditor'
import { StringListEditor } from './StringListEditor'

interface Props {
  initial?: Product
  onSave: (product: Product) => void
  onClose: () => void
}

const emptyProduct = (): Product => ({
  id: genId('own'),
  brand: 'TP-Link',
  category: 'router',
  model: '',
  specs: {},
  priceUSD: 0,
  priceCategory: 'mid',
  stock: 0,
  pros: [],
  cons: [],
})

export function OwnProductForm({ initial, onSave, onClose }: Props) {
  const [product, setProduct] = useState<Product>(initial ?? emptyProduct())

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!product.model.trim()) return
    onSave(product)
    onClose()
  }

  return (
    <Modal title={initial ? 'Изменить товар' : 'Добавить товар в свой каталог'} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-slate-700">Бренд</label>
            <select
              className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
              value={product.brand}
              onChange={(e) => setProduct({ ...product, brand: e.target.value as OwnBrand })}
            >
              {visibleOwnBrands().map((b) => (
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
              onChange={(e) => setProduct({ ...product, category: e.target.value as Category })}
            >
              {visibleCategories().map((c) => (
                <option key={c} value={c}>
                  {CATEGORY_LABELS[c]}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-slate-700">Модель</label>
            <input
              className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
              value={product.model}
              onChange={(e) => setProduct({ ...product, model: e.target.value })}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Серия (необязательно)</label>
            <input
              className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
              value={product.series ?? ''}
              onChange={(e) => setProduct({ ...product, series: e.target.value })}
            />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
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
          <div>
            <label className="block text-sm font-medium text-slate-700">Остаток, шт.</label>
            <input
              type="number"
              min={0}
              className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
              value={product.stock}
              onChange={(e) => setProduct({ ...product, stock: Number(e.target.value) })}
            />
          </div>
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
        <StringListEditor
          label="Плюсы (относительно конкурентов)"
          items={product.pros}
          onChange={(pros) => setProduct({ ...product, pros })}
          placeholder="Например: дешевле, тот же контроллер"
        />
        <StringListEditor
          label="Минусы"
          items={product.cons}
          onChange={(cons) => setProduct({ ...product, cons })}
          placeholder="Например: нет 10G порта"
        />

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
