import { test, expect } from '@playwright/test'

test.describe('Demo — Person Selector', () => {
  test('shows student and coach cards', async ({ page }) => {
    await page.goto('/demo')
    await expect(page.getByText('Explore the Demo')).toBeVisible()
    // Students
    await expect(page.getByRole('button', { name: /Aja Williams/ })).toBeVisible()
    await expect(page.getByRole('button', { name: /Marcus Chen/ })).toBeVisible()
    await expect(page.getByRole('button', { name: /Sofia Reyes/ })).toBeVisible()
    // Coaches — these render as buttons with coach name text
    await expect(page.getByText('Elizabeth Chen').first()).toBeVisible()
    await expect(page.getByText('Angelica Morales').first()).toBeVisible()
  })

  test('clicking a student navigates to their garden', async ({ page }) => {
    await page.goto('/demo')
    await page.getByRole('button', { name: /Aja Williams/ }).click()
    await expect(page).toHaveURL(/\/demo\/garden/)
    await expect(page.getByText("Aja's Growth Garden")).toBeVisible()
  })

  test('clicking a coach navigates to their caseload', async ({ page }) => {
    await page.goto('/demo')
    await page.getByRole('button', { name: /Elizabeth Chen/ }).click()
    await expect(page).toHaveURL(/\/demo\/coach/)
    await expect(page.getByText("Elizabeth Chen's Caseload")).toBeVisible()
  })
})

test.describe('Demo — Navigation', () => {
  test('demo header shows DEMO badge and all nav links', async ({ page }) => {
    await page.goto('/demo/garden')
    await expect(page.getByText('Demo', { exact: true })).toBeVisible()
    const nav = page.locator('nav')
    await expect(nav.getByRole('link', { name: 'Garden' })).toBeVisible()
    await expect(nav.getByRole('link', { name: 'Conversation' })).toBeVisible()
    await expect(nav.getByRole('link', { name: 'Coach' })).toBeVisible()
  })

  test('person selector dropdown switches students', async ({ page }) => {
    await page.goto('/demo/garden?student=stu_aja')
    await expect(page.getByText("Aja's Growth Garden")).toBeVisible()

    await page.getByLabel('Select student').selectOption('stu_marcus')
    await expect(page).toHaveURL(/student=stu_marcus/)
    await expect(page.getByText("Marcus's Growth Garden")).toBeVisible()
  })

  test('sign in link is visible in demo header', async ({ page }) => {
    await page.goto('/demo/garden')
    await expect(page.getByRole('link', { name: 'Sign in' })).toBeVisible()
  })
})

test.describe('Demo — Garden Page', () => {
  test('shows garden with skill plants for Aja', async ({ page }) => {
    await page.goto('/demo/garden?student=stu_aja')
    await expect(page.getByText("Aja's Growth Garden")).toBeVisible()
    await expect(page.getByText('Resilience').first()).toBeVisible()
  })

  test('shows garden for all three students', async ({ page }) => {
    for (const [id, name] of [
      ['stu_aja', 'Aja'],
      ['stu_marcus', 'Marcus'],
      ['stu_sofia', 'Sofia'],
    ]) {
      await page.goto(`/demo/garden?student=${id}`)
      await expect(page.getByText(`${name}'s Growth Garden`)).toBeVisible()
    }
  })
})

test.describe('Demo — Conversation Flow', () => {
  test('conversation page loads for Aja', async ({ page }) => {
    await page.goto('/demo/conversation?student=stu_aja')
    await expect(page.getByText('Growth Conversations')).toBeVisible()
    // Should show skill coverage and/or completed conversations
    const hasCoverage = await page.getByText('Skill Coverage').isVisible().catch(() => false)
    const hasCompleted = await page.getByText('Completed').isVisible().catch(() => false)
    expect(hasCoverage || hasCompleted).toBeTruthy()
  })

  test('conversation page loads for Marcus with available work', async ({ page }) => {
    // Marcus may have unreflected work
    await page.goto('/demo/conversation?student=stu_marcus')
    await expect(page.getByText('Growth Conversation')).toBeVisible()
  })

  // Note: All demo students have conversations for all their work,
  // so there's no unreflected work available in the static data.
  // These tests would work if new unreflected work items were added to the demo data.
  test.skip('clicking work starts the conversation with typewriter', async () => {
    // Requires unreflected work in demo data
  })

  test.skip('full conversation flow: phase 1 → 2 → 3 → synthesis', async () => {
    // Requires unreflected work in demo data
  })
})

test.describe('Demo — Coach Dashboard', () => {
  test('shows caseload for Elizabeth', async ({ page }) => {
    await page.goto('/demo/coach?coach=coach_elizabeth')
    await expect(page.getByText("Elizabeth Chen's Caseload")).toBeVisible()
    await expect(page.getByText('Aja Williams')).toBeVisible()
  })

  test('View Garden link navigates to student garden', async ({ page }) => {
    await page.goto('/demo/coach?coach=coach_elizabeth')
    await page.getByText('View Garden').first().click()
    await expect(page).toHaveURL(/\/demo\/coach\//)
    await expect(page.getByText('Coach view')).toBeVisible()
  })

  test('Prep for Session link works', async ({ page }) => {
    await page.goto('/demo/coach?coach=coach_elizabeth')
    await page.getByText('Prep for Session').first().click()
    await expect(page).toHaveURL(/\/demo\/coach\/.*\/prep/)
    await expect(page.getByText('Prep:')).toBeVisible()
  })

  test('back to caseload link works', async ({ page }) => {
    await page.goto('/demo/coach?coach=coach_elizabeth')
    await page.getByText('View Garden').first().click()
    await page.getByText('← Back to Caseload').click()
    await expect(page).toHaveURL(/\/demo\/coach/)
  })
})
