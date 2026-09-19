import { useState } from 'react'
import { BRANDS, type Product } from '../types'
import {
  AP_MOUNT_LABELS,
  BUILDING_TYPE_LABELS,
  cameraTierLabel,
  designNetworkTiers,
  wallMaterialLabel,
  type ApMountType,
  type BrandFilter,
  type BuildingType,
  type CameraTier,
  type DesignerInput,
  type Tier,
  type WallMaterial,
} from '../lib/designer'
import { SHOW_VIDEO_SURVEILLANCE } from '../lib/features'
import { addProductsToRack } from '../lib/rackCart'

interface Props {
  catalog: Product[]
  /** Вызывается после отправки варианта в «Дизайнер стойки» — используется, чтобы переключить вкладку. */
  onSentToRack?: () => void
}

const WALL_OPTIONS: WallMaterial[] = ['open', 'drywall', 'brick', 'concrete']
const BRAND_OPTIONS: BrandFilter[] = ['all', ...BRANDS]
const AP_MOUNT_OPTIONS: ApMountType[] = ['any', 'ceiling', 'wall', 'outdoor']
const CAMERA_TIERS: CameraTier[] = ['none', 'budget', 'standard', 'premium']
const TIER_ORDER: Tier[] = ['budget', 'mid', 'premium']
const TIER_ACCENT: Record<Tier, { border: string; badge: string; ring: string }> = {
  budget: { border: 'border-slate-200', badge: 'bg-slate-100 text-slate-600', ring: '' },
  mid: { border: 'border-blue-200', badge: 'bg-blue-100 text-blue-700', ring: '' },
  premium: { border: 'border-violet-200', badge: 'bg-violet-100 text-violet-700', ring: '' },
}

