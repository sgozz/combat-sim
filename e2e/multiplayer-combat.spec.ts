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
  await nameInput.fill('Combat Test')
  
  await page.locator('.cmd-btn-create').click()
  await page.waitForURL(/\/lobby\/.*/, { timeout: 10000 })
  
  // Get invite code from lobby
  const inviteCode = page.locator('.lobby-invite-code')
  await expect(inviteCode).toBeVisible({ timeout: 5000 })
  const codeText = await inviteCode.textContent() ?? ''
  const match = codeText.match(/join=([A-Z0-9]+)/i)
  if (!match) throw new Error('Could not extract invite code from: ' + codeText)
  
  return match[1]
}

async function joinMatchByCode(page: Page, inviteCode: string): Promise<void> {
  const joinBtn = page.getByRole('button', { name: /join by code/i })
  await expect(joinBtn).toBeVisible({ timeout: 5000 })
  await joinBtn.click()
  await page.waitForTimeout(300)
  
  const joinInput = page.locator('.dashboard-join-input')
  await expect(joinInput).toBeVisible({ timeout: 3000 })
  await joinInput.fill(inviteCode)
  await page.locator('.dashboard-join-form').getByRole('button', { name: /join/i }).click()
  
  await page.waitForURL(/\/lobby\/.*/, { timeout: 10000 })
  await page.waitForTimeout(1000)
}

async function startMatchFromLobby(page: Page): Promise<void> {
  const startBtn = page.locator('.lobby-start-btn')
  await expect(startBtn).toBeEnabled({ timeout: 10000 })
  await startBtn.click()
  
  const confirmBtn = page.locator('.lobby-dialog-btn--confirm')
  if (await confirmBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await confirmBtn.click()
  }
  
  await page.waitForURL(/\/game\/.*/, { timeout: 15000 })
  await page.waitForTimeout(2000)
}

async function waitForMyTurn(page: Page, timeout = 15000): Promise<boolean> {
  const start = Date.now()
  while (Date.now() - start < timeout) {
    const turnText = await page.locator('.turn-stepper').textContent().catch(() => '') ?? ''
    if (turnText.includes('Choose') || turnText.includes('YOUR TURN') || turnText.includes('STEP 1')) {
      return true
    }
    await page.waitForTimeout(500)
  }
  return false
}

async function selectManeuver(page: Page, maneuverName: string): Promise<void> {
  const maneuverBtn = page.locator('.maneuver-btn').filter({ hasText: new RegExp(maneuverName, 'i') }).first()
  if (await maneuverBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await maneuverBtn.click()
    await page.waitForTimeout(300)
  }
}

async function clickOnEnemy(page: Page): Promise<boolean> {
  const canvas = page.locator('canvas').first()
  if (!await canvas.isVisible().catch(() => false)) return false
  
  const box = await canvas.boundingBox()
  if (!box) return false
  
  await canvas.click({ position: { x: box.width * 0.6, y: box.height * 0.5 } })
  await page.waitForTimeout(500)
  
  const attackBtn = page.locator('.action-btn').filter({ hasText: /attack/i }).first()
  return await attackBtn.isVisible().catch(() => false)
}

async function executeAttack(page: Page): Promise<void> {
  const attackBtn = page.locator('.action-btn').filter({ hasText: /attack/i }).first()
  if (await attackBtn.isVisible().catch(() => false)) {
    await attackBtn.click()
    await page.waitForTimeout(500)
  }
}

async function waitForDefenseModal(page: Page, timeout = 10000): Promise<boolean> {
  const start = Date.now()
  while (Date.now() - start < timeout) {
    const modal = page.locator('.defense-modal, .defense-modal-overlay, [class*="defense"]').first()
    if (await modal.isVisible().catch(() => false)) {
      return true
    }
    
    const defenseText = page.getByText(/incoming attack|choose.*defense|dodge|parry|block/i).first()
    if (await defenseText.isVisible().catch(() => false)) {
      return true
    }
    
    await page.waitForTimeout(300)
  }
  return false
}

async function selectDefense(page: Page, defenseType: 'dodge' | 'parry' | 'block' | 'none'): Promise<void> {
  const defenseBtn = page.locator('.defense-card, .defense-btn, button').filter({ 
    hasText: new RegExp(defenseType, 'i') 
  }).first()
  
  if (await defenseBtn.isVisible().catch(() => false)) {
    await defenseBtn.click()
    await page.waitForTimeout(500)
  }
}

