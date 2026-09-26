import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import type { Product } from '../types'
import {
  autoPlaceAPs,
  CANVAS_H_M,
  CANVAS_W_M,
  computeHeatmapGrid,
  generateFloorPlan,
  HEATMAP_STEP_M,
  newPlacedAP,
  planBuilding,
  wallMaterialColor,
  type BuildingPlan,
  type Floor,
  type GenerateParams,
  type Room,
} from '../lib/buildingPlan'
import { BUILDING_TYPE_LABELS, wallMaterialLabel, type BuildingType, type WallMaterial } from '../lib/designer'
import { genId, usePersistedState } from '../lib/storage'
import { AlertIcon, QuoteIcon, RackIcon } from './NavIcons'
import { ProductImage } from './ProductImage'
import { ProposalDialog } from './ProposalDialog'
import { RackWorkspace } from './RackWorkspace'

interface Props {
  catalog: Product[]
}

const PX_PER_M = 24
const CANVAS_W_PX = CANVAS_W_M * PX_PER_M
const CANVAS_H_PX = CANVAS_H_M * PX_PER_M
const MATERIALS: WallMaterial[] = ['open', 'drywall', 'brick', 'concrete']
const BUILDING_TYPES: BuildingType[] = ['office', 'retail', 'warehouse', 'hotel', 'apartment']

function round1(v: number) {
  return Math.round(v * 10) / 10
}

function clamp(v: number, min: number, max: number) {
  return Math.min(Math.max(v, min), max)
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t
}

/** Красный → жёлтый → зелёный по силе сигнала 0..1, с альфой, растущей вместе с силой. */
function heatColor(strength: number): string {
  const s = clamp(strength, 0, 1)
  if (s < 0.04) return 'transparent'
  const stops: [number, number, number][] = [
    [239, 68, 68],
    [234, 179, 8],
    [34, 197, 94],
  ]
  const [c1, c2] = s <= 0.5 ? [stops[0], stops[1]] : [stops[1], stops[2]]
  const t = s <= 0.5 ? s / 0.5 : (s - 0.5) / 0.5
  const r = Math.round(lerp(c1[0], c2[0], t))
  const g = Math.round(lerp(c1[1], c2[1], t))
  const b = Math.round(lerp(c1[2], c2[2], t))
  const alpha = 0.12 + s * 0.5
  return `rgba(${r}, ${g}, ${b}, ${alpha.toFixed(2)})`
}

function defaultPlan(): BuildingPlan {
  const floorId = genId('floor')
  return {
    floors: [
      {
        id: floorId,
        name: 'Этаж 1',
        heightM: 3.2,
        rooms: [],
        aps: [],
        switchPoint: { x: CANVAS_W_M / 2, y: CANVAS_H_M / 2 },
      },
    ],
    serverFloorId: floorId,
  }
}

type DragState =
  | { kind: 'room'; roomId: string; startClientX: number; startClientY: number; startX: number; startY: number; w: number; h: number }
  | { kind: 'resize'; roomId: string; startClientX: number; startClientY: number; x: number; y: number; startW: number; startH: number }
  | { kind: 'switch'; startClientX: number; startClientY: number; startX: number; startY: number }
  | { kind: 'ap'; apId: string; startClientX: number; startClientY: number; startX: number; startY: number }

