export const COMPANY_NAME = 'SAR'
export const COMPANY_TAGLINE = 'Инструменты и оборудование для монтажников и интеграторов'
export const COMPANY_ADDRESS = 'Ташкент'

/** Без «+» и пробелов — то, что ожидает wa.me в URL. */
export const WHATSAPP_NUMBER = '998123456789'
export const WHATSAPP_DISPLAY = '+998 12 345 67 89'

export function whatsappLink(text?: string) {
  const base = `https://wa.me/${WHATSAPP_NUMBER}`
  return text ? `${base}?text=${encodeURIComponent(text)}` : base
}
