import type { DataRow } from './variables'

export interface ParsedTable {
  headers: string[]
  rows: DataRow[]
}

function detectDelimiter(line: string): string {
  const tabs = (line.match(/\t/g) || []).length
  const commas = (line.match(/,/g) || []).length
  if (tabs > commas) return '\t'
  return ','
}

function parseLine(line: string, delimiter: string): string[] {
  const out: string[] = []
  let cur = ''
  let inQuote = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuote && line[i + 1] === '"') {
        cur += '"'
        i++
      } else {
        inQuote = !inQuote
      }
      continue
    }
    if (!inQuote && ch === delimiter) {
      out.push(cur.trim())
      cur = ''
      continue
    }
    cur += ch
  }
  out.push(cur.trim())
  return out
}

export function parseCsvText(raw: string): ParsedTable {
  const text = raw.replace(/^\uFEFF/, '').trim()
  if (!text) return { headers: [], rows: [] }

  const lines = text.split(/\r?\n/).filter((l) => l.trim())
  if (lines.length === 0) return { headers: [], rows: [] }

  const delimiter = detectDelimiter(lines[0])
  const headers = parseLine(lines[0], delimiter)
  const rows: DataRow[] = []

  for (let i = 1; i < lines.length; i++) {
    const cols = parseLine(lines[i], delimiter)
    if (cols.every((c) => !c)) continue
    const row: DataRow = {}
    headers.forEach((h, idx) => {
      row[h] = cols[idx] ?? ''
    })
    rows.push(row)
  }

  return { headers, rows }
}
