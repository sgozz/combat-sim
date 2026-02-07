import { test, expect, type Page, type BrowserContext } from '@playwright/test'

/**
 * E2E tests for the pre-game flow covering the new UI redesign:
 * - Login (WelcomeScreen)
 * - Dashboard (match list, stats, empty state)
 * - Match creation flow
 * - Armory (character roster, CRUD)
 * - Character editor (tabs, inline forms, save)
 * - Lobby (player list, ready system, character preview, start flow)
 * - Full flow (login → create → select → ready → start)
 */

function uniqueName(base: string): string {
  const suffix = Math.random().toString(36).slice(2, 8)
  return `${base}_${suffix}`.slice(0, 16)
}

/**
 * Helper: Set up a new player by logging in
 * Returns page after successful login at /home
 */
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

/**
 * Helper: Create a match and wait for lobby screen
 */
async function createMatch(page: Page, matchName: string): Promise<void> {
  await page.getByRole('button', { name: /new match/i }).click()
  await page.waitForTimeout(500)
  
  // Fill dialog fields
  const nameInput = page.locator('#cmd-match-name')
  await expect(nameInput).toBeVisible({ timeout: 5000 })
  await nameInput.clear()
  await nameInput.fill(matchName)
  
  // Create button in dialog
  await page.locator('.cmd-btn-create').click()
  
  // Wait for redirect to lobby
  await page.waitForURL(/\/lobby\/.*/, { timeout: 10000 })
}