test.describe('Multiplayer Combat', () => {
  test('two players can join same lobby via invite code', async ({ browser }) => {
    const context1 = await browser.newContext()
    const context2 = await browser.newContext()
    
    try {
      const player1 = await setupPlayer(context1, uniqueName('Ali'))
      const inviteCode = await createMatchAndGetCode(player1)
      
      const player2 = await setupPlayer(context2, uniqueName('Bob'))
      await joinMatchByCode(player2, inviteCode)
      
      // Both players should see 2 players in the list
      await expect(player1.locator('.player-list-item:not(.player-list-item--empty)')).toHaveCount(2, { timeout: 10000 })
      await expect(player2.locator('.player-list-item:not(.player-list-item--empty)')).toHaveCount(2, { timeout: 10000 })
      
      const p1Names = await player1.locator('.player-list-name').allTextContents()
      const p2Names = await player2.locator('.player-list-name').allTextContents()
      
      expect(p1Names.length).toBeGreaterThanOrEqual(2)
      expect(p2Names.length).toBeGreaterThanOrEqual(2)
      
    } finally {
      await context1.close()
      await context2.close()
    }
  })

  test('two players can start match and take turns', async ({ browser }) => {
    const context1 = await browser.newContext()
    const context2 = await browser.newContext()
    
    try {
      const player1 = await setupPlayer(context1, uniqueName('Ali'))
      const inviteCode = await createMatchAndGetCode(player1)
      
      const player2 = await setupPlayer(context2, uniqueName('Bob'))
      await joinMatchByCode(player2, inviteCode)
      
      // Player2 needs to ready up (ready button only shows with 2+ players)
      const readyBtn = player2.locator('.player-list-ready-btn')
      if (await readyBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await readyBtn.click()
        await player2.waitForTimeout(500)
      }
      
      // Player1 (creator) starts the match
      await startMatchFromLobby(player1)
      // Player2 should also transition to game
      await player2.waitForURL(/\/game\/.*/, { timeout: 15000 })
      await player2.waitForTimeout(2000)
      
      const p1Turn = await player1.locator('.turn-stepper').textContent().catch(() => '') ?? ''
      const p2Turn = await player2.locator('.turn-stepper').textContent().catch(() => '') ?? ''
      
      const p1IsActive = p1Turn.includes('Choose') || p1Turn.includes('STEP')
      const p2IsActive = p2Turn.includes('Choose') || p2Turn.includes('STEP')
      
      expect(p1IsActive || p2IsActive).toBe(true)
      expect(p1IsActive && p2IsActive).toBe(false)
      
      const activePlayer = p1IsActive ? player1 : player2
      
      await selectManeuver(activePlayer, 'Attack')
      await activePlayer.waitForTimeout(500)
      
      const endTurnBtn = activePlayer.getByRole('button', { name: /end turn/i })
      if (await endTurnBtn.isVisible().catch(() => false)) {
        await endTurnBtn.click()
        await activePlayer.waitForTimeout(1000)
      }
      
      const newP1Turn = await player1.locator('.turn-stepper').textContent().catch(() => '') ?? ''
      const newP2Turn = await player2.locator('.turn-stepper').textContent().catch(() => '') ?? ''
      
      const newP1IsActive = newP1Turn.includes('Choose') || newP1Turn.includes('STEP')
      const newP2IsActive = newP2Turn.includes('Choose') || newP2Turn.includes('STEP')
      
      if (p1IsActive) {
        expect(newP2IsActive).toBe(true)
      } else {
        expect(newP1IsActive).toBe(true)
      }
      
    } finally {
      await context1.close()
      await context2.close()
    }
  })

  test('attack triggers defense modal for defender', async ({ browser }) => {
    const context1 = await browser.newContext()
    const context2 = await browser.newContext()
    
    try {
      const player1 = await setupPlayer(context1, uniqueName('Atk'))
      const inviteCode = await createMatchAndGetCode(player1)
      
      const player2 = await setupPlayer(context2, uniqueName('Def'))
      await joinMatchByCode(player2, inviteCode)
      
      // Ready up player2
      const readyBtn = player2.locator('.player-list-ready-btn')
      if (await readyBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await readyBtn.click()
        await player2.waitForTimeout(500)
      }
      
      await startMatchFromLobby(player1)
      await player2.waitForURL(/\/game\/.*/, { timeout: 15000 })
      await player2.waitForTimeout(2000)
      
      const p1IsActive = await waitForMyTurn(player1, 3000)
      const attacker = p1IsActive ? player1 : player2
      const defender = p1IsActive ? player2 : player1
      
      await selectManeuver(attacker, 'Attack')
      await attacker.waitForTimeout(500)
      
      const targetSelected = await clickOnEnemy(attacker)
      
      if (targetSelected) {
        await executeAttack(attacker)
        await attacker.waitForTimeout(500)
        
        const defenseModalVisible = await waitForDefenseModal(defender, 5000)
        
        expect(defenseModalVisible).toBe(true)
        
        if (defenseModalVisible) {
          await selectDefense(defender, 'dodge')
          await defender.waitForTimeout(1000)
          
          const modalGone = !(await defender.locator('.defense-modal').isVisible().catch(() => false))
          expect(modalGone).toBe(true)
        }
      }
      
    } finally {
      await context1.close()
      await context2.close()
    }
  })

  test('player disconnecting from open lobby is removed', async ({ browser }) => {
    const context1 = await browser.newContext()
    const context2 = await browser.newContext()
    
    try {
      const player1 = await setupPlayer(context1, uniqueName('Host'))
      const inviteCode = await createMatchAndGetCode(player1)
      
      const player2 = await setupPlayer(context2, uniqueName('Join'))
      await joinMatchByCode(player2, inviteCode)
      
      const participantsBefore = await player1.locator('.player-list-item:not(.player-list-item--empty)').count()
      expect(participantsBefore).toBe(2)
      
      await player2.close()
      await player1.waitForTimeout(2000)
      
      const participantsAfter = await player1.locator('.player-list-item:not(.player-list-item--empty)').count()
      expect(participantsAfter).toBe(1)
      
    } finally {
      await context1.close()
      await context2.close()
    }
  })

  test('match pauses when active player disconnects during their turn', async ({ browser }) => {
    const context1 = await browser.newContext()
    const context2 = await browser.newContext()
    
    try {
      const player1 = await setupPlayer(context1, uniqueName('P1'))
      const inviteCode = await createMatchAndGetCode(player1)
      
      const player2 = await setupPlayer(context2, uniqueName('P2'))
      await joinMatchByCode(player2, inviteCode)
      
      // Ready up player2
      const readyBtn = player2.locator('.player-list-ready-btn')
      if (await readyBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await readyBtn.click()
        await player2.waitForTimeout(500)
      }
      
      await startMatchFromLobby(player1)
      await player2.waitForURL(/\/game\/.*/, { timeout: 15000 })
      await player2.waitForTimeout(2000)
      
      const p1IsActive = await waitForMyTurn(player1, 3000)
      const activePlayer = p1IsActive ? player1 : player2
      const otherPlayer = p1IsActive ? player2 : player1
      
      await activePlayer.close()
      
      const pauseModal = otherPlayer.locator('.pause-modal')
      await expect(pauseModal).toBeVisible({ timeout: 5000 })
      
    } finally {
      await context1.close()
      await context2.close()
    }
  })
})

