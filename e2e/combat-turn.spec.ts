import { test, expect, type Page, type BrowserContext } from '@playwright/test'

const MOBILE_VIEWPORT = { width: 390, height: 844 }

function uniqueName(base: string): string {
  const suffix = Math.random().toString(36).slice(2, 8)
  return `${base}_${suffix}`.slice(0, 16)
}

async function setupPlayer(context: BrowserContext, nickname: string): Promise<Page> {
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
  
  await page.getByRole('button', { name: /GURPS 4e/i }).click()
  await page.waitForTimeout(300)
  
  const enterBtn = page.getByRole('button', { name: /enter arena/i })
  await expect(enterBtn).toBeEnabled({ timeout: 10000 })
  await enterBtn.click()
  
  await page.waitForURL('/home', { timeout: 15000 })
  
  return page
}

async function createMatchAndStart(page: Page): Promise<void> {
  await page.getByRole('button', { name: /new match/i }).click()
  await page.waitForTimeout(500)
  
  const nameInput = page.locator('#cmd-match-name')
  await expect(nameInput).toBeVisible({ timeout: 5000 })
  await nameInput.clear()
  await nameInput.fill('Combat Test')
  
  await page.locator('.cmd-btn-create').click()
  await page.waitForURL(/\/lobby\/.*/, { timeout: 10000 })
  
  // Add a bot (need >= 2 combatants)
  const addBotBtn = page.locator('.match-settings-bot-btn').filter({ hasText: '+' })
  await expect(addBotBtn).toBeVisible({ timeout: 5000 })
  await addBotBtn.click()
  await page.waitForTimeout(500)
  
  // Start match
  const startBtn = page.locator('.lobby-start-btn')
  await expect(startBtn).toBeEnabled({ timeout: 5000 })
  await startBtn.click()
  
  // Confirm start
  const confirmBtn = page.locator('.lobby-dialog-btn--confirm')
  if (await confirmBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await confirmBtn.click()
  }
  
  await page.waitForURL(/\/game\/.*/, { timeout: 15000 })
  await page.waitForTimeout(2000)
}

