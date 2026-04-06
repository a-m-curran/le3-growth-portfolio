import { test, expect } from '@playwright/test'
import { readFileSync } from 'fs'
import { join } from 'path'

// These tests run against the extract-text module directly
// They don't need the web server

test.describe('Text Extraction', () => {
  test('extracts text from .txt file', async () => {
    const { extractText } = require('../src/lib/extract-text')
    const buffer = Buffer.from('Hello, this is a test document with some content.')
    const result = await extractText(buffer, 'test.txt')
    expect(result).toContain('Hello')
    expect(result).toContain('test document')
  })

  test('extracts text from .md file', async () => {
    const { extractText } = require('../src/lib/extract-text')
    const buffer = Buffer.from('# Heading\n\nSome markdown content with **bold** text.')
    const result = await extractText(buffer, 'test.md')
    expect(result).toContain('Heading')
    expect(result).toContain('bold')
  })

  test('returns empty string for unsupported file types', async () => {
    const { extractText } = require('../src/lib/extract-text')
    const buffer = Buffer.from('binary data')
    const result = await extractText(buffer, 'image.png')
    expect(result).toBe('')
  })

  test('truncates very long content', async () => {
    const { extractText } = require('../src/lib/extract-text')
    const longText = 'A'.repeat(20000)
    const buffer = Buffer.from(longText)
    const result = await extractText(buffer, 'long.txt')
    expect(result.length).toBeLessThan(10000)
    expect(result).toContain('[Content truncated')
  })

  test('isSupported correctly identifies supported types', async () => {
    const { isSupported } = require('../src/lib/extract-text')
    expect(isSupported('essay.pdf')).toBe(true)
    expect(isSupported('paper.docx')).toBe(true)
    expect(isSupported('notes.txt')).toBe(true)
    expect(isSupported('readme.md')).toBe(true)
    expect(isSupported('photo.jpg')).toBe(false)
    expect(isSupported('archive.zip')).toBe(false)
  })

  test('extracts text from real test work file', async () => {
    const { extractText } = require('../src/lib/extract-text')
    const filePath = join(process.cwd(), 'test-work', 'soc155-week1-discussion.txt')
    const buffer = readFileSync(filePath)
    const result = await extractText(buffer, 'soc155-week1-discussion.txt')
    expect(result).toContain('SOC 155')
    expect(result).toContain('Organizational Structure')
    expect(result.length).toBeGreaterThan(100)
  })
})
