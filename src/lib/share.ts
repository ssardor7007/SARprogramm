import { exportActiveProject, type ProjectSnapshot } from './projects'

/**
 * Проект объекта целиком (параметры подбора, план здания, шкаф, реквизиты КП) упаковывается
 * в саму ссылку — после «#», поэтому на сервер ничего не уходит и ничего не хранится:
 * кто открыл ссылку, тот получает копию проекта у себя в браузере.
 */
const HASH_KEY = 'project'

interface Payload {
  v: 1
  n: string
  s: ProjectSnapshot
}

function toBase64Url(bytes: Uint8Array) {
  let bin = ''
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64Url(s: string) {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4)
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

export async function buildProjectShareLink(): Promise<{ url: string; name: string }> {
  const { deflateSync, strToU8 } = await import('fflate')
  const { name, snapshot } = exportActiveProject()
  const payload: Payload = { v: 1, n: name, s: snapshot }
  const packed = toBase64Url(deflateSync(strToU8(JSON.stringify(payload)), { level: 9 }))
  const { origin, pathname } = window.location
  return { url: `${origin}${pathname}#${HASH_KEY}=${packed}`, name }
}

export function sharedProjectHash(): string | undefined {
  if (typeof window === 'undefined') return undefined
  const m = window.location.hash.match(new RegExp(`^#${HASH_KEY}=([A-Za-z0-9_-]+)$`))
  return m?.[1]
}

export async function readSharedProject(packed: string): Promise<{ name: string; snapshot: ProjectSnapshot } | null> {
  try {
    const { inflateSync, strFromU8 } = await import('fflate')
    const data = JSON.parse(strFromU8(inflateSync(fromBase64Url(packed)))) as Payload
    if (data?.v !== 1 || typeof data.s !== 'object') return null
    return { name: String(data.n ?? 'Присланный проект'), snapshot: data.s }
  } catch {
    return null
  }
}

export function clearShareHash() {
  const { pathname, search } = window.location
  window.history.replaceState(null, '', `${pathname}${search}`)
}
