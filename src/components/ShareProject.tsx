import { useEffect, useState } from 'react'
import { telegramShareLink, whatsappLink } from '../lib/contacts'
import { importProject } from '../lib/projects'
import { buildProjectShareLink, clearShareHash, readSharedProject, sharedProjectHash } from '../lib/share'
import type { ProjectSnapshot } from '../lib/projects'
import { Dialog } from './Dialog'

/** Окно «Поделиться проектом»: ссылка, копирование и отправка в мессенджеры. */
export function ShareProjectDialog({ onClose }: { onClose: () => void }) {
  const [link, setLink] = useState<{ url: string; name: string } | null>(null)
  const [error, setError] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    let cancelled = false
    buildProjectShareLink()
      .then((l) => !cancelled && setLink(l))
      .catch(() => !cancelled && setError(true))
    return () => {
      cancelled = true
    }
  }, [])

  async function copy() {
    if (!link) return
    try {
      await navigator.clipboard.writeText(link.url)
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }

  const text = link ? `Проект «${link.name}» — откройте ссылку, чтобы посмотреть подбор оборудования и план:` : ''

  return (
    <Dialog label="Поделиться проектом" title="Поделиться проектом" subtitle="Коллега или менеджер SAR откроет копию проекта у себя — со всеми этажами, точками доступа и шкафом." onClose={onClose} size="md">
      <div className="space-y-4 p-5">
        {error && <p className="text-sm text-[var(--danger)]">Не удалось собрать ссылку. Попробуйте ещё раз.</p>}
        {!link && !error && <p className="text-sm text-[var(--text-muted)]">Готовлю ссылку…</p>}
        {link && (
          <>
            <textarea
              readOnly
              value={link.url}
              rows={3}
              onFocus={(e) => e.currentTarget.select()}
              className="w-full resize-none rounded-lg border border-[var(--border)] bg-[var(--surface-alt)] px-3 py-2 font-mono text-[11px] text-[var(--text-muted)]"
              aria-label="Ссылка на проект"
            />
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={copy} className="rounded-lg px-4 py-2 text-sm font-semibold" style={{ backgroundColor: 'var(--accent)', color: 'var(--accent-ink)' }}>
                {copied ? 'Ссылка скопирована ✓' : 'Скопировать ссылку'}
              </button>
              <a href={telegramShareLink(text, link.url)} target="_blank" rel="noreferrer" className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm font-medium text-[var(--text)] hover:bg-black/5">
                Telegram
              </a>
              <a href={whatsappLink(`${text}\n${link.url}`)} target="_blank" rel="noreferrer" className="rounded-lg border border-emerald-600 px-3 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-50">
                WhatsApp
              </a>
            </div>
            <p className="text-[11px] leading-snug text-[var(--text-muted)]">
              Проект хранится внутри самой ссылки — на сервер ничего не загружается. Изменения после отправки в ссылку не попадут: отправьте новую.
            </p>
          </>
        )}
      </div>
    </Dialog>
  )
}

/** Баннер, когда сайт открыли по ссылке с проектом. */
export function IncomingProjectBanner() {
  const [incoming, setIncoming] = useState<{ name: string; snapshot: ProjectSnapshot } | null>(null)
  const [broken, setBroken] = useState(false)

  useEffect(() => {
    const packed = sharedProjectHash()
    if (!packed) return
    let cancelled = false
    readSharedProject(packed).then((r) => {
      if (cancelled) return
      if (r) setIncoming(r)
      else setBroken(true)
    })
    return () => {
      cancelled = true
    }
  }, [])

  if (broken) {
    return (
      <div className="no-print border-b border-amber-200 bg-amber-50 px-4 py-2 text-center text-sm text-amber-800">
        Ссылка на проект повреждена — попросите отправить её ещё раз.{' '}
        <button
          type="button"
          className="font-medium underline"
          onClick={() => {
            clearShareHash()
            setBroken(false)
          }}
        >
          Закрыть
        </button>
      </div>
    )
  }
  if (!incoming) return null
  return (
    <div className="no-print border-b border-[var(--border)] px-4 py-3" style={{ backgroundColor: 'var(--surface-alt)' }}>
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3">
        <span className="text-sm text-[var(--text)]">
          Вам отправили проект <b>«{incoming.name}»</b>. Открыть его как новый проект? Ваши проекты не изменятся.
        </span>
        <span className="ml-auto flex gap-2">
          <button
            type="button"
            onClick={() => {
              importProject(incoming.name, incoming.snapshot)
              clearShareHash()
              window.location.reload()
            }}
            className="rounded-lg px-4 py-2 text-sm font-semibold"
            style={{ backgroundColor: 'var(--accent)', color: 'var(--accent-ink)' }}
          >
            Открыть проект
          </button>
          <button
            type="button"
            onClick={() => {
              clearShareHash()
              setIncoming(null)
            }}
            className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm text-[var(--text-muted)] hover:bg-black/5"
          >
            Не сейчас
          </button>
        </span>
      </div>
    </div>
  )
}
