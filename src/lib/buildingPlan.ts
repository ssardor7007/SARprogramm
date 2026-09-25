import type { Product } from '../types'
import { findProduct, type BuildingType, type WallMaterial } from './designer'
import { genId } from './storage'

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

/** Точка доступа, как её сохранил пользователь — координаты, дальше их можно перетаскивать вручную */
export interface PlacedAP {
  id: string
  pos: Point
}

export interface Floor {
  id: string
  name: string
  /** Высота этажа в метрах — используется для расчёта магистрального кабеля до серверной */
  heightM: number
  rooms: Room[]
  /** Точки доступа на этаже — расставляются автоматически или руками, дальше их можно двигать */
  aps: PlacedAP[]
  /** Точка коммутации (шкаф/коммутатор) на этаже, к которой идут кабели от точек доступа */
  switchPoint: Point
}

export interface BuildingPlan {
  floors: Floor[]
  /** Этаж, где стоит сервер/основная стойка — остальные подключаются магистральным кабелем */
  serverFloorId: string
  /**
   * Конкретное оборудование, уже подобранное в «Подборе по объекту» для одного из
   * сегментов (бюджет/оптимум/премиум) — если задано, planBuilding ставит именно
   * эти модели на всё здание вместо своего подбора по рангу стен, так что бренд
   * на плане совпадает с тем, что выбрали в карточке сегмента.
   */
  preferredApProductId?: string
  preferredSwitchProductId?: string
  preferredRouterProductId?: string
  preferredControllerProductId?: string
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
const RADIUS_BY_RANK = [COVERAGE_RADIUS_M.open, COVERAGE_RADIUS_M.drywall, COVERAGE_RADIUS_M.brick, COVERAGE_RADIUS_M.concrete]

/** Доля сигнала, которая проходит сквозь ОДНУ стену этого материала — «открытое пространство» физической стены не имеет, поэтому не ослабляет. */
const WALL_PASS_FACTOR: Record<WallMaterial, number> = {
  open: 1,
  drywall: 0.6,
  brick: 0.4,
  concrete: 0.22,
}

/** Комната, в которой лежит точка — верхняя из нарисованных, если они перекрываются. */
function roomAt(rooms: Room[], x: number, y: number): Room | undefined {
  for (let i = rooms.length - 1; i >= 0; i--) {
    const r = rooms[i]
    if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return r
  }
  return undefined
}

/**
 * Ослабление сигнала на пути от точки доступа до точки замера: «прошагиваем»
 * отрезок между ними и на каждой смене помещения умножаем накопленный сигнал
 * на коэффициент прохождения стены материала того помещения, в которое зашли.
 * Так тепловая карта реально гаснет за стеной, а не просто угасает по кругу
 * от расстояния, как будто стен вообще нет.
 */
function wallAttenuation(from: Point, to: Point, rooms: Room[]): number {
  const dist = euclid(from, to)
  if (dist < 0.05 || rooms.length === 0) return 1
  const steps = Math.max(4, Math.ceil(dist / 0.35))
  let attenuation = 1
  let prevRoom = roomAt(rooms, from.x, from.y)
  for (let i = 1; i <= steps; i++) {
    const t = i / steps
    const room = roomAt(rooms, from.x + (to.x - from.x) * t, from.y + (to.y - from.y) * t)
    if ((room?.id ?? null) !== (prevRoom?.id ?? null)) {
      const material = room?.wallMaterial ?? prevRoom?.wallMaterial
      if (material) attenuation *= WALL_PASS_FACTOR[material]
    }
    prevRoom = room
  }
  return attenuation
}

export interface HeatCell {
  /** Метры, левый верхний угол клетки */
  x: number
  y: number
  /** Лучший сигнал среди всех точек доступа в этой клетке, 0..1 */
  strength: number
}

export const HEATMAP_STEP_M = 0.5

/**
 * Сетка «сила сигнала» для тепловой карты этажа. В отличие от простого круга
 * вокруг точки доступа, здесь для каждой клетки идёт луч до каждой AP и
 * считается, сколько стен и какого материала он пересёк — за бетонной стеной
 * сигнал реально гаснет, а не тянется тем же цветом, что и в открытом коридоре.
 */
export function computeHeatmapGrid(floor: Floor, aps: APPlacement[]): HeatCell[] {
  const cells: HeatCell[] = []
  if (aps.length === 0) return cells
  for (let y = HEATMAP_STEP_M / 2; y < CANVAS_H_M; y += HEATMAP_STEP_M) {
    for (let x = HEATMAP_STEP_M / 2; x < CANVAS_W_M; x += HEATMAP_STEP_M) {
      let best = 0
      for (const ap of aps) {
        const dist = euclid(ap.pos, { x, y })
        const reach = ap.radius * 1.4
        if (dist > reach) continue
        // Внутри радиуса «уверенного приёма» сигнал должен читаться зелёным почти
        // целиком (лёгкое угасание к краю), а не таять линейно от самой точки —
        // иначе даже центр зоны покрытия рисовался жёлто-оранжевым. Настоящий спад
        // до нуля идёт только на «хвосте» между радиусом и предельной дальностью.
        const distanceFalloff =
          dist <= ap.radius ? 1 - (dist / ap.radius) * 0.2 : 0.8 * (1 - (dist - ap.radius) / (reach - ap.radius))
        if (distanceFalloff <= best) continue
        const strength = distanceFalloff * wallAttenuation(ap.pos, { x, y }, floor.rooms)
        if (strength > best) best = strength
      }
      cells.push({ x, y, strength: best })
    }
  }
  return cells
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

/**
 * Автоматически расставляет точки доступа по комнатам этажа (жадное покрытие).
 * Результат — обычные точки, которые дальше можно свободно перетаскивать руками.
 */
export function autoPlaceAPs(rooms: Room[]): PlacedAP[] {
  const targets = buildCoverageTargets(rooms)
  const candidates = buildCandidatePoints(rooms)
  return greedyCoverage(candidates, targets).map((p) => ({ id: genId('ap'), pos: p.pos }))
}

export function newPlacedAP(pos: Point): PlacedAP {
  return { id: genId('ap'), pos }
}

function pickSwitch(catalog: Product[], portsNeeded: number, preferred?: Product): { product?: Product; qty: number } {
  if (portsNeeded <= 0) return { product: undefined, qty: 0 }
  const qty = portsNeeded <= 8 ? 1 : Math.ceil(portsNeeded / 24)
  if (preferred) return { product: preferred, qty }
  if (portsNeeded <= 8) {
    return { product: findProduct(catalog, 'tpl-sg2210p', 'switch', 'budget'), qty: 1 }
  }
  return { product: findProduct(catalog, 'tpl-sg3428mp', 'switch', 'mid'), qty }
}

export function planBuilding(plan: BuildingPlan, catalog: Product[]): BuildingPlanResult {
  const warnings: string[] = []
  const serverFloorIndex = Math.max(0, plan.floors.findIndex((f) => f.id === plan.serverFloorId))
  const serverFloor = plan.floors[serverFloorIndex] ?? plan.floors[0]

  const preferredAp = plan.preferredApProductId ? catalog.find((p) => p.id === plan.preferredApProductId) : undefined
  const preferredSwitch = plan.preferredSwitchProductId ? catalog.find((p) => p.id === plan.preferredSwitchProductId) : undefined
  const preferredRouter = plan.preferredRouterProductId ? catalog.find((p) => p.id === plan.preferredRouterProductId) : undefined
  const preferredController = plan.preferredControllerProductId
    ? catalog.find((p) => p.id === plan.preferredControllerProductId)
    : undefined

  const perFloor: FloorResult[] = plan.floors.map((floor, floorIndex) => {
    const worstRank = floor.rooms.reduce((rank, room) => Math.max(rank, MATERIAL_RANK[room.wallMaterial]), 0)
    const radius = RADIUS_BY_RANK[worstRank]

    const aps: APPlacement[] = floor.aps.map((placed) => ({
      id: placed.id,
      pos: placed.pos,
      radius,
      cableLengthM: manhattan(placed.pos, floor.switchPoint) * CABLE_SLACK + DROP_ALLOWANCE_M,
    }))

    const apTier = TIER_BY_RANK[worstRank]
    const apProduct = aps.length === 0 ? undefined : (preferredAp ?? findProduct(catalog, AP_ID_BY_TIER[apTier], 'ap', apTier))
    if (aps.length > 0 && !apProduct) {
      warnings.push(`Этаж «${floor.name}»: в каталоге нет подходящей точки доступа.`)
    }

    const portsNeeded = Math.ceil(aps.length * 1.15)
    const { product: switchProduct, qty: switchQty } = pickSwitch(catalog, portsNeeded, preferredSwitch)
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
  const routerProduct = totalAPCount === 0 ? undefined : (preferredRouter ?? findProduct(catalog, routerId, 'router', routerTier))
  if (totalAPCount > 0 && !routerProduct) {
    warnings.push('В каталоге нет подходящего роутера/шлюза.')
  }

  // Оверрайд из Дизайнера сам решает, нужен ли контроллер (он приходит только для
  // экосистем с Omada) — в этом режиме не подсовываем свой TP-Link-контроллер,
  // если Дизайнер для этого сегмента его не выбирал.
  const isOverridden = Boolean(preferredAp || preferredSwitch || preferredRouter)
  const controllerProduct =
    totalAPCount > 1
      ? (preferredController ?? (isOverridden ? undefined : findProduct(catalog, 'tpl-oc200', 'other', 'budget')))
      : undefined

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
  // Через цветовые переменные Tailwind, чтобы заливка комнат следовала теме «день/ночь».
  return {
    open: 'var(--color-slate-200, #e2e8f0)',
    drywall: 'var(--color-blue-200, #bfdbfe)',
    brick: 'var(--color-amber-200, #fde68a)',
    concrete: 'var(--color-slate-300, #cbd5e1)',
  }[m]
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

    floors.push({ id: floorId, name: `Этаж ${i + 1}`, heightM: params.floorHeightM, rooms, aps: autoPlaceAPs(rooms), switchPoint })
  }

  return { floors, serverFloorId: floors[0].id }
}

function round1(v: number) {
  return Math.round(v * 10) / 10
}

/**
 * Строит чертёж этажей по РЕАЛЬНЫМ промерам (длина/ширина/высота/номера),
 * которые уже ввели в «Подборе по объекту» — в отличие от generateFloorPlan,
 * не подбирает форму под площадь, а использует точные размеры каждого этажа.
 * Так план из Дизайнера и план в «Плане здания» совпадают без повторного ввода.
 */
export function generateFloorPlanFromDesigner(
  buildingType: BuildingType,
  wallMaterial: WallMaterial,
  floors: { lengthM: number; widthM: number; ceilingHeightM: number; rooms: number }[],
  preferred?: {
    apProductId?: string
    switchProductId?: string
    routerProductId?: string
    controllerProductId?: string
  },
): BuildingPlan {
  const isHotelLike = buildingType === 'hotel' || buildingType === 'apartment'
  const resultFloors: Floor[] = floors.map((f, i) => {
    const floorId = `floor-${i}`
    const w = clampNum(f.widthM, 4, CANVAS_W_M)
    const h = clampNum(f.lengthM, 4, CANVAS_H_M)
    let rooms: Room[]
    let switchPoint: Point

    if (isHotelLike && f.rooms > 0) {
      const n = Math.round(f.rooms)
      const roomsPerSide = Math.ceil(n / 2)
      const corridorWidth = 2.4
      const roomDepth = clampNum((h - corridorWidth) / 2, 3, 8)
      const roomWidth = clampNum(w / roomsPerSide - 0.1, 3, 5.5)

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
          wallMaterial,
        })
      }
      switchPoint = { x: round1((roomsPerSide * roomWidth) / 2), y: round1(roomDepth + corridorWidth / 2) }
    } else {
      rooms = [
        {
          id: `${floorId}-room-0`,
          name: 'Открытое пространство',
          x: 0,
          y: 0,
          w: round1(w),
          h: round1(h),
          wallMaterial,
        },
      ]
      switchPoint = { x: round1(w / 2), y: round1(h / 2) }
    }

    return { id: floorId, name: `Этаж ${i + 1}`, heightM: f.ceilingHeightM, rooms, aps: autoPlaceAPs(rooms), switchPoint }
  })

  return {
    floors: resultFloors,
    serverFloorId: resultFloors[0].id,
    preferredApProductId: preferred?.apProductId,
    preferredSwitchProductId: preferred?.switchProductId,
    preferredRouterProductId: preferred?.routerProductId,
    preferredControllerProductId: preferred?.controllerProductId,
  }
}
