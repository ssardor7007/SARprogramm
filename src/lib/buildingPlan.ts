import type { Product } from '../types'
import { findProduct, type BuildingType, type WallMaterial } from './designer'

export const CANVAS_W_M = 40
export const CANVAS_H_M = 24

export interface Room {
  id: string
  name: string
  /** Координаты и размеры в метрах, левый верхний угол */
  x: number
  y: number
  w: number
  h: number
  wallMaterial: WallMaterial
}

export interface Point {
  x: number
  y: number
}

export interface Floor {
  id: string
  name: string
  /** Высота этажа в метрах — используется для расчёта магистрального кабеля до серверной */
  heightM: number
  rooms: Room[]
  /** Точка коммутации (шкаф/коммутатор) на этаже, к которой идут кабели от точек доступа */
  switchPoint: Point
}

export interface BuildingPlan {
  floors: Floor[]
  /** Этаж, где стоит сервер/основная стойка — остальные подключаются магистральным кабелем */
  serverFloorId: string
}

export interface APPlacement {
  id: string
  pos: Point
  /** Радиус уверенного приёма для этой точки — определяет самый требовательный из покрываемых участков */
  radius: number
  cableLengthM: number
}

const MATERIAL_RANK: Record<WallMaterial, number> = { open: 0, drywall: 1, brick: 2, concrete: 3 }
const TIER_BY_RANK = ['budget', 'mid', 'mid', 'premium'] as const
const AP_ID_BY_TIER = { budget: 'tpl-eap225', mid: 'tpl-eap670', premium: 'tpl-eap660-hd' } as const

/** Радиус уверенного покрытия одной точкой доступа, метров — зависит от того, что сигналу приходится пробивать */
export const COVERAGE_RADIUS_M: Record<WallMaterial, number> = {
  open: 16,
  drywall: 12,
  brick: 9,
  concrete: 7,
}

const CABLE_SLACK = 1.15
/** Запас на спуск от потолка до точки доступа + разделка на патч-панели, метров */
const DROP_ALLOWANCE_M = 3
const RISER_SLACK = 1.1
export const CABLE_PRICE_PER_M_USD = 0.35
const DEVICE_CAPACITY_PER_AP_ESTIMATE = 15

export interface FloorResult {
  floor: Floor
  aps: APPlacement[]
  apTier: 'budget' | 'mid' | 'premium'
  apProduct?: Product
  switchProduct?: Product
  switchQty: number
  accessCableM: number
  backboneCableM: number
}

export interface BuildingPlanResult {
  perFloor: FloorResult[]
  routerProduct?: Product
  controllerProduct?: Product
  totalAPCount: number
  totalCableM: number
  cableCostUSD: number
  equipmentUSD: number
  totalUSD: number
  warnings: string[]
}

function manhattan(a: Point, b: Point) {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y)
}

