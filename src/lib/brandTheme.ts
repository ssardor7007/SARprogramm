/** Фирменные цвета для визуального различия брендов в интерфейсе. */
export const BRAND_COLORS: Record<string, string> = {
  'TP-Link': '#2f6fed',
  'Wi-Tek': '#12897a',
  Hikvision: '#d1373f',
  Dahua: '#c77b00',
  Tenda: '#e0932f',
  'Ubiquiti (UniFi)': '#0559c9',
  MikroTik: '#b02a37',
  Ruijie: '#7c53e0',
  Оптика: '#0f9b8e',
}

const FALLBACK_COLOR = '#5b6178'

export function brandColor(brand: string): string {
  return BRAND_COLORS[brand] ?? FALLBACK_COLOR
}
