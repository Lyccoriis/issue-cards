import { statSync } from 'node:fs'
import fs from 'node:fs/promises'
import https from 'node:https'
import path from 'node:path'
import { randomUUID } from 'node:crypto'

export type AttachmentHost = 'imgur' | 'catbox' | 'mclogs' | 'discord' | 'youtube' | 'link'

export interface UploadResult {
  url: string
  host: AttachmentHost
  name: string
  mime: string
  bytes: number
}

export type JobState = 'queued' | 'uploading' | 'done' | 'error' | 'canceled'

export interface UploadJob {
  id: string
  name: string
  target: string
  host: AttachmentHost
  bytes: number
  sent: number
  state: JobState
  attempt: number
  error: string
  result: UploadResult | null
}

export const MAX_UPLOAD_BYTES = 200 * 1024 * 1024

const MAX_LOG_BYTES = 10 * 1024 * 1024
const MAX_LOG_LINES = 25_000

const STALL_MS = 45_000

const ATTEMPTS = 3
const BACKOFF_MS = [0, 1_500, 5_000]

const RUNNING_AT_ONCE = 2

const IMAGE_EXT = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.avif'])

const MIME: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.bmp': 'image/bmp',
  '.avif': 'image/avif',
  '.svg': 'image/svg+xml',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mov': 'video/quicktime',
  '.mkv': 'video/x-matroska',
  '.m4v': 'video/x-m4v',
  '.log': 'text/plain',
  '.txt': 'text/plain',
  '.json': 'application/json',
}

function mimeFor(name: string): string {
  return MIME[path.extname(name).toLowerCase()] ?? 'application/octet-stream'
}

const LOG_NAMES = [
  /^latest\.log$/i,
  /^debug\.log$/i,
  /^crash[-_]?report.*\.(txt|log)$/i,
  /^crash-.*\.txt$/i,
  /^hs_err_pid\d*\.log$/i,
]

export function isLogFile(name: string): boolean {
  const base = path.basename(name)
  return LOG_NAMES.some(rule => rule.test(base))
}

let clientId = process.env.IMGUR_CLIENT_ID ?? ''

export function setImgurClientId(value: string): void {
  clientId = value.trim()
}

function imgurClientId(): string {
  return clientId
}

function hostFor(name: string): AttachmentHost {
  if (isLogFile(name)) return 'mclogs'
  return imgurClientId() && IMAGE_EXT.has(path.extname(name).toLowerCase()) ? 'imgur' : 'catbox'
}

const USER_AGENT = 'issue-cards (desktop)'

interface SendOpts {
  url: string
  headers: Record<string, string>
  body: Buffer
  onSent: (sent: number) => void
  signal: AbortSignal
}

interface SendResult {
  status: number
  text: string
}

function send({ url, headers, body, onSent, signal }: SendOpts): Promise<SendResult> {
  return new Promise((resolve, reject) => {
    let settled = false
    let moved = Date.now()

    const finish = (fn: () => void) => {
      if (settled) return
      settled = true
      clearInterval(watchdog)
      signal.removeEventListener('abort', onAbort)
      fn()
    }

    const request = https.request(
      url,
      {
        method: 'POST',
        headers: {
          'user-agent': USER_AGENT,
          ...headers,
          'content-length': String(body.length),
        },
      },
      response => {
        const chunks: Buffer[] = []
        response.on('data', chunk => {
          moved = Date.now()
          chunks.push(chunk as Buffer)
        })
        response.on('end', () =>
          finish(() =>
            resolve({
              status: response.statusCode ?? 0,
              text: Buffer.concat(chunks).toString('utf8'),
            }),
          ),
        )
        response.on('error', err => finish(() => reject(err)))
      },
    )

    const onAbort = () => {
      request.destroy(new Error('canceled'))
    }
    signal.addEventListener('abort', onAbort, { once: true })

    const watchdog = setInterval(() => {
      if (Date.now() - moved > STALL_MS) {
        request.destroy(new Error(`nothing moved for ${Math.round(STALL_MS / 1000)}s`))
      }
    }, 5_000)

    request.on('error', err => finish(() => reject(err)))

    const CHUNK = 64 * 1024
    let at = 0
    const pump = () => {
      if (settled) return
      while (at < body.length) {
        const end = Math.min(at + CHUNK, body.length)
        const ok = request.write(body.subarray(at, end))
        at = end
        moved = Date.now()
        onSent(at)
        if (!ok) {
          request.once('drain', pump)
          return
        }
      }
      request.end()
    }
    pump()
  })
}

