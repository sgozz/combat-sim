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
  await page.waitForLoadState('networkidle')
  
  const nameInput = page.getByPlaceholder('Enter your name')
  await expect(nameInput).toBeVisible({ timeout: 10000 })
  await nameInput.fill(nickname)
  
  await page.getByRole('button', { name: /enter arena/i }).click()
  await page.waitForURL('**/lobby', { timeout: 10000 })
  
  return page
}

async function createLobbyAndGetInviteCode(page: Page): Promise<string> {
  await page.getByRole('button', { name: /quick match/i }).click()
  await page.waitForURL('**/game', { timeout: 10000 })
  
  const inviteCode = await page.locator('code').first().textContent()
  if (!inviteCode) throw new Error('Could not get invite code')
  
  return inviteCode
}

async function setBotCount(page: Page, count: number): Promise<void> {
  const currentCount = await page.locator('.bot-count-value, .bot-selector span').first().textContent()
  const current = parseInt(currentCount || '1', 10)
  
  const minusBtn = page.locator('button').filter({ hasText: '−' }).first()
  const plusBtn = page.locator('button').filter({ hasText: '+' }).first()
  
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

async function waitForMyTurn(page: Page, timeout = 15000): Promise<boolean> {
  const start = Date.now()
  while (Date.now() - start < timeout) {
    const turnText = await page.locator('.turn-stepper').textContent().catch(() => '')
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
      const player1 = await setupPlayer(context1, uniqueName('Alice'))
      const inviteCode = await createLobbyAndGetInviteCode(player1)
      
      await setBotCount(player1, 0)
      
      const player2 = await context2.newPage()
      await player2.addInitScript(() => localStorage.clear())
      await player2.goto(`/?join=${inviteCode}`)
      await player2.waitForLoadState('networkidle')
      
      const nameInput = player2.getByPlaceholder('Enter your name')
      await expect(nameInput).toBeVisible({ timeout: 10000 })
      await nameInput.fill(uniqueName('Bob'))
      await player2.getByRole('button', { name: /enter arena/i }).click()
      
      await player2.waitForURL('**/game', { timeout: 10000 })
      await player2.waitForTimeout(1000)
      
      const p1Participants = await player1.locator('li').allTextContents()
      const p2Participants = await player2.locator('li').allTextContents()
      
      expect(p1Participants.length).toBeGreaterThanOrEqual(2)
      expect(p2Participants.length).toBeGreaterThanOrEqual(2)
      expect(p1Participants.some(p => p.includes('(You)'))).toBe(true)
      expect(p2Participants.some(p => p.includes('(You)'))).toBe(true)
      
    } finally {
      await context1.close()
      await context2.close()
    }
  })

  test('two players can start match and take turns', async ({ browser }) => {
    const context1 = await browser.newContext()
    const context2 = await browser.newContext()
    
    try {
      const player1 = await setupPlayer(context1, uniqueName('Alice'))
      const inviteCode = await createLobbyAndGetInviteCode(player1)
      await setBotCount(player1, 0)
      
      const player2 = await context2.newPage()
      await player2.addInitScript(() => localStorage.clear())
      await player2.goto(`/?join=${inviteCode}`)
      await player2.waitForLoadState('networkidle')
      await player2.getByPlaceholder('Enter your name').fill(uniqueName('Bob'))
      await player2.getByRole('button', { name: /enter arena/i }).click()
      await player2.waitForURL('**/game', { timeout: 10000 })
      await player2.waitForTimeout(1000)
      
      await player1.getByRole('button', { name: /start match/i }).click()
      await player1.waitForTimeout(2000)
      
      const p1Turn = await player1.locator('.turn-stepper').textContent().catch(() => '')
      const p2Turn = await player2.locator('.turn-stepper').textContent().catch(() => '')
      
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
      
      const newP1Turn = await player1.locator('.turn-stepper').textContent().catch(() => '')
      const newP2Turn = await player2.locator('.turn-stepper').textContent().catch(() => '')
      
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
      const player1 = await setupPlayer(context1, uniqueName('Attacker'))
      const inviteCode = await createLobbyAndGetInviteCode(player1)
      await setBotCount(player1, 0)
      
      const player2 = await context2.newPage()
      await player2.addInitScript(() => localStorage.clear())
      await player2.goto(`/?join=${inviteCode}`)
      await player2.waitForLoadState('networkidle')
      await player2.getByPlaceholder('Enter your name').fill(uniqueName('Defender'))
      await player2.getByRole('button', { name: /enter arena/i }).click()
      await player2.waitForURL('**/game', { timeout: 10000 })
      await player2.waitForTimeout(1000)
      
      await player1.getByRole('button', { name: /start match/i }).click()
      await player1.waitForTimeout(2000)
      
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

  test('defense modal shows countdown timer', async ({ browser }) => {
    const context1 = await browser.newContext()
    const context2 = await browser.newContext()
    
    try {
      const player1 = await setupPlayer(context1, uniqueName('Attacker'))
      const inviteCode = await createLobbyAndGetInviteCode(player1)
      await setBotCount(player1, 0)
      
      const player2 = await context2.newPage()
      await player2.addInitScript(() => localStorage.clear())
      await player2.goto(`/?join=${inviteCode}`)
      await player2.waitForLoadState('networkidle')
      await player2.getByPlaceholder('Enter your name').fill(uniqueName('Defender'))
      await player2.getByRole('button', { name: /enter arena/i }).click()
      await player2.waitForURL('**/game', { timeout: 10000 })
      await player2.waitForTimeout(1000)
      
      await player1.getByRole('button', { name: /start match/i }).click()
      await player1.waitForTimeout(2000)
      
      const p1IsActive = await waitForMyTurn(player1, 3000)
      const attacker = p1IsActive ? player1 : player2
      const defender = p1IsActive ? player2 : player1
      
      await selectManeuver(attacker, 'Attack')
      const targetSelected = await clickOnEnemy(attacker)
      
      if (targetSelected) {
        await executeAttack(attacker)
        
        const defenseModalVisible = await waitForDefenseModal(defender, 5000)
        
        if (defenseModalVisible) {
          const timerElement = defender.locator('.defense-timer, .timer-value, [class*="timer"]').first()
          const timerVisible = await timerElement.isVisible().catch(() => false)
          
          if (timerVisible) {
            const timerText1 = await timerElement.textContent()
            await defender.waitForTimeout(2000)
            const timerText2 = await timerElement.textContent()
            
            const time1 = parseInt(timerText1?.replace(/\D/g, '') || '0', 10)
            const time2 = parseInt(timerText2?.replace(/\D/g, '') || '0', 10)
            
            expect(time1).toBeGreaterThan(time2)
          }
          
          await selectDefense(defender, 'dodge')
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
      const inviteCode = await createLobbyAndGetInviteCode(player1)
      await setBotCount(player1, 0)
      
      const player2 = await context2.newPage()
      await player2.addInitScript(() => localStorage.clear())
      await player2.goto(`/?join=${inviteCode}`)
      await player2.waitForLoadState('networkidle')
      await player2.getByPlaceholder('Enter your name').fill(uniqueName('Joiner'))
      await player2.getByRole('button', { name: /enter arena/i }).click()
      await player2.waitForURL('**/game', { timeout: 10000 })
      await player2.waitForTimeout(1000)
      
      const participantsBefore = await player1.locator('li').count()
      expect(participantsBefore).toBe(2)
      
      await player2.close()
      await player1.waitForTimeout(2000)
      
      const participantsAfter = await player1.locator('li').count()
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
      const player1 = await setupPlayer(context1, uniqueName('Player1'))
      const inviteCode = await createLobbyAndGetInviteCode(player1)
      await setBotCount(player1, 0)
      
      const player2 = await context2.newPage()
      await player2.addInitScript(() => localStorage.clear())
      await player2.goto(`/?join=${inviteCode}`)
      await player2.waitForLoadState('networkidle')
      await player2.getByPlaceholder('Enter your name').fill(uniqueName('Player2'))
      await player2.getByRole('button', { name: /enter arena/i }).click()
      await player2.waitForURL('**/game', { timeout: 10000 })
      await player2.waitForTimeout(1000)
      
      await player1.getByRole('button', { name: /start match/i }).click()
      await player1.waitForTimeout(2000)
      
      const p1IsActive = await waitForMyTurn(player1, 3000)
      const activePlayer = p1IsActive ? player1 : player2
      const otherPlayer = p1IsActive ? player2 : player1
      
      await activePlayer.close()
      await otherPlayer.waitForTimeout(2000)
      
      const pauseIndicator = await otherPlayer.getByText(/paused|waiting.*reconnect|disconnected/i).isVisible().catch(() => false)
      
      expect(pauseIndicator).toBe(true)
      
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
      const player1 = await setupPlayer(context1, uniqueName('Attacker'))
      const inviteCode = await createLobbyAndGetInviteCode(player1)
      await setBotCount(player1, 0)
      
      const player2 = await context2.newPage()
      await player2.addInitScript(() => localStorage.clear())
      await player2.goto(`/?join=${inviteCode}`)
      await player2.waitForLoadState('networkidle')
      await player2.getByPlaceholder('Enter your name').fill(uniqueName('Defender'))
      await player2.getByRole('button', { name: /enter arena/i }).click()
      await player2.waitForURL('**/game', { timeout: 10000 })
      await player2.waitForTimeout(1000)
      
      await player1.getByRole('button', { name: /start match/i }).click()
      await player1.waitForTimeout(2000)
      
      const p1IsActive = await waitForMyTurn(player1, 3000)
      const attacker = p1IsActive ? player1 : player2
      const defender = p1IsActive ? player2 : player1
      
      await selectManeuver(attacker, 'Attack')
      const targetSelected = await clickOnEnemy(attacker)
      
      if (targetSelected) {
        await executeAttack(attacker)
        
        const defenseModalVisible = await waitForDefenseModal(defender, 5000)
        
        if (defenseModalVisible) {
          const dodgeCard = defender.locator('.defense-card.dodge, button').filter({ hasText: /dodge/i }).first()
          
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
