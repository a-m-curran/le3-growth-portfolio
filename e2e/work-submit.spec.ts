import { test, expect } from '@playwright/test'

test.describe('Work Submit Page (unauthenticated)', () => {
  test('redirects to login when not authenticated', async ({ page }) => {
    await page.goto('/work/submit')
    await expect(page).toHaveURL(/\/login/)
  })
})

test.describe('Work Submit API', () => {
  test('POST /api/work/submit is protected', async ({ request }) => {
    const response = await request.post('/api/work/submit', {
      multipart: {
        title: 'Test Work',
        workType: 'essay',
      },
      maxRedirects: 0,
    })
    // Middleware redirects unauthenticated requests
    expect([302, 307, 401].includes(response.status()) || response.url().includes('/login')).toBeTruthy()
  })
})
