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

interface MyMemoryResponse {
  responseStatus: number
  responseDetails?: string
  responseData?: { translatedText?: string }
}

/** 中文 → 英文（MyMemory 免费接口） */
export async function translateZhToEn(text: string): Promise<string> {
  const q = text.trim()
  if (!q) throw new Error('没有可翻译的文字')
  if (!hasChinese(q)) throw new Error('请先输入中文内容')

  const url =
    'https://api.mymemory.translated.net/get?' +
    new URLSearchParams({ q, langpair: 'zh-CN|en' })

  const res = await fetch(url)
  if (!res.ok) throw new Error('翻译服务暂时不可用，请稍后重试')

  const data = (await res.json()) as MyMemoryResponse
  if (data.responseStatus !== 200) {
    throw new Error(data.responseDetails || '翻译失败')
  }

  const translated = data.responseData?.translatedText?.trim()
  if (!translated) throw new Error('未获取到翻译结果')

  return translated
}
