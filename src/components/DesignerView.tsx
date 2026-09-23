import { useState } from 'react'
import { BRANDS, CATEGORY_LABELS, type Brand, type Product } from '../types'
import {
  AP_MOUNT_LABELS,
  BUILDING_TYPE_LABELS,
  cameraTierLabel,
  designNetworkTiers,
  floorAreaM2,
  wallMaterialLabel,
  type ApMountType,
  type BrandFilter,
  type BuildingType,
  type CameraTier,
  type DesignerInput,
  type FloorSpec,
  type Tier,
  type TierResult,
  type WallMaterial,
} from '../lib/designer'
import { sendDesignToBuildingPlan } from '../lib/buildingPlanBridge'
import { SHOW_VIDEO_SURVEILLANCE } from '../lib/features'
import { addProductsToRack } from '../lib/rackCart'
import { genId, usePersistedState } from '../lib/storage'
import { AlertIcon, CheckIcon, PencilIcon } from './NavIcons'
import { ProductImage } from './ProductImage'

interface Props {
  catalog: Product[]
  /** Вызывается после отправки варианта в серверный шкаф (на «Плане здания») — используется, чтобы переключить вкладку. */
  onSentToRack?: () => void
  /** Вызывается после отправки промеров в «План здания» — используется, чтобы переключить вкладку. */
  onSentToPlan?: () => void
}

const WALL_OPTIONS: WallMaterial[] = ['open', 'drywall', 'brick', 'concrete']
const AP_MOUNT_OPTIONS: ApMountType[] = ['any', 'ceiling', 'wall', 'outdoor']
const CAMERA_TIERS: CameraTier[] = ['none', 'budget', 'standard', 'premium']
const TIER_ORDER: Tier[] = ['budget', 'mid', 'premium']
const TIER_ACCENT: Record<Tier, { border: string; badge: string; ring: string }> = {
  budget: { border: 'border-slate-200', badge: 'bg-slate-100 text-slate-600', ring: '' },
  mid: { border: 'border-blue-200', badge: 'bg-blue-100 text-blue-700', ring: '' },
  premium: { border: 'border-violet-200', badge: 'bg-violet-100 text-violet-700', ring: '' },
}

/** Строка ручной правки карточки сегмента — товар и количество, которые задал сам пользователь. */
interface OverrideLine {
  id: string
  productId: string
  qty: number
}

