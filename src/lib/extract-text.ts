/**
 * Extract text content from uploaded files.
 * Supports: PDF, DOCX, TXT, MD
 * Truncates to ~8000 chars to stay within LLM context limits.
 */

const MAX_CONTENT_LENGTH = 8000

export async function extractText(buffer: Buffer, filename: string): Promise<string> {
  const ext = filename.toLowerCase().split('.').pop() || ''

  let text = ''

  switch (ext) {
    case 'pdf':
      text = await extractPdf(buffer)
      break
    case 'docx':
      text = await extractDocx(buffer)
      break
    case 'txt':
    case 'md':
    case 'markdown':
      text = buffer.toString('utf-8')
      break
    default:
      return ''
  }

  // Clean up whitespace
  text = text.replace(/\s+/g, ' ').trim()

  // Truncate if needed
  if (text.length > MAX_CONTENT_LENGTH) {
    text = text.substring(0, MAX_CONTENT_LENGTH) + '\n\n[Content truncated — original was longer]'
  }

  return text
}

async function extractPdf(buffer: Buffer): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const pdfParse = require('pdf-parse') as (buf: Buffer) => Promise<{ text: string }>
  const result = await pdfParse(buffer)
  return result.text
}

async function extractDocx(buffer: Buffer): Promise<string> {
  const mammoth = await import('mammoth')
  const result = await mammoth.extractRawText({ buffer })
  return result.value
}

export function getSupportedExtensions(): string[] {
  return ['pdf', 'docx', 'txt', 'md']
}

export function isSupported(filename: string): boolean {
  const ext = filename.toLowerCase().split('.').pop() || ''
  return getSupportedExtensions().includes(ext)
}
