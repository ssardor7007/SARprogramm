import { useState } from 'react'
import { brandColor } from '../lib/brandTheme'
import type { Category } from '../types'
import { CategoryIcon } from './icons'

interface Props {
  imageUrl?: string
  brand: string
  category: Category
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'fill' | 'marker'
}

/** Относительные пути (из public/) резолвятся с учётом base пути сборки — GitHub Pages/поддомен. */
function resolveSrc(url: string) {
  if (/^(https?:)?\/\//.test(url) || url.startsWith('data:')) return url
  const base = import.meta.env.BASE_URL
  return base.endsWith('/') ? base + url.replace(/^\//, '') : `${base}/${url.replace(/^\//, '')}`
}

/** products/tpl/x.jpeg → products/cutout/x.png (вырезанный прибор без фона, только для локальных фото). */
function cutoutUrl(url: string) {
  const m = url.match(/^\/?products\/(?:[^/]+\/)*([^/]+)\.(?:png|jpe?g|webp)$/i)
  return m ? `products/cutout/${m[1]}.png` : undefined
}

export function ProductImage({ imageUrl, brand, category, size = 'md' }: Props) {
  const [failed, setFailed] = useState(false)
  const [cutoutFailed, setCutoutFailed] = useState(false)
  const color = brandColor(brand)
  const dim = size === 'xs' ? 'h-5 w-5' : size === 'sm' ? 'h-10 w-10' : size === 'lg' ? 'h-24 w-24' : 'h-16 w-16'
  const iconDim = size === 'xs' ? 'h-3 w-3' : size === 'sm' ? 'h-5 w-5' : size === 'lg' ? 'h-10 w-10' : 'h-8 w-8'

  // 'fill' — заполняет собой родителя (у которого должен быть position: relative и overflow: hidden),
  // а не занимает фиксированный квадрат: нужно для юнита стойки. Наши фото — это весь прибор целиком,
  // снятый чуть сверху-спереди с отступами по краям, а не отдельная лицевая панель — поэтому кадрируем
  // (object-cover + сдвиг вниз + небольшой зум), чтобы в юните было видно панель с портами край в край,
  // без белых полей и верхушки корпуса, как на настоящих рендерах серверных шкафов.
  if (size === 'fill') {
    if (imageUrl && !failed) {
      return (
        <img
          src={resolveSrc(imageUrl)}
          alt={brand}
          onError={() => setFailed(true)}
          className="absolute inset-0 h-full w-full object-cover"
          style={{ objectPosition: '50% 78%', transform: 'scale(1.35)' }}
        />
      )
    }
    return (
      <div className="absolute inset-0 flex items-center justify-center" style={{ color }}>
        <div className="h-1/2 w-1/2">
          <CategoryIcon category={category} />
        </div>
      </div>
    )
  }

  // 'marker' — значок точки доступа на плане здания: сам прибор без белого фона.
  // Для точек доступа лежат вырезанные PNG с прозрачностью в products/cutout/ (то же имя
  // файла, расширение .png); если вырезки нет — показываем обычное фото, без фото — иконку.
  if (size === 'marker') {
    if (imageUrl && !failed) {
      const cutout = cutoutUrl(imageUrl)
      return (
        <img
          src={resolveSrc(cutoutFailed || !cutout ? imageUrl : cutout)}
          alt={brand}
          draggable={false}
          onError={() => (cutout && !cutoutFailed ? setCutoutFailed(true) : setFailed(true))}
          className="h-full w-full object-contain"
          style={{ filter: 'drop-shadow(0 1px 2px rgba(0, 0, 0, 0.55)) drop-shadow(0 0 1px rgba(0, 0, 0, 0.45))' }}
        />
      )
    }
    return (
      <div className="h-3/5 w-3/5" style={{ color }}>
        <CategoryIcon category={category} />
      </div>
    )
  }

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