function multipart(
  fields: Record<string, string>,
  file: { field: string; name: string; mime: string; bytes: Buffer } | null,
): { body: Buffer; contentType: string } {
  const boundary = `----issuecards${randomUUID().replace(/-/g, '')}`
  const parts: Buffer[] = []

  for (const [name, value] of Object.entries(fields)) {
    parts.push(
      Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`,
      ),
    )
  }

  if (file) {
    const head =
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="${file.field}"; filename="${file.name.replace(/"/g, '')}"\r\n` +
      `Content-Type: ${file.mime}\r\n\r\n`
    parts.push(Buffer.from(head), file.bytes, Buffer.from('\r\n'))
  }

  parts.push(Buffer.from(`--${boundary}--\r\n`))
  return { body: Buffer.concat(parts), contentType: `multipart/form-data; boundary=${boundary}` }
}

type Put = (bytes: Buffer, name: string, onSent: (n: number) => void, signal: AbortSignal) => Promise<string>

const toImgur: Put = async (bytes, name, onSent, signal) => {
  const { body, contentType } = multipart({ type: 'file' }, {
    field: 'image',
    name,
    mime: mimeFor(name),
    bytes,
  })

  const { status, text } = await send({
    url: 'https://api.imgur.com/3/image',
    headers: { authorization: `Client-ID ${imgurClientId()}`, 'content-type': contentType },
    body,
    onSent,
    signal,
  })

  const parsed = parseJson<{ success?: boolean; data?: { link?: string; error?: unknown } }>(text)
  if (status < 200 || status >= 300 || !parsed?.success || !parsed.data?.link) {
    const reason =
      typeof parsed?.data?.error === 'string' ? parsed.data.error : `imgur answered ${status}`
    throw new Error(`Imgur refused the upload, ${reason}`, { cause: retryable(status) })
  }
  return parsed.data.link
}

const toCatbox: Put = async (bytes, name, onSent, signal) => {
  const { body, contentType } = multipart({ reqtype: 'fileupload' }, {
    field: 'fileToUpload',
    name,
    mime: mimeFor(name),
    bytes,
  })

  const { status, text } = await send({
    url: 'https://catbox.moe/user/api.php',
    headers: { 'content-type': contentType },
    body,
    onSent,
    signal,
  })

  const answer = text.trim()
  if (!answer.startsWith('https://')) {
    throw new Error(`Catbox refused the upload, ${answer || `it answered ${status}`}`, {
      cause: retryable(status),
    })
  }
  return answer
}

const toMclogs: Put = async (bytes, name, onSent, signal) => {
  let content = bytes.toString('utf8')

  const lines = content.split('\n')
  if (lines.length > MAX_LOG_LINES) content = lines.slice(-MAX_LOG_LINES).join('\n')
  if (Buffer.byteLength(content) > MAX_LOG_BYTES) {
    content = content.slice(-MAX_LOG_BYTES)
  }

  const body = Buffer.from(`content=${encodeURIComponent(content)}`)
  const { status, text } = await send({
    url: 'https://api.mclo.gs/1/log',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
    onSent,
    signal,
  })

  const parsed = parseJson<{ success?: boolean; url?: string; error?: string }>(text)
  if (!parsed?.success || !parsed.url) {
    throw new Error(`mclo.gs refused the log, ${parsed?.error ?? `it answered ${status}`}`, {
      cause: retryable(status),
    })
  }
  return parsed.url
}

const HOSTS: Record<'imgur' | 'catbox' | 'mclogs', Put> = {
  imgur: toImgur,
  catbox: toCatbox,
  mclogs: toMclogs,
}

function parseJson<T>(text: string): T | null {
  try {
    return JSON.parse(text) as T
  } catch {
    return null
  }
}

function retryable(status: number): boolean {
  return status === 0 || status === 429 || status >= 500
}

type Source = { kind: 'path'; filePath: string } | { kind: 'bytes'; data: Buffer } | { kind: 'link'; url: string }

interface Entry {
  job: UploadJob
  source: Source
  abort: AbortController
}

const entries = new Map<string, Entry>()
const waiting: string[] = []
let running = 0

let notify: (job: UploadJob) => void = () => {}

export function onUploadJob(fn: (job: UploadJob) => void): void {
  notify = fn
}

function push(entry: Entry): UploadJob {
  entries.set(entry.job.id, entry)
  waiting.push(entry.job.id)
  notify({ ...entry.job })
  pump()
  return { ...entry.job }
}

function update(entry: Entry, patch: Partial<UploadJob>): void {
  Object.assign(entry.job, patch)
  notify({ ...entry.job })
}

function pump(): void {
  while (running < RUNNING_AT_ONCE && waiting.length > 0) {
    const id = waiting.shift()!
    const entry = entries.get(id)
    if (!entry || entry.job.state !== 'queued') continue
    running += 1
    void work(entry).finally(() => {
      running -= 1
      pump()
    })
  }
}

async function readSource(entry: Entry): Promise<{ bytes: Buffer; name: string }> {
  const { source } = entry
  if (source.kind === 'bytes') return { bytes: source.data, name: entry.job.name }
  if (source.kind === 'path') {
    return { bytes: await fs.readFile(source.filePath), name: path.basename(source.filePath) }
  }

  const response = await fetch(source.url, { signal: entry.abort.signal })
  if (!isDiscordCdn(response.url || source.url)) throw new Error('That link sent the request somewhere else')
  if (!response.ok) throw new Error(`Could not read that link, it answered ${response.status}`)
  const length = Number(response.headers.get('content-length') ?? 0)
  if (length > MAX_UPLOAD_BYTES) throw new Error('That file is larger than the 200 MB the hosts take')
  return {
    bytes: Buffer.from(await response.arrayBuffer()),
    name: decodeURIComponent(new URL(source.url).pathname.split('/').pop() || 'file'),
  }
}

async function work(entry: Entry): Promise<void> {
  update(entry, { state: 'uploading' })

  let payload: { bytes: Buffer; name: string }
  try {
    payload = await readSource(entry)
  } catch (err) {
    update(entry, { state: entry.abort.signal.aborted ? 'canceled' : 'error', error: reason(err) })
    return
  }

  if (payload.bytes.length > MAX_UPLOAD_BYTES) {
    update(entry, { state: 'error', error: `${payload.name} is larger than the 200 MB the hosts take` })
    return
  }

  const host = hostFor(payload.name)
  update(entry, { name: payload.name, host, bytes: payload.bytes.length, sent: 0 })

  for (let attempt = 1; attempt <= ATTEMPTS; attempt += 1) {
    if (entry.abort.signal.aborted) {
      update(entry, { state: 'canceled' })
      return
    }
    if (BACKOFF_MS[attempt - 1]) await wait(BACKOFF_MS[attempt - 1], entry.abort.signal)

    update(entry, { attempt, sent: 0, error: '' })
    try {
      const url = await HOSTS[host as 'imgur' | 'catbox' | 'mclogs'](
        payload.bytes,
        payload.name,
        sent => update(entry, { sent }),
        entry.abort.signal,
      )
      update(entry, {
        state: 'done',
        sent: payload.bytes.length,
        result: {
          url,
          host,
          name: payload.name,
          mime: mimeFor(payload.name),
          bytes: payload.bytes.length,
        },
      })
      return
    } catch (err) {
      if (entry.abort.signal.aborted) {
        update(entry, { state: 'canceled' })
        return
      }
      const last = attempt === ATTEMPTS
      const again = !last && (err instanceof Error ? err.cause !== false : true)
      if (!again) {
        update(entry, { state: 'error', error: reason(err) })
        return
      }
      update(entry, { error: `${reason(err)}, trying again` })
    }
  }
}

function wait(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise(resolve => {
    const timer = setTimeout(resolve, ms)
    signal.addEventListener('abort', () => {
      clearTimeout(timer)
      resolve()
    }, { once: true })
  })
}

function reason(err: unknown): string {
  if (err instanceof Error) return err.message
  return String(err)
}

function fresh(name: string, target: string, source: Source): Entry {
  return {
    job: {
      id: randomUUID(),
      name,
      target,
      host: hostFor(name),
      bytes: 0,
      sent: 0,
      state: 'queued',
      attempt: 0,
      error: '',
      result: null,
    },
    source,
    abort: new AbortController(),
  }
}

export function queuePath(filePath: string, target: string): UploadJob {
  if (typeof filePath !== 'string' || typeof target !== 'string' || !path.isAbsolute(filePath)) {
    throw new Error('That is not a file path')
  }
  const stat = statSync(filePath)
  if (!stat.isFile()) throw new Error('That is not a file')
  if (stat.size > MAX_UPLOAD_BYTES) throw new Error('That file is larger than the 200 MB the hosts take')
  return push(fresh(path.basename(filePath), target, { kind: 'path', filePath }))
}

export function queueBytes(data: ArrayBuffer, name: string, target: string): UploadJob {
  if (!(data instanceof ArrayBuffer) || typeof name !== 'string' || typeof target !== 'string') {
    throw new Error('That is not a file')
  }
  if (data.byteLength > MAX_UPLOAD_BYTES) throw new Error('That file is larger than the 200 MB the hosts take')
  return push(fresh(name, target, { kind: 'bytes', data: Buffer.from(data) }))
}

export function queueRehost(url: string, target: string): UploadJob {
  if (typeof url !== 'string' || typeof target !== 'string' || !isDiscordCdn(url)) {
    throw new Error('Only Discord links are copied to a host')
  }
  const name = decodeURIComponent(new URL(url).pathname.split('/').pop() || 'file')
  return push(fresh(name, target, { kind: 'link', url }))
}

function isDiscordCdn(value: string): boolean {
  try {
    const parsed = new URL(value)
    return parsed.protocol === 'https:' && /^(?:cdn|media)\.discordapp\.(?:net|com)$/i.test(parsed.hostname)
  } catch {
    return false
  }
}

export function cancelUpload(id: string): void {
  const entry = entries.get(id)
  if (!entry) return
  entry.abort.abort()
  if (entry.job.state === 'queued') update(entry, { state: 'canceled' })
}

export function retryUpload(id: string): UploadJob | null {
  const entry = entries.get(id)
  if (!entry || (entry.job.state !== 'error' && entry.job.state !== 'canceled')) return null
  entry.abort = new AbortController()
  Object.assign(entry.job, { state: 'queued', sent: 0, attempt: 0, error: '' })
  waiting.push(entry.job.id)
  notify({ ...entry.job })
  pump()
  return { ...entry.job }
}

export function forgetUpload(id: string): void {
  entries.delete(id)
}

export function listUploads(): UploadJob[] {
  return [...entries.values()].map(e => ({ ...e.job }))
}