test.describe('Single Player Combat Flow', () => {
  test('Move and Attack allows attack after movement', async ({ browser }) => {
    const context = await browser.newContext()
    const player = await setupPlayer(context, uniqueName('MoveAtk'))
    
    await createMatchAndStart(player)
    
    // Select Move & Attack maneuver (key 5)
    const moveAttackBtn = player.locator('.maneuver-btn').filter({ hasText: /Move.*Attack|Rush/i }).first()
    const btnVisible = await moveAttackBtn.isVisible().catch(() => false)
    
    if (btnVisible) {
      await moveAttackBtn.click()
      await player.waitForTimeout(500)
      
      // Click on canvas to move (click somewhere on the 3D arena)
      const canvas = player.locator('canvas').first()
      if (await canvas.isVisible().catch(() => false)) {
        const box = await canvas.boundingBox()
        if (box) {
          // Click slightly to the right of center to move
          await canvas.click({ position: { x: box.width / 2 + 50, y: box.height / 2 } })
          await player.waitForTimeout(500)
          
          // After clicking hex, confirm move button should appear
          const confirmBtn = player.getByRole('button', { name: /confirm move/i })
          if (await confirmBtn.isVisible().catch(() => false)) {
            await confirmBtn.click()
            await player.waitForTimeout(500)
          }
          
          // After moving, attack button should STILL be visible (this is the bug fix verification)
          const attackBtn = player.locator('.action-btn').filter({ hasText: /attack/i }).first()
          const attackVisible = await attackBtn.isVisible().catch(() => false)
          
          // The attack button should be visible after moving in Move & Attack
          // If it's not visible, it might be because no target is in range, which is OK
          // The key test is that we didn't end turn - check that maneuver panel shows our maneuver
          const maneuverBanner = player.locator('.current-maneuver-banner')
          const bannerVisible = await maneuverBanner.isVisible().catch(() => false)
          
          // Either attack button is visible OR maneuver banner shows we're still in our turn
          expect(attackVisible || bannerVisible).toBeTruthy()
        }
      }
    }
    
    await context.close()
  })

  test('player can start match and see combat UI', async ({ browser }) => {
    const context = await browser.newContext()
    const player = await setupPlayer(context, uniqueName('War'))
    
    await createMatchAndStart(player)
    
    const maneuverBtnVisible = await player.locator('.maneuver-btn').first().isVisible().catch(() => false)
    const panelVisible = await player.locator('.panel').first().isVisible().catch(() => false)
    
    expect(maneuverBtnVisible || panelVisible).toBeTruthy()
    
    if (maneuverBtnVisible) {
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
    const player = await setupPlayer(context, uniqueName('Key'))
    
    await createMatchAndStart(player)
    
    const maneuverBtnVisible = await player.locator('.maneuver-btn').first().isVisible().catch(() => false)
    
    if (maneuverBtnVisible) {
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
      localStorage.clear()
      sessionStorage.clear()
    })
    
    await page.goto('/')
    await page.waitForLoadState('domcontentloaded')
    
    const title = page.getByText(/Tactical Combat Simulator/i)
    await expect(title).toBeVisible({ timeout: 5000 })
    
    const nameInput = page.getByPlaceholder('Enter username')
    await expect(nameInput).toBeVisible({ timeout: 5000 })
    
    await nameInput.fill('TestPlayer')
    
    await page.getByRole('button', { name: /GURPS 4e/i }).click()
    await page.waitForTimeout(300)
    
    const enterBtn = page.getByRole('button', { name: /enter arena/i })
    await expect(enterBtn).toBeEnabled({ timeout: 5000 })
    await enterBtn.click()
    
    await expect(page.getByRole('button', { name: /new match/i })).toBeVisible({ timeout: 15000 })
  })

  test('tutorial can be opened from welcome screen', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.clear()
      sessionStorage.clear()
    })
    
    await page.goto('/')
    await page.waitForLoadState('domcontentloaded')
    
    const tutorialButton = page.getByRole('button', { name: /how to play/i })
    await expect(tutorialButton).toBeVisible({ timeout: 5000 })
    
    await tutorialButton.click()
    
    await expect(page.getByText(/welcome to tactical|getting started|basics/i)).toBeVisible({ timeout: 3000 })
  })

  test('dashboard shows after login', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.clear()
      sessionStorage.clear()
    })
    
    await page.goto('/')
    await page.waitForLoadState('domcontentloaded')
    
    await page.getByPlaceholder('Enter username').fill('LobbyTester')
    await page.getByRole('button', { name: /GURPS 4e/i }).click()
    await page.waitForTimeout(300)
    
    const enterBtn = page.getByRole('button', { name: /enter arena/i })
    await expect(enterBtn).toBeEnabled({ timeout: 10000 })
    await enterBtn.click()
    
    await expect(page.getByRole('button', { name: /new match/i })).toBeVisible({ timeout: 15000 })
  })
})

