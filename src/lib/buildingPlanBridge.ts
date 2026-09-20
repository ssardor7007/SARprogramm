import { generateFloorPlanFromDesigner } from './buildingPlan'
import type { BuildingType, WallMaterial } from './designer'

const STORAGE_KEY = 'sar-net-compare:building-plan'

/**
 * Строит чертёж по промерам, уже введённым в «Подборе по объекту», и сохраняет
 * его туда же, откуда читает «План здания» (usePersistedState('building-plan', …)),
 * так что при переключении вкладки план уже готов — без повторного ввода размеров.
 */
export function sendDesignToBuildingPlan(
  buildingType: BuildingType,
  wallMaterial: WallMaterial,
  floors: { lengthM: number; widthM: number; ceilingHeightM: number; rooms: number }[],
  preferred?: {
    apProductId?: string
    switchProductId?: string
    routerProductId?: string
    controllerProductId?: string
  },
) {
  const plan = generateFloorPlanFromDesigner(buildingType, wallMaterial, floors, preferred)
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(plan))
  } catch {
    // хранилище недоступно (приватный режим и т.п.) — молча игнорируем
  }
}