export function BuildingPlanView({ catalog }: Props) {
  const [plan, setPlan] = usePersistedState<BuildingPlan>('building-plan', defaultPlan())
  const [activeFloorId, setActiveFloorId] = useState(plan.floors[0]?.id)
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null)
  const [drawRect, setDrawRect] = useState<{ x: number; y: number; w: number; h: number } | null>(null)
  const [gen, setGen] = useState<GenerateParams>({
    buildingType: 'hotel',
    floors: 3,
    areaPerFloorM2: 300,
    wallMaterial: 'concrete',
    roomsPerFloor: 20,
    floorHeightM: 3.2,
  })
  const canvasRef = useRef<HTMLDivElement>(null)
  const heatmapCanvasRef = useRef<HTMLCanvasElement>(null)
  const [showProposal, setShowProposal] = useState(false)
  const dragRef = useRef<DragState | null>(null)
  const drawStartRef = useRef<{ x: number; y: number } | null>(null)

  function setGenField<K extends keyof GenerateParams>(key: K, value: GenerateParams[K]) {
    setGen((prev) => ({ ...prev, [key]: value }))
  }

  const isHotelLike = gen.buildingType === 'hotel' || gen.buildingType === 'apartment'

  function handleGenerate() {
    const hasRooms = plan.floors.some((f) => f.rooms.length > 0)
    if (hasRooms && !confirm('Это заменит текущий чертёж (все нарисованные этажи и комнаты). Построить заново по параметрам?')) {
      return
    }
    const newPlan = generateFloorPlan(gen)
    setPlan(newPlan)
    setActiveFloorId(newPlan.floors[0].id)
    setSelectedRoomId(null)
  }

  const activeFloor = plan.floors.find((f) => f.id === activeFloorId) ?? plan.floors[0]
  const result = planBuilding(plan, catalog)
  const activeFloorResult = result.perFloor.find((f) => f.floor.id === activeFloor.id)

  useEffect(() => {
    const canvas = heatmapCanvasRef.current
    if (!canvas || !activeFloorResult) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    const cellPx = HEATMAP_STEP_M * PX_PER_M
    for (const cell of computeHeatmapGrid(activeFloor, activeFloorResult.aps)) {
      if (cell.strength < 0.04) continue
      ctx.fillStyle = heatColor(cell.strength)
      ctx.fillRect((cell.x - HEATMAP_STEP_M / 2) * PX_PER_M, (cell.y - HEATMAP_STEP_M / 2) * PX_PER_M, cellPx + 0.5, cellPx + 0.5)
    }
  }, [activeFloor, activeFloorResult])

  function updateFloor(floorId: string, updater: (f: Floor) => Floor) {
    setPlan((prev) => ({ ...prev, floors: prev.floors.map((f) => (f.id === floorId ? updater(f) : f)) }))
  }

  function updateRoom(roomId: string, updater: (r: Room) => Room) {
    updateFloor(activeFloor.id, (f) => ({ ...f, rooms: f.rooms.map((r) => (r.id === roomId ? updater(r) : r)) }))
  }

  function removeRoom(roomId: string) {
    updateFloor(activeFloor.id, (f) => ({ ...f, rooms: f.rooms.filter((r) => r.id !== roomId) }))
    setSelectedRoomId(null)
  }

  function addFloor() {
    const floor: Floor = {
      id: genId('floor'),
      name: `Этаж ${plan.floors.length + 1}`,
      heightM: 3.2,
      rooms: [],
      aps: [],
      switchPoint: { x: CANVAS_W_M / 2, y: CANVAS_H_M / 2 },
    }
    setPlan((prev) => ({ ...prev, floors: [...prev.floors, floor] }))
    setActiveFloorId(floor.id)
  }

  function removeFloor(floorId: string) {
    if (plan.floors.length <= 1) return
    setPlan((prev) => {
      const floors = prev.floors.filter((f) => f.id !== floorId)
      const serverFloorId = prev.serverFloorId === floorId ? floors[0].id : prev.serverFloorId
      return { ...prev, floors, serverFloorId }
    })
    if (activeFloorId === floorId) setActiveFloorId(plan.floors.find((f) => f.id !== floorId)?.id ?? plan.floors[0].id)
  }

  function pointerToMeters(e: ReactPointerEvent) {
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return { x: 0, y: 0 }
    return {
      x: clamp((e.clientX - rect.left) / PX_PER_M, 0, CANVAS_W_M),
      y: clamp((e.clientY - rect.top) / PX_PER_M, 0, CANVAS_H_M),
    }
  }

  function onCanvasPointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    if (e.button !== 0) return
    setSelectedRoomId(null)
    const m = pointerToMeters(e)
    drawStartRef.current = m
    setDrawRect({ x: m.x, y: m.y, w: 0, h: 0 })
    canvasRef.current?.setPointerCapture(e.pointerId)
  }

  function onCanvasPointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    if (!drawStartRef.current) return
    const m = pointerToMeters(e)
    const start = drawStartRef.current
    setDrawRect({ x: Math.min(start.x, m.x), y: Math.min(start.y, m.y), w: Math.abs(m.x - start.x), h: Math.abs(m.y - start.y) })
  }

  function onCanvasPointerUp() {
    const rect = drawRect
    drawStartRef.current = null
    setDrawRect(null)
    if (!rect || rect.w < 0.5 || rect.h < 0.5) return
    const room: Room = {
      id: genId('room'),
      name: `Комната ${activeFloor.rooms.length + 1}`,
      x: round1(rect.x),
      y: round1(rect.y),
      w: round1(Math.max(0.5, rect.w)),
      h: round1(Math.max(0.5, rect.h)),
      wallMaterial: 'drywall',
    }
    updateFloor(activeFloor.id, (f) => ({ ...f, rooms: [...f.rooms, room] }))
    setSelectedRoomId(room.id)
  }

  function onRoomPointerDown(e: ReactPointerEvent<HTMLDivElement>, room: Room) {
    e.stopPropagation()
    setSelectedRoomId(room.id)
    dragRef.current = { kind: 'room', roomId: room.id, startClientX: e.clientX, startClientY: e.clientY, startX: room.x, startY: room.y, w: room.w, h: room.h }
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  function onRoomPointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    const d = dragRef.current
    if (!d || d.kind !== 'room') return
    const dxM = (e.clientX - d.startClientX) / PX_PER_M
    const dyM = (e.clientY - d.startClientY) / PX_PER_M
    updateRoom(d.roomId, (r) => ({
      ...r,
      x: round1(clamp(d.startX + dxM, 0, CANVAS_W_M - d.w)),
      y: round1(clamp(d.startY + dyM, 0, CANVAS_H_M - d.h)),
    }))
  }

  function onResizeHandlePointerDown(e: ReactPointerEvent<HTMLDivElement>, room: Room) {
    e.stopPropagation()
    dragRef.current = { kind: 'resize', roomId: room.id, startClientX: e.clientX, startClientY: e.clientY, x: room.x, y: room.y, startW: room.w, startH: room.h }
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  function onResizeHandlePointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    const d = dragRef.current
    if (!d || d.kind !== 'resize') return
    const dxM = (e.clientX - d.startClientX) / PX_PER_M
    const dyM = (e.clientY - d.startClientY) / PX_PER_M
    updateRoom(d.roomId, (r) => ({
      ...r,
      w: round1(clamp(d.startW + dxM, 0.5, CANVAS_W_M - d.x)),
      h: round1(clamp(d.startH + dyM, 0.5, CANVAS_H_M - d.y)),
    }))
  }

  function onSwitchPointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    e.stopPropagation()
    dragRef.current = { kind: 'switch', startClientX: e.clientX, startClientY: e.clientY, startX: activeFloor.switchPoint.x, startY: activeFloor.switchPoint.y }
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  function onSwitchPointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    const d = dragRef.current
    if (!d || d.kind !== 'switch') return
    const dxM = (e.clientX - d.startClientX) / PX_PER_M
    const dyM = (e.clientY - d.startClientY) / PX_PER_M
    updateFloor(activeFloor.id, (f) => ({
      ...f,
      switchPoint: { x: round1(clamp(d.startX + dxM, 0, CANVAS_W_M)), y: round1(clamp(d.startY + dyM, 0, CANVAS_H_M)) },
    }))
  }

  function onAnyPointerUp() {
    dragRef.current = null
  }

  function onApPointerDown(e: ReactPointerEvent<HTMLDivElement>, apId: string, pos: { x: number; y: number }) {
    e.stopPropagation()
    dragRef.current = { kind: 'ap', apId, startClientX: e.clientX, startClientY: e.clientY, startX: pos.x, startY: pos.y }
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  function onApPointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    const d = dragRef.current
    if (!d || d.kind !== 'ap') return
    const dxM = (e.clientX - d.startClientX) / PX_PER_M
    const dyM = (e.clientY - d.startClientY) / PX_PER_M
    const nextPos = { x: round1(clamp(d.startX + dxM, 0, CANVAS_W_M)), y: round1(clamp(d.startY + dyM, 0, CANVAS_H_M)) }
    updateFloor(activeFloor.id, (f) => ({ ...f, aps: f.aps.map((ap) => (ap.id === d.apId ? { ...ap, pos: nextPos } : ap)) }))
  }

  function removeAP(apId: string) {
    updateFloor(activeFloor.id, (f) => ({ ...f, aps: f.aps.filter((ap) => ap.id !== apId) }))
  }

  function addAP() {
    updateFloor(activeFloor.id, (f) => ({
      ...f,
      aps: [...f.aps, newPlacedAP({ x: f.switchPoint.x + 3, y: f.switchPoint.y - 3 })],
    }))
  }

  function autoPlaceForActiveFloor() {
    if (activeFloor.aps.length > 0 && !confirm('Это заменит текущее расположение точек доступа на этаже. Расставить заново автоматически?')) {
      return
    }
    updateFloor(activeFloor.id, (f) => ({ ...f, aps: autoPlaceAPs(f.rooms) }))
  }

  const selectedRoom = activeFloor.rooms.find((r) => r.id === selectedRoomId) ?? null
  const isServerFloor = plan.serverFloorId === activeFloor.id

  return (
    <div>
      <div className="mb-4 no-print">
        <h1 className="text-xl font-semibold text-slate-900">План здания</h1>
        <p className="text-sm text-slate-500">
          Нарисуйте комнаты мышью прямо на плане (клик и протяжка), задайте материал стен — система сама расставит точки
          доступа, подберёт оборудование и посчитает, сколько метров кабеля уйдёт на каждый этаж и до серверной. Или
          укажите параметры объекта ниже — и чертёж будет построен автоматически.
        </p>
      </div>

      <div className="no-print mb-4 rounded-lg border border-slate-200 bg-white p-3">
        <h2 className="mb-2 text-sm font-semibold text-slate-700">Построить чертёж по параметрам объекта</h2>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-500">Тип объекта</label>
            <select
              className="mt-1 rounded border border-slate-300 px-2 py-1 text-sm"
              value={gen.buildingType}
              onChange={(e) => setGenField('buildingType', e.target.value as BuildingType)}
            >
              {BUILDING_TYPES.map((t) => (
                <option key={t} value={t}>
                  {BUILDING_TYPE_LABELS[t]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500">Этажей</label>
            <input
              type="number"
              min={1}
              className="mt-1 w-20 rounded border border-slate-300 px-2 py-1 text-sm"
              value={gen.floors}
              onChange={(e) => setGenField('floors', Math.max(1, Number(e.target.value)))}
            />
          </div>
          {isHotelLike ? (
            <div>
              <label className="block text-xs font-medium text-slate-500">Номеров на этаж</label>
              <input
                type="number"
                min={1}
                className="mt-1 w-24 rounded border border-slate-300 px-2 py-1 text-sm"
                value={gen.roomsPerFloor}
                onChange={(e) => setGenField('roomsPerFloor', Math.max(1, Number(e.target.value)))}
              />
            </div>
          ) : (
            <div>
              <label className="block text-xs font-medium text-slate-500">Площадь этажа, м²</label>
              <input
                type="number"
                min={10}
                className="mt-1 w-28 rounded border border-slate-300 px-2 py-1 text-sm"
                value={gen.areaPerFloorM2}
                onChange={(e) => setGenField('areaPerFloorM2', Math.max(10, Number(e.target.value)))}
              />
            </div>
          )}
          <div>
            <label className="block text-xs font-medium text-slate-500">Материал стен</label>
            <select
              className="mt-1 rounded border border-slate-300 px-2 py-1 text-sm"
              value={gen.wallMaterial}
              onChange={(e) => setGenField('wallMaterial', e.target.value as WallMaterial)}
            >
              {MATERIALS.map((m) => (
                <option key={m} value={m}>
                  {wallMaterialLabel(m)}
                </option>
              ))}
            </select>
          </div>
          <button onClick={handleGenerate} className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700">
            Построить чертёж
          </button>
        </div>
        {isHotelLike && (
          <p className="mt-2 text-xs text-slate-400">
            Номера разложатся в два ряда вдоль коридора на каждом этаже — дальше можно подвинуть стены и переименовать
            вручную.
          </p>
        )}
      </div>

      <div className="no-print mb-3 flex flex-wrap items-center gap-2">
        {plan.floors.map((f) => (
          <button
            key={f.id}
            onClick={() => {
              setActiveFloorId(f.id)
              setSelectedRoomId(null)
            }}
            className="flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium"
            style={
              f.id === activeFloor.id
                ? { borderColor: 'var(--accent)', color: 'var(--accent)', backgroundColor: 'var(--color-blue-50, #eff6ff)' }
                : { borderColor: 'var(--border)', color: 'var(--text-muted)' }
            }
          >
            {f.id === plan.serverFloorId && (
              <span title="Серверная / шкаф" className="h-4 w-4">
                <RackIcon />
              </span>
            )}
            {f.name}
          </button>
        ))}
        <button onClick={addFloor} className="rounded-full border border-dashed border-slate-300 px-3 py-1.5 text-sm text-slate-500 hover:bg-slate-50">
          + Этаж
        </button>
      </div>

      <div className="no-print mb-4 flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 bg-white p-3">
        <div>
          <label className="block text-xs font-medium text-slate-500">Название этажа</label>
          <input
            className="mt-1 rounded border border-slate-300 px-2 py-1 text-sm"
            value={activeFloor.name}
            onChange={(e) => updateFloor(activeFloor.id, (f) => ({ ...f, name: e.target.value }))}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500">Высота этажа, м</label>
          <input
            type="number"
            step={0.1}
            min={2}
            className="mt-1 w-24 rounded border border-slate-300 px-2 py-1 text-sm"
            value={activeFloor.heightM}
            onChange={(e) => updateFloor(activeFloor.id, (f) => ({ ...f, heightM: Number(e.target.value) }))}
          />
        </div>
        <button
          onClick={() => setPlan((prev) => ({ ...prev, serverFloorId: activeFloor.id }))}
          disabled={isServerFloor}
          className="flex items-center gap-1.5 rounded border px-3 py-1.5 text-sm font-medium disabled:cursor-default disabled:opacity-60"
          style={isServerFloor ? { borderColor: 'var(--accent)', color: 'var(--accent)' } : { borderColor: 'var(--border)', color: 'var(--text-muted)' }}
        >
          {isServerFloor && <RackIcon className="h-4 w-4" />}
          {isServerFloor ? 'Это серверная' : 'Сделать серверной'}
        </button>
        {plan.floors.length > 1 && (
          <button onClick={() => removeFloor(activeFloor.id)} className="ml-auto rounded border border-red-200 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50">
            Удалить этаж
          </button>
        )}
      </div>

      {/* minmax(0,1fr) + min-w-0: чертёж (960 px) прокручивается внутри своей колонки, а не
          расталкивает сетку и не наезжает на правую панель с кнопками. */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0">
          <p className="no-print mb-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400">
            <span>
              Тёмная метка <RackIcon className="inline h-3.5 w-3.5 align-[-2px]" /> — коммутатор/серверная этого этажа, перетащите её. Значки с фото — точки доступа Wi-Fi (подобранная модель, подпись снизу): их можно
              свободно перетаскивать мышью, двойной клик удаляет точку. Одна клетка сетки = 1 м.
            </span>
            <span className="flex items-center gap-2 whitespace-nowrap">
              <span>Слабый</span>
              <span
                className="h-2.5 w-28 rounded-full"
                style={{ background: 'linear-gradient(to right, #ef4444, #eab308, #22c55e)' }}
              />
              <span>Сильный</span>
            </span>
          </p>
          <div className="no-print mb-2 flex gap-2">
            <button onClick={addAP} className="rounded border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50">
              + Точка доступа
            </button>
            <button onClick={autoPlaceForActiveFloor} className="rounded border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50">
              Расставить автоматически
            </button>
          </div>
          <div className="overflow-auto rounded-lg border-2 border-slate-300 bg-white">
            <div
              ref={canvasRef}
              onPointerDown={onCanvasPointerDown}
              onPointerMove={onCanvasPointerMove}
              onPointerUp={onCanvasPointerUp}
              style={{
                width: CANVAS_W_PX,
                height: CANVAS_H_PX,
                position: 'relative',
                cursor: 'crosshair',
                backgroundImage:
                  'linear-gradient(to right, var(--color-slate-100, #f1f5f9) 1px, transparent 1px), linear-gradient(to bottom, var(--color-slate-100, #f1f5f9) 1px, transparent 1px)',
                backgroundSize: `${PX_PER_M}px ${PX_PER_M}px`,
              }}
            >
              {activeFloor.rooms.map((room) => (
                <div
                  key={room.id}
                  onPointerDown={(e) => onRoomPointerDown(e, room)}
                  onPointerMove={onRoomPointerMove}
                  onPointerUp={onAnyPointerUp}
                  className="absolute flex cursor-move flex-col items-center justify-center overflow-hidden rounded-sm border-2 text-center text-xs font-medium text-slate-700"
                  style={{
                    left: room.x * PX_PER_M,
                    top: room.y * PX_PER_M,
                    width: room.w * PX_PER_M,
                    height: room.h * PX_PER_M,
                    backgroundColor: wallMaterialColor(room.wallMaterial),
                    borderColor: room.id === selectedRoomId ? 'var(--accent)' : 'var(--color-slate-400, #94a3b8)',
                    zIndex: 1,
                  }}
                >
                  <span className="truncate px-1">{room.name}</span>
                  <span className="text-[10px] text-slate-500">{round1(room.w * room.h)} м²</span>
                  <div
                    onPointerDown={(e) => onResizeHandlePointerDown(e, room)}
                    onPointerMove={onResizeHandlePointerMove}
                    onPointerUp={onAnyPointerUp}
                    className="absolute bottom-0 right-0 h-3 w-3 cursor-nwse-resize bg-slate-500"
                  />
                </div>
              ))}

              {drawRect && (
                <div
                  className="absolute border-2 border-dashed border-blue-500 bg-blue-100/40"
                  style={{ left: drawRect.x * PX_PER_M, top: drawRect.y * PX_PER_M, width: drawRect.w * PX_PER_M, height: drawRect.h * PX_PER_M }}
                />
              )}

              <canvas
                ref={heatmapCanvasRef}
                width={CANVAS_W_PX}
                height={CANVAS_H_PX}
                className="pointer-events-none absolute inset-0"
                style={{ zIndex: 2, width: CANVAS_W_PX, height: CANVAS_H_PX }}
              />

              <svg width={CANVAS_W_PX} height={CANVAS_H_PX} className="pointer-events-none absolute inset-0" style={{ zIndex: 3 }}>
                {activeFloorResult?.aps.map((ap) => (
                  <g key={ap.id}>
                    <line
                      x1={ap.pos.x * PX_PER_M}
                      y1={ap.pos.y * PX_PER_M}
                      x2={activeFloor.switchPoint.x * PX_PER_M}
                      y2={activeFloor.switchPoint.y * PX_PER_M}
                      stroke="#2563eb"
                      strokeWidth={1}
                      strokeDasharray="4 3"
                      opacity={0.5}
                    />
                  </g>
                ))}
              </svg>

              {/* Точки доступа — фото подобранной модели вместо безликой точки */}
              {activeFloorResult?.aps.map((ap) => {
                const product = activeFloorResult.apProduct
                const name = product ? `${product.brand} ${product.model}` : 'Точка доступа'
                return (
                  <div
                    key={ap.id}
                    onPointerDown={(e) => onApPointerDown(e, ap.id, ap.pos)}
                    onPointerMove={onApPointerMove}
                    onPointerUp={onAnyPointerUp}
                    onDoubleClick={() => removeAP(ap.id)}
                    title={`${name} — кабель ~${round1(ap.cableLengthM)} м. Перетащите, двойной клик — удалить.`}
                    className="absolute -translate-x-1/2 -translate-y-1/2 cursor-move touch-none select-none"
                    style={{ left: ap.pos.x * PX_PER_M, top: ap.pos.y * PX_PER_M, zIndex: 4 }}
                  >
                    <div className="flex h-10 w-10 items-center justify-center">
                      {product ? (
                        <ProductImage imageUrl={product.imageUrl} brand={product.brand} category={product.category} size="marker" />
                      ) : (
                        <span className="h-3 w-3 rounded-full bg-blue-600" />
                      )}
                    </div>
                    {product && (
                      <span
                        className="pointer-events-none absolute left-1/2 top-full mt-0.5 -translate-x-1/2 whitespace-nowrap rounded px-1 py-px text-[9px] font-medium leading-tight text-white"
                        style={{ backgroundColor: 'rgba(15, 23, 42, 0.8)' }}
                      >
                        {product.model}
                      </span>
                    )}
                  </div>
                )
              })}

              <div
                onPointerDown={onSwitchPointerDown}
                onPointerMove={onSwitchPointerMove}
                onPointerUp={onAnyPointerUp}
                title="Коммутатор/серверная этого этажа — перетащите"
                className="absolute flex h-7 w-7 -translate-x-1/2 -translate-y-1/2 cursor-move items-center justify-center rounded bg-slate-900 p-1 text-white shadow"
                style={{ left: activeFloor.switchPoint.x * PX_PER_M, top: activeFloor.switchPoint.y * PX_PER_M, zIndex: 3 }}
              >
                <RackIcon />
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          {selectedRoom && (
            <div className="no-print rounded-lg border border-slate-200 bg-white p-4">
              <h2 className="mb-2 text-sm font-semibold text-slate-700">Комната</h2>
              <div className="space-y-2">
                <div>
                  <label className="block text-xs text-slate-500">Название</label>
                  <input
                    className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-sm"
                    value={selectedRoom.name}
                    onChange={(e) => updateRoom(selectedRoom.id, (r) => ({ ...r, name: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-500">Материал стен</label>
                  <select
                    className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-sm"
                    value={selectedRoom.wallMaterial}
                    onChange={(e) => updateRoom(selectedRoom.id, (r) => ({ ...r, wallMaterial: e.target.value as WallMaterial }))}
                  >
                    {MATERIALS.map((m) => (
                      <option key={m} value={m}>
                        {wallMaterialLabel(m)}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs text-slate-500">Ширина, м</label>
                    <input
                      type="number"
                      step={0.1}
                      min={0.5}
                      className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-sm"
                      value={selectedRoom.w}
                      onChange={(e) => updateRoom(selectedRoom.id, (r) => ({ ...r, w: Math.max(0.5, Number(e.target.value)) }))}
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500">Глубина, м</label>
                    <input
                      type="number"
                      step={0.1}
                      min={0.5}
                      className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-sm"
                      value={selectedRoom.h}
                      onChange={(e) => updateRoom(selectedRoom.id, (r) => ({ ...r, h: Math.max(0.5, Number(e.target.value)) }))}
                    />
                  </div>
                </div>
                <button onClick={() => removeRoom(selectedRoom.id)} className="text-sm text-red-600 hover:underline">
                  Удалить комнату
                </button>
              </div>
            </div>
          )}

          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <h2 className="mb-2 text-sm font-semibold text-slate-700">Оборудование по проекту</h2>
            <div className="space-y-3">
              {result.perFloor.map((fr) => (
                <div key={fr.floor.id} className="border-b border-slate-100 pb-2 text-sm last:border-0">
                  <div className="font-medium text-slate-800">{fr.floor.name}</div>
                  {fr.aps.length === 0 ? (
                    <div className="text-xs text-slate-400">Нет комнат — нарисуйте план этажа</div>
                  ) : (
                    <ul className="mt-1 space-y-0.5 text-xs text-slate-600">
                      <li>
                        {fr.apProduct ? `${fr.apProduct.brand} ${fr.apProduct.model}` : 'AP не подобран'} × {fr.aps.length}
                      </li>
                      {fr.switchProduct && (
                        <li>
                          {fr.switchProduct.brand} {fr.switchProduct.model} × {fr.switchQty}
                        </li>
                      )}
                      <li>Кабель по этажу: ~{round1(fr.accessCableM)} м</li>
                      {fr.backboneCableM > 0 && <li>Магистральный кабель до серверной: ~{round1(fr.backboneCableM)} м</li>}
                    </ul>
                  )}
                </div>
              ))}

              {result.routerProduct && (
                <div className="text-sm">
                  Роутер/шлюз: {result.routerProduct.brand} {result.routerProduct.model}
                </div>
              )}
              {result.controllerProduct && (
                <div className="text-sm">
                  Контроллер сети: {result.controllerProduct.brand} {result.controllerProduct.model}
                </div>
              )}
            </div>

            {result.warnings.length > 0 && (
              <div className="mt-3 space-y-1 rounded border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800">
                {result.warnings.map((w, i) => (
                  <div key={i} className="flex gap-1.5">
                    <AlertIcon className="mt-px h-3.5 w-3.5 shrink-0" />
                    <span>{w}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-3 space-y-1 border-t border-slate-100 pt-2 text-sm text-slate-600">
              <div className="flex justify-between">
                <span>Точек доступа всего</span>
                <span className="font-medium text-slate-900">{result.totalAPCount}</span>
              </div>
              <div className="flex justify-between">
                <span>Кабель всего (с запасом)</span>
                <span className="font-medium text-slate-900">~{round1(result.totalCableM)} м</span>
              </div>
              <div className="flex justify-between text-xs text-slate-400">
                <span>из них кабель, ориентировочно</span>
                <span>${round1(result.cableCostUSD)}</span>
              </div>
            </div>

            <div className="mt-2 flex items-center justify-between border-t border-slate-100 pt-2">
              <span className="text-base font-semibold text-slate-900">Итого по проекту</span>
              <span className="text-xl font-bold text-slate-900">${Math.round(result.totalUSD).toLocaleString()}</span>
            </div>
            <p className="mt-1 text-[11px] text-slate-400">
              Кабель — ориентировочный расчёт по прямой (с запасом на слабину и разделку), без учёта коробов, разъёмов и работ.
            </p>

            <button
              onClick={() => setShowProposal(true)}
              className="no-print mt-3 flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-semibold shadow-sm"
              style={{ backgroundColor: 'var(--accent)', color: 'var(--accent-ink)' }}
            >
              <span className="h-4 w-4">
                <QuoteIcon />
              </span>
              КП для клиента (PDF)
            </button>
            <p className="no-print mt-1.5 text-center text-[11px] text-slate-400">От вашего имени: логотип, контакты, ваши цены</p>
          </div>
        </div>
      </div>

      <div className="mt-8">
        <h2 className="text-lg font-semibold text-slate-900">Серверный шкаф</h2>
        <p className="mb-4 text-sm text-slate-500">
          На этаже «{plan.floors.find((f) => f.id === plan.serverFloorId)?.name}». Добавляйте оборудование карточками
          в поиске — то, что по характеристикам крепится в 19" стойку, встанет в шкаф, а настольные модели, точки
          доступа и камеры появятся справа как подключённые к нему, но стоящие на объекте.
        </p>
        <RackWorkspace catalog={catalog} />
      </div>

      {showProposal && <ProposalDialog result={result} onClose={() => setShowProposal(false)} />}
    </div>
  )
}