export function DesignerView({ catalog, onSentToRack, onSentToPlan }: Props) {
  const [input, setInput] = usePersistedState<DesignerInput>('designer-input', {
    buildingType: 'office',
    floors: [
      { lengthM: 20, widthM: 12.5, ceilingHeightM: 3, rooms: 0 },
      { lengthM: 20, widthM: 12.5, ceilingHeightM: 3, rooms: 0 },
    ],
    wallMaterial: 'drywall',
    workstations: 15,
    mobileDevices: 25,
    outdoorCoverage: false,
    outdoorLengthM: 20,
    outdoorWidthM: 10,
    cameraTier: SHOW_VIDEO_SURVEILLANCE ? 'standard' : 'none',
    cameraCount: 8,
    cameraBrand: 'Hikvision',
    preferredBrand: 'all',
    apMountType: 'any',
    maxBudgetUSD: 0,
  })
  /** Пусто = «Все бренды (авто)», одна строка из 3 карточек. Один и более брендов — своя строка на каждый. */
  const [selectedBrands, setSelectedBrands] = usePersistedState<Brand[]>('designer-selected-brands', [])
  /**
   * Ручная правка карточки сегмента — «Изменить» на карточке копирует её текущий
   * авторасчёт сюда (по ключу «бренд:сегмент»), дальше пользователь редактирует
   * список сам, а «Сбросить» удаляет запись и карточка снова показывает авторасчёт.
   */
  const [tierOverrides, setTierOverrides] = usePersistedState<Record<string, OverrideLine[]>>('designer-tier-overrides', {})
  const [editingKey, setEditingKey] = useState<string | null>(null)
  const [editSearch, setEditSearch] = useState('')

  const brandsToShow: BrandFilter[] = selectedBrands.length > 0 ? selectedBrands : ['all']
  const resultsByBrand = brandsToShow.map((brand) => ({
    brand,
    result: designNetworkTiers({ ...input, preferredBrand: brand }, catalog),
  }))
  const totalAreaM2 = input.floors.reduce((sum, f) => sum + floorAreaM2(f), 0)
  const isHotelLike = input.buildingType === 'hotel' || input.buildingType === 'apartment'

  function set<K extends keyof DesignerInput>(key: K, value: DesignerInput[K]) {
    setInput((prev) => ({ ...prev, [key]: value }))
  }

  function toggleBrand(b: Brand) {
    setSelectedBrands((prev) => (prev.includes(b) ? prev.filter((x) => x !== b) : [...prev, b]))
  }

  function setFloorField<K extends keyof FloorSpec>(index: number, field: K, value: FloorSpec[K]) {
    setInput((prev) => {
      const floors = [...prev.floors]
      floors[index] = { ...floors[index], [field]: value }
      return { ...prev, floors }
    })
  }

  function addFloor() {
    setInput((prev) => {
      const last = prev.floors[prev.floors.length - 1]
      return { ...prev, floors: [...prev.floors, last ? { ...last } : { lengthM: 10, widthM: 10, ceilingHeightM: 3, rooms: 0 }] }
    })
  }

  function removeFloor(index: number) {
    setInput((prev) => {
      if (prev.floors.length <= 1) return prev
      return { ...prev, floors: prev.floors.filter((_, i) => i !== index) }
    })
  }

  function overrideKeyFor(brand: BrandFilter, tier: Tier) {
    return `${brand}:${tier}`
  }

  /** Строки карточки как они сейчас показаны — из ручной правки, если она есть, иначе авторасчёт. */
  function effectiveLines(tierResult: TierResult, key: string): { product: Product; qty: number }[] {
    const override = tierOverrides[key]
    if (!override) {
      return tierResult.lines
        .filter((l): l is typeof l & { product: Product } => !!l.product)
        .map((l) => ({ product: l.product, qty: l.qty }))
    }
    return override
      .map((l) => ({ product: catalog.find((p) => p.id === l.productId), qty: l.qty }))
      .filter((l): l is { product: Product; qty: number } => !!l.product)
  }

  function sendTierToRack(tierResult: TierResult, key: string) {
    addProductsToRack(effectiveLines(tierResult, key))
    onSentToRack?.()
  }

  function sendToBuildingPlan(tierResult: TierResult, key: string) {
    const override = tierOverrides[key]
    if (override) {
      const lines = effectiveLines(tierResult, key)
      const byCategory = (cat: Product['category']) => lines.find((l) => l.product.category === cat)?.product.id
      sendDesignToBuildingPlan(input.buildingType, input.wallMaterial, input.floors, {
        apProductId: byCategory('ap'),
        switchProductId: byCategory('switch'),
        routerProductId: byCategory('router'),
      })
    } else {
      const byRole = (role: string) => tierResult.lines.find((l) => l.role === role)?.product?.id
      sendDesignToBuildingPlan(input.buildingType, input.wallMaterial, input.floors, {
        apProductId: byRole('Точки доступа Wi-Fi'),
        switchProductId: byRole('PoE-коммутатор'),
        routerProductId: byRole('Роутер / шлюз'),
        controllerProductId: byRole('Контроллер сети (Omada)'),
      })
    }
    onSentToPlan?.()
  }

  function startEditing(key: string, tierResult: TierResult) {
    setTierOverrides((prev) => {
      if (prev[key]) return prev
      const seeded = tierResult.lines
        .filter((l): l is typeof l & { product: Product } => !!l.product)
        .map((l) => ({ id: genId('custom'), productId: l.product.id, qty: l.qty }))
      return { ...prev, [key]: seeded }
    })
    setEditingKey(key)
    setEditSearch('')
  }

  function stopEditing() {
    setEditingKey(null)
    setEditSearch('')
  }

  function resetOverride(key: string) {
    setTierOverrides((prev) => {
      const next = { ...prev }
      delete next[key]
      return next
    })
    if (editingKey === key) stopEditing()
  }

  function addOverrideProduct(key: string, product: Product) {
    setTierOverrides((prev) => {
      const lines = prev[key] ?? []
      const existing = lines.find((l) => l.productId === product.id)
      const nextLines = existing
        ? lines.map((l) => (l.id === existing.id ? { ...l, qty: l.qty + 1 } : l))
        : [...lines, { id: genId('custom'), productId: product.id, qty: 1 }]
      return { ...prev, [key]: nextLines }
    })
    setEditSearch('')
  }

  function setOverrideQty(key: string, lineId: string, qty: number) {
    setTierOverrides((prev) => ({
      ...prev,
      [key]: (prev[key] ?? []).map((l) => (l.id === lineId ? { ...l, qty: Math.max(1, qty) } : l)),
    }))
  }

  function removeOverrideLine(key: string, lineId: string) {
    setTierOverrides((prev) => ({ ...prev, [key]: (prev[key] ?? []).filter((l) => l.id !== lineId) }))
  }

  return (
    <div>
      <div className="mb-4 no-print">
        <h1 className="text-xl font-semibold text-slate-900">Подбор оборудования по объекту</h1>
        <p className="text-sm text-slate-500">
          Введите параметры объекта и ожидаемую нагрузку — получите сразу три готовых варианта (бюджетный,
          оптимальный, премиум) на разных брендах, с рекомендацией, какой лучше решает задачу клиента. Это
          оценка «на глаз», не замена радиообследования для сложных объектов.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[380px_1fr]">
        <div className="no-print space-y-4 rounded-lg border border-slate-200 bg-white p-4">
          <div>
            <label className="block text-sm font-medium text-slate-700">Тип объекта</label>
            <select
              className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
              value={input.buildingType}
              onChange={(e) => set('buildingType', e.target.value as BuildingType)}
            >
              {Object.entries(BUILDING_TYPE_LABELS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700">Этажи и промеры каждого</label>
            <p className="mt-0.5 text-xs text-slate-400">
              Вводите реальные промеры помещения — длину, ширину, высоту потолка и число комнат — на каждый этаж
              отдельно. Точки доступа считаются по каждому этажу самостоятельно, а не по средней площади здания.
            </p>
            <div className="mt-2 space-y-2">
              {input.floors.map((f, i) => (
                <div key={i} className="rounded border border-slate-200 p-2">
                  <div className="mb-1.5 flex items-center justify-between">
                    <span className="text-sm font-medium text-slate-700">Этаж {i + 1}</span>
                    <button
                      type="button"
                      onClick={() => removeFloor(i)}
                      disabled={input.floors.length <= 1}
                      className="text-xs text-red-600 hover:underline disabled:opacity-30"
                    >
                      Убрать
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs text-slate-500">Длина, м</label>
                      <input
                        type="number"
                        min={1}
                        className="mt-0.5 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
                        value={f.lengthM}
                        onChange={(e) => setFloorField(i, 'lengthM', Math.max(0, Number(e.target.value)))}
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-500">Ширина, м</label>
                      <input
                        type="number"
                        min={1}
                        className="mt-0.5 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
                        value={f.widthM}
                        onChange={(e) => setFloorField(i, 'widthM', Math.max(0, Number(e.target.value)))}
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-500">Высота потолка, м</label>
                      <input
                        type="number"
                        min={1}
                        step={0.1}
                        className="mt-0.5 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
                        value={f.ceilingHeightM}
                        onChange={(e) => setFloorField(i, 'ceilingHeightM', Math.max(0, Number(e.target.value)))}
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-500">{isHotelLike ? 'Номеров / квартир' : 'Комнат'}</label>
                      <input
                        type="number"
                        min={0}
                        className="mt-0.5 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
                        value={f.rooms}
                        onChange={(e) => setFloorField(i, 'rooms', Math.max(0, Number(e.target.value)))}
                      />
                    </div>
                  </div>
                  <p className="mt-1.5 text-xs text-slate-400">Площадь: {floorAreaM2(f).toFixed(0)} м²</p>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={addFloor}
              className="mt-2 rounded border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100"
            >
              + Добавить этаж
            </button>
            <p className="mt-2 text-xs text-slate-400">
              Итого: {totalAreaM2.toLocaleString()} м² на {input.floors.length} эт.
            </p>
            <p className="mt-1 text-xs text-slate-400">
              Если этаж разбит на много небольших комнат с несущими стенами между ними — точек доступа обычно
              нужно больше, чем по одной лишь площади этажа. Берём более осторожную из двух оценок на каждом
              этаже (0 комнат — считаем только по площади).
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700">Материал стен / перегородок</label>
            <select
              className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
              value={input.wallMaterial}
              onChange={(e) => set('wallMaterial', e.target.value as WallMaterial)}
            >
              {WALL_OPTIONS.map((w) => (
                <option key={w} value={w}>
                  {wallMaterialLabel(w)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700">Wi-Fi клиенты по типу устройств</label>
            <p className="mt-0.5 text-xs text-slate-400">
              Компьютеры и ноутбуки грузят сеть сильнее (видеозвонки, VPN, файлы) — учитываем это отдельно от телефонов.
            </p>
            <div className="mt-2 grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-500">Рабочие места (ПК, ноутбуки)</label>
                <input
                  type="number"
                  min={0}
                  className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
                  value={input.workstations}
                  onChange={(e) => set('workstations', Math.max(0, Number(e.target.value)))}
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500">Телефоны и др. устройства</label>
                <input
                  type="number"
                  min={0}
                  className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
                  value={input.mobileDevices}
                  onChange={(e) => set('mobileDevices', Math.max(0, Number(e.target.value)))}
                />
              </div>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Итого одновременных клиентов: {input.workstations + input.mobileDevices}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700">Бюджет клиента, $</label>
            <p className="mt-0.5 text-xs text-slate-400">
              Необязательно. Если указать — покажем, какие сегменты укладываются, и подскажем лучший вариант в
              рамках этой суммы.
            </p>
            <input
              type="number"
              min={0}
              placeholder="Без ограничения"
              className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
              value={input.maxBudgetUSD || ''}
              onChange={(e) => set('maxBudgetUSD', Math.max(0, Number(e.target.value)))}
            />
          </div>

          <div>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={input.outdoorCoverage}
                onChange={(e) => set('outdoorCoverage', e.target.checked)}
              />
              Нужна Wi-Fi зона на улице (двор, парковка, терраса)
            </label>

            {input.outdoorCoverage && (
              <div className="mt-2 rounded border border-slate-200 p-2">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs text-slate-500">Длина, м</label>
                    <input
                      type="number"
                      min={1}
                      className="mt-0.5 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
                      value={input.outdoorLengthM}
                      onChange={(e) => set('outdoorLengthM', Math.max(0, Number(e.target.value)))}
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500">Ширина, м</label>
                    <input
                      type="number"
                      min={1}
                      className="mt-0.5 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
                      value={input.outdoorWidthM}
                      onChange={(e) => set('outdoorWidthM', Math.max(0, Number(e.target.value)))}
                    />
                  </div>
                </div>
                <p className="mt-1.5 text-xs text-slate-400">
                  Площадь: {(input.outdoorLengthM * input.outdoorWidthM).toLocaleString()} м²
                </p>
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700">Монтаж точки доступа</label>
            <p className="mt-0.5 text-xs text-slate-400">
              Точки доступа бывают потолочные и настенные — по умолчанию подбираем любую подходящую по сегменту.
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {AP_MOUNT_OPTIONS.map((m) => {
                const active = input.apMountType === m
                return (
                  <button
                    key={m}
                    type="button"
                    onClick={() => set('apMountType', m)}
                    className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
                      active
                        ? 'border-blue-500 bg-blue-500 text-white'
                        : 'border-slate-300 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    {AP_MOUNT_LABELS[m]}
                  </button>
                )
              })}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700">Бренд оборудования</label>
            <p className="mt-0.5 text-xs text-slate-400">
              По умолчанию подбираем лучшую цену среди всех брендов. Отметьте один или несколько брендов галочкой —
              под каждый появится своя строка из трёх вариантов (бюджетный/оптимальный/премиум) на его оборудовании,
              чтобы сравнить бренды между собой.
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => setSelectedBrands([])}
                className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
                  selectedBrands.length === 0
                    ? 'border-blue-500 bg-blue-500 text-white'
                    : 'border-slate-300 text-slate-600 hover:bg-slate-100'
                }`}
              >
                Все бренды (авто)
              </button>
              {BRANDS.map((b) => {
                const checked = selectedBrands.includes(b)
                return (
                  <label
                    key={b}
                    className={`flex cursor-pointer items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
                      checked ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-300 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <input type="checkbox" className="h-3 w-3" checked={checked} onChange={() => toggleBrand(b)} />
                    {b}
                  </label>
                )
              })}
            </div>
          </div>

          {SHOW_VIDEO_SURVEILLANCE && (
            <>
              <hr className="border-slate-200" />

              <div>
                <label className="block text-sm font-medium text-slate-700">Видеонаблюдение</label>
                <select
                  className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
                  value={input.cameraTier}
                  onChange={(e) => set('cameraTier', e.target.value as CameraTier)}
                >
                  {CAMERA_TIERS.map((t) => (
                    <option key={t} value={t}>
                      {cameraTierLabel(t)}
                    </option>
                  ))}
                </select>
              </div>

              {input.cameraTier !== 'none' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-slate-700">Кол-во камер</label>
                    <input
                      type="number"
                      min={1}
                      className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
                      value={input.cameraCount}
                      onChange={(e) => set('cameraCount', Number(e.target.value))}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700">Бренд камер</label>
                    <select
                      className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
                      value={input.cameraBrand}
                      onChange={(e) => set('cameraBrand', e.target.value as 'Hikvision' | 'Dahua')}
                    >
                      <option value="Hikvision">Hikvision</option>
                      <option value="Dahua">Dahua</option>
                    </select>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <div>
          <div className="hidden print:block mb-4">
            <h1 className="text-xl font-semibold">Предложение по оснащению объекта</h1>
            <p className="text-sm text-slate-500">{new Date().toLocaleDateString('ru-RU')}</p>
          </div>

          <div className="mb-4 rounded-lg border border-blue-100 bg-blue-50 p-4 text-sm text-blue-900">
            {BUILDING_TYPE_LABELS[input.buildingType]}, {totalAreaM2.toLocaleString()} м² на всё здание, {input.floors.length} эт.
            {(() => {
              const totalRooms = input.floors.reduce((sum, f) => sum + f.rooms, 0)
              return totalRooms > 0 ? ` (${totalRooms} ${isHotelLike ? 'номеров' : 'комнат'} всего)` : ''
            })()}
            {' '}— {resultsByBrand[0].result.concurrentDevices} одновременных клиентов ({input.workstations} рабочих мест +{' '}
            {input.mobileDevices} мобильных устройств).{' '}
            {resultsByBrand.length > 1
              ? 'Ниже — по три варианта на каждый выбранный бренд, чтобы сравнить бренды между собой.'
              : 'Ниже — три готовых варианта, чтобы сравнить с клиентом на месте.'}
          </div>

          {resultsByBrand.map(({ brand, result: r }) => (
            <div key={brand} className="mb-6 print:break-inside-avoid">
              {resultsByBrand.length > 1 && (
                <h2 className="mb-2 text-base font-semibold text-slate-900">{brand}</h2>
              )}

              <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
                <b>Рекомендуем: {r.tiers.find((t) => t.tier === r.recommendedTier)?.tierLabel}.</b>{' '}
                {r.recommendationReason}
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                {TIER_ORDER.map((tier) => {
                  const t = r.tiers.find((rr) => rr.tier === tier)!
                  const accent = TIER_ACCENT[tier]
                  const isRecommended = tier === r.recommendedTier
                  const key = overrideKeyFor(brand, tier)
                  const override = tierOverrides[key]
                  const isEditing = editingKey === key
                  const resolvedOverride = (override ?? [])
                    .map((l) => ({ ...l, product: catalog.find((p) => p.id === l.productId) }))
                    .filter((l): l is OverrideLine & { product: Product } => !!l.product)
                  const displayTotalUSD = override
                    ? resolvedOverride.reduce((sum, l) => sum + l.product.priceUSD * l.qty, 0)
                    : t.totalUSD
                  const displayBrands = override ? Array.from(new Set(resolvedOverride.map((l) => l.product.brand))) : t.brands
                  const overBudgetUSD = input.maxBudgetUSD > 0 ? Math.max(0, displayTotalUSD - input.maxBudgetUSD) : 0
                  const fitsBudget = overBudgetUSD === 0
                  const editResults =
                    isEditing && editSearch.trim()
                      ? catalog.filter((p) => `${p.brand} ${p.model}`.toLowerCase().includes(editSearch.trim().toLowerCase())).slice(0, 8)
                      : []
                  const sendDisabled = override ? resolvedOverride.length === 0 : t.lines.every((l) => !l.product)
                  return (
                    <div
                      key={tier}
                      className={`flex flex-col rounded-lg border-2 bg-white p-4 print:break-inside-avoid ${
                        isRecommended ? 'border-emerald-400 shadow-md' : accent.border
                      }`}
                    >
                      <div className="mb-1 flex items-center justify-between">
                        <span className={`rounded px-2 py-0.5 text-xs font-semibold ${accent.badge}`}>{t.tierLabel}</span>
                        {isRecommended && (
                          <span className="rounded bg-emerald-500 px-2 py-0.5 text-xs font-semibold text-white">
                            Рекомендуем
                          </span>
                        )}
                      </div>

                      <div className="no-print mb-2 flex items-center gap-2 text-xs">
                        {isEditing ? (
                          <>
                            <button
                              onClick={stopEditing}
                              className="flex items-center gap-1.5 rounded border border-slate-300 px-2.5 py-1.5 font-medium text-slate-700 hover:bg-slate-100"
                            >
                              <CheckIcon className="h-3.5 w-3.5" />
                              Готово
                            </button>
                            <button onClick={() => resetOverride(key)} className="text-slate-400 hover:text-red-600">
                              Сбросить к рекомендации
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => startEditing(key, t)}
                              className="flex items-center gap-1.5 rounded border border-slate-300 px-2.5 py-1.5 font-medium text-slate-700 hover:bg-slate-100"
                            >
                              <PencilIcon />
                              Изменить
                            </button>
                            {override && <span className="text-slate-400">изменено вручную</span>}
                          </>
                        )}
                      </div>

                      <p className="mb-2 text-xs text-slate-400">{displayBrands.join(', ') || '—'}</p>

                      <div className="mb-1 text-2xl font-bold text-slate-900">${displayTotalUSD.toLocaleString()}</div>
                      <p className="mb-2 text-xs text-slate-400">
                        ≈${(r.concurrentDevices > 0 ? displayTotalUSD / r.concurrentDevices : displayTotalUSD).toFixed(1)} на одного
                        одновременного клиента
                      </p>
                      {input.maxBudgetUSD > 0 && (
                        <p
                          className={`mb-2 flex items-center gap-1 text-xs font-medium ${fitsBudget ? 'text-emerald-600' : 'text-red-600'}`}
                        >
                          {fitsBudget ? <CheckIcon className="h-3.5 w-3.5" /> : <AlertIcon className="h-3.5 w-3.5" />}
                          {fitsBudget ? 'В бюджете' : `Превышает бюджет на $${overBudgetUSD.toLocaleString()}`}
                        </p>
                      )}

                      <ul className="mb-3 flex-1 space-y-2 text-sm">
                        {override
                          ? resolvedOverride.map((l) => (
                              <li key={l.id} className="flex items-start gap-2 border-t border-slate-100 pt-2 first:border-0 first:pt-0">
                                <ProductImage imageUrl={l.product.imageUrl} brand={l.product.brand} category={l.product.category} size="sm" />
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-start justify-between gap-1">
                                    <span className="font-medium text-slate-900" title={`${l.product.brand} ${l.product.model}`}>
                                      {l.product.brand} {l.product.model}
                                    </span>
                                    {!isEditing && l.qty > 1 && <span className="shrink-0 font-medium text-slate-900">× {l.qty}</span>}
                                  </div>
                                  <div className="text-xs text-slate-400">{CATEGORY_LABELS[l.product.category]}</div>
                                  {isEditing && (
                                    <div className="mt-1.5 flex items-center gap-1">
                                      <button
                                        onClick={() => setOverrideQty(key, l.id, l.qty - 1)}
                                        disabled={l.qty <= 1}
                                        aria-label={`Уменьшить количество ${l.product.model}`}
                                        className="h-8 w-8 rounded border border-slate-300 text-sm leading-none text-slate-600 hover:bg-slate-100 disabled:opacity-40"
                                      >
                                        −
                                      </button>
                                      <span className="w-7 text-center text-sm font-medium tabular-nums" aria-live="polite">
                                        {l.qty}
                                      </span>
                                      <button
                                        onClick={() => setOverrideQty(key, l.id, l.qty + 1)}
                                        aria-label={`Увеличить количество ${l.product.model}`}
                                        className="h-8 w-8 rounded border border-slate-300 text-sm leading-none text-slate-600 hover:bg-slate-100"
                                      >
                                        +
                                      </button>
                                      <button
                                        onClick={() => removeOverrideLine(key, l.id)}
                                        className="ml-1 rounded px-2 py-1.5 text-xs text-red-600 hover:bg-red-50 hover:text-red-700"
                                      >
                                        Убрать
                                      </button>
                                    </div>
                                  )}
                                </div>
                              </li>
                            ))
                          : t.lines.map((line, i) => (
                              <li
                                key={i}
                                className="flex items-center gap-2 border-t border-slate-100 pt-2 first:border-0 first:pt-0"
                                title={line.reason}
                              >
                                {line.product && (
                                  <ProductImage
                                    imageUrl={line.product.imageUrl}
                                    brand={line.product.brand}
                                    category={line.product.category}
                                    size="sm"
                                  />
                                )}
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-start justify-between gap-1">
                                    <span
                                      className="font-medium text-slate-900"
                                      title={line.product ? `${line.product.brand} ${line.product.model}` : line.role}
                                    >
                                      {line.product ? `${line.product.brand} ${line.product.model}` : line.role}
                                    </span>
                                    {line.qty > 1 && <span className="shrink-0 font-medium text-slate-900">× {line.qty}</span>}
                                  </div>
                                  <div className="text-xs text-slate-400">{line.role}</div>
                                </div>
                              </li>
                            ))}
                      </ul>

                      {isEditing && (
                        <div className="no-print relative mb-3">
                          <input
                            value={editSearch}
                            onChange={(e) => setEditSearch(e.target.value)}
                            placeholder="+ добавить товар (бренд, модель)"
                            aria-label="Найти и добавить товар"
                            className="w-full rounded border border-slate-300 px-2.5 py-2 text-xs"
                          />
                          {editResults.length > 0 && (
                            <div className="absolute inset-x-0 top-full z-10 mt-1 max-h-48 overflow-y-auto rounded border border-slate-200 bg-white shadow-lg">
                              {editResults.map((p) => (
                                <button
                                  key={p.id}
                                  onClick={() => addOverrideProduct(key, p)}
                                  className="flex w-full items-center justify-between gap-2 px-2.5 py-2 text-left text-xs hover:bg-slate-50"
                                >
                                  <span className="truncate">
                                    {p.brand} {p.model}
                                  </span>
                                  <span className="shrink-0 text-slate-400">${p.priceUSD}</span>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {!override && t.warnings.length > 0 && (
                        <div className="mb-2 space-y-1.5 rounded border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800">
                          {t.warnings.map((w, i) => (
                            <div key={i} className="flex gap-1.5">
                              <AlertIcon className="mt-px h-3.5 w-3.5 shrink-0" />
                              <span>{w}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="mt-1 flex flex-col gap-1.5">
                        <button
                          onClick={() => sendTierToRack(t, key)}
                          disabled={sendDisabled}
                          className="no-print rounded border border-slate-300 px-2 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:cursor-default disabled:opacity-40 disabled:hover:bg-transparent"
                        >
                          Добавить в шкаф на плане здания →
                        </button>
                        <button
                          onClick={() => sendToBuildingPlan(t, key)}
                          disabled={sendDisabled}
                          className="no-print rounded border border-slate-300 px-2 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:cursor-default disabled:opacity-40 disabled:hover:bg-transparent"
                        >
                          Показать на плане здания →
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}

          <button
            onClick={() => window.print()}
            className="no-print mt-4 rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700"
          >
            Печать / сохранить как PDF
          </button>
        </div>
      </div>
    </div>
  )
}
