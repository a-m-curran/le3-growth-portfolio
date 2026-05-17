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
  // unpdf ships a no-DOM serverless build of pdf.js and is ESM-only, so
  // it is dynamic-imported here exactly like mammoth below. This replaced
  // pdf-parse@2.x, which required the DOMMatrix browser global and a
  // Node range that excluded Trigger.dev's Node 21.7.3 sandbox — every
  // synced PDF landed with empty content as a result. (Alias unpdf's
  // extractText so it does not shadow this module's own extractText.)
  const { extractText: extractPdfText, getDocumentProxy } = await import('unpdf')
  const pdf = await getDocumentProxy(new Uint8Array(buffer))
  const { text } = await extractPdfText(pdf, { mergePages: true })
  return text
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