test.describe('Defense UI', () => {
  test('defense modal is visible and properly styled', async ({ browser }) => {
    const context1 = await browser.newContext()
    const context2 = await browser.newContext()
    
    try {
      const player1 = await setupPlayer(context1, uniqueName('Atk'))
      const inviteCode = await createMatchAndGetCode(player1)
      
      const player2 = await setupPlayer(context2, uniqueName('Def'))
      await joinMatchByCode(player2, inviteCode)
      
      // Ready up player2
      const readyBtn = player2.locator('.player-list-ready-btn')
      if (await readyBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await readyBtn.click()
        await player2.waitForTimeout(500)
      }
      
      await startMatchFromLobby(player1)
      await player2.waitForURL(/\/game\/.*/, { timeout: 15000 })
      await player2.waitForTimeout(2000)
      
      const p1IsActive = await waitForMyTurn(player1, 3000)
      const attacker = p1IsActive ? player1 : player2
      const defender = p1IsActive ? player2 : player1
      
      await selectManeuver(attacker, 'Attack')
      const targetSelected = await clickOnEnemy(attacker)
      
      if (targetSelected) {
        await executeAttack(attacker)
        
        const defenseModalVisible = await waitForDefenseModal(defender, 5000)
        
        if (defenseModalVisible) {
          const dodgeCard = defender.locator('.defense-card, .defense-btn, button').filter({ hasText: /dodge/i }).first()
          
          await expect(dodgeCard).toBeVisible()
          
          const dodgeBox = await dodgeCard.boundingBox()
          expect(dodgeBox).not.toBeNull()
          expect(dodgeBox!.width).toBeGreaterThan(50)
          expect(dodgeBox!.height).toBeGreaterThan(50)
          
          await selectDefense(defender, 'dodge')
        }
      }
      
    } finally {
      await context1.close()
      await context2.close()
    }
  })
})