function euclid(a: Point, b: Point) {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

interface CoverageTarget {
  point: Point
  /** Требуемый радиус покрытия для этой точки (зависит от материала стен её комнаты) */
  radius: number
}

/**
 * Точки, которые обязательно должны попадать в зону уверенного приёма.
 * Маленькие комнаты (меньше радиуса покрытия) представлены одной точкой в центре —
 * их вполне может накрыть точка доступа из коридора или соседнего помещения.
 * Большие помещения получают сетку точек, чтобы не остались слепые зоны по углам.
 */
function buildCoverageTargets(rooms: Room[]): CoverageTarget[] {
  const targets: CoverageTarget[] = []
  for (const room of rooms) {
    const radius = COVERAGE_RADIUS_M[room.wallMaterial]
    if (room.w <= radius && room.h <= radius) {
      targets.push({ point: { x: room.x + room.w / 2, y: room.y + room.h / 2 }, radius })
      continue
    }
    const step = Math.max(1.5, radius * 0.8)
    const cols = Math.max(1, Math.round(room.w / step))
    const rows = Math.max(1, Math.round(room.h / step))
    for (let ry = 0; ry < rows; ry++) {
      for (let rx = 0; rx < cols; rx++) {
        targets.push({
          point: { x: room.x + ((rx + 0.5) * room.w) / cols, y: room.y + ((ry + 0.5) * room.h) / rows },
          radius,
        })
      }
    }
  }
  return targets
}

/** Возможные места для точки доступа: сетка по всему этажу (включая коридоры) плюс центр каждой комнаты */
function buildCandidatePoints(rooms: Room[]): Point[] {
  const points: Point[] = []
  const step = 3
  for (let y = step / 2; y < CANVAS_H_M; y += step) {
    for (let x = step / 2; x < CANVAS_W_M; x += step) {
      points.push({ x, y })
    }
  }
  for (const room of rooms) {
    points.push({ x: room.x + room.w / 2, y: room.y + room.h / 2 })
  }
  return points
}

/**
 * Жадное покрытие: на каждом шаге ставим точку доступа там, где она накрывает
 * больше всего ещё не накрытых участков, пока не закроем всё. Так одна точка
 * в коридоре обслуживает сразу несколько соседних комнат, а не по одной AP на
 * каждую комнату.
 */
function greedyCoverage(candidates: Point[], targets: CoverageTarget[]): { pos: Point; radius: number }[] {
  const covered = new Array(targets.length).fill(false)
  const placements: { pos: Point; radius: number }[] = []
  let remaining = targets.length
  let guard = 0

  while (remaining > 0 && guard < 300) {
    guard++
    let bestPoint: Point | null = null
    let bestCoverIdx: number[] = []

    for (const candidate of candidates) {
      const coverIdx: number[] = []
      for (let i = 0; i < targets.length; i++) {
        if (!covered[i] && euclid(candidate, targets[i].point) <= targets[i].radius) coverIdx.push(i)
      }
      if (coverIdx.length > bestCoverIdx.length) {
        bestCoverIdx = coverIdx
        bestPoint = candidate
      }
    }

    if (!bestPoint || bestCoverIdx.length === 0) {
      const idx = covered.findIndex((c) => !c)
      if (idx === -1) break
      bestPoint = targets[idx].point
      bestCoverIdx = [idx]
    }

    for (const idx of bestCoverIdx) covered[idx] = true
    remaining -= bestCoverIdx.length
    const radius = Math.max(...bestCoverIdx.map((i) => targets[i].radius))
    placements.push({ pos: bestPoint, radius })
  }

  return placements
}

function pickSwitch(catalog: Product[], portsNeeded: number): { product?: Product; qty: number } {
  if (portsNeeded <= 0) return { product: undefined, qty: 0 }
  if (portsNeeded <= 8) {
    return { product: findProduct(catalog, 'tpl-sg2210p', 'switch', 'budget'), qty: 1 }
  }
  const qty = Math.ceil(portsNeeded / 24)
  return { product: findProduct(catalog, 'tpl-sg3428mp', 'switch', 'mid'), qty }
}

export function planBuilding(plan: BuildingPlan, catalog: Product[]): BuildingPlanResult {
  const warnings: string[] = []
  const serverFloorIndex = Math.max(0, plan.floors.findIndex((f) => f.id === plan.serverFloorId))
  const serverFloor = plan.floors[serverFloorIndex] ?? plan.floors[0]

  const perFloor: FloorResult[] = plan.floors.map((floor, floorIndex) => {
    const worstRank = floor.rooms.reduce((rank, room) => Math.max(rank, MATERIAL_RANK[room.wallMaterial]), 0)

    const targets = buildCoverageTargets(floor.rooms)
    const candidates = buildCandidatePoints(floor.rooms)
    const aps: APPlacement[] = greedyCoverage(candidates, targets).map((placement, i) => ({
      id: `ap-${floor.id}-${i}`,
      pos: placement.pos,
      radius: placement.radius,
      cableLengthM: manhattan(placement.pos, floor.switchPoint) * CABLE_SLACK + DROP_ALLOWANCE_M,
    }))

    const apTier = TIER_BY_RANK[worstRank]
    const apProduct = aps.length > 0 ? findProduct(catalog, AP_ID_BY_TIER[apTier], 'ap', apTier) : undefined
    if (aps.length > 0 && !apProduct) {
      warnings.push(`Этаж «${floor.name}»: в каталоге нет подходящей точки доступа.`)
    }

    const portsNeeded = Math.ceil(aps.length * 1.15)
    const { product: switchProduct, qty: switchQty } = pickSwitch(catalog, portsNeeded)
    if (portsNeeded > 0 && !switchProduct) {
      warnings.push(`Этаж «${floor.name}»: в каталоге нет подходящего PoE-коммутатора.`)
    }

    const accessCableM = aps.reduce((sum, ap) => sum + ap.cableLengthM, 0)

    let backboneCableM = 0
    if (floor.id !== serverFloor.id && aps.length > 0) {
      const lo = Math.min(floorIndex, serverFloorIndex)
      const hi = Math.max(floorIndex, serverFloorIndex)
      let vertical = 0
      for (let i = lo; i < hi; i++) vertical += plan.floors[i].heightM
      const horizontal = manhattan(floor.switchPoint, serverFloor.switchPoint)
      backboneCableM = (vertical + horizontal) * RISER_SLACK
    }

    return { floor, aps, apTier, apProduct, switchProduct, switchQty, accessCableM, backboneCableM }
  })

  const totalAPCount = perFloor.reduce((sum, f) => sum + f.aps.length, 0)
  const totalCableM = perFloor.reduce((sum, f) => sum + f.accessCableM + f.backboneCableM, 0)
  const cableCostUSD = totalCableM * CABLE_PRICE_PER_M_USD

  const estimatedDevices = totalAPCount * DEVICE_CAPACITY_PER_AP_ESTIMATE
  let routerTier: 'budget' | 'mid' | 'premium' = 'budget'
  let routerId = 'tpl-er605'
  if (estimatedDevices > 150) {
    routerTier = 'premium'
    routerId = 'tpl-er8411'
  } else if (estimatedDevices > 50) {
    routerTier = 'mid'
    routerId = 'tpl-er7206'
  }
  const routerProduct = totalAPCount > 0 ? findProduct(catalog, routerId, 'router', routerTier) : undefined
  if (totalAPCount > 0 && !routerProduct) {
    warnings.push('В каталоге нет подходящего роутера/шлюза.')
  }

  const controllerProduct = totalAPCount > 1 ? findProduct(catalog, 'tpl-oc200', 'other', 'budget') : undefined

  const equipmentUSD =
    perFloor.reduce((sum, f) => sum + (f.apProduct ? f.apProduct.priceUSD * f.aps.length : 0) + (f.switchProduct ? f.switchProduct.priceUSD * f.switchQty : 0), 0) +
    (routerProduct?.priceUSD ?? 0) +
    (controllerProduct?.priceUSD ?? 0)

  return {
    perFloor,
    routerProduct,
    controllerProduct,
    totalAPCount,
    totalCableM,
    cableCostUSD,
    equipmentUSD,
    totalUSD: equipmentUSD + cableCostUSD,
    warnings,
  }
}

export function wallMaterialColor(m: WallMaterial) {
  return { open: '#e2e8f0', drywall: '#bfdbfe', brick: '#fde68a', concrete: '#cbd5e1' }[m]
}

export interface GenerateParams {
  buildingType: BuildingType
  floors: number
  areaPerFloorM2: number
  wallMaterial: WallMaterial
  /** Номеров/квартир на этаже — используется для гостиниц и жилых домов */
  roomsPerFloor: number
  floorHeightM: number
}

function clampNum(v: number, min: number, max: number) {
  return Math.min(Math.max(v, min), max)
}

/**
 * Автоматически строит чертёж этажей по параметрам объекта — для гостиниц/жилых
 * домов раскладывает номера в два ряда вдоль коридора, для остальных типов
 * рисует одно открытое помещение нужной площади. Это стартовый эскиз, который
 * потом можно поправить руками (подвинуть стены, переименовать комнаты).
 */
export function generateFloorPlan(params: GenerateParams): BuildingPlan {
  const isHotelLike = params.buildingType === 'hotel' || params.buildingType === 'apartment'
  const floorCount = Math.max(1, Math.round(params.floors))
  const floors: Floor[] = []

  for (let i = 0; i < floorCount; i++) {
    const floorId = `floor-${i}`
    let rooms: Room[]
    let switchPoint: Point

    if (isHotelLike && params.roomsPerFloor > 0) {
      const n = Math.round(params.roomsPerFloor)
      const roomsPerSide = Math.ceil(n / 2)
      const roomDepth = 6
      const corridorWidth = 2.4
      const roomWidth = clampNum(CANVAS_W_M / roomsPerSide - 0.1, 3, 5.5)

      rooms = []
      for (let r = 0; r < n; r++) {
        const side = r < roomsPerSide ? 0 : 1
        const idxInSide = side === 0 ? r : r - roomsPerSide
        rooms.push({
          id: `${floorId}-room-${r}`,
          name: `Номер ${r + 1}`,
          x: round1(idxInSide * roomWidth),
          y: side === 0 ? 0 : round1(roomDepth + corridorWidth),
          w: round1(roomWidth),
          h: roomDepth,
          wallMaterial: params.wallMaterial,
        })
      }
      switchPoint = { x: round1((roomsPerSide * roomWidth) / 2), y: round1(roomDepth + corridorWidth / 2) }
    } else {
      const area = Math.max(10, params.areaPerFloorM2)
      const w = clampNum(Math.sqrt(area * 1.4), 4, CANVAS_W_M)
      const h = clampNum(area / w, 4, CANVAS_H_M)
      rooms = [
        {
          id: `${floorId}-room-0`,
          name: 'Открытое пространство',
          x: 0,
          y: 0,
          w: round1(w),
          h: round1(h),
          wallMaterial: params.wallMaterial,
        },
      ]
      switchPoint = { x: round1(w / 2), y: round1(h / 2) }
    }

    floors.push({ id: floorId, name: `Этаж ${i + 1}`, heightM: params.floorHeightM, rooms, switchPoint })
  }

  return { floors, serverFloorId: floors[0].id }
}

function round1(v: number) {
  return Math.round(v * 10) / 10
}
