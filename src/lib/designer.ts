import type { Product } from '../types'

export type WallMaterial = 'open' | 'drywall' | 'brick' | 'concrete'
export type BuildingType = 'office' | 'retail' | 'warehouse' | 'hotel' | 'apartment'
export type CameraTier = 'none' | 'budget' | 'standard' | 'premium'

export interface DesignerInput {
  buildingType: BuildingType
  totalAreaM2: number
  floors: number
  wallMaterial: WallMaterial
  /** Компьютеры, ноутбуки — тяжёлый трафик (видеозвонки, передача файлов, VPN) */
  workstations: number
  /** Телефоны, планшеты и прочие лёгкие онлайн-устройства */
  mobileDevices: number
  outdoorCoverage: boolean
  cameraTier: CameraTier
  cameraCount: number
  cameraBrand: 'Hikvision' | 'Dahua'
}

export interface DesignerLine {
  role: string
  product?: Product
  qty: number
  reason: string
}

export interface DesignerResult {
  lines: DesignerLine[]
  apCount: number
  warnings: string[]
  totalUSD: number
}

const AREA_PER_AP: Record<WallMaterial, number> = {
  open: 150,
  drywall: 120,
  brick: 90,
  concrete: 70,
}

const DEVICE_CAPACITY_PER_AP = 25
const POE_PORT_HEADROOM = 1.15
/** Рабочее место (ПК/ноутбук) нагружает Wi-Fi заметно сильнее телефона — учитываем это при выборе уровня точки доступа. */
const WORKSTATION_LOAD_WEIGHT = 1.6

/**
 * Ищет товар по id, а если он был удалён/переименован в каталоге — берёт
 * любой товар TP-Link той же категории и ценового уровня. Подбор всегда
 * держится бренда TP-Link, чтобы предложение оставалось единой линейкой
 * Omada, а не миксом случайных брендов.
 */
function findProduct(catalog: Product[], id: string, category: Product['category'], tier: 'budget' | 'mid' | 'premium') {
  const byId = catalog.find((p) => p.id === id)
  if (byId) return byId
  const tplCategory = catalog.filter((p) => p.brand === 'TP-Link' && p.category === category)
  const sameTier = tplCategory.find((p) => p.priceCategory === tier)
  return sameTier ?? tplCategory[0]
}

