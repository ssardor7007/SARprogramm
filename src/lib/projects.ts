import type { BuildingPlan } from './buildingPlan'
import type { DesignerInput } from './designer'
import type { RackLine } from './rackCart'
import { genId, load, loadOptional, remove, save } from './storage'
import type { Brand } from '../types'

export interface ProjectMeta {
  id: string
  name: string
  updatedAt: number
}

interface ProjectSnapshot {
  designerInput?: DesignerInput
  selectedBrands?: Brand[]
  buildingPlan?: BuildingPlan
  rackHeight?: number
  rackLines?: RackLine[]
}

/**
 * «Живые» ключи — то же самое localStorage-хранилище, которое уже читают usePersistedState-хуки
 * в DesignerView/BuildingPlanView/RackWorkspace. Переключение проекта не трогает их API — просто
 * подменяет содержимое этих ключей на снимок нужного проекта и перезагружает страницу, чтобы все
 * компоненты перечитали своё состояние заново.
 */
const LIVE_KEYS = {
  designerInput: 'designer-input',
  selectedBrands: 'designer-selected-brands',
  buildingPlan: 'building-plan',
  rackHeight: 'rack-height',
  rackLines: 'rack-lines',
} as const

const PROJECTS_KEY = 'projects'
const ACTIVE_KEY = 'active-project'

function dataKey(id: string) {
  return `project:${id}`
}

function snapshotLive(): ProjectSnapshot {
  return {
    designerInput: loadOptional(LIVE_KEYS.designerInput),
    selectedBrands: loadOptional(LIVE_KEYS.selectedBrands),
    buildingPlan: loadOptional(LIVE_KEYS.buildingPlan),
    rackHeight: loadOptional(LIVE_KEYS.rackHeight),
    rackLines: loadOptional(LIVE_KEYS.rackLines),
  }
}

function restoreLive(snapshot: ProjectSnapshot) {
  setOrClear(LIVE_KEYS.designerInput, snapshot.designerInput)
  setOrClear(LIVE_KEYS.selectedBrands, snapshot.selectedBrands)
  setOrClear(LIVE_KEYS.buildingPlan, snapshot.buildingPlan)
  setOrClear(LIVE_KEYS.rackHeight, snapshot.rackHeight)
  setOrClear(LIVE_KEYS.rackLines, snapshot.rackLines)
}

function setOrClear<T>(key: string, value: T | undefined) {
  if (value === undefined) remove(key)
  else save(key, value)
}

function touch(id: string) {
  const list = load<ProjectMeta[]>(PROJECTS_KEY, [])
  save(
    PROJECTS_KEY,
    list.map((p) => (p.id === id ? { ...p, updatedAt: Date.now() } : p)),
  )
}

/** При первом заходе после обновления оборачивает то, что уже накопилось в «живых» ключах
 * (старые пользователи без концепции проектов), в проект «Проект 1» — чтобы никто не потерял работу. */
function ensureBootstrapped() {
  if (load<string>(ACTIVE_KEY, '')) return
  const id = genId('project')
  save(PROJECTS_KEY, [{ id, name: 'Проект 1', updatedAt: Date.now() } satisfies ProjectMeta])
  save(dataKey(id), snapshotLive())
  save(ACTIVE_KEY, id)
}

export function listProjects(): ProjectMeta[] {
  ensureBootstrapped()
  return [...load<ProjectMeta[]>(PROJECTS_KEY, [])].sort((a, b) => b.updatedAt - a.updatedAt)
}

export function getActiveProjectId(): string {
  ensureBootstrapped()
  return load<string>(ACTIVE_KEY, '')
}

/** Сохраняет текущее состояние экрана в активный проект — вызывается перед тем, как с него уйти. */
export function saveActiveSnapshot() {
  const id = getActiveProjectId()
  if (!id) return
  save(dataKey(id), snapshotLive())
  touch(id)
}

export function switchProject(id: string) {
  saveActiveSnapshot()
  restoreLive(load<ProjectSnapshot>(dataKey(id), {}))
  save(ACTIVE_KEY, id)
  touch(id)
}

export function createProject(name: string): ProjectMeta {
  saveActiveSnapshot()
  const meta: ProjectMeta = { id: genId('project'), name: name.trim() || 'Новый проект', updatedAt: Date.now() }
  save(PROJECTS_KEY, [...load<ProjectMeta[]>(PROJECTS_KEY, []), meta])
  save(dataKey(meta.id), {})
  restoreLive({})
  save(ACTIVE_KEY, meta.id)
  return meta
}

export function renameProject(id: string, name: string) {
  const trimmed = name.trim()
  if (!trimmed) return
  const list = load<ProjectMeta[]>(PROJECTS_KEY, [])
  save(
    PROJECTS_KEY,
    list.map((p) => (p.id === id ? { ...p, name: trimmed } : p)),
  )
}

/** Удаляет проект и возвращает id проекта, который стал активным (сам себя, если удалили не активный). */
export function deleteProject(id: string): string {
  const list = load<ProjectMeta[]>(PROJECTS_KEY, [])
  const wasActive = getActiveProjectId() === id
  const rest = list.filter((p) => p.id !== id)
  remove(dataKey(id))

  if (rest.length === 0) {
    const meta: ProjectMeta = { id: genId('project'), name: 'Проект 1', updatedAt: Date.now() }
    save(PROJECTS_KEY, [meta])
    save(dataKey(meta.id), {})
    restoreLive({})
    save(ACTIVE_KEY, meta.id)
    return meta.id
  }

  save(PROJECTS_KEY, rest)
  if (!wasActive) return getActiveProjectId()

  const target = rest[0]
  restoreLive(load<ProjectSnapshot>(dataKey(target.id), {}))
  save(ACTIVE_KEY, target.id)
  return target.id
}
