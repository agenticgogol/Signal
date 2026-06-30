import mammoth from 'mammoth'
import { PDFParse } from 'pdf-parse'
import { normalizeText } from '@/lib/knowledge'

function titleFromFilename(filename: string) {
  return filename.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim() || 'Uploaded document'
}

function notebookTextFromIpynb(jsonText: string) {
  const notebook = JSON.parse(jsonText) as { cells?: Array<{ cell_type?: string; source?: string[] | string }> }
  const lines: string[] = []
  for (const cell of notebook.cells ?? []) {
    const source = Array.isArray(cell.source) ? cell.source.join('') : String(cell.source || '')
    if (!source.trim()) continue
    lines.push(`### ${cell.cell_type || 'cell'}\n${source}`)
  }
  return normalizeText(lines.join('\n\n'))
}

export async function extractUploadText(file: File) {
  const filename = file.name || 'upload'
  const lower = filename.toLowerCase()
  const buffer = Buffer.from(await file.arrayBuffer())

  if (lower.endsWith('.pdf')) {
    const parser = new PDFParse({ data: buffer })
    const parsed = await parser.getText()
    await parser.destroy()
    return {
      title: titleFromFilename(filename),
      text: normalizeText(parsed.text || ''),
    }
  }

  if (lower.endsWith('.docx') || lower.endsWith('.doc')) {
    const parsed = await mammoth.extractRawText({ buffer })
    return {
      title: titleFromFilename(filename),
      text: normalizeText(parsed.value || ''),
    }
  }

  const utf8 = buffer.toString('utf8')

  if (lower.endsWith('.ipynb')) {
    return {
      title: titleFromFilename(filename),
      text: notebookTextFromIpynb(utf8),
    }
  }

  if (lower.endsWith('.txt') || lower.endsWith('.md') || lower.endsWith('.py') || lower.endsWith('.js') || lower.endsWith('.ts')) {
    return {
      title: titleFromFilename(filename),
      text: normalizeText(utf8),
    }
  }

  return {
    title: titleFromFilename(filename),
    text: normalizeText(utf8),
  }
}
