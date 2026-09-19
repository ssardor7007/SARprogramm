import { CATEGORY_LABELS, type Brand, type PriceCategory, type Product } from '../types'

export type WallMaterial = 'open' | 'drywall' | 'brick' | 'concrete'
export type Tier = PriceCategory
/** 'all' — подбирать лучший вариант по цене среди всех брендов (как раньше); конкретный бренд — держать все три сегмента на его оборудовании, где это возможно. */
export type BrandFilter = Brand | 'all'
/** 'any' — не фильтровать по способу установки; иначе исключать точки доступа другого явно указанного монтажа. */
export type ApMountType = 'any' | 'ceiling' | 'wall' | 'outdoor'

export const AP_MOUNT_LABELS: Record<ApMountType, string> = {
  any: 'Любой (авто)',
  ceiling: 'Потолочная',
  wall: 'Настенная',
  outdoor: 'Наружная',
}

export const TIER_LABELS: Record<Tier, string> = {
  budget: 'Бюджетный',
  mid: 'Оптимальный',
  premium: 'Премиум',
}
export type BuildingType = 'office' | 'retail' | 'warehouse' | 'hotel' | 'apartment'
export type CameraTier = 'none' | 'budget' | 'standard' | 'premium'

export const BUILDING_TYPE_LABELS: Record<BuildingType, string> = {
  office: 'Офис',
  retail: 'Магазин / торговый зал',
  warehouse: 'Склад',
  hotel: 'Гостиница',
  apartment: 'Жилой дом',
}

