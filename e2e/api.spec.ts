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

test.describe('API — Auth', () => {
  test('GET /api/auth/callback without code redirects to login', async ({ request }) => {
    const response = await request.get('/api/auth/callback', {
      maxRedirects: 0,
    })
    expect([302, 307]).toContain(response.status())
    const location = response.headers()['location']
    expect(location).toContain('/login')
  })

  test('/api/onboarding routes no longer serve content (removed)', async ({ request }) => {
    // The onboarding API routes have been deleted. Since they're not in the
    // middleware's public allowlist, unauthenticated requests get redirected
    // to /login (307). Authenticated requests would hit 404 if they got
    // through. Either outcome confirms the route is gone — we just need to
    // make sure it doesn't return a 2xx response.
    const postResp = await request.post('/api/onboarding', {
      data: { firstName: 'x', lastName: 'x', nluId: 'x', coachId: 'x' },
      maxRedirects: 0,
      failOnStatusCode: false,
    })
    expect(postResp.ok()).toBeFalsy()
    expect([307, 308, 404]).toContain(postResp.status())

    const getResp = await request.get('/api/onboarding/coaches', {
      maxRedirects: 0,
      failOnStatusCode: false,
    })
    expect(getResp.ok()).toBeFalsy()
    expect([307, 308, 404]).toContain(getResp.status())
  })
})
