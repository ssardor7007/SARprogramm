const common = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.7,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
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

export function QuoteIcon() {
  return (
    <svg viewBox="0 0 24 24" {...common}>
      <path d="M6 3h9l4 4v14H6Z" />
      <path d="M15 3v4h4" />
      <path d="M9 12h6M9 15h6M9 18h3" />
    </svg>
  )
}

export function ToolsIcon() {
  return (
    <svg viewBox="0 0 24 24" {...common}>
      <path d="M14.5 6.5a3.5 3.5 0 0 1-4.6 4.6L4 17l3 3 5.9-5.9a3.5 3.5 0 0 1 4.6-4.6l-2.3 2.3-2-2Z" />
    </svg>
  )
}

export function PlanIcon() {
  return (
    <svg viewBox="0 0 24 24" {...common}>
      <rect x="3" y="3" width="18" height="18" rx="1" />
      <path d="M3 9h8M9 9v12" />
      <circle cx="6" cy="6" r="0.7" fill="currentColor" stroke="none" />
      <circle cx="15" cy="14" r="0.7" fill="currentColor" stroke="none" />
      <circle cx="18" cy="18" r="0.7" fill="currentColor" stroke="none" />
      <path d="M6 6 15 14M15 14 18 18" strokeDasharray="1.5 1.5" />
    </svg>
  )
}

export function RackIcon() {
  return (
    <svg viewBox="0 0 24 24" {...common}>
      <rect x="4" y="3" width="16" height="18" rx="1" />
      <path d="M4 8h16M4 13h16M4 18h16" />
      <circle cx="7" cy="5.5" r="0.6" fill="currentColor" stroke="none" />
      <circle cx="7" cy="10.5" r="0.6" fill="currentColor" stroke="none" />
      <circle cx="7" cy="15.5" r="0.6" fill="currentColor" stroke="none" />
    </svg>
  )
}