export function designNetwork(input: DesignerInput, catalog: Product[]): DesignerResult {
  const warnings: string[] = []
  const concurrentDevices = input.workstations + input.mobileDevices
  const areaPerAP = AREA_PER_AP[input.wallMaterial]
  const areaPerFloor = input.totalAreaM2 / Math.max(1, input.floors)
  const apsPerFloor = Math.max(1, Math.ceil(areaPerFloor / areaPerAP))
  let apCount = apsPerFloor * input.floors

  const apsByDevices = Math.ceil(concurrentDevices / DEVICE_CAPACITY_PER_AP)
  if (apsByDevices > apCount) {
    apCount = apsByDevices
  }

  const outdoorAPs = input.outdoorCoverage ? Math.max(2, Math.ceil(input.floors / 2)) : 0

  // Выбор модели точки доступа: площадь/материал стен + плотность клиентов,
  // где рабочие места (видеозвонки, VPN, передача файлов) весят тяжелее телефонов
  const weightedLoad = input.workstations * WORKSTATION_LOAD_WEIGHT + input.mobileDevices
  const loadPerAP = weightedLoad / Math.max(1, apCount)
  let apTier: 'budget' | 'mid' | 'premium' = 'budget'
  if (loadPerAP > 25 || areaPerAP >= 150) apTier = 'premium'
  else if (loadPerAP > 12 || input.wallMaterial !== 'open') apTier = 'mid'
  const apIdByTier = { budget: 'tpl-eap225', mid: 'tpl-eap670', premium: 'tpl-eap660-hd' } as const
  const apProduct = findProduct(catalog, apIdByTier[apTier], 'ap', apTier)

  const lines: DesignerLine[] = []

  if (apProduct) {
    lines.push({
      role: 'Точки доступа Wi-Fi (в помещении)',
      product: apProduct,
      qty: apCount,
      reason: `${input.floors} эт. × ~${apsPerFloor} AP/этаж по покрытию (${areaPerAP} м²/точка для стен «${wallMaterialLabel(input.wallMaterial)}»), с учётом ${input.workstations} рабочих мест и ${input.mobileDevices} мобильных устройств`,
    })
  } else {
    warnings.push('В каталоге нет подходящей точки доступа — добавьте товары категории «Точка доступа» в «Каталог».')
  }

  if (outdoorAPs > 0) {
    const outdoorProduct = findProduct(catalog, 'tpl-eap225-outdoor', 'ap', 'mid')
    if (outdoorProduct) {
      lines.push({
        role: 'Точки доступа для улицы/двора',
        product: outdoorProduct,
        qty: outdoorAPs,
        reason: 'Ориентировочно, для покрытия прилегающей территории (уточняйте по факту периметра)',
      })
    }
  }

  // Коммутация: под AP + под камеры, с запасом
  const cameraCount = input.cameraTier === 'none' ? 0 : input.cameraCount
  const poePortsNeeded = Math.ceil((apCount + outdoorAPs + cameraCount) * POE_PORT_HEADROOM)

  if (poePortsNeeded > 0) {
    if (poePortsNeeded <= 8) {
      const sw = findProduct(catalog, 'tpl-sg2210p', 'switch', 'budget')
      if (sw) lines.push({ role: 'PoE-коммутатор', product: sw, qty: 1, reason: `Нужно ~${poePortsNeeded} PoE-портов с запасом` })
    } else {
      const swCount = Math.ceil(poePortsNeeded / 24)
      const sw = findProduct(catalog, 'tpl-sg3428mp', 'switch', 'mid')
      if (sw) {
        lines.push({
          role: 'PoE-коммутатор',
          product: sw,
          qty: swCount,
          reason: `Нужно ~${poePortsNeeded} PoE-портов с запасом (24 порта на коммутатор)`,
        })
      }
    }
  }

  // Роутер/шлюз по количеству пользователей
  let routerTier: 'budget' | 'mid' | 'premium' = 'budget'
  let routerId = 'tpl-er605'
  if (concurrentDevices > 150) {
    routerTier = 'premium'
    routerId = 'tpl-er8411'
  } else if (concurrentDevices > 50) {
    routerTier = 'mid'
    routerId = 'tpl-er7206'
  }
  const router = findProduct(catalog, routerId, 'router', routerTier)
  if (router) {
    lines.push({
      role: 'Роутер / шлюз',
      product: router,
      qty: 1,
      reason: `Расчёт на ~${concurrentDevices} одновременных пользователей сети (${input.workstations} рабочих мест + ${input.mobileDevices} мобильных)`,
    })
  }

  // Контроллер Omada — для централизованной настройки и автоматического роуминга между AP
  if (apCount + outdoorAPs > 1) {
    const controller = findProduct(catalog, 'tpl-oc200', 'other', 'budget')
    if (controller) {
      lines.push({
        role: 'Контроллер сети (аналог Omada Designer)',
        product: controller,
        qty: 1,
        reason: 'Централизованная настройка и мониторинг всех точек доступа и коммутаторов из одного приложения',
      })
    }
  }

  // Камеры и NVR
  if (input.cameraTier !== 'none' && cameraCount > 0) {
    const cameraTierMap: Record<Exclude<CameraTier, 'none'>, 'budget' | 'mid' | 'premium'> = {
      budget: 'budget',
      standard: 'mid',
      premium: 'premium',
    }
    const priceTier = cameraTierMap[input.cameraTier]
    const cameraPool = catalog.filter((p) => p.category === 'camera' && p.brand === input.cameraBrand)
    const camera = cameraPool.find((p) => p.priceCategory === priceTier) ?? cameraPool[0]
    if (camera) {
      lines.push({ role: 'IP-камеры', product: camera, qty: cameraCount, reason: `Выбрано по бренду ${input.cameraBrand} и уровню «${cameraTierLabel(input.cameraTier)}»` })
    } else {
      warnings.push(`В каталоге нет камер бренда ${input.cameraBrand} — добавьте их в «Каталог».`)
    }

    const nvrPool = catalog.filter((p) => p.category === 'nvr' && p.brand === input.cameraBrand)
    const nvr = nvrPool.find((p) => {
      const channelsStr = p.specs['Каналы'] ?? ''
      const channels = parseInt(channelsStr, 10)
      return !Number.isNaN(channels) && channels >= cameraCount
    }) ?? nvrPool.sort((a, b) => b.priceUSD - a.priceUSD)[0]
    if (nvr) {
      lines.push({ role: 'Видеорегистратор (NVR)', product: nvr, qty: 1, reason: `Нужно не менее ${cameraCount} каналов` })
    } else {
      warnings.push('В каталоге нет подходящего NVR на нужное число каналов.')
    }
  }

  const totalUSD = lines.reduce((sum, l) => sum + (l.product ? l.product.priceUSD * l.qty : 0), 0)

  return { lines, apCount: apCount + outdoorAPs, warnings, totalUSD }
}

export function wallMaterialLabel(m: WallMaterial) {
  return { open: 'открытое пространство', drywall: 'гипсокартон', brick: 'кирпич', concrete: 'бетон/ж/б' }[m]
}

export function cameraTierLabel(t: CameraTier) {
  return { none: 'без камер', budget: 'бюджетный', standard: 'стандартный', premium: 'премиум (ИИ-аналитика)' }[t]
}
