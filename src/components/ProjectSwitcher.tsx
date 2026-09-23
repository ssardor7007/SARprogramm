import { useState } from 'react'
import { CheckIcon, ChevronDownIcon, FolderIcon } from './NavIcons'
import {
  createProject,
  deleteProject,
  getActiveProjectId,
  listProjects,
  renameProject,
  switchProject,
  type ProjectMeta,
} from '../lib/projects'

/** Переключатель проектов объекта — живёт в шапке рядом с переключателем «Каталог/Инструменты».
 * Каждый проект — это свой независимый набор: параметры подбора, план здания и серверный шкаф,
 * чтобы разные объекты не затирали друг друга в одном и том же localStorage. */
export function ProjectSwitcher() {
  const [open, setOpen] = useState(false)
  const [projects, setProjects] = useState<ProjectMeta[]>(() => listProjects())
  const activeId = getActiveProjectId()
  const active = projects.find((p) => p.id === activeId)

  function handleCreate() {
    const name = prompt('Название нового проекта', `Проект ${projects.length + 1}`)
    if (name === null) return
    createProject(name)
    window.location.reload()
  }

  function handleSwitch(id: string) {
    setOpen(false)
    if (id === activeId) return
    switchProject(id)
    window.location.reload()
  }

  function handleRename() {
    if (!active) return
    const name = prompt('Новое название проекта', active.name)
    if (name === null) return
    renameProject(active.id, name)
    setProjects(listProjects())
    setOpen(false)
  }

  function handleDelete() {
    if (!active) return
    if (!confirm(`Удалить проект «${active.name}»? Это действие необратимо.`)) return
    deleteProject(active.id)
    window.location.reload()
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex max-w-[10rem] shrink-0 items-center gap-1.5 rounded-full border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-[var(--text-muted)] hover:bg-black/5 sm:max-w-[15rem]"
        title="Переключить проект объекта"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <FolderIcon className="h-4 w-4 shrink-0" />
        <span className="truncate">{active?.name ?? 'Проект'}</span>
        <ChevronDownIcon className="h-3 w-3 shrink-0" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full z-50 mt-1 w-60 overflow-hidden rounded-lg border border-slate-200 bg-white text-left shadow-lg">
            <div className="max-h-64 overflow-y-auto py-1">
              {projects.map((p) => (
                <button
                  key={p.id}
                  onClick={() => handleSwitch(p.id)}
                  className={`flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm ${
                    p.id === activeId ? 'bg-blue-50 font-medium text-blue-700' : 'text-slate-700 hover:bg-slate-50'
                  }`}
                  aria-current={p.id === activeId ? 'true' : undefined}
                >
                  <span className="h-4 w-4 shrink-0">{p.id === activeId && <CheckIcon />}</span>
                  <span className="truncate">{p.name}</span>
                </button>
              ))}
            </div>
            <div className="border-t border-slate-100 py-1">
              <button onClick={handleCreate} className="block w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50">
                + Новый проект
              </button>
              <button onClick={handleRename} className="block w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50">
                Переименовать
              </button>
              <button onClick={handleDelete} className="block w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50">
                Удалить проект
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
