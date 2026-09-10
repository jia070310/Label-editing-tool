/** 获取当前文档中选中的文字 */
export function getSelectedText(): string {
  const sel = window.getSelection()
  if (!sel || sel.rangeCount === 0) return ''
  return sel.toString().trim()
}

/** 是否包含中文 */
export function hasChinese(text: string): boolean {
  return /[\u4e00-\u9fff]/.test(text)
}

/** 从单元格内容中取待翻译的中文（第一行或选中文字） */
export function pickSourceText(content: string, selection: string): string {
  if (selection) return selection
  const firstLine = content.split('\n')[0]?.trim() ?? ''
  return firstLine
}

/** 将英文翻译追加到单元格：中文在上，英文在下 */
export function mergeTranslationIntoCell(
  content: string,
  sourceText: string,
  translation: string,
): string {
  const source = sourceText.trim()
  const trans = translation.trim()
  if (!source || !trans) return content

  const lines = content.split('\n')

  // 整格只有一行中文，或第一行与源文一致 → 替换/追加第二行
  if (lines.length === 1 && lines[0].trim() === source) {
    return `${lines[0]}\n${trans}`
  }
  if (lines.length >= 2 && lines[0].trim() === source) {
    return `${lines[0]}\n${trans}${lines.length > 2 ? '\n' + lines.slice(2).join('\n') : ''}`
  }

  // 在内容中定位选中片段
  const idx = content.indexOf(sourceText)
  if (idx >= 0) {
    const before = content.slice(0, idx + sourceText.length)
    const after = content.slice(idx + sourceText.length)
    if (/^\n[^\n]+/.test(after) && !after.includes('\n\n')) {
      const rest = after.indexOf('\n') >= 0 ? after.slice(after.indexOf('\n')) : ''
      return `${before}\n${trans}${rest}`
    }
    return `${before}\n${trans}${after}`
  }

  return content ? `${content}\n${trans}` : `${source}\n${trans}`
}

/** 单元格是否包含翻译行（第二行及以后） */
export function cellHasTranslation(content: string): boolean {
  const lines = content.split('\n')
  return lines.length >= 2 && lines[1].trim().length > 0
}

/** 去掉英文翻译行，保留中文（第一行） */
export function removeTranslationFromCell(content: string): string {
  const lines = content.split('\n')
  if (lines.length < 2) return content
  const rest = lines.slice(2)
  const chinese = lines[0]
  if (rest.length === 0) return chinese
  return [chinese, ...rest].join('\n')
}

const CACHE_KEY = 'lemon-label-translate-cache-v2'
const CACHE_MAX = 800
const memoryCache = new Map<string, string>()

/**
 * 标签常用计量单位：翻译前把中文单位换成英文简称，
 * 避免机翻把「尺」有时译成 foot、有时译成 feet。
 */
function prepareZhForTranslate(text: string): string {
  return text
    .replace(/[/／]\s*尺/g, '/ft')
    .replace(/(\d+(?:\.\d+)?)\s*尺(?!子)/g, '$1 ft')
    .replace(/[/／]\s*米(?![厘毫])/g, '/m')
    .replace(/(\d+(?:\.\d+)?)\s*米(?![厘毫])/g, '$1 m')
    .replace(/[/／]\s*厘米/g, '/cm')
    .replace(/(\d+(?:\.\d+)?)\s*厘米/g, '$1 cm')
    .replace(/[/／]\s*毫米/g, '/mm')
    .replace(/(\d+(?:\.\d+)?)\s*毫米/g, '$1 mm')
}

/** 纠正机翻残留的 foot/feet 等单位写法 */
function normalizeLabelEnglish(text: string): string {
  return text
    .replace(/[/／]\s*feet?\b/gi, '/ft')
    .replace(/\b(\d+(?:\.\d+)?)\s*\/\s*feet?\b/gi, '$1/ft')
    .replace(/\b(\d+(?:\.\d+)?)\s+feet?\b/gi, '$1 ft')
    .replace(/\bper\s+feet?\b/gi, '/ft')
    .replace(/\bchi\b/gi, 'ft')
    .replace(/[/／]\s*metres?\b/gi, '/m')
    .replace(/[/／]\s*meters?\b/gi, '/m')
    .replace(/[/／]\s*centimet(?:re|er)s?\b/gi, '/cm')
    .replace(/[/／]\s*millimet(?:re|er)s?\b/gi, '/mm')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

function loadDiskCache(): void {
  if (memoryCache.size > 0) return
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return
    const obj = JSON.parse(raw) as Record<string, string>
    for (const [k, v] of Object.entries(obj)) {
      if (typeof k === 'string' && typeof v === 'string' && v.trim()) {
        memoryCache.set(k, v.trim())
      }
    }
  } catch {
    /* ignore */
  }
}

