import type { Category } from '../types'

const common = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
}

function RouterIcon() {
  return (
    <svg viewBox="0 0 32 32" {...common}>
      <path d="M10 12 L8 6 M22 12 L24 6" />
      <circle cx="8" cy="5" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="24" cy="5" r="1.2" fill="currentColor" stroke="none" />
      <rect x="5" y="12" width="22" height="10" rx="2.5" />
      <circle cx="10" cy="17" r="1" fill="currentColor" stroke="none" />
      <circle cx="14" cy="17" r="1" fill="currentColor" stroke="none" />
      <path d="M19 17h5" />
    </svg>
  )
}

function SwitchIcon() {
  return (
    <svg viewBox="0 0 32 32" {...common}>
      <rect x="4" y="9" width="24" height="14" rx="2" />
      <path d="M8 23v3M13 23v3M18 23v3M23 23v3" />
      <path d="M7 14.5h3M12 14.5h3M17 14.5h3M22 14.5h3" />
    </svg>
  )
}

function ApIcon() {
  return (
    <svg viewBox="0 0 32 32" {...common}>
      <circle cx="16" cy="21" r="3" />
      <path d="M10 15a8.5 8.5 0 0 1 12 0" />
      <path d="M6.5 11a13.5 13.5 0 0 1 19 0" />
    </svg>
  )
}

function CameraIcon() {
  return (
    <svg viewBox="0 0 32 32" {...common}>
      <rect x="4" y="12" width="16" height="10" rx="2" />
      <path d="M20 15.5 27 12v10l-7-3.5" />
      <circle cx="10" cy="17" r="2.6" />
    </svg>
  )
}

function NvrIcon() {
  return (
    <svg viewBox="0 0 32 32" {...common}>
      <rect x="5" y="7" width="22" height="18" rx="2" />
      <path d="M8 12h16M8 16h16" />
      <circle cx="22" cy="20.5" r="2.2" />
      <path d="M9 20.5h8" />
    </svg>
  )
}

function ControllerIcon() {
  return (
    <svg viewBox="0 0 32 32" {...common}>
      <path d="M16 5 27 11v10L16 27 5 21V11z" />
      <circle cx="16" cy="16" r="4" />
    </svg>
  )
}

const ICONS: Record<Category, () => ReturnType<typeof RouterIcon>> = {
  router: RouterIcon,
  switch: SwitchIcon,
  ap: ApIcon,
  camera: CameraIcon,
  nvr: NvrIcon,
  other: ControllerIcon,
}

export function CategoryIcon({ category }: { category: Category }) {
  const Icon = ICONS[category]
  return <Icon />
}
