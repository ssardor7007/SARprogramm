import { useState } from 'react'
import type { Product } from '../types'
import {
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
  ownCatalog: Product[]
}

const BUILDING_TYPE_LABELS: Record<BuildingType, string> = {
  office: 'Офис',
  retail: 'Магазин / торговый зал',
  warehouse: 'Склад',
  hotel: 'Гостиница',
  apartment: 'Жилой дом',
}

const WALL_OPTIONS: WallMaterial[] = ['open', 'drywall', 'brick', 'concrete']
const CAMERA_TIERS: CameraTier[] = ['none', 'budget', 'standard', 'premium']

export function DesignerView({ ownCatalog }: Props) {
  const [input, setInput] = useState<DesignerInput>({
    buildingType: 'office',
    totalAreaM2: 500,
    floors: 2,
    wallMaterial: 'drywall',
    concurrentDevices: 40,
    outdoorCoverage: false,
    cameraTier: SHOW_VIDEO_SURVEILLANCE ? 'standard' : 'none',
    cameraCount: 8,
    cameraBrand: 'Hikvision',
  })

  const result = designNetwork(input, ownCatalog)

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
              <label className="block text-sm font-medium text-slate-700">Площадь, м²</label>
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
            <label className="block text-sm font-medium text-slate-700">
              Одновременных Wi-Fi клиентов: {input.concurrentDevices}
            </label>
            <input
              type="range"
              min={5}
              max={400}
              step={5}
              className="mt-1 w-full"
              value={input.concurrentDevices}
              onChange={(e) => set('concurrentDevices', Number(e.target.value))}
            />
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
                      onChange={(e) => set('cameraBrand', e.target.value as 'Vitek' | 'Hikvision')}
                    >
                      <option value="Vitek">Vitek</option>
                      <option value="Hikvision">Hikvision</option>
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
            {BUILDING_TYPE_LABELS[input.buildingType]}, {input.totalAreaM2} м², {input.floors} эт. — расчётно нужно{' '}
            <b>{result.apCount}</b> точек доступа для стабильного покрытия и {input.concurrentDevices} одновременных
            клиентов.
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
