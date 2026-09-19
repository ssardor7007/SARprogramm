import { useState } from 'react'
import type { Product } from '../types'
import {
  BUILDING_TYPE_LABELS,
  cameraTierLabel,
  designNetwork,
  wallMaterialLabel,
  type BuildingType,
  type CameraTier,
  type DesignerInput,
  type WallMaterial,
} from '../lib/designer'
import { SHOW_VIDEO_SURVEILLANCE } from '../lib/features'

interface Props {
  catalog: Product[]
}

const WALL_OPTIONS: WallMaterial[] = ['open', 'drywall', 'brick', 'concrete']
const CAMERA_TIERS: CameraTier[] = ['none', 'budget', 'standard', 'premium']

export function DesignerView({ catalog }: Props) {
  const [input, setInput] = useState<DesignerInput>({
    buildingType: 'office',
    totalAreaM2: 500,
    floors: 2,
    wallMaterial: 'drywall',
    roomsPerFloor: 20,
    workstations: 15,
    mobileDevices: 25,
    outdoorCoverage: false,
    cameraTier: SHOW_VIDEO_SURVEILLANCE ? 'standard' : 'none',
    cameraCount: 8,
    cameraBrand: 'Hikvision',
  })

  const result = designNetwork(input, catalog)

  function set<K extends keyof DesignerInput>(key: K, value: DesignerInput[K]) {
    setInput((prev) => ({ ...prev, [key]: value }))
  }

  return (
    <div>
      <div className="mb-4 no-print">
        <h1 className="text-xl font-semibold text-slate-900">Подбор оборудования по объекту</h1>
        <p className="text-sm text-slate-500">
          Упрощённый аналог TP-Link Omada Designer: введите параметры здания — получите ориентировочный набор
          точек доступа, коммутаторов и роутера. Это оценка «на глаз», не замена радиообследования для сложных
          объектов.
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

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700">Площадь всего здания, м²</label>
              <input
                type="number"
                min={10}
                className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
                value={input.totalAreaM2}
                onChange={(e) => set('totalAreaM2', Number(e.target.value))}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">Этажей</label>
              <input
                type="number"
                min={1}
                className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
                value={input.floors}
                onChange={(e) => set('floors', Number(e.target.value))}
              />
            </div>
          </div>
          <p className="-mt-2 text-xs text-slate-400">
            Указываете площадь <b>всего здания целиком</b> (сумма по всем этажам) — сейчас это ≈
            {Math.round(input.totalAreaM2 / Math.max(1, input.floors)).toLocaleString()} м² на один этаж.
          </p>

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
            {BUILDING_TYPE_LABELS[input.buildingType]}, {input.totalAreaM2} м² на всё здание, {input.floors} эт.
            {(input.buildingType === 'hotel' || input.buildingType === 'apartment') && ` (${input.roomsPerFloor} номеров/этаж)`}
            {' '}— расчётно нужно <b>{result.apCount}</b> точек доступа для стабильного покрытия{' '}
            {input.workstations + input.mobileDevices} одновременных клиентов ({input.workstations} рабочих мест +{' '}
            {input.mobileDevices} мобильных устройств).
          </div>

          {result.warnings.length > 0 && (
            <div className="mb-4 space-y-1 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              {result.warnings.map((w, i) => (
                <div key={i}>⚠ {w}</div>
              ))}
            </div>
          )}

          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-slate-600">Роль</th>
                  <th className="px-3 py-2 text-left font-medium text-slate-600">Модель</th>
                  <th className="px-3 py-2 text-left font-medium text-slate-600">Кол-во</th>
                  <th className="px-3 py-2 text-left font-medium text-slate-600">Сумма</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {result.lines.map((line, i) => (
                  <tr key={i}>
                    <td className="px-3 py-2 align-top text-slate-600">
                      {line.role}
                      <div className="text-xs text-slate-400">{line.reason}</div>
                    </td>
                    <td className="px-3 py-2 align-top font-medium text-slate-900">
                      {line.product ? `${line.product.brand} ${line.product.model}` : '—'}
                    </td>
                    <td className="px-3 py-2 align-top text-slate-600">{line.qty}</td>
                    <td className="px-3 py-2 align-top text-slate-900">
                      {line.product ? `$${(line.product.priceUSD * line.qty).toLocaleString()}` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex items-center justify-between rounded-lg border border-slate-200 bg-white p-4">
            <span className="text-lg font-semibold text-slate-900">Итого оборудование</span>
            <span className="text-2xl font-bold text-slate-900">${result.totalUSD.toLocaleString()}</span>
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
