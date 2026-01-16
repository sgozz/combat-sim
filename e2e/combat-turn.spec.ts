import { test, expect, type Page, type BrowserContext } from '@playwright/test'

async function setupPlayer(context: BrowserContext, nickname: string): Promise<Page> {
  const page = await context.newPage()
  
  await page.addInitScript(() => {
    localStorage.removeItem('gurps.nickname')
  })
  
  await page.goto('/')
  await page.waitForLoadState('networkidle')
  
  const nameInput = page.getByPlaceholder('Enter your name')
  await expect(nameInput).toBeVisible({ timeout: 10000 })
  await nameInput.fill(nickname)
  
  await page.getByRole('button', { name: /enter arena/i }).click()
  
  await expect(page.getByText(/create lobby|quick match/i)).toBeVisible({ timeout: 10000 })
  
  return page
}

test.describe('Single Player Combat Flow', () => {
  test('player can start match and see combat UI', async ({ browser }) => {
    const context = await browser.newContext()
    const player = await setupPlayer(context, 'TestWarrior')
    
    const quickMatchBtn = player.getByRole('button', { name: /quick match/i })
    await expect(quickMatchBtn).toBeVisible({ timeout: 5000 })
    await quickMatchBtn.click()
    
    await expect(player.getByText(/leave lobby/i)).toBeVisible({ timeout: 10000 })
    
    const editBtn = player.getByRole('button', { name: /edit character/i })
    await expect(editBtn).toBeVisible({ timeout: 5000 })
    await editBtn.click()
    
    await player.waitForTimeout(500)
    const nameInput = player.locator('input[type="text"]').first()
    await expect(nameInput).toBeVisible({ timeout: 3000 })
    await nameInput.clear()
    await nameInput.fill('Champion')
    
    await player.getByRole('button', { name: /save/i }).click()
    await player.waitForTimeout(500)
    
    const startBtn = player.getByRole('button', { name: /start match/i })
    await expect(startBtn).toBeVisible({ timeout: 5000 })
    await startBtn.click()
    
    await player.waitForTimeout(2000)
    
    const maneuverVisible = await player.getByText(/choose maneuver/i).isVisible().catch(() => false)
    const actionsVisible = await player.getByText(/actions/i).isVisible().catch(() => false)
    
    expect(maneuverVisible || actionsVisible).toBeTruthy()
    
    if (maneuverVisible) {
      const attackBtn = player.locator('.maneuver-btn').filter({ hasText: /Attack/ }).first()
      if (await attackBtn.isVisible().catch(() => false)) {
        await attackBtn.click()
        await player.waitForTimeout(500)
      }
      
      const endTurnBtn = player.getByRole('button', { name: /end turn/i })
      if (await endTurnBtn.isVisible().catch(() => false)) {
        await endTurnBtn.click()
        await player.waitForTimeout(1000)
      }
    }
    
    await context.close()
  })

  test('player can use keyboard shortcuts', async ({ browser }) => {
    const context = await browser.newContext()
    const player = await setupPlayer(context, 'KeyboardUser')
    
    await player.getByRole('button', { name: /quick match/i }).click()
    await expect(player.getByText(/leave lobby/i)).toBeVisible({ timeout: 10000 })
    
    await player.getByRole('button', { name: /start match/i }).click()
    await player.waitForTimeout(2000)
    
    const maneuverVisible = await player.getByText(/choose maneuver/i).isVisible().catch(() => false)
    
    if (maneuverVisible) {
      await player.keyboard.press('1')
      await player.waitForTimeout(500)
      
      await player.keyboard.press('e')
      await player.waitForTimeout(500)
    }
    
    await context.close()
  })
})

test.describe('UI Elements', () => {
  test('welcome screen shows and accepts nickname', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.removeItem('gurps.nickname')
    })
    
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    
    const title = page.getByText(/GURPS Combat Simulator/i)
    await expect(title).toBeVisible({ timeout: 5000 })
    
    const nameInput = page.getByPlaceholder('Enter your name')
    await expect(nameInput).toBeVisible({ timeout: 5000 })
    
    await nameInput.fill('TestPlayer')
    
    const enterBtn = page.getByRole('button', { name: /enter arena/i })
    await expect(enterBtn).toBeVisible()
    await enterBtn.click()
    
    await expect(page.getByText(/quick match/i)).toBeVisible({ timeout: 10000 })
  })

  test('tutorial can be opened from welcome screen', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.removeItem('gurps.nickname')
    })
    
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    
    const tutorialButton = page.getByRole('button', { name: /how to play/i })
    await expect(tutorialButton).toBeVisible({ timeout: 5000 })
    
    await tutorialButton.click()
    
    await expect(page.getByText(/welcome to gurps|getting started|basics/i)).toBeVisible({ timeout: 3000 })
  })

  test('lobby browser shows after login', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.removeItem('gurps.nickname')
    })
    
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    
    await page.getByPlaceholder('Enter your name').fill('LobbyTester')
    await page.getByRole('button', { name: /enter arena/i }).click()
    
    await expect(page.getByRole('button', { name: /quick match/i })).toBeVisible({ timeout: 10000 })
    await expect(page.getByRole('button', { name: /refresh/i })).toBeVisible({ timeout: 5000 })
  })
})
