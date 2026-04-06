import { test, expect } from '@playwright/test'

test.describe('API — Conversation Start', () => {
  test('POST /api/conversation/start redirects when unauthenticated', async ({ request }) => {
    const response = await request.post('/api/conversation/start', {
      data: { workId: 'fake-id' },
      maxRedirects: 0,
    })
    // Middleware redirects to /login OR the route returns 401
    expect([302, 307, 401].includes(response.status()) || response.url().includes('/login')).toBeTruthy()
  })
})

test.describe('API — Conversation Next Phase', () => {
  test('POST /api/conversation/:id/next-phase is protected', async ({ request }) => {
    const response = await request.post('/api/conversation/fake-id/next-phase', {
      data: { studentResponse: 'test', currentPhase: 1 },
      maxRedirects: 0,
    })
    expect([302, 307, 401].includes(response.status()) || response.url().includes('/login')).toBeTruthy()
  })
})

test.describe('API — Onboarding', () => {
  test('GET /api/onboarding/coaches returns coach list', async ({ request }) => {
    const response = await request.get('/api/onboarding/coaches')
    expect(response.ok()).toBeTruthy()
    const data = await response.json()
    expect(data.coaches).toBeDefined()
    expect(Array.isArray(data.coaches)).toBeTruthy()
    expect(data.coaches.length).toBeGreaterThan(0)
    for (const coach of data.coaches) {
      expect(coach.id).toBeDefined()
      expect(coach.name).toBeDefined()
    }
  })

  test('POST /api/onboarding is protected', async ({ request }) => {
    const response = await request.post('/api/onboarding', {
      data: {
        firstName: 'Test',
        lastName: 'User',
        nluId: 'N00999999',
        coachId: 'fake-id',
      },
      maxRedirects: 0,
    })
    // Should either redirect or return 401
    expect([302, 307, 401].includes(response.status()) || response.url().includes('/login')).toBeTruthy()
  })

  test('GET /api/auth/callback without code redirects to login', async ({ request }) => {
    const response = await request.get('/api/auth/callback', {
      maxRedirects: 0,
    })
    expect([302, 307]).toContain(response.status())
    const location = response.headers()['location']
    expect(location).toContain('/login')
  })
})
