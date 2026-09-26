import { useCallback, useState } from 'react'

/**
 * Реквизиты монтажника/интегратора, от имени которого уходит коммерческое предложение.
 * Хранятся отдельно от проектов (без префикса проекта): один и тот же монтажник ведёт
 * много объектов, и его шапка не должна меняться при переключении проекта. На другом
 * компьютере/в другом браузере — свой монтажник со своими реквизитами.
 */
export interface InstallerProfile {
  company: string
  person: string
  position: string
  phone: string
  email: string
  address: string
  website: string
  /** Логотип, уменьшенный до ~320 px и сохранённый как data:URL */
  logoDataUrl?: string
  accent: string
}

export const ACCENT_PRESETS: { id: string; label: string; color: string }[] = [
  { id: 'navy', label: 'Тёмно-синий', color: '#1d3557' },
  { id: 'graphite', label: 'Графит', color: '#2b2d31' },
  { id: 'emerald', label: 'Изумруд', color: '#0f5b4a' },
  { id: 'burgundy', label: 'Бордо', color: '#6b1d2b' },
  { id: 'royal', label: 'Королевский синий', color: '#2446a8' },
]

const KEY = 'sar-installer-profile'

const EMPTY: InstallerProfile = {
  company: '',
  person: '',
  position: '',
  phone: '',
  email: '',
  address: '',
  website: '',
  accent: ACCENT_PRESETS[0].color,
}

function read(): InstallerProfile {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? { ...EMPTY, ...(JSON.parse(raw) as Partial<InstallerProfile>) } : EMPTY
  } catch {
    return EMPTY
  }
}

export function useInstallerProfile() {
  const [profile, setProfile] = useState<InstallerProfile>(read)
  const update = useCallback((patch: Partial<InstallerProfile>) => {
    setProfile((prev) => {
      const next = { ...prev, ...patch }
      try {
        localStorage.setItem(KEY, JSON.stringify(next))
      } catch {
        // хранилище переполнено/недоступно — реквизиты просто не запомнятся
      }
      return next
    })
  }, [])
  return { profile, update }
}

/** Читает картинку-логотип, уменьшает до maxSide и возвращает PNG data:URL (прозрачность сохраняется). */
export function readLogoFile(file: File, maxSide = 320): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(reader.error)
    reader.onload = () => {
      const img = new Image()
      img.onerror = () => reject(new Error('Не удалось прочитать изображение'))
      img.onload = () => {
        const k = Math.min(1, maxSide / Math.max(img.width, img.height))
        const canvas = document.createElement('canvas')
        canvas.width = Math.max(1, Math.round(img.width * k))
        canvas.height = Math.max(1, Math.round(img.height * k))
        canvas.getContext('2d')?.drawImage(img, 0, 0, canvas.width, canvas.height)
        resolve(canvas.toDataURL('image/png'))
      }
      img.src = reader.result as string
    }
    reader.readAsDataURL(file)
  })
}