export function DesignerView({ catalog, onSentToRack }: Props) {
  const [input, setInput] = useState<DesignerInput>({
    buildingType: 'office',
    floorAreas: [250, 250],
    wallMaterial: 'drywall',
    roomsPerFloor: 20,
    workstations: 15,
    mobileDevices: 25,
    outdoorCoverage: false,
    cameraTier: SHOW_VIDEO_SURVEILLANCE ? 'standard' : 'none',
    cameraCount: 8,
    cameraBrand: 'Hikvision',
    preferredBrand: 'all',
    apMountType: 'any',
  })

  const result = designNetworkTiers(input, catalog)
  const totalAreaM2 = input.floorAreas.reduce((sum, a) => sum + a, 0)

  function set<K extends keyof DesignerInput>(key: K, value: DesignerInput[K]) {
    setInput((prev) => ({ ...prev, [key]: value }))
  }

  function setFloorArea(index: number, area: number) {
    setInput((prev) => {
      const floorAreas = [...prev.floorAreas]
      floorAreas[index] = Math.max(0, area)
      return { ...prev, floorAreas }
    })
  }

  function addFloor() {
    setInput((prev) => ({
      ...prev,
      floorAreas: [...prev.floorAreas, prev.floorAreas[prev.floorAreas.length - 1] ?? 100],
    }))
  }

  function removeFloor(index: number) {
    setInput((prev) => {
      if (prev.floorAreas.length <= 1) return prev
      return { ...prev, floorAreas: prev.floorAreas.filter((_, i) => i !== index) }
    })
  }

  function sendTierToRack(tier: Tier) {
    const t = result.tiers.find((r) => r.tier === tier)
    if (!t) return
    addProductsToRack(t.lines.map((line) => ({ product: line.product, qty: line.qty })))
    onSentToRack?.()
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
            <label className="block text-sm font-medium text-slate-700">Этажи и площадь каждого</label>
            <p className="mt-0.5 text-xs text-slate-400">
              У каждого этажа своя площадь — точки доступа считаются отдельно под каждый этаж, а не по средней
              площади здания.
            </p>
            <div className="mt-2 space-y-1.5">
              {input.floorAreas.map((area, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="w-14 shrink-0 text-sm text-slate-600">Этаж {i + 1}</span>
                  <input
                    type="number"
                    min={10}
                    className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
                    value={area}
                    onChange={(e) => setFloorArea(i, Number(e.target.value))}
                  />
                  <span className="shrink-0 text-xs text-slate-400">м²</span>
                  <button
                    type="button"
                    onClick={() => removeFloor(i)}
                    disabled={input.floorAreas.length <= 1}
                    className="shrink-0 text-xs text-red-600 hover:underline disabled:opacity-30"
                  >
                    Убрать
                  </button>
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
              Итого: {totalAreaM2.toLocaleString()} м² на {input.floorAreas.length} эт.
            </p>
          </div>

          {(input.buildingType === 'hotel' || input.buildingType === 'apartment') && (
            <div>
              <label className="block text-sm font-medium text-slate-700">Номеров / квартир на одном этаже</label>
              <input
                type="number"
                min={1}
                className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
                value={input.roomsPerFloor}
                onChange={(e) => set('roomsPerFloor', Math.max(0, Number(e.target.value)))}
              />
              <p className="mt-1 text-xs text-slate-400">
                У гостиниц много маленьких номеров с несущими стенами между ними — точек доступа обычно нужно больше, чем
                по одной лишь площади этажа. Берём более осторожную из двух оценок.
              </p>
            </div>
          )}

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

          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={input.outdoorCoverage}
              onChange={(e) => set('outdoorCoverage', e.target.checked)}
            />
            Нужна Wi-Fi зона на улице (двор, парковка, терраса)
          </label>

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
              По умолчанию подбираем лучшую цену среди всех брендов. Выберите конкретный бренд — и все три варианта
              (бюджетный/оптимальный/премиум) будут собраны на его оборудовании, где это есть в каталоге.
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {BRAND_OPTIONS.map((b) => {
                const active = input.preferredBrand === b
                return (
                  <button
                    key={b}
                    type="button"
                    onClick={() => set('preferredBrand', b)}
                    className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
                      active
                        ? 'border-blue-500 bg-blue-500 text-white'
                        : 'border-slate-300 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    {b === 'all' ? 'Все бренды (авто)' : b}
                  </button>
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
            {BUILDING_TYPE_LABELS[input.buildingType]}, {totalAreaM2} м² на всё здание, {input.floorAreas.length} эт.
            {(input.buildingType === 'hotel' || input.buildingType === 'apartment') && ` (${input.roomsPerFloor} номеров/этаж)`}
            {' '}— {result.concurrentDevices} одновременных клиентов ({input.workstations} рабочих мест +{' '}
            {input.mobileDevices} мобильных устройств). Ниже — три готовых варианта, чтобы сравнить с клиентом на месте.
          </div>

          <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
            <b>Рекомендуем: {result.tiers.find((t) => t.tier === result.recommendedTier)?.tierLabel}.</b>{' '}
            {result.recommendationReason}
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {TIER_ORDER.map((tier) => {
              const t = result.tiers.find((r) => r.tier === tier)!
              const accent = TIER_ACCENT[tier]
              const isRecommended = tier === result.recommendedTier
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
                  <p className="mb-2 text-xs text-slate-400">{t.brands.join(', ') || '—'}</p>

                  <div className="mb-3 text-2xl font-bold text-slate-900">${t.totalUSD.toLocaleString()}</div>
                  <p className="mb-3 text-xs text-slate-400">
                    ≈${t.usdPerClient.toFixed(1)} на одного одновременного клиента
                  </p>

                  <ul className="mb-3 flex-1 space-y-2 text-sm">
                    {t.lines.map((line, i) => (
                      <li key={i} className="border-t border-slate-100 pt-2 first:border-0 first:pt-0" title={line.reason}>
                        <div className="font-medium text-slate-900">
                          {line.product ? `${line.product.brand} ${line.product.model}` : line.role}
                          {line.qty > 1 ? ` × ${line.qty}` : ''}
                        </div>
                        <div className="text-xs text-slate-400">{line.role}</div>
                      </li>
                    ))}
                  </ul>

                  {t.warnings.length > 0 && (
                    <div className="mb-2 space-y-1 rounded border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800">
                      {t.warnings.map((w, i) => (
                        <div key={i}>⚠ {w}</div>
                      ))}
                    </div>
                  )}

                  <button
                    onClick={() => sendTierToRack(tier)}
                    className="no-print mt-1 rounded border border-slate-300 px-2 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
                  >
                    Добавить в «Дизайнер стойки» →
                  </button>
                </div>
              )
            })}
          </div>

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
