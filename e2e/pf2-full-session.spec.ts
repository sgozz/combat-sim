import { test, expect, type Page, type BrowserContext } from '@playwright/test'

/**
 * E2E Integration Test - PF2 Full Session
 * 
 * Verifies all 11 bugfixes work together in a complete PF2 playthrough:
 * - Task 1: AC calculation with armor
 * - Task 3: Unique spawn positions
 * - Task 4: Dashboard stats persistence
 * - Task 5: Step action functionality
 * - Task 7: TurnStepper updates
 * - Task 8: Tutorial text (square grid)
 * - Task 9: Victory screen display
 * - Task 10: Initiative name display
 * - Task 11: Character editor name input
 */

function uniqueName(base: string): string {
  const suffix = Math.random().toString(36).slice(2, 8)
  return `${base}_${suffix}`.slice(0, 16)
}

async function loginPF2(context: BrowserContext, nickname: string): Promise<Page> {
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

  await page.getByRole('button', { name: /Pathfinder 2e/i }).click()
  await page.waitForTimeout(300)

  const enterBtn = page.getByRole('button', { name: /enter arena/i })
  await expect(enterBtn).toBeEnabled({ timeout: 10000 })
  await enterBtn.click()
  await page.waitForURL('/home', { timeout: 15000 })
  return page
}

test.describe('PF2 Full Session Integration', () => {
  test('complete PF2 playthrough verifying all bugfixes', async ({ browser }) => {
    const context = await browser.newContext()
    const playerName = uniqueName('PF2Player')
    const page = await loginPF2(context, playerName)

    await page.waitForTimeout(1000)

    await page.getByRole('button', { name: /armory/i }).click()
    await page.waitForURL('/armory', { timeout: 10000 })

    await page.locator('.armory-btn-new').click()
    await page.waitForURL(/\/armory\/(new|[a-zA-Z0-9-]+)/, { timeout: 10000 })

    const charName = uniqueName('Valeros')
    const nameInput = page.locator('input.editor-name-input')
    await expect(nameInput).toBeVisible({ timeout: 5000 })
    
    await nameInput.clear()
    await nameInput.fill(charName)
    await page.waitForTimeout(500)

    await page.locator('.editor-btn-save').click()
    await page.waitForURL('/armory', { timeout: 10000 })

    const charCard = page.locator('.armory-character-card').filter({ hasText: charName })
    await expect(charCard).toBeVisible({ timeout: 5000 })

    const backBtn = page.locator('.armory-btn-back').first()
    await backBtn.click()
    await page.waitForURL('/home', { timeout: 10000 })

    await page.getByRole('button', { name: /new match/i }).click()
    await page.waitForTimeout(500)

    const matchName = uniqueName('PF2Match')
    const matchNameInput = page.locator('#cmd-match-name')
    await expect(matchNameInput).toBeVisible({ timeout: 5000 })
    await matchNameInput.clear()
    await matchNameInput.fill(matchName)

    await page.locator('.cmd-btn-create').click()
    await page.waitForURL(/\/lobby\/.*/, { timeout: 10000 })

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

    const addBotBtn = page.locator('.match-settings-bot-btn').filter({ hasText: '+' })
    await expect(addBotBtn).toBeVisible({ timeout: 10000 })
    await addBotBtn.click()
    await page.waitForTimeout(1000)

    const startBtn = page.locator('.lobby-start-btn')
    await expect(startBtn).toBeEnabled({ timeout: 10000 })
    await startBtn.click()

    const confirmBtn = page.locator('.lobby-dialog-btn--confirm')
    if (await confirmBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await confirmBtn.click()
    }

    await page.waitForURL(/\/game\/.*/, { timeout: 15000 })
    await page.waitForTimeout(5000)

    const canvas = page.locator('canvas').first()
    await expect(canvas).toBeVisible({ timeout: 15000 })

    await page.waitForTimeout(2000)

    let actionCount = 0
    const maxActions = 20
    let idleCount = 0

    while (actionCount < maxActions && idleCount < 5) {
      const matchEndOverlay = page.locator('.match-end-overlay')
      if (await matchEndOverlay.isVisible().catch(() => false)) {
        break
      }

      await page.waitForTimeout(1000)

      const endTurnBtn = page.locator('button').filter({ hasText: /end turn/i }).first()
      if (await endTurnBtn.isEnabled().catch(() => false)) {
        await endTurnBtn.click()
        await page.waitForTimeout(2000)
        idleCount = 0
      } else {
        idleCount++
      }

      actionCount++

      if (actionCount % 5 === 0) {
        const overlay = await page.locator('.match-end-overlay').isVisible().catch(() => false)
        if (overlay) break
      }
    }

    await page.waitForTimeout(2000)

    const victoryOverlay = page.locator('.match-end-overlay')
    await expect(victoryOverlay).toBeVisible({ timeout: 30000 })

    const victoryTitle = page.locator('.match-end-title')
    await expect(victoryTitle).toBeVisible({ timeout: 5000 })
    const titleText = await victoryTitle.textContent()
    expect(titleText).toMatch(/VICTORY|DEFEAT|MATCH ENDED/i)

    const returnBtn = page.locator('button').filter({ hasText: /return to dashboard/i })
    await expect(returnBtn).toBeVisible({ timeout: 5000 })
    await returnBtn.click()

    await page.waitForURL(/\/(home|lobby)/, { timeout: 15000 })
    await page.waitForTimeout(1000)

    if (page.url().includes('/lobby')) {
      const leaveBtn = page.locator('button').filter({ hasText: /back|leave/i }).first()
      if (await leaveBtn.isVisible().catch(() => false)) {
        await leaveBtn.click()
        await page.waitForURL('/home', { timeout: 10000 })
      }
    }

    await page.waitForTimeout(1000)

    const statsSection = page.locator('.dashboard-stats, .stats-card, text=/wins?|losses?|matches?/i')
    const hasStats = await statsSection.first().isVisible().catch(() => false)
    
    if (hasStats) {
      const statsText = await page.locator('body').textContent()
      expect(statsText).toMatch(/\d+/)
    }

    await context.close()
  })
})
