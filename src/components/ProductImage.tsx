import { useState } from 'react'
import { brandColor } from '../lib/brandTheme'
import type { Category } from '../types'
import { CategoryIcon } from './icons'

interface Props {
  imageUrl?: string
  brand: string
  category: Category
  size?: 'xs' | 'sm' | 'md' | 'lg'
}

/** Относительные пути (из public/) резолвятся с учётом base пути сборки — GitHub Pages/поддомен. */
function resolveSrc(url: string) {
  if (/^(https?:)?\/\//.test(url) || url.startsWith('data:')) return url
  const base = import.meta.env.BASE_URL
  return base.endsWith('/') ? base + url.replace(/^\//, '') : `${base}/${url.replace(/^\//, '')}`
}

export function ProductImage({ imageUrl, brand, category, size = 'md' }: Props) {
  const [failed, setFailed] = useState(false)
  const color = brandColor(brand)
  const dim = size === 'xs' ? 'h-5 w-5' : size === 'sm' ? 'h-10 w-10' : size === 'lg' ? 'h-24 w-24' : 'h-16 w-16'
  const iconDim = size === 'xs' ? 'h-3 w-3' : size === 'sm' ? 'h-5 w-5' : size === 'lg' ? 'h-10 w-10' : 'h-8 w-8'

  if (imageUrl && !failed) {
    return (
      <img
        src={resolveSrc(imageUrl)}
        alt={brand}
        onError={() => setFailed(true)}
        className={`${dim} shrink-0 rounded-lg border border-slate-200 bg-white object-contain p-1`}
      />
    )
  }

  return (
    <div
      className={`${dim} flex shrink-0 items-center justify-center rounded-lg border`}
      style={{ backgroundColor: `${color}14`, borderColor: `${color}33`, color }}
    >
      <div className={iconDim}>
        <CategoryIcon category={category} />
      </div>
    </div>
  )
}