export interface DesignerInput {
  buildingType: BuildingType
  /** Площадь каждого этажа отдельно, м² — длина массива = число этажей. */
  floorAreas: number[]
  wallMaterial: WallMaterial
  /** Для гостиниц/апартаментов: номеров на одном этаже — уточняет расчёт точек доступа по коридору */
  roomsPerFloor: number
  /** Компьютеры, ноутбуки — тяжёлый трафик (видеозвонки, передача файлов, VPN) */
  workstations: number
  /** Телефоны, планшеты и прочие лёгкие онлайн-устройства */
  mobileDevices: number
  outdoorCoverage: boolean
  cameraTier: CameraTier
  cameraCount: number
  cameraBrand: 'Hikvision' | 'Dahua'
  /** Если выбран конкретный бренд — все три сегмента подбираются на его оборудовании (там, где оно есть в каталоге). */
  preferredBrand: BrandFilter
  /** Способ установки точки доступа — потолочная или настенная. По умолчанию не фильтруем. */
  apMountType: ApMountType
  /** Бюджет клиента, $. 0 или не задан — без ограничения. Не меняет сами сегменты, а помечает, какие в него укладываются, и двигает рекомендацию. */
  maxBudgetUSD: number
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

export const AREA_PER_AP: Record<WallMaterial, number> = {
  open: 150,
  drywall: 120,
  brick: 90,
  concrete: 70,
}

/** Номеров гостиницы, которые уверенно накрывает одна точка доступа в коридоре — зависит от толщины стен между номерами */
const ROOMS_PER_AP: Record<WallMaterial, number> = {
  open: 8,
  drywall: 6,
  brick: 5,
  concrete: 4,
}

const POE_PORT_HEADROOM = 1.15

/**
 * Ищет товар по id, а если он был удалён/переименован в каталоге — берёт
 * любой товар TP-Link той же категории и ценового уровня. Подбор всегда
 * держится бренда TP-Link, чтобы предложение оставалось единой линейкой
 * Omada, а не миксом случайных брендов.
 */
export function findProduct(catalog: Product[], id: string, category: Product['category'], tier: 'budget' | 'mid' | 'premium') {
  const byId = catalog.find((p) => p.id === id)
  if (byId) return byId
  const tplCategory = catalog.filter((p) => p.brand === 'TP-Link' && p.category === category)
  const sameTier = tplCategory.find((p) => p.priceCategory === tier)
  return sameTier ?? tplCategory[0]
}

/**
 * В каталоге категория «switch» вперемешку содержит и PoE-коммутаторы, и
 * обычные (без PoE). В этом приложении коммутатор всегда подбирается на
 * роль «PoE-коммутатор» — питать точки доступа/камеры, — поэтому пул нужно
 * сузить до моделей, у которых PoE реально есть, иначе подбор может выдать
 * коммутатор без единого PoE-порта.
 */
function isPoeSwitch(p: Product): boolean {
  return /PoE/i.test(p.specs['Характеристики'] ?? '')
}

type ApMountKind = 'ceiling' | 'wall' | 'outdoor' | 'desktop' | 'indoor' | 'unspecified'

/** Способ установки, который явно следует из модели/описания точки доступа — если он вообще указан. */
function classifyApMount(p: Product): ApMountKind {
  const text = `${p.model} ${p.specs['Характеристики'] ?? ''}`
  if (/wall|настенн/i.test(text)) return 'wall'
  if (/ceiling|celling|потолочн/i.test(text)) return 'ceiling'
  if (/outdoor|наружн|уличн/i.test(text)) return 'outdoor'
  if (/desktop|настольн/i.test(text)) return 'desktop'
  // «внутренние антенны» — про антенну, не про монтаж, поэтому ищем именно
  // «внутренняя точка доступа»/«indoor», а не голое «внутренн» (\w не берёт
  // кириллицу, поэтому хвост слова матчим явным классом символов).
  if (/\bindoor\b|внутренн[а-яё]*\s+точ(?:ка|ку|ки)/i.test(text)) return 'indoor'
  return 'unspecified'
}

/**
 * Точку доступа без явно указанного способа установки в каталоге не отсекаем
 * (нет данных — не спорим). С явно указанным монтажом, не совпадающим с
 * выбором клиента, — исключаем; «просто внутренняя» точка доступа (без
 * уточнения потолок/стена) годится под оба комнатных варианта, но не под
 * уличный.
 */
function matchesApMount(p: Product, mountType: ApMountType): boolean {
  if (mountType === 'any') return true
  const kind = classifyApMount(p)
  if (kind === mountType || kind === 'unspecified') return true
  if (kind === 'indoor') return mountType === 'ceiling' || mountType === 'wall'
  return false
}

/** Сужает пул кандидатов под жёсткие требования роли: PoE у коммутатора, способ установки у точки доступа. */
function narrowPool(pool: Product[], category: Product['category'], apMountType: ApMountType): Product[] {
  if (category === 'switch') {
    const poeOnly = pool.filter(isPoeSwitch)
    if (poeOnly.length > 0) pool = poeOnly
  }
  if (category === 'ap' && apMountType !== 'any') {
    const matched = pool.filter((p) => matchesApMount(p, apMountType))
    if (matched.length > 0) pool = matched
  }
  return pool
}

/**
 * Подбирает товар нужной категории и ценового сегмента среди ВСЕХ брендов
 * площадки (не только TP-Link) — так бюджетный, оптимальный и премиум
 * пакеты естественно расходятся по разным брендам, как в реальной практике
 * рынка. В премиум-сегменте при наличии предпочитаем Ubiquiti — это
 * узнаваемый премиальный бренд у клиентов.
 */
export function pickTierProduct(
  catalog: Product[],
  category: Product['category'],
  tier: Tier,
  apMountType: ApMountType = 'any',
): Product | undefined {
  const pool = narrowPool(
    catalog.filter((p) => p.category === category && p.priceCategory === tier),
    category,
    apMountType,
  )
  if (pool.length === 0) return undefined
  if (tier === 'premium') {
    const ubiquiti = pool.filter((p) => p.brand === 'Ubiquiti (UniFi)').sort((a, b) => a.priceUSD - b.priceUSD)
    if (ubiquiti.length > 0) return ubiquiti[0]
  }
  return [...pool].sort((a, b) => a.priceUSD - b.priceUSD)[0]
}

interface BrandPick {
  product?: Product
  note?: string
}

/**
 * То же самое, что pickTierProduct, но с учётом выбора конкретного бренда клиентом.
 * Сначала ищет модель нужного сегмента именно у этого бренда; если у бренда нет модели
 * ровно этого сегмента — берёт ближайшую по цене модель того же бренда; если у бренда
 * вообще нет товаров этой категории — откатывается на обычный кросс-брендовый подбор
 * и явно предупреждает, что бренд пришлось заменить.
 */
function pickForTierAndBrand(
  catalog: Product[],
  category: Product['category'],
  tier: Tier,
  preferredBrand: BrandFilter,
  apMountType: ApMountType = 'any',
): BrandPick {
  if (preferredBrand === 'all') {
    return { product: pickTierProduct(catalog, category, tier, apMountType) }
  }
  const brandPool = narrowPool(
    catalog.filter((p) => p.category === category && p.brand === preferredBrand),
    category,
    apMountType,
  )
  if (brandPool.length === 0) {
    return {
      product: pickTierProduct(catalog, category, tier, apMountType),
      note: `У бренда ${preferredBrand} нет позиции «${CATEGORY_LABELS[category]}» в каталоге — подобран аналог другого бренда.`,
    }
  }
  const exact = brandPool.filter((p) => p.priceCategory === tier).sort((a, b) => a.priceUSD - b.priceUSD)
  if (exact.length > 0) return { product: exact[0] }
  const sorted = [...brandPool].sort((a, b) => a.priceUSD - b.priceUSD)
  return {
    product: sorted[Math.floor(sorted.length / 2)],
    note: `У бренда ${preferredBrand} нет модели уровня «${TIER_LABELS[tier]}» для «${CATEGORY_LABELS[category]}» — предложена ближайшая по цене модель этого же бренда.`,
  }
}

/** Сколько устройств уверенно обслуживает одна точка доступа в этом сегменте — бюджетные модели слабее, премиум держит больше клиентов. */
const DEVICE_CAPACITY_BY_TIER: Record<Tier, number> = { budget: 15, mid: 25, premium: 45 }
/** Порог одновременных пользователей, после которого роутер этого сегмента уже работает на пределе. */
const ROUTER_LOAD_CAP: Record<Tier, number> = { budget: 40, mid: 150, premium: Infinity }

export interface TierResult extends DesignerResult {
  tier: Tier
  tierLabel: string
  /** Бренды точек доступа/коммутатора/роутера, вошедшие в этот пакет */
  brands: string[]
  /** Метрика для сравнения пакетов между собой: цена на одного одновременного клиента */
  usdPerClient: number
  /** Укладывается ли итоговая сумма в бюджет клиента (input.maxBudgetUSD). true, если бюджет не задан. */
  fitsBudget: boolean
  /** На сколько $ сегмент превышает заданный бюджет — 0, если укладывается или бюджет не задан. */
  overBudgetUSD: number
}

export interface DesignerTiersResult {
  tiers: TierResult[]
  recommendedTier: Tier
  recommendationReason: string
  concurrentDevices: number
}

function designTier(input: DesignerInput, catalog: Product[], tier: Tier): TierResult {
  const warnings: string[] = []
  const concurrentDevices = input.workstations + input.mobileDevices
  const floors = Math.max(1, input.floorAreas.length)
  const areaPerAP = AREA_PER_AP[input.wallMaterial]

  const isHotelLike = input.buildingType === 'hotel' || input.buildingType === 'apartment'
  const apsPerFloorByRooms =
    isHotelLike && input.roomsPerFloor > 0 ? Math.ceil(input.roomsPerFloor / ROOMS_PER_AP[input.wallMaterial]) : 0

  // Считаем точки доступа отдельно на каждый этаж по его собственной площади,
  // а не по средней площади здания — у этажей разного размера разная потребность.
  const floorPlan = input.floorAreas.map((areaM2, i) => {
    const apsByArea = Math.max(1, Math.ceil(areaM2 / areaPerAP))
    const aps = Math.max(apsByArea, apsPerFloorByRooms)
    return { floorNo: i + 1, areaM2, aps }
  })
  let apCount = floorPlan.reduce((sum, f) => sum + f.aps, 0)

  const apsByDevices = Math.ceil(concurrentDevices / DEVICE_CAPACITY_BY_TIER[tier])
  if (apsByDevices > apCount) apCount = apsByDevices

  const outdoorAPs = input.outdoorCoverage ? Math.max(2, Math.ceil(floors / 2)) : 0

  const { product: apProduct, note: apNote } = pickForTierAndBrand(catalog, 'ap', tier, input.preferredBrand, input.apMountType)
  const lines: DesignerLine[] = []
  const brands = new Set<string>()
  if (apNote) warnings.push(apNote)
  if (apProduct && input.apMountType !== 'any' && !matchesApMount(apProduct, input.apMountType)) {
    warnings.push(
      `Нет подходящей точки доступа монтажа «${AP_MOUNT_LABELS[input.apMountType]}» в этом сегменте — предложена ближайшая по цене/бренду модель.`,
    )
  }

  if (apProduct) {
    brands.add(apProduct.brand)
    const perFloorText = floorPlan.map((f) => `эт.${f.floorNo}: ${f.areaM2} м² → ${f.aps} AP`).join(', ')
    const coverageReason =
      apsPerFloorByRooms > 0
        ? `не менее ${input.roomsPerFloor} номеров/этаж ÷ ~${ROOMS_PER_AP[input.wallMaterial]} номеров на точку`
        : `по площади каждого этажа ÷ ${areaPerAP} м²/точка`
    lines.push({
      role: 'Точки доступа Wi-Fi',
      product: apProduct,
      qty: apCount,
      reason: `${perFloorText} (${coverageReason}) — до ${DEVICE_CAPACITY_BY_TIER[tier]} устройств на точку в этом сегменте, всего ${concurrentDevices} одновременных клиентов`,
    })
  } else {
    warnings.push(`В сегменте «${TIER_LABELS[tier]}» нет точки доступа в каталоге.`)
  }

  if (outdoorAPs > 0) {
    const { product: outdoorProduct, note: outdoorNote } = pickForTierAndBrand(catalog, 'ap', tier, input.preferredBrand, 'outdoor')
    if (outdoorNote) warnings.push(outdoorNote)
    if (outdoorProduct) {
      brands.add(outdoorProduct.brand)
      lines.push({
        role: 'Точки доступа для улицы/двора',
        product: outdoorProduct,
        qty: outdoorAPs,
        reason: 'Ориентировочно, для покрытия прилегающей территории — модель с уличным (наружным) исполнением',
      })
    }
  }

  const cameraCount = input.cameraTier === 'none' ? 0 : input.cameraCount
  const poePortsNeeded = Math.ceil((apCount + outdoorAPs + cameraCount) * POE_PORT_HEADROOM)

  if (poePortsNeeded > 0) {
    const swCount = poePortsNeeded <= 8 ? 1 : Math.ceil(poePortsNeeded / 24)
    const { product: sw, note: swNote } = pickForTierAndBrand(catalog, 'switch', tier, input.preferredBrand)
    if (swNote) warnings.push(swNote)
    if (sw) {
      brands.add(sw.brand)
      lines.push({
        role: 'PoE-коммутатор',
        product: sw,
        qty: swCount,
        reason: `Нужно ~${poePortsNeeded} PoE-портов с запасом`,
      })
    } else {
      warnings.push(`В сегменте «${TIER_LABELS[tier]}» нет коммутатора в каталоге.`)
    }
  }

  const { product: router, note: routerNote } = pickForTierAndBrand(catalog, 'router', tier, input.preferredBrand)
  if (routerNote) warnings.push(routerNote)
  if (router) {
    brands.add(router.brand)
    lines.push({
      role: 'Роутер / шлюз',
      product: router,
      qty: 1,
      reason: `Расчёт на ~${concurrentDevices} одновременных пользователей сети`,
    })
    if (concurrentDevices > ROUTER_LOAD_CAP[tier]) {
      warnings.push(
        `При ~${concurrentDevices} одновременных клиентах роутер сегмента «${TIER_LABELS[tier]}» работает на пределе — возможны просадки в пиковой нагрузке.`,
      )
    }
  } else {
    warnings.push(`В сегменте «${TIER_LABELS[tier]}» нет роутера в каталоге.`)
  }

  if (apProduct?.brand === 'TP-Link' && apCount + outdoorAPs > 1) {
    const controller = findProduct(catalog, 'tpl-oc200', 'other', 'budget')
    if (controller) {
      lines.push({
        role: 'Контроллер сети (Omada)',
        product: controller,
        qty: 1,
        reason: 'Централизованная настройка и роуминг между точками доступа',
      })
    }
  }

  if (input.cameraTier !== 'none' && cameraCount > 0) {
    const cameraTierMap: Record<Exclude<CameraTier, 'none'>, Tier> = { budget: 'budget', standard: 'mid', premium: 'premium' }
    const priceTier = cameraTierMap[input.cameraTier]
    const cameraPool = catalog.filter((p) => p.category === 'camera' && p.brand === input.cameraBrand)
    const camera = cameraPool.find((p) => p.priceCategory === priceTier) ?? cameraPool[0]
    if (camera) {
      brands.add(camera.brand)
      lines.push({ role: 'IP-камеры', product: camera, qty: cameraCount, reason: `Бренд ${input.cameraBrand}, уровень «${cameraTierLabel(input.cameraTier)}»` })
    }
    const nvrPool = catalog.filter((p) => p.category === 'nvr' && p.brand === input.cameraBrand)
    const nvr = nvrPool.find((p) => {
      const channels = parseInt(p.specs['Каналы'] ?? '', 10)
      return !Number.isNaN(channels) && channels >= cameraCount
    }) ?? nvrPool.sort((a, b) => b.priceUSD - a.priceUSD)[0]
    if (nvr) lines.push({ role: 'Видеорегистратор (NVR)', product: nvr, qty: 1, reason: `Нужно не менее ${cameraCount} каналов` })
  }

  const totalUSD = lines.reduce((sum, l) => sum + (l.product ? l.product.priceUSD * l.qty : 0), 0)
  const totalApCount = apCount + outdoorAPs
  const overBudgetUSD = input.maxBudgetUSD > 0 ? Math.max(0, totalUSD - input.maxBudgetUSD) : 0

  return {
    tier,
    tierLabel: TIER_LABELS[tier],
    lines,
    apCount: totalApCount,
    warnings,
    totalUSD,
    brands: Array.from(brands),
    usdPerClient: concurrentDevices > 0 ? totalUSD / concurrentDevices : totalUSD,
    fitsBudget: overBudgetUSD === 0,
    overBudgetUSD,
  }
}

/**
 * Считает объект сразу в трёх сегментах (бюджет/оптимум/премиум) на разных
 * брендах и подсказывает, какой вариант оптимален под введённый трафик —
 * как просит монтажник: ввёл объект и нагрузку, получил три готовых
 * коммерческих предложения и рекомендацию.
 */
export function designNetworkTiers(input: DesignerInput, catalog: Product[]): DesignerTiersResult {
  const concurrentDevices = input.workstations + input.mobileDevices
  const tiers: TierResult[] = (['budget', 'mid', 'premium'] as Tier[]).map((tier) => designTier(input, catalog, tier))
  const [budgetTier, midTier, premiumTier] = tiers

  let recommendedTier: Tier = 'mid'
  let recommendationReason = `При ~${concurrentDevices} одновременных клиентах оптимальный сегмент даёт лучший баланс цены и запаса по нагрузке.`

  if (concurrentDevices <= 20) {
    recommendedTier = 'budget'
    recommendationReason = `Всего ~${concurrentDevices} одновременных клиентов — бюджетный сегмент (${budgetTier.brands.join(', ')}) полностью справится, не переплачивайте.`
  } else if (concurrentDevices > 80) {
    recommendedTier = 'premium'
    recommendationReason = `При ~${concurrentDevices} одновременных клиентах нужен запас по стабильности — премиум-сегмент (${premiumTier.brands.join(', ')}) держит нагрузку с запасом.`
  } else if (budgetTier.apCount > premiumTier.apCount * 1.5 && midTier.totalUSD < budgetTier.totalUSD * 1.3) {
    recommendedTier = 'mid'
    recommendationReason = `Бюджетному сегменту нужно ${budgetTier.apCount} точек доступа против ${midTier.apCount} в оптимальном — при похожей цене оптимальный сегмент (${midTier.brands.join(', ')}) выгоднее и проще в обслуживании.`
  } else {
    recommendationReason = `При ~${concurrentDevices} одновременных клиентах оптимальный сегмент (${midTier.brands.join(', ')}) — лучшее сочетание цены и запаса по нагрузке.`
  }

  // Бюджет клиента может перебить рекомендацию по нагрузке: берём самый
  // «богатый» сегмент, который в него укладывается, а не просто следующий
  // по нагрузке — премиум ценнее оптимального, если оба укладываются.
  if (input.maxBudgetUSD > 0) {
    const richnessOrder: Tier[] = ['premium', 'mid', 'budget']
    const bestFitting = richnessOrder.find((t) => tiers.find((r) => r.tier === t)!.fitsBudget)
    const budgetText = `$${input.maxBudgetUSD.toLocaleString()}`

    if (!bestFitting) {
      recommendedTier = 'budget'
      recommendationReason = `Даже бюджетный сегмент ($${budgetTier.totalUSD.toLocaleString()}) выходит за рамки бюджета ${budgetText} — это минимальная цена рабочего решения под эти параметры.`
    } else if (bestFitting !== recommendedTier) {
      const chosen = tiers.find((r) => r.tier === bestFitting)!
      recommendedTier = bestFitting
      recommendationReason = `С учётом бюджета ${budgetText} — сегмент «${chosen.tierLabel}» (${chosen.brands.join(', ')}, $${chosen.totalUSD.toLocaleString()}) лучший вариант, который в него укладывается.`
    } else {
      const chosen = tiers.find((r) => r.tier === recommendedTier)!
      recommendationReason += ` Укладывается в бюджет ${budgetText} (стоимость $${chosen.totalUSD.toLocaleString()}).`
    }
  }

  return { tiers, recommendedTier, recommendationReason, concurrentDevices }
}

export function wallMaterialLabel(m: WallMaterial) {
  return { open: 'открытое пространство', drywall: 'гипсокартон', brick: 'кирпич', concrete: 'бетон/ж/б' }[m]
}

export function cameraTierLabel(t: CameraTier) {
  return { none: 'без камер', budget: 'бюджетный', standard: 'стандартный', premium: 'премиум (ИИ-аналитика)' }[t]
}
