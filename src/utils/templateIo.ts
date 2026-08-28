import type { LabelTemplate } from './storage'
import {
  TEMPLATE_FILE_EXT,
  defaultExportFileName,
  defaultExportFileNameUnique,
  serializeTemplateFile,
} from './storage'
import { isElectronApp } from './electron'

function downloadTextFile(fileName: string, content: string) {
  const blob = new Blob([content], { type: 'application/json;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  a.style.display = 'none'
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

function pickTextFile(): Promise<{ name: string; content: string } | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = `.${TEMPLATE_FILE_EXT},.json,application/json`
    input.style.display = 'none'
    input.onchange = async () => {
      const file = input.files?.[0]
      input.remove()
      if (!file) {
        resolve(null)
        return
      }
      try {
        const content = await file.text()
        resolve({ name: file.name, content })
      } catch {
        resolve(null)
      }
    }
    input.oncancel = () => {
      input.remove()
      resolve(null)
    }
    document.body.appendChild(input)
    input.click()
  })
}

/** 导出单个模板到本地文件（不写入本地模板库） */
export async function exportTemplateFile(
  template: LabelTemplate,
  options?: { uniqueName?: boolean },
): Promise<{ ok: boolean; cancelled?: boolean; path?: string }> {
  const fileName = options?.uniqueName
    ? defaultExportFileNameUnique(template)
    : defaultExportFileName(template)
  const content = serializeTemplateFile(template)

  if (isElectronApp() && window.electronAPI?.saveTextFile) {
    return window.electronAPI.saveTextFile({
      title: '导出标签模板',
      defaultPath: fileName,
      filters: [
        { name: '柠檬标签模板', extensions: [TEMPLATE_FILE_EXT, 'json'] },
      ],
      content,
    })
  }

  downloadTextFile(fileName, content)
  return { ok: true }
}

/** 从本地选择并读取模板文件内容 */
export async function pickTemplateFileContent(): Promise<string | null> {
  if (isElectronApp() && window.electronAPI?.openTextFile) {
    const result = await window.electronAPI.openTextFile({
      title: '添加标签模板',
      filters: [
        { name: '柠檬标签模板', extensions: [TEMPLATE_FILE_EXT, 'json'] },
      ],
    })
    if (!result.ok || result.cancelled || !result.content) return null
    return result.content
  }
  const picked = await pickTextFile()
  return picked?.content ?? null
}
