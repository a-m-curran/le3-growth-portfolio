import { test, expect } from '@playwright/test'

test.describe('Login Page', () => {
  test('shows magic link login form', async ({ page }) => {
    await page.goto('/login')
    await expect(page.getByText('LE3 Growth Portfolio')).toBeVisible()
    await expect(page.getByPlaceholder('you@nlu.edu')).toBeVisible()
    await expect(page.getByRole('button', { name: /Send Sign-In Link/ })).toBeVisible()
  })

  test('shows link to demo', async ({ page }) => {
    await page.goto('/login')
    const demoLink = page.getByRole('link', { name: /Try the demo/ })
    await expect(demoLink).toBeVisible()
    await expect(demoLink).toHaveAttribute('href', '/demo')
  })

  test('requires email before submitting', async ({ page }) => {
    await page.goto('/login')
    const submitBtn = page.getByRole('button', { name: /Send Sign-In Link/ })
    await expect(submitBtn).toBeDisabled()
  })

  test('submit button enables with email input', async ({ page }) => {
    await page.goto('/login')
    await page.getByPlaceholder('you@nlu.edu').fill('test@nlu.edu')
    const submitBtn = page.getByRole('button', { name: /Send Sign-In Link/ })
    await expect(submitBtn).toBeEnabled()
  })
})

test.describe('Onboarding Page', () => {
  test('shows onboarding form', async ({ page }) => {
    await page.goto('/onboarding')
    await expect(page.getByText('Welcome to LE3')).toBeVisible()
    await expect(page.getByLabel('First Name')).toBeVisible()
    await expect(page.getByLabel('Last Name')).toBeVisible()
    await expect(page.getByLabel('NLU Student ID')).toBeVisible()
    await expect(page.getByLabel('Your Coach')).toBeVisible()
  })

  test('submit button is disabled until required fields are filled', async ({ page }) => {
    await page.goto('/onboarding')
    const submitBtn = page.getByRole('button', { name: /Create My Portfolio/ })
    await expect(submitBtn).toBeDisabled()
  })
})

test.describe('Auth Redirects', () => {
  test('unauthenticated user on /garden is redirected to /login', async ({ page }) => {
    await page.goto('/garden')
    // Middleware should redirect to /login
    await expect(page).toHaveURL(/\/login/)
  })

  test('unauthenticated user on /conversation is redirected to /login', async ({ page }) => {
    await page.goto('/conversation')
    await expect(page).toHaveURL(/\/login/)
  })

  test('unauthenticated user on /coach is redirected to /login', async ({ page }) => {
    await page.goto('/coach')
    await expect(page).toHaveURL(/\/login/)
  })

  test('demo routes are accessible without auth', async ({ page }) => {
    await page.goto('/demo')
    await expect(page).toHaveURL(/\/demo/)
    await expect(page.getByText('Explore the Demo')).toBeVisible()
  })

  test('demo garden is accessible without auth', async ({ page }) => {
    await page.goto('/demo/garden')
    await expect(page).toHaveURL(/\/demo\/garden/)
    await expect(page.getByText("Growth Garden")).toBeVisible()
  })
})
