import { test, expect, type Page, type BrowserContext } from '@playwright/test'

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

async function createMatchAndGetCode(page: Page): Promise<string> {
  await page.getByRole('button', { name: /new match/i }).click()
  await page.waitForTimeout(500)
  
  const nameInput = page.locator('#cmd-match-name')
  await expect(nameInput).toBeVisible({ timeout: 5000 })
  await nameInput.clear()
  await nameInput.fill('Sync Test')
  
  await page.locator('.cmd-btn-create').click()
  await page.waitForURL(/\/lobby\/.*/, { timeout: 10000 })
  
  // Get invite code from lobby
  const inviteCode = page.locator('.lobby-invite-code')
  await expect(inviteCode).toBeVisible({ timeout: 5000 })
  const codeText = await inviteCode.textContent() ?? ''
  // Extract code from URL (format: "http://localhost:5173?join=XXXXX")
  const match = codeText.match(/join=([A-Z0-9]+)/i)
  if (!match) throw new Error('Could not extract invite code from: ' + codeText)
  
  return match[1]
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
      const inviteCode = await createMatchAndGetCode(player1)
      
      const player2 = await setupPlayer(context2, uniqueName('Bob'))
      
      // Player2 joins via invite code from dashboard
      const joinBtn = player2.getByRole('button', { name: /join by code/i })
      await expect(joinBtn).toBeVisible({ timeout: 5000 })
      await joinBtn.click()
      await player2.waitForTimeout(300)
      
      const joinInput = player2.locator('.dashboard-join-input')
      await expect(joinInput).toBeVisible({ timeout: 3000 })
      await joinInput.fill(inviteCode)
      await player2.locator('.dashboard-join-form').getByRole('button', { name: /join/i }).click()
      
      await player2.waitForURL(/\/lobby\/.*/, { timeout: 10000 })
      await player2.waitForTimeout(1000)
      
      // Both players should see 2 players in the list
      await expect(player1.locator('.player-list-item:not(.player-list-item--empty)')).toHaveCount(2, { timeout: 10000 })
      await expect(player2.locator('.player-list-item:not(.player-list-item--empty)')).toHaveCount(2, { timeout: 10000 })
    } finally {
      await context1.close()
      await context2.close()
    }
  })
  
  test('refresh maintains lobby state', async ({ browser }) => {
    const context1 = await browser.newContext()
    const context2 = await browser.newContext()
    
    try {
      const player1 = await setupPlayer(context1, uniqueName('Alice'))
      const inviteCode = await createMatchAndGetCode(player1)
      
      const player2 = await setupPlayer(context2, uniqueName('Bob'))
      
      const joinBtn = player2.getByRole('button', { name: /join by code/i })
      await joinBtn.click()
      await player2.waitForTimeout(300)
      const joinInput = player2.locator('.dashboard-join-input')
      await joinInput.fill(inviteCode)
      await player2.locator('.dashboard-join-form').getByRole('button', { name: /join/i }).click()
      
      await player2.waitForURL(/\/lobby\/.*/, { timeout: 10000 })
      await player2.waitForTimeout(1000)
      
      await expect(player1.locator('.player-list-item:not(.player-list-item--empty)')).toHaveCount(2, { timeout: 10000 })
      await expect(player2.locator('.player-list-item:not(.player-list-item--empty)')).toHaveCount(2, { timeout: 10000 })
      
      // Reload player2 — state should be maintained via session token
      await player2.reload({ waitUntil: 'networkidle' })
      await player2.waitForTimeout(2000)
      
      await expect(player2.locator('.player-list-item:not(.player-list-item--empty)')).toHaveCount(2, { timeout: 10000 })
      await expect(player1.locator('.player-list-item:not(.player-list-item--empty)')).toHaveCount(2, { timeout: 10000 })
    } finally {
      await context1.close()
      await context2.close()
    }
  })
  
  test('no duplicate matches in list', async ({ browser }) => {
    const context1 = await browser.newContext()
    const context2 = await browser.newContext()
    
    try {
      const player1 = await setupPlayer(context1, uniqueName('Host'))
      const inviteCode = await createMatchAndGetCode(player1)
      
      const player2 = await setupPlayer(context2, uniqueName('Join'))
      
      const joinBtn = player2.getByRole('button', { name: /join by code/i })
      await joinBtn.click()
      await player2.waitForTimeout(300)
      const joinInput = player2.locator('.dashboard-join-input')
      await joinInput.fill(inviteCode)
      await player2.locator('.dashboard-join-form').getByRole('button', { name: /join/i }).click()
      
      await player2.waitForURL(/\/lobby\/.*/, { timeout: 10000 })
      await player2.waitForTimeout(1000)
      
      // Open a second tab to check dashboard
      const page3 = await context2.newPage()
      await page3.goto('/')
      await page3.waitForURL('/home', { timeout: 10000 })
      await page3.waitForTimeout(1000)
      
      // Should have exactly 1 match card
      const matchCards = page3.locator('.dashboard-match-grid .lobby-card')
      await expect(matchCards).toHaveCount(1, { timeout: 10000 })
    } finally {
      await context1.close()
      await context2.close()
    }
  })
})