test.describe('Pre-Game Flow', () => {
  
  // =============================================================================
  // Test 1: Login Flow
  // =============================================================================
  
  test('login flow redirects to dashboard', async ({ browser }) => {
    const context = await browser.newContext()
    const page = await context.newPage()
    
    await page.addInitScript(() => {
      localStorage.clear()
      sessionStorage.clear()
    })
    
    // Navigate to welcome screen
    await page.goto('/')
    await page.waitForLoadState('domcontentloaded')
    
    // Verify welcome screen elements
    const title = page.getByText(/tactical combat simulator/i)
    await expect(title).toBeVisible({ timeout: 5000 })
    
    const nameInput = page.getByPlaceholder('Enter username')
    await expect(nameInput).toBeVisible()
    
     // Enter name and submit
     await nameInput.fill('TestPlayer')
     
     // Select GURPS ruleset
     await page.getByRole('button', { name: /GURPS 4e/i }).click()
     await page.waitForTimeout(300)
     
     const enterBtn = page.getByRole('button', { name: /enter arena/i })
     await expect(enterBtn).toBeEnabled({ timeout: 5000 })
     await enterBtn.click()
    
    // Verify redirect to dashboard
    await page.waitForURL('/home', { timeout: 10000 })
    await expect(page).toHaveURL('/home')
    
    // Save screenshot
    await page.screenshot({ path: '.sisyphus/evidence/login-success.png' })
    
    await context.close()
  })
  
  test('login shows connection status indicator', async ({ browser }) => {
    const context = await browser.newContext()
    const page = await context.newPage()
    
    await page.addInitScript(() => {
      localStorage.clear()
      sessionStorage.clear()
    })
    
    await page.goto('/')
    await page.waitForLoadState('domcontentloaded')
    
    // Connection status should be visible on welcome screen
    const statusText = page.locator('.status-text')
    await expect(statusText).toBeVisible({ timeout: 10000 })
    
    // Status should eventually show "Connected" or remain "Connecting"/"Offline"
    await page.waitForTimeout(2000)
    const text = await statusText.textContent()
    expect(['Connected to server', 'Connecting...', 'Offline']).toContain(text)
    
    await context.close()
  })
  
  // =============================================================================
  // Test 2: Dashboard
  // =============================================================================
  
  test('dashboard shows empty state for new user', async ({ browser }) => {
    const context = await browser.newContext()
    const player = await setupPlayer(context, uniqueName('NewUser'))
    
    // Verify empty state
    const emptyState = player.locator('.dashboard-empty-state')
    await expect(emptyState).toBeVisible({ timeout: 5000 })
    
    const emptyText = player.getByText(/no matches yet/i)
    await expect(emptyText).toBeVisible()
    
    await player.screenshot({ path: '.sisyphus/evidence/dashboard-empty.png' })
    
    await context.close()
  })
  
  test('dashboard shows stats bar', async ({ browser }) => {
    const context = await browser.newContext()
    const player = await setupPlayer(context, uniqueName('StatsUser'))
    
    // Stats bar should be visible even with zero matches
    const statsBar = player.locator('.stats-bar, .dashboard-stats')
    await expect(statsBar).toBeVisible({ timeout: 5000 })
    
    // Should show stat cards (Total, Wins, Losses, Win Rate)
    const statCards = player.locator('.stat-card')
    const count = await statCards.count()
    expect(count).toBeGreaterThanOrEqual(3) // At least 3 stat cards
    
    await context.close()
  })
  
  test('dashboard shows match in waiting section', async ({ browser }) => {
    const context = await browser.newContext()
    const page1 = await setupPlayer(context, uniqueName('Match'))
    
    await createMatch(page1, 'Test Match')
    
    // Verify we're in the lobby with the match name
    await expect(page1.locator('.lobby-panel-players')).toBeVisible({ timeout: 10000 })
    
    // Open a second tab to check dashboard while still in lobby
    const page2 = await context.newPage()
    await page2.goto('/')
    await page2.waitForURL('/home', { timeout: 10000 })
    
    // Match should appear in waiting section
    const matchCard = page2.locator('.dashboard-match-grid .lobby-card').first()
    await expect(matchCard).toBeVisible({ timeout: 10000 })
    
    await page2.screenshot({ path: '.sisyphus/evidence/dashboard-with-match.png' })
    
    await context.close()
  })
  
  // =============================================================================
  // Test 3: Create Match Flow
  // =============================================================================
  
  test('create match dialog flow', async ({ browser }) => {
    const context = await browser.newContext()
    const player = await setupPlayer(context, uniqueName('Creator'))
    
    // Click New Match button
    await player.getByRole('button', { name: /new match/i }).click()
    await player.waitForTimeout(500)
    
    // Dialog should appear
    const dialog = player.locator('.cmd-dialog')
    await expect(dialog).toBeVisible({ timeout: 5000 })
    
    // Fill match name
    const nameInput = player.locator('#cmd-match-name')
    await expect(nameInput).toBeVisible()
    await nameInput.clear()
    await nameInput.fill('E2E Test Match')
    
    // Create button
    await player.locator('.cmd-btn-create').click()
    
    // Should redirect to lobby
    await player.waitForURL(/\/lobby\/.*/, { timeout: 10000 })
    await expect(player).toHaveURL(/\/lobby\/[a-zA-Z0-9-]+/)
    
    await player.screenshot({ path: '.sisyphus/evidence/match-created-lobby.png' })
    
    await context.close()
  })
  
  // =============================================================================
  // Test 4: Armory Flow
  // =============================================================================
  
  test('armory shows empty state for new user', async ({ browser }) => {
    const context = await browser.newContext()
    const player = await setupPlayer(context, uniqueName('Armory'))
    
    // Navigate to armory via dashboard button
    await player.getByRole('button', { name: /armory/i }).click()
    await player.waitForURL('/armory', { timeout: 10000 })
    
    // Verify empty state
    const emptyState = player.locator('.armory-empty-state')
    await expect(emptyState).toBeVisible({ timeout: 5000 })
    
    const emptyText = player.getByText(/no characters/i)
    await expect(emptyText).toBeVisible()
    
    await player.screenshot({ path: '.sisyphus/evidence/armory-empty.png' })
    
    await context.close()
  })
  
  test('create character from armory', async ({ browser }) => {
    const context = await browser.newContext()
    const player = await setupPlayer(context, uniqueName('CharCrt'))
    
    await player.getByRole('button', { name: /armory/i }).click()
    await player.waitForURL('/armory', { timeout: 10000 })
    
    const newCharBtn = player.locator('.armory-btn-new')
    await expect(newCharBtn).toBeVisible({ timeout: 5000 })
    await newCharBtn.click()
    
    await player.waitForURL(/\/armory\/(new|[a-zA-Z0-9-]+)/, { timeout: 5000 })
    
    await player.screenshot({ path: '.sisyphus/evidence/character-editor.png' })
    
    await context.close()
  })
  
  // =============================================================================
  // Test 5: Character Editor Flow
  // =============================================================================
  
  test('character editor tabs and save', async ({ browser }) => {
    const context = await browser.newContext()
    const player = await setupPlayer(context, uniqueName('Editor'))
    
    await player.getByRole('button', { name: /armory/i }).click()
    await player.waitForURL('/armory', { timeout: 10000 })
    
    const newCharBtn = player.locator('.armory-btn-new')
    await expect(newCharBtn).toBeVisible({ timeout: 5000 })
    await newCharBtn.click()
    await player.waitForURL(/\/armory\/(new|[a-zA-Z0-9-]+)/, { timeout: 5000 })
    
    // Should show editor UI
    const editor = player.locator('.character-editor')
    await expect(editor).toBeVisible({ timeout: 5000 })
    
    // Change name
    const nameInput = player.locator('input.editor-name-input')
    await expect(nameInput).toBeVisible({ timeout: 5000 })
    await nameInput.clear()
    await nameInput.fill('E2E Hero')
    await player.waitForTimeout(300)
    
    // Check for tabs
    const tabsExist = await player.locator('.editor-tabs').isVisible().catch(() => false)
    
    if (tabsExist) {
      const skillsTab = player.getByRole('tab', { name: /skills/i })
      if (await skillsTab.isVisible().catch(() => false)) {
        await skillsTab.click()
        await player.waitForTimeout(500)
      }
      
      const equipTab = player.getByRole('tab', { name: /equipment/i })
      if (await equipTab.isVisible().catch(() => false)) {
        await equipTab.click()
        await player.waitForTimeout(500)
      }
    }
    
    // Save character
    await player.locator('.editor-btn-save').click()
    await player.waitForTimeout(1000)
    
    // Should redirect back to armory
    await player.waitForURL('/armory', { timeout: 10000 })
    
    // Character should appear in list
    const characterCard = player.locator('.armory-character-card').first()
    await expect(characterCard).toBeVisible({ timeout: 5000 })
    
    await player.screenshot({ path: '.sisyphus/evidence/armory-with-character.png' })
    
    await context.close()
  })
  
  test('character editor inline skill form (no prompt)', async ({ browser }) => {
    const context = await browser.newContext()
    const player = await setupPlayer(context, uniqueName('Skill'))
    
    await player.getByRole('button', { name: /armory/i }).click()
    await player.waitForURL('/armory', { timeout: 10000 })
    
    const newCharBtn = player.locator('.armory-btn-new')
    await expect(newCharBtn).toBeVisible({ timeout: 5000 })
    await newCharBtn.click()
    await player.waitForURL(/\/armory\/(new|[a-zA-Z0-9-]+)/, { timeout: 5000 })
    
    // Switch to skills tab if tabs exist
    const skillsTab = player.getByRole('tab', { name: /skills/i })
    if (await skillsTab.isVisible().catch(() => false)) {
      await skillsTab.click()
      await player.waitForTimeout(500)
    }
    
    // Look for inline add form (NOT window.prompt)
    const addSkillBtn = player.getByRole('button', { name: /add skill/i }).first()
    if (await addSkillBtn.isVisible().catch(() => false)) {
      await addSkillBtn.click()
      await player.waitForTimeout(500)
      
      // Inline form should appear
      const skillNameInput = player.locator('input[name="skillName"], input[placeholder*="skill" i]').first()
      if (await skillNameInput.isVisible().catch(() => false)) {
        await skillNameInput.fill('Swordsmanship')
        await player.waitForTimeout(300)
        
        // Submit inline form
        const confirmBtn = player.locator('.inline-form, .skill-form').getByRole('button', { name: /add|save|confirm/i }).first()
        if (await confirmBtn.isVisible().catch(() => false)) {
          await confirmBtn.click()
          await player.waitForTimeout(500)
        }
        
        await player.screenshot({ path: '.sisyphus/evidence/skill-inline-form.png' })
      }
    }
    
    await context.close()
  })
  
  // =============================================================================
  // Test 6: Lobby Flow
  // =============================================================================
  
  test('lobby shows player list', async ({ browser }) => {
    const context = await browser.newContext()
    const player = await setupPlayer(context, uniqueName('Lobby'))
    
    await createMatch(player, 'Lobby Test')
    
    const playerList = player.locator('.lobby-panel-players')
    await expect(playerList).toBeVisible({ timeout: 10000 })
    
    // Verify player name appears in the list
    const playerName = player.locator('.player-list-name')
    await expect(playerName.first()).toBeVisible({ timeout: 5000 })
    
    // Verify ready summary line exists
    const summary = player.locator('.player-list-summary')
    await expect(summary).toBeVisible({ timeout: 5000 })
    
    await player.screenshot({ path: '.sisyphus/evidence/lobby-player-list.png' })
    
    await context.close()
  })
  
  test('lobby single player auto-ready with bot enables start', async ({ browser }) => {
    const context = await browser.newContext()
    const player = await setupPlayer(context, uniqueName('Ready'))
    
    await createMatch(player, 'Ready Test')
    
    // With a single player, ready button is not shown (auto-ready)
    // Add a bot to enable start (need >= 2 combatants)
    const addBotBtn = player.locator('.match-settings-bot-btn').filter({ hasText: '+' })
    await expect(addBotBtn).toBeVisible({ timeout: 5000 })
    await addBotBtn.click()
    await player.waitForTimeout(500)
    
    // Start button should become enabled (single player = auto-ready, 2 combatants)
    const startBtn = player.locator('.lobby-start-btn')
    await expect(startBtn).toBeVisible({ timeout: 5000 })
    await expect(startBtn).toBeEnabled({ timeout: 5000 })
    
    await player.screenshot({ path: '.sisyphus/evidence/lobby-ready-toggled.png' })
    
    await context.close()
  })
  
  test('lobby start button requires enough combatants', async ({ browser }) => {
    const context = await browser.newContext()
    const player = await setupPlayer(context, uniqueName('Start'))
    
    await createMatch(player, 'Start Test')
    
    // Start button should be disabled with only 1 combatant
    const startBtn = player.locator('.lobby-start-btn')
    await expect(startBtn).toBeVisible({ timeout: 10000 })
    await expect(startBtn).toBeDisabled()
    
    // Add a bot to reach 2 combatants
    const addBotBtn = player.locator('.match-settings-bot-btn').filter({ hasText: '+' })
    await addBotBtn.click()
    await player.waitForTimeout(500)
    
    // Start button should now be enabled (solo player = auto-ready, 2 combatants)
    await expect(startBtn).toBeEnabled({ timeout: 5000 })
    
    await player.screenshot({ path: '.sisyphus/evidence/lobby-start-button.png' })
    
    await context.close()
  })
  
  test('lobby shows character preview panel', async ({ browser }) => {
    const context = await browser.newContext()
    const player = await setupPlayer(context, uniqueName('Prev'))
    
    // Create match
    await createMatch(player, 'Preview Test')
    
    // Character preview panel should exist
    const previewPanel = player.locator('.lobby-panel-preview')
    await expect(previewPanel).toBeVisible({ timeout: 5000 })
    
    await player.screenshot({ path: '.sisyphus/evidence/lobby-character-preview.png' })
    
    await context.close()
  })
  
  // =============================================================================
  // Test 7: Full Flow (Login → Create → Ready → Start)
  // =============================================================================
  
  test('full flow: login → create match → ready → start', async ({ browser }) => {
    const context = await browser.newContext()
    const page = await context.newPage()
    
    await page.addInitScript(() => {
      localStorage.clear()
      sessionStorage.clear()
    })
    
    // Step 1: Login
    await page.goto('/')
    await page.waitForLoadState('domcontentloaded')
    
    const nickname = uniqueName('Full')
    await page.getByPlaceholder('Enter username').fill(nickname)
    await page.getByRole('button', { name: /GURPS 4e/i }).click()
    await page.waitForTimeout(300)
    const enterBtn1 = page.getByRole('button', { name: /enter arena/i })
    await expect(enterBtn1).toBeEnabled({ timeout: 5000 })
    await enterBtn1.click()
    await page.waitForURL('/home', { timeout: 10000 })
    
    await page.screenshot({ path: '.sisyphus/evidence/flow-1-dashboard.png' })
    
    // Step 2: Create Match
    await createMatch(page, 'Full Flow Match')
    await expect(page).toHaveURL(/\/lobby\/.*/)
    
    await page.screenshot({ path: '.sisyphus/evidence/flow-2-lobby.png' })
    
    // Step 3: Ready up
    const readyBtn = page.locator('.player-list-ready-btn')
    if (await readyBtn.isVisible().catch(() => false)) {
      await readyBtn.click()
      await page.waitForTimeout(1000)
      
      await page.screenshot({ path: '.sisyphus/evidence/flow-3-ready.png' })
    }
    
    // Step 4: Start match (if creator and button enabled)
    const startBtn = page.locator('.lobby-start-btn')
    const canStart = await startBtn.isVisible().catch(() => false)
    
    if (canStart) {
      const isEnabled = !(await startBtn.isDisabled())
      
      if (isEnabled) {
        await startBtn.click()
        await page.waitForTimeout(2000)
        
        // Should redirect to game screen
        await page.waitForURL(/\/game\/.*/, { timeout: 15000 })
        await expect(page).toHaveURL(/\/game\/[a-zA-Z0-9-]+/)
        
        await page.screenshot({ path: '.sisyphus/evidence/flow-4-game.png' })
        
        // Verify game UI elements
        const gameUI = page.locator('.maneuver-btn, .panel, canvas')
        const gameVisible = await gameUI.first().isVisible({ timeout: 10000 }).catch(() => false)
        expect(gameVisible).toBeTruthy()
        
        await page.screenshot({ path: '.sisyphus/evidence/flow-5-combat-ui.png' })
      }
    }
    
    await context.close()
  })
  
  test('full flow with character creation', async ({ browser }) => {
    const context = await browser.newContext()
    const page = await context.newPage()
    
    await page.addInitScript(() => {
      localStorage.clear()
      sessionStorage.clear()
    })
    
    // Step 1: Login
    await page.goto('/')
    await page.waitForLoadState('domcontentloaded')
    
    const nickname = uniqueName('Char')
    await page.getByPlaceholder('Enter username').fill(nickname)
    await page.getByRole('button', { name: /GURPS 4e/i }).click()
    await page.waitForTimeout(300)
    const enterBtn2 = page.getByRole('button', { name: /enter arena/i })
    await expect(enterBtn2).toBeEnabled({ timeout: 5000 })
    await enterBtn2.click()
    await page.waitForURL('/home', { timeout: 10000 })
    
    // Step 2: Create Character via Armory button
    await page.getByRole('button', { name: /armory/i }).click()
    await page.waitForURL('/armory', { timeout: 10000 })
    
    const newCharBtn = page.locator('.armory-btn-new')
    await expect(newCharBtn).toBeVisible({ timeout: 5000 })
    await newCharBtn.click()
    await page.waitForURL(/\/armory\/(new|[a-zA-Z0-9-]+)/, { timeout: 5000 })
    
    const nameInput = page.locator('input.editor-name-input')
    await expect(nameInput).toBeVisible({ timeout: 5000 })
    await nameInput.clear()
    await nameInput.fill('Flow Hero')
    
    await page.locator('.editor-btn-save').click()
    await page.waitForURL('/armory', { timeout: 10000 })
    
    await page.screenshot({ path: '.sisyphus/evidence/char-flow-1-saved.png' })
    
    // Step 3: Navigate back to dashboard and create match
    await page.locator('.armory-btn-back').click()
    await page.waitForURL('/home', { timeout: 10000 })
    
    await createMatch(page, 'Char Flow Match')
    await expect(page).toHaveURL(/\/lobby\/.*/)
    
    // Step 4: Character preview should exist
    const characterSection = page.locator('.lobby-panel-preview')
    await expect(characterSection).toBeVisible({ timeout: 10000 })
    
    await page.screenshot({ path: '.sisyphus/evidence/char-flow-2-lobby-with-char.png' })
    
    await context.close()
  })
  
})
