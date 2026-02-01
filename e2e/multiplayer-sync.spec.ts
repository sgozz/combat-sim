import { test, expect, type Page, type BrowserContext } from '@playwright/test'

function uniqueName(base: string): string {
  return `${base}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

async function setupPlayer(context: BrowserContext, nickname: string): Promise<Page> {
  const page = await context.newPage()
  
  await page.addInitScript(() => {
    localStorage.clear()
  })
  
  await page.goto('/')
  await page.waitForLoadState('domcontentloaded')
  
  const nameInput = page.getByPlaceholder('Enter username')
  await expect(nameInput).toBeVisible({ timeout: 10000 })
  await nameInput.fill(nickname)
  
  // Select GURPS ruleset
  await page.getByRole('button', { name: /GURPS 4e/i }).click()
  
  await page.getByRole('button', { name: /enter arena/i }).click()
  await page.waitForURL('**/matches', { timeout: 10000 })
  
  return page
}

async function createLobbyAndGetInviteCode(page: Page): Promise<string> {
  await page.getByRole('button', { name: /new match/i }).click()
  await page.waitForURL('**/game', { timeout: 10000 })
  
  const inviteInput = page.locator('.setup-invite-input')
  await expect(inviteInput).toBeVisible({ timeout: 10000 })
  const inviteUrl = await inviteInput.inputValue()
  const match = inviteUrl.match(/join=([A-Z0-9]+)/)
  if (!match) throw new Error('Could not get invite code from: ' + inviteUrl)
  
  return match[1]
}

async function setBotCount(page: Page, count: number): Promise<void> {
  const botDisplay = page.locator('.bot-count-display')
  if (!await botDisplay.isVisible({ timeout: 3000 }).catch(() => false)) return
  
  const currentCount = await botDisplay.textContent()
  const current = parseInt(currentCount || '1', 10)
  
  const minusBtn = page.locator('.setup-bot-btn').filter({ hasText: '−' }).first()
  const plusBtn = page.locator('.setup-bot-btn').filter({ hasText: '+' }).first()
  
  if (count < current) {
    for (let i = 0; i < current - count; i++) {
      if (await minusBtn.isEnabled()) await minusBtn.click()
    }
  } else if (count > current) {
    for (let i = 0; i < count - current; i++) {
      if (await plusBtn.isEnabled()) await plusBtn.click()
    }
  }
}

test.describe('Multiplayer Lobby Sync', () => {
  test('lobby synchronization', async ({ browser }) => {
    const context1 = await browser.newContext()
    const context2 = await browser.newContext()
    
    await context1.addInitScript(() => {
      localStorage.clear()
    })
    await context2.addInitScript(() => {
      localStorage.clear()
    })
    
    try {
      const player1 = await setupPlayer(context1, uniqueName('Alice'))
      const inviteCode = await createLobbyAndGetInviteCode(player1)
      await setBotCount(player1, 0)
      
      const player2 = await context2.newPage()
      await player2.addInitScript(() => localStorage.clear())
      await player2.goto(`/?join=${inviteCode}`)
      await player2.waitForLoadState('domcontentloaded')
      
      const nameInput = player2.getByPlaceholder('Enter username')
      await expect(nameInput).toBeVisible({ timeout: 10000 })
      await nameInput.fill(uniqueName('Bob'))
      await player2.getByRole('button', { name: /enter arena/i }).click()
      
      await player2.waitForURL('**/game', { timeout: 10000 })
      await player2.waitForTimeout(1000)
      
      await expect(player2.locator('.setup-player-item')).toHaveCount(2, { timeout: 10000 })
      await expect(player1.locator('.setup-player-item')).toHaveCount(2, { timeout: 10000 })
    } finally {
      await context1.close()
      await context2.close()
    }
  })
  
  test('refresh maintains lobby state', async ({ browser }) => {
    const context1 = await browser.newContext()
    const context2 = await browser.newContext()
    
    await context1.addInitScript(() => {
      localStorage.clear()
    })
    await context2.addInitScript(() => {
      localStorage.clear()
    })
    
    try {
      const player1 = await setupPlayer(context1, uniqueName('Alice'))
      const inviteCode = await createLobbyAndGetInviteCode(player1)
      await setBotCount(player1, 0)
      
      const player2 = await context2.newPage()
      await player2.addInitScript(() => localStorage.clear())
      await player2.goto(`/?join=${inviteCode}`)
      await player2.waitForLoadState('domcontentloaded')
      
      const nameInput = player2.getByPlaceholder('Enter username')
      await expect(nameInput).toBeVisible({ timeout: 10000 })
      await nameInput.fill(uniqueName('Bob'))
      await player2.getByRole('button', { name: /enter arena/i }).click()
      await player2.waitForURL('**/game', { timeout: 10000 })
      await player2.waitForTimeout(1000)
      
      await expect(player2.locator('.setup-player-item')).toHaveCount(2, { timeout: 10000 })
      await expect(player1.locator('.setup-player-item')).toHaveCount(2, { timeout: 10000 })
      
      await player2.reload({ waitUntil: 'networkidle' })
      await player2.waitForTimeout(1000)
      
      await expect(player2.locator('.setup-player-item')).toHaveCount(2, { timeout: 10000 })
      await expect(player1.locator('.setup-player-item')).toHaveCount(2, { timeout: 10000 })
    } finally {
      await context1.close()
      await context2.close()
    }
  })
  
  test('no duplicate matches in list', async ({ browser }) => {
    const context1 = await browser.newContext()
    const context2 = await browser.newContext()
    
    await context1.addInitScript(() => {
      localStorage.clear()
    })
    await context2.addInitScript(() => {
      localStorage.clear()
    })
    
    try {
      const player1 = await setupPlayer(context1, uniqueName('Host'))
      const inviteCode = await createLobbyAndGetInviteCode(player1)
      await setBotCount(player1, 0)
      
      const player2 = await context2.newPage()
      await player2.addInitScript(() => localStorage.clear())
      await player2.goto(`/?join=${inviteCode}`)
      await player2.waitForLoadState('domcontentloaded')
      
      const nameInput = player2.getByPlaceholder('Enter username')
      await expect(nameInput).toBeVisible({ timeout: 10000 })
      await nameInput.fill(uniqueName('Joiner'))
      await player2.getByRole('button', { name: /enter arena/i }).click()
      await player2.waitForURL('**/game', { timeout: 10000 })
      await player2.waitForTimeout(1000)
      
      await player2.goto('/home')
      await player2.waitForLoadState('domcontentloaded')
      
      await player2.reload({ waitUntil: 'networkidle' })
      await player2.waitForTimeout(1000)
      
      const matchCards = player2.locator('.dashboard-match-grid .lobby-card').filter({ hasText: inviteCode })
      await expect(matchCards).toHaveCount(1, { timeout: 10000 })
    } finally {
      await context1.close()
      await context2.close()
    }
  })
})
