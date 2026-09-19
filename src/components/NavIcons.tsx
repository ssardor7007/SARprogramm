const common = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.7,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
}

export function CompareIcon() {
  return (
    <svg viewBox="0 0 24 24" {...common}>
      <path d="M8 4 4 8l4 4M4 8h9" />
      <path d="M16 20l4-4-4-4M20 16h-9" />
    </svg>
  )
}

export function DesignerIcon() {
  return (
    <svg viewBox="0 0 24 24" {...common}>
      <rect x="4" y="4" width="16" height="16" rx="1.5" />
      <path d="M4 9h16M9 9v11" />
    </svg>
  )
}

export function CatalogIcon() {
  return (
    <svg viewBox="0 0 24 24" {...common}>
      <path d="M4 7 12 3l8 4-8 4-8-4Z" />
      <path d="M4 7v10l8 4 8-4V7M12 11v10" />
    </svg>
  )
}

export function CompetitorsIcon() {
  return (
    <svg viewBox="0 0 24 24" {...common}>
      <path d="M12 3 4 6v6c0 4.2 3.2 7.4 8 9 4.8-1.6 8-4.8 8-9V6l-8-3Z" />
    </svg>
  )
}