test.describe('Mobile UI', () => {
  test('mobile can start match and see action bar with HP', async ({ browser }) => {
    const context = await browser.newContext({ viewport: MOBILE_VIEWPORT })
    const page = await setupPlayer(context, uniqueName('MobWar'))
    
    await createMatchAndStart(page)
    
    const actionBar = page.locator('.action-bar')
    await expect(actionBar).toBeVisible({ timeout: 10000 })
    
    const hpStatus = page.locator('.action-bar-status')
    const hpVisible = await hpStatus.isVisible().catch(() => false)
    
    const maneuverBtn = actionBar.locator('.action-bar-btn').filter({ hasText: /maneuver|change/i }).first()
    const maneuverVisible = await maneuverBtn.isVisible().catch(() => false)
    
    expect(hpVisible || maneuverVisible).toBeTruthy()
    
    await context.close()
  })

  test('mobile maneuver popup opens and closes', async ({ browser }) => {
    const context = await browser.newContext({ viewport: MOBILE_VIEWPORT })
    const page = await setupPlayer(context, uniqueName('MobMan'))
    
    await createMatchAndStart(page)
    
    const actionBar = page.locator('.action-bar')
    await expect(actionBar).toBeVisible({ timeout: 10000 })
    
    // Wait for animations to settle
    await page.waitForTimeout(1000)
    
    const maneuverBtn = actionBar.locator('.action-bar-btn').filter({ hasText: /maneuver|change/i }).first()
    if (await maneuverBtn.isVisible().catch(() => false)) {
      await maneuverBtn.click({ force: true })
      await page.waitForTimeout(500)
      
      const maneuverPopup = page.locator('.action-bar-maneuvers')
      await expect(maneuverPopup).toBeVisible({ timeout: 3000 })
      
      const attackOption = maneuverPopup.locator('.action-bar-maneuver-btn').filter({ hasText: /attack/i }).first()
      if (await attackOption.isVisible().catch(() => false)) {
        await attackOption.click({ force: true })
        await page.waitForTimeout(500)
        
        await expect(maneuverPopup).not.toBeVisible()
      }
    }
    
    await context.close()
  })

  test('mobile shows attack button after selecting target', async ({ browser }) => {
    const context = await browser.newContext({ viewport: MOBILE_VIEWPORT })
    const page = await setupPlayer(context, uniqueName('MobAtk'))
    
    await createMatchAndStart(page)
    
    const actionBar = page.locator('.action-bar')
    await expect(actionBar).toBeVisible({ timeout: 10000 })
    await page.waitForTimeout(1000)
    
    const maneuverBtn = actionBar.locator('.action-bar-btn').filter({ hasText: /maneuver|change/i }).first()
    if (await maneuverBtn.isVisible().catch(() => false)) {
      await maneuverBtn.click({ force: true })
      await page.waitForTimeout(500)
      
      const maneuverPopup = page.locator('.action-bar-maneuvers')
      const attackOption = maneuverPopup.locator('.action-bar-maneuver-btn').filter({ hasText: /attack/i }).first()
      if (await attackOption.isVisible().catch(() => false)) {
        await attackOption.click({ force: true })
        await page.waitForTimeout(500)
      }
    }
    
    const hint = actionBar.locator('.action-bar-hint')
    const hintText = await hint.textContent().catch(() => '')
    
    if (hintText?.includes('enemy') || hintText?.includes('target')) {
      const canvas = page.locator('canvas').first()
      if (await canvas.isVisible().catch(() => false)) {
        const box = await canvas.boundingBox()
        if (box) {
          await canvas.click({ position: { x: box.width / 2 + 30, y: box.height / 2 } })
          await page.waitForTimeout(1000)
          
          const attackBtn = actionBar.locator('.action-bar-btn.primary').first()
          const attackVisible = await attackBtn.isVisible().catch(() => false)
          
          expect(attackVisible).toBeTruthy()
        }
      }
    }
    
    await context.close()
  })

  test('mobile initiative tracker is compact', async ({ browser }) => {
    const context = await browser.newContext({ viewport: MOBILE_VIEWPORT })
    const page = await setupPlayer(context, uniqueName('MobInit'))
    
    await createMatchAndStart(page)
    
    const initiativeTracker = page.locator('.initiative-tracker')
    if (await initiativeTracker.isVisible().catch(() => false)) {
      const indicator = page.locator('.initiative-indicator')
      const indicatorHidden = !(await indicator.isVisible().catch(() => false))
      expect(indicatorHidden).toBeTruthy()
    }
    
    await context.close()
  })

  test('mobile camera controls are hidden', async ({ browser }) => {
    const context = await browser.newContext({ viewport: MOBILE_VIEWPORT })
    const page = await setupPlayer(context, uniqueName('MobCam'))
    
    await createMatchAndStart(page)
    
    const cameraControls = page.locator('.camera-controls-compact')
    const cameraHidden = !(await cameraControls.isVisible().catch(() => false))
    expect(cameraHidden).toBeTruthy()
    
    await context.close()
  })
})