function saveDiskCache(): void {
  try {
    // 超出上限时丢掉较早条目
    if (memoryCache.size > CACHE_MAX) {
      const drop = memoryCache.size - CACHE_MAX
      let i = 0
      for (const key of memoryCache.keys()) {
        memoryCache.delete(key)
        if (++i >= drop) break
      }
    }
    const obj: Record<string, string> = {}
    for (const [k, v] of memoryCache) obj[k] = v
    localStorage.setItem(CACHE_KEY, JSON.stringify(obj))
  } catch {
    /* quota / private mode */
  }
}

function cacheGet(q: string): string | null {
  loadDiskCache()
  return memoryCache.get(q) ?? null
}

function cacheSet(q: string, en: string): void {
  loadDiskCache()
  memoryCache.set(q, en)
  saveDiskCache()
}

async function fetchWithTimeout(
  url: string,
  ms = 10000,
): Promise<Response> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), ms)
  try {
    return await fetch(url, { signal: ctrl.signal })
  } finally {
    clearTimeout(timer)
  }
}

/** Google 免费 gtx 接口（无 Key，桌面端主进程更稳） */
async function translateViaGoogle(q: string): Promise<string> {
  const url =
    'https://translate.googleapis.com/translate_a/single?' +
    new URLSearchParams({
      client: 'gtx',
      sl: 'zh-CN',
      tl: 'en',
      dt: 't',
      q,
    })
  const res = await fetchWithTimeout(url)
  if (!res.ok) throw new Error(`Google HTTP ${res.status}`)
  const data = (await res.json()) as unknown
  // [[["Hello","你好",null,null,1]],null,"zh-CN",...]
  if (!Array.isArray(data) || !Array.isArray(data[0])) {
    throw new Error('Google 返回格式异常')
  }
  const parts: string[] = []
  for (const chunk of data[0]) {
    if (Array.isArray(chunk) && typeof chunk[0] === 'string') {
      parts.push(chunk[0])
    }
  }
  const text = parts.join('').trim()
  if (!text) throw new Error('Google 未返回译文')
  return text
}

/** MyMemory 备用 */
async function translateViaMyMemory(q: string): Promise<string> {
  const url =
    'https://api.mymemory.translated.net/get?' +
    new URLSearchParams({ q, langpair: 'zh-CN|en' })
  const res = await fetchWithTimeout(url, 12000)
  if (!res.ok) throw new Error('MyMemory 暂时不可用')
  const data = (await res.json()) as {
    responseStatus: number
    responseDetails?: string
    responseData?: { translatedText?: string }
  }
  if (data.responseStatus !== 200) {
    throw new Error(data.responseDetails || 'MyMemory 翻译失败')
  }
  const translated = data.responseData?.translatedText?.trim()
  if (!translated) throw new Error('MyMemory 未返回译文')
  return translated
}

async function translateRemote(q: string): Promise<string> {
  // Electron：走主进程，避免渲染进程 CORS / 限流抖动
  const api = window.electronAPI?.translateText
  if (api) {
    const result = await api(q)
    if (result?.ok && result.text?.trim()) return result.text.trim()
    // 主进程失败时继续尝试渲染进程直连
  }

  try {
    return await translateViaGoogle(q)
  } catch {
    return await translateViaMyMemory(q)
  }
}

/** 中文 → 英文（本地缓存 + Google 优先 + MyMemory 备用） */
export async function translateZhToEn(text: string): Promise<string> {
  const q = text.trim()
  if (!q) throw new Error('没有可翻译的文字')
  if (!hasChinese(q)) throw new Error('请先输入中文内容')

  const hit = cacheGet(q)
  if (hit) return normalizeLabelEnglish(hit)

  const prepared = prepareZhForTranslate(q)
  const translated = normalizeLabelEnglish(await translateRemote(prepared))
  cacheSet(q, translated)
  return translated
}

/** 有限并发执行异步任务 */
export async function mapPool<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>,
  onProgress?: (done: number, total: number) => void,
): Promise<R[]> {
  const total = items.length
  const results = new Array<R>(total)
  let next = 0
  let done = 0
  const limit = Math.max(1, Math.min(concurrency, total || 1))

  async function runOne(): Promise<void> {
    while (true) {
      const i = next++
      if (i >= total) return
      results[i] = await worker(items[i], i)
      done += 1
      onProgress?.(done, total)
    }
  }

  await Promise.all(Array.from({ length: limit }, () => runOne()))
  return results
}
