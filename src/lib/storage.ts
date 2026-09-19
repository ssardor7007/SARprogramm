import { useCallback, useEffect, useState } from 'react'

const PREFIX = 'sar-net-compare:'

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(PREFIX + key)
    if (!raw) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

function save<T>(key: string, value: T) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value))
  } catch {
    // хранилище недоступно (приватный режим и т.п.) — молча игнорируем
  }
}

/**
 * Персистентный стейт в localStorage, с ленивой инициализацией из seed-данных.
 * Если передана `seedVersion` и она не совпадает с сохранённой — локальные
 * данные считаются устаревшими (например, seed поправили из-за ошибки в
 * данных) и переинициализируются свежим seed, а не хранятся вечно как есть.
 */
export function usePersistedList<T extends { id: string }>(key: string, seed: T[], seedVersion?: number) {
  const versionKey = `${key}:version`
  const [items, setItems] = useState<T[]>(() => {
    if (seedVersion !== undefined && load(versionKey, -1) !== seedVersion) return seed
    return load(key, seed)
  })

  useEffect(() => {
    save(key, items)
    if (seedVersion !== undefined) save(versionKey, seedVersion)
  }, [key, items, seedVersion])

  const upsert = useCallback((item: T) => {
    setItems((prev) => {
      const idx = prev.findIndex((p) => p.id === item.id)
      if (idx === -1) return [...prev, item]
      const next = [...prev]
      next[idx] = item
      return next
    })
  }, [])

  const remove = useCallback((id: string) => {
    setItems((prev) => prev.filter((p) => p.id !== id))
  }, [])

  const resetToSeed = useCallback(() => {
    setItems(seed)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return { items, setItems, upsert, remove, resetToSeed }
}

/** Персистентный стейт в localStorage для произвольных JSON-значений (не список с id). */
export function usePersistedState<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => load(key, initial))

  useEffect(() => {
    save(key, value)
  }, [key, value])

  return [value, setValue] as const
}

export function genId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}
