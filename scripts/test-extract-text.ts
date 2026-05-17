/**
 * Regression test for src/lib/extract-text.ts.
 *
 * Guards the exact gap that let the PDF-extraction bug ship: there was
 * no test that a real PDF actually extracts. SAMPLE_PDF_B64 is a
 * minimal, structurally-valid PDF whose text is "Hello LE3 recovery".
 *
 * No DB, no env, no network — pure function.
 *
 * USAGE:
 *   npx tsx scripts/test-extract-text.ts
 */

import { extractText } from '@/lib/extract-text'

// Minimal valid PDF (Catalog/Pages/Page/Contents/Font + correct xref).
// Verified: unpdf@1.6.2 extractText → "Hello LE3 recovery".
const SAMPLE_PDF_B64 =
  'JVBERi0xLjQKMSAwIG9iago8PCAvVHlwZSAvQ2F0YWxvZyAvUGFnZXMgMiAwIFIgPj4KZW5kb2JqCjIgMCBvYmoKPDwgL1R5cGUgL1BhZ2VzIC9LaWRzIFszIDAgUl0gL0NvdW50IDEgPj4KZW5kb2JqCjMgMCBvYmoKPDwgL1R5cGUgL1BhZ2UgL1BhcmVudCAyIDAgUiAvTWVkaWFCb3ggWzAgMCAzMDAgMTQ0XSAvQ29udGVudHMgNCAwIFIgL1Jlc291cmNlcyA8PCAvRm9udCA8PCAvRjEgNSAwIFIgPj4gPj4gPj4KZW5kb2JqCjQgMCBvYmoKPDwgL0xlbmd0aCA0OSA+PgpzdHJlYW0KQlQgL0YxIDE4IFRmIDIwIDEwMCBUZCAoSGVsbG8gTEUzIHJlY292ZXJ5KSBUaiBFVAplbmRzdHJlYW0KZW5kb2JqCjUgMCBvYmoKPDwgL1R5cGUgL0ZvbnQgL1N1YnR5cGUgL1R5cGUxIC9CYXNlRm9udCAvSGVsdmV0aWNhID4+CmVuZG9iagp4cmVmCjAgNgowMDAwMDAwMDAwIDY1NTM1IGYgCjAwMDAwMDAwMDkgMDAwMDAgbiAKMDAwMDAwMDA1OCAwMDAwMCBuIAowMDAwMDAwMTE1IDAwMDAwIG4gCjAwMDAwMDAyNDEgMDAwMDAgbiAKMDAwMDAwMDM0MCAwMDAwMCBuIAp0cmFpbGVyCjw8IC9TaXplIDYgL1Jvb3QgMSAwIFIgPj4Kc3RhcnR4cmVmCjQxMAolJUVPRg=='

let passed = 0
let failed = 0

function ok(cond: boolean, label: string, detail?: string): void {
  if (cond) {
    passed++
    console.log(`  ✓ ${label}`)
  } else {
    failed++
    console.error(`  ✗ ${label}`)
    if (detail) console.error(`    ${detail}`)
  }
}

async function main(): Promise<void> {
  console.log('\n\x1b[1;36m━━━ extractText: real PDF ━━━\x1b[0m')
  const buf = Buffer.from(SAMPLE_PDF_B64, 'base64')
  let text = ''
  let threw: unknown = null
  try {
    text = await extractText(buf, 'sample.pdf')
  } catch (e) {
    threw = e
  }
  ok(threw === null, 'extractText(pdf) does not throw', String(threw))
  ok(text.includes('Hello LE3 recovery'), 'extracted text contains the PDF body', JSON.stringify(text))

  console.log('\n\x1b[1;36m━━━ extractText: unsupported type ━━━\x1b[0m')
  const empty = await extractText(Buffer.from('binary'), 'image.png')
  ok(empty === '', 'unsupported extension returns empty string', JSON.stringify(empty))

  console.log(`\n${passed} passed, ${failed} failed`)
  process.exit(failed > 0 ? 1 : 0)
}
main()
