import { useState } from 'react'
import { PHONE_DISPLAY, WHATSAPP_DISPLAY, phoneLink, telegramChatLink, whatsappLink } from '../lib/contacts'
import { ChatIcon, CloseIcon } from './NavIcons'

/**
 * Плавающая кнопка «Связаться» — как онлайн-чат у крупных магазинов, только ведёт в мессенджеры,
 * где монтажники и так общаются. Telegram и телефон появляются, когда заданы в contacts.ts.
 */
export function ContactFab() {
  const [open, setOpen] = useState(false)
  const tg = telegramChatLink()
  const tel = phoneLink()
  const links = [
    { href: whatsappLink('Здравствуйте! Вопрос по оборудованию.'), label: 'WhatsApp', sub: WHATSAPP_DISPLAY, color: '#25d366' },
    ...(tg ? [{ href: tg, label: 'Telegram', sub: 'Написать в чат', color: '#2aabee' }] : []),
    ...(tel ? [{ href: tel, label: 'Позвонить', sub: PHONE_DISPLAY, color: '#2f5fe0' }] : []),
  ]

  return (
    <div className="no-print fixed bottom-4 right-4 z-40 flex flex-col items-end gap-2">
      {open && (
        <div className="w-60 overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-xl">
          <div className="border-b border-[var(--border)] px-4 py-3">
            <div className="text-sm font-semibold text-[var(--text)]">Нужна помощь с подбором?</div>
            <div className="text-xs text-[var(--text-muted)]">Инженер SAR ответит в мессенджере</div>
          </div>
          {links.map((l) => (
            <a key={l.label} href={l.href} target="_blank" rel="noreferrer" className="flex items-center gap-3 px-4 py-2.5 hover:bg-black/5">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: l.color }} />
              <span>
                <span className="block text-sm font-medium text-[var(--text)]">{l.label}</span>
                <span className="block text-xs text-[var(--text-muted)]">{l.sub}</span>
              </span>
            </a>
          ))}
        </div>
      )}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={open ? 'Закрыть контакты' : 'Связаться с SAR'}
        className="flex h-14 w-14 items-center justify-center rounded-full shadow-lg transition-transform hover:scale-105"
        style={{ backgroundColor: 'var(--accent)', color: 'var(--accent-ink)' }}
      >
        {open ? <CloseIcon className="h-6 w-6" /> : <ChatIcon />}
      </button>
    </div>
  )
}
