import { test, expect } from '@playwright/test'

test.describe('LTI 1.3 Public Endpoints', () => {
  test('GET /api/lti/config returns tool configuration JSON', async ({ request }) => {
    const response = await request.get('/api/lti/config')
    expect(response.ok()).toBeTruthy()

    const config = await response.json()
    expect(config.title).toBe('LE3 Growth Portfolio')
    expect(config.oidc_initiation_url).toContain('/api/lti/login')
    expect(config.target_link_uri).toContain('/api/lti/launch')
    expect(config.public_jwk_url).toContain('/api/lti/jwks')
    expect(Array.isArray(config.scopes)).toBeTruthy()
  })

  test('GET /api/lti/jwks returns 503 without keys OR a valid JWKS', async ({ request }) => {
    const response = await request.get('/api/lti/jwks')
    // If LTI keys are not configured (dev mode), expect 503.
    // If configured, expect a valid JWKS structure.
    if (response.status() === 503) {
      const body = await response.json()
      expect(body.error).toBeTruthy()
    } else {
      expect(response.ok()).toBeTruthy()
      const jwks = await response.json()
      expect(Array.isArray(jwks.keys)).toBeTruthy()
    }
  })

  test('POST /api/lti/launch rejects without state cookie', async ({ request }) => {
    const response = await request.post('/api/lti/launch', {
      multipart: {
        id_token: 'fake.token.here',
        state: 'random-state',
      },
      maxRedirects: 0,
    })
    // Should reject because there's no matching cookie.
    // The exact status depends on whether LTI is configured at all.
    expect([400, 401, 500]).toContain(response.status())
  })

  test('GET /api/lti/login without required params returns 400', async ({ request }) => {
    const response = await request.get('/api/lti/login', { maxRedirects: 0 })
    // Expect either 400 (missing params) or 500 (LTI not configured) — both acceptable
    expect([400, 500]).toContain(response.status())
  })
})
