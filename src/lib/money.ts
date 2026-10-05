import { createSharedState } from './storage'

export type Currency = 'USD' | 'UZS'

export interface MoneySettings {
  currency: Currency
  /** Сум за $1. 12 500 — курс, по которому посчитаны долларовые цены прайса поставщика. */
  rate: number
}

export const DEFAULT_UZS_RATE = 12500

const store = createSharedState<MoneySettings>('money', { currency: 'UZS', rate: DEFAULT_UZS_RATE })

export function formatUSD(usd: number) {
  const digits = Math.abs(usd) < 100 && Math.round(usd) !== usd ? 2 : 0
  return `$${usd.toLocaleString('ru-RU', { minimumFractionDigits: digits, maximumFractionDigits: digits })}`
}

export function formatUZS(sum: number) {
  return `${Math.round(sum).toLocaleString('ru-RU')} сум`
}

export function formatIn(usd: number, s: MoneySettings) {
  return s.currency === 'UZS' ? formatUZS(usd * s.rate) : formatUSD(usd)
}

/**
 * Валюта показа цен для всего приложения. Цены в каталоге хранятся в долларах;
 * сумы — пересчёт по курсу из настройки (по умолчанию тот же курс, что в прайсе поставщика).
 */
export function useMoney() {
  const [settings, setSettings] = store.use()
  return {
    ...settings,
    fmt: (usd: number) => formatIn(usd, settings),
    /** Перевод суммы из текущей валюты обратно в доллары (для полей ввода «бюджет»). */
    toUSD: (amount: number) => (settings.currency === 'UZS' ? amount / settings.rate : amount),
    fromUSD: (usd: number) => (settings.currency === 'UZS' ? Math.round(usd * settings.rate) : usd),
    symbol: settings.currency === 'UZS' ? 'сум' : '$',
    setCurrency: (currency: Currency) => setSettings((s) => ({ ...s, currency })),
    setRate: (rate: number) => setSettings((s) => ({ ...s, rate: rate > 0 ? rate : DEFAULT_UZS_RATE })),
  }
}

export function getMoneySettings() {
  return store.get()
}
