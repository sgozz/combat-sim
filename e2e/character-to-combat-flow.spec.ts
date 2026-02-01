import { test, expect, type Page, type BrowserContext } from '@playwright/test'

function uniqueName(base: string): string {
  return `${base}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

async function login(context: BrowserContext, nickname: string): Promise<Page> {
  const page = await context.newPage()
  await page.addInitScript(() => {
    localStorage.clear()
    sessionStorage.clear()
  })
  await page.goto('/')
  await page.waitForLoadState('domcontentloaded')
  await page.waitForTimeout(500)
  
  const nameInput = page.getByPlaceholder(/enter.*name/i)
  await expect(nameInput).toBeVisible({ timeout: 10000 })
  await nameInput.fill(nickname)
  
  // Select GURPS ruleset
  const gurpsBtn = page.getByRole('button', { name: /GURPS 4e/i })
  await expect(gurpsBtn).toBeVisible({ timeout: 5000 })
  await gurpsBtn.click()
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
  await expect(page.locator('.character-armory')).toBeVisible({ timeout: 10000 })
}

async function createCharacter(page: Page, name: string, ruleset: 'gurps' | 'pf2'): Promise<void> {
  await navigateToArmory(page)

  const newCharBtn = page.locator('.armory-btn-new')
  await expect(newCharBtn).toBeVisible({ timeout: 10000 })
  await newCharBtn.click()
  await page.waitForTimeout(300)

  const menuOption = ruleset === 'gurps'
    ? page.locator('.armory-new-char-menu').getByText(/gurps/i)
    : page.locator('.armory-new-char-menu').getByText(/pathfinder/i)

  const hasMenu = await menuOption.isVisible().catch(() => false)
  if (hasMenu) {
    await menuOption.click()
  } else {
    await page.goto(`/armory/new?ruleset=${ruleset}`)
  }

  await page.waitForURL(/\/armory\/(new|[a-zA-Z0-9-]+)/, { timeout: 10000 })

  const nameInput = page.locator('input.editor-name-input, input[name="name"]').first()
  await expect(nameInput).toBeVisible({ timeout: 5000 })
  await nameInput.clear()
  await nameInput.fill(name)
  await page.waitForTimeout(300)

  await page.getByRole('button', { name: /save/i }).first().click()
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

async function createMatch(page: Page, matchName: string, rulesetId: 'gurps' | 'pf2'): Promise<void> {
  await navigateToHome(page)

  await page.getByRole('button', { name: /new match/i }).click()
  await page.waitForTimeout(500)

  const nameInput = page.locator('#cmd-match-name')
  await expect(nameInput).toBeVisible({ timeout: 5000 })
  await nameInput.clear()
  await nameInput.fill(matchName)

  const rulesetLabel = rulesetId === 'gurps' ? 'GURPS 4e' : 'Pathfinder 2e'
  await page.getByRole('button', { name: rulesetLabel }).click()

  await page.getByRole('button', { name: /create match/i }).click()
  await page.waitForURL(/\/lobby\/.*/, { timeout: 10000 })
}

test.describe('Character to Combat Flow', () => {

  test('GURPS: create character, save, select in lobby', async ({ browser }) => {
    const context = await browser.newContext()
    const page = await login(context, uniqueName('GPlayer'))
    const charName = uniqueName('Warrior')

    await createCharacter(page, charName, 'gurps')
    await createMatch(page, uniqueName('GMatch'), 'gurps')

    await page.waitForTimeout(1000)
    const charCard = page.locator('.character-picker-card').filter({ hasText: charName })
    await expect(charCard).toBeVisible({ timeout: 10000 })
    await charCard.click()
    await page.waitForTimeout(500)

    await expect(charCard).toHaveAttribute('aria-pressed', 'true', { timeout: 5000 })

    await context.close()
  })

  test('PF2: create character, save, select in lobby', async ({ browser }) => {
    const context = await browser.newContext()
    const page = await login(context, uniqueName('PPlayer'))
    const charName = uniqueName('Fighter')

    await createCharacter(page, charName, 'pf2')
    await createMatch(page, uniqueName('PMatch'), 'pf2')

    await page.waitForTimeout(1000)
    const charCard = page.locator('.character-picker-card').filter({ hasText: charName })
    await expect(charCard).toBeVisible({ timeout: 10000 })
    await charCard.click()
    await page.waitForTimeout(500)

    await expect(charCard).toHaveAttribute('aria-pressed', 'true', { timeout: 5000 })

    await context.close()
  })

  test('lobby filters characters by match ruleset', async ({ browser }) => {
    const context = await browser.newContext()
    const page = await login(context, uniqueName('Multi'))

    await createCharacter(page, 'GurpsHero', 'gurps')
    await createCharacter(page, 'PF2Hero', 'pf2')

    // GURPS match should only show GURPS character
    await createMatch(page, uniqueName('GM'), 'gurps')
    await page.waitForTimeout(1000)

    const gurpsCard = page.locator('.character-picker-card').filter({ hasText: 'GurpsHero' })
    const pf2Card = page.locator('.character-picker-card').filter({ hasText: 'PF2Hero' })

    await expect(gurpsCard).toBeVisible({ timeout: 10000 })
    expect(await pf2Card.isVisible().catch(() => false)).toBeFalsy()

    await context.close()
  })

})
