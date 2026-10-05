export const COMPANY_NAME = 'SAR'
export const COMPANY_TAGLINE = 'Инструменты и оборудование для монтажников и интеграторов'
export const COMPANY_ADDRESS = 'Ташкент'

/** Без «+» и пробелов — то, что ожидает wa.me в URL. */
export const WHATSAPP_NUMBER = '998123456789'
export const WHATSAPP_DISPLAY = '+998 12 345 67 89'

/** Имя аккаунта или канала в Telegram без «@». Пусто — кнопка «Написать в Telegram» не показывается. */
export const TELEGRAM_USERNAME: string = ''
/** Телефон для звонка, например '+998 71 200 00 00'. Пусто — кнопка «Позвонить» не показывается. */
export const PHONE_DISPLAY: string = ''

export function whatsappLink(text?: string) {
  const base = `https://wa.me/${WHATSAPP_NUMBER}`
  return text ? `${base}?text=${encodeURIComponent(text)}` : base
}

export function telegramChatLink() {
  return TELEGRAM_USERNAME ? `https://t.me/${TELEGRAM_USERNAME}` : undefined
}

/** «Поделиться в Telegram»: пользователь сам выбирает чат — клиента, коллегу или менеджера. */
export function telegramShareLink(text: string, url?: string) {
  const params = new URLSearchParams()
  params.set('url', url ?? (typeof window !== 'undefined' ? window.location.origin : 'https://sar-network.higgsfield.app'))
  params.set('text', text)
  return `https://t.me/share/url?${params.toString()}`
}

export function phoneLink() {
  return PHONE_DISPLAY ? `tel:${PHONE_DISPLAY.replace(/[^\d+]/g, '')}` : undefined
}
