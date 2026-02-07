import { test, expect, type Page, type BrowserContext } from '@playwright/test'

type RulesetId = 'gurps' | 'pf2'

function uniqueName(base: string): string {
  const suffix = Math.random().toString(36).slice(2, 8)
  return `${base}_${suffix}`.slice(0, 16)
}

async function login(context: BrowserContext, nickname: string, ruleset: RulesetId = 'gurps'): Promise<Page> {
  const page = await context.newPage()
  await page.addInitScript(() => {
    localStorage.clear()
    sessionStorage.clear()
  })
  await page.goto('/')
  await page.waitForLoadState('domcontentloaded')
  await page.waitForTimeout(500)

  const nameInput = page.getByPlaceholder('Enter username')
  await expect(nameInput).toBeVisible({ timeout: 10000 })
  await nameInput.fill(nickname)

  const rulesetLabel = ruleset === 'gurps' ? /GURPS 4e/i : /Pathfinder 2e/i
  await page.getByRole('button', { name: rulesetLabel }).click()
  await page.waitForTimeout(300)

  const enterBtn = page.getByRole('button', { name: /enter arena/i })
  await expect(enterBtn).toBeEnabled({ timeout: 5000 })
  await enterBtn.click()
  await page.waitForURL('/home', { timeout: 10000 })
  return page
}

async function navigateToArmory(page: Page): Promise<void> {
  await page.getByRole('button', { name: /armory/i }).click()
  await page.waitForURL('/armory', { timeout: 10000 })
  await expect(page.locator('.armory-btn-new')).toBeVisible({ timeout: 10000 })
}

async function createCharacter(page: Page, name: string): Promise<void> {
  await navigateToArmory(page)

  await page.locator('.armory-btn-new').click()
  await page.waitForURL(/\/armory\/(new|[a-zA-Z0-9-]+)/, { timeout: 10000 })

  const nameInput = page.locator('input.editor-name-input')
  await expect(nameInput).toBeVisible({ timeout: 5000 })
  await nameInput.clear()
  await nameInput.fill(name)
  await page.waitForTimeout(300)

  await page.locator('.editor-btn-save').click()
  await page.waitForURL('/armory', { timeout: 10000 })

  await expect(page.locator('.armory-character-card').filter({ hasText: name })).toBeVisible({ timeout: 5000 })
}

async function navigateToHome(page: Page): Promise<void> {
  const backBtn = page.locator('.armory-btn-back, .lobby-back-btn').first()
  if (await backBtn.isVisible().catch(() => false)) {
    await backBtn.click()
    await page.waitForURL('/home', { timeout: 10000 })
  }
}

async function createMatch(page: Page, matchName: string): Promise<void> {
  await navigateToHome(page)

  await page.getByRole('button', { name: /new match/i }).click()
  await page.waitForTimeout(500)

  const nameInput = page.locator('#cmd-match-name')
  await expect(nameInput).toBeVisible({ timeout: 5000 })
  await nameInput.clear()
  await nameInput.fill(matchName)

  await page.locator('.cmd-btn-create').click()
  await page.waitForURL(/\/lobby\/.*/, { timeout: 10000 })
}

test.describe('Character to Combat Flow', () => {

  test('GURPS: create character, save, select in lobby', async ({ browser }) => {
    const context = await browser.newContext()
    const name = uniqueName('GP')
    const page = await login(context, name, 'gurps')
    const charName = uniqueName('War')

    await createCharacter(page, charName)
    await createMatch(page, uniqueName('GM'))

    await page.waitForTimeout(1000)

    const previewName = page.locator('.character-preview-name')
    const alreadySelected = await previewName.filter({ hasText: charName }).isVisible().catch(() => false)

    if (!alreadySelected) {
      const charCard = page.locator('.character-picker-card').filter({ hasText: charName })
      await expect(charCard).toBeVisible({ timeout: 10000 })
      await charCard.click()
      await page.waitForTimeout(500)
    }

    await expect(previewName).toContainText(charName, { timeout: 5000 })

    await context.close()
  })

  test('PF2: create character, save, select in lobby', async ({ browser }) => {
    const context = await browser.newContext()
    const name = uniqueName('PP')
    const page = await login(context, name, 'pf2')
    const charName = uniqueName('Ftr')

    await createCharacter(page, charName)
    await createMatch(page, uniqueName('PM'))

    await page.waitForTimeout(1000)

    const previewName = page.locator('.character-preview-name')
    const alreadySelected = await previewName.filter({ hasText: charName }).isVisible().catch(() => false)

    if (!alreadySelected) {
      const charCard = page.locator('.character-picker-card').filter({ hasText: charName })
      await expect(charCard).toBeVisible({ timeout: 10000 })
      await charCard.click()
      await page.waitForTimeout(500)
    }

    await expect(previewName).toContainText(charName, { timeout: 5000 })

    await context.close()
  })

  test('lobby filters characters by match ruleset', async ({ browser }) => {
    const context = await browser.newContext()
    const name = uniqueName('Mul')
    const page = await login(context, name, 'gurps')

    await createCharacter(page, 'GurpsHero')

    // Switch to PF2 to create a PF2 character
    await navigateToHome(page)
    const rulesetBadge = page.locator('.dashboard-ruleset-badge')
    await rulesetBadge.click()
    await page.waitForTimeout(300)
    const switchConfirm = page.locator('.dashboard-dialog-btn--confirm')
    if (await switchConfirm.isVisible({ timeout: 2000 }).catch(() => false)) {
      await switchConfirm.click()
      await page.waitForTimeout(1000)
    }

    await createCharacter(page, 'PF2Hero')

    // Switch back to GURPS
    await navigateToHome(page)
    await rulesetBadge.click()
    await page.waitForTimeout(300)
    const switchBack = page.locator('.dashboard-dialog-btn--confirm')
    if (await switchBack.isVisible({ timeout: 2000 }).catch(() => false)) {
      await switchBack.click()
      await page.waitForTimeout(1000)
    }

    // Create GURPS match — should only show GURPS character
    await createMatch(page, uniqueName('GM'))
    await page.waitForTimeout(1000)

    const gurpsCard = page.locator('.character-picker-card').filter({ hasText: 'GurpsHero' })
    const pf2Card = page.locator('.character-picker-card').filter({ hasText: 'PF2Hero' })

    await expect(gurpsCard).toBeVisible({ timeout: 10000 })
    expect(await pf2Card.isVisible().catch(() => false)).toBeFalsy()

    await context.close()
  })

})
