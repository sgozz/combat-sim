import { test, expect } from '@playwright/test';

test('full game loop', async ({ page }) => {
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', exception => console.log(`PAGE ERROR: ${exception}`));

  // 1. Open App
  await page.goto('http://localhost:5173');
  await page.waitForLoadState('domcontentloaded');

  // Clear local storage explicitly and reload
  await page.evaluate(() => window.localStorage.clear());
  await page.reload();
  await page.waitForLoadState('domcontentloaded');

  // 2. Welcome Screen or Existing Session
  const welcomeInput = page.getByPlaceholder('Enter your nickname...');
  if (await welcomeInput.isVisible()) {
    await welcomeInput.fill('Tester');
    await page.getByRole('button', { name: 'Enter Battle' }).click();
  }

  // Handle existing game session
  if (await page.getByText('Lobby / Status').isVisible()) {
     console.log('Already in game, attempting to leave...');
     // Try clicking Leave Match if visible (match over or active)
     const leaveMatchBtn = page.getByRole('button', { name: 'Leave Match' });
     if (await leaveMatchBtn.isVisible()) {
        await leaveMatchBtn.click();
     } else {
        // Try Leave Lobby (waiting room)
        const leaveLobbyBtn = page.getByRole('button', { name: 'Leave Lobby' });
        if (await leaveLobbyBtn.isVisible()) {
            await leaveLobbyBtn.click();
        }
     }
  }

  // 3. Lobby Browser
  try {
    await expect(page.getByText('Battle Lobbies')).toBeVisible();
  } catch (e) {
    await page.screenshot({ path: 'debug-lobby.png' });
    throw e;
  }
  await expect(page.getByText('Battle Lobbies')).toBeVisible();
  
  // Create Lobby (Quick Match)
  await page.getByRole('button', { name: 'Quick Match' }).click();

  // 4. Waiting Room
  await expect(page.getByText('Lobby / Status')).toBeVisible();
  
  // Start Match
  await page.getByRole('button', { name: 'Start Match' }).click();
  
  // 5. Combat
  // Wait for match state to load
  await expect(page.getByText('Current Turn: Tester')).toBeVisible({ timeout: 10000 });
  
  // Choose Maneuver
  await expect(page.getByRole('heading', { name: 'Choose Maneuver' })).toBeVisible();
  await page.getByRole('button', { name: 'Move', exact: true }).click();
  
  // Verify Actions are shown
  await expect(page.getByRole('heading', { name: 'Actions' })).toBeVisible();
  
  // Test Move Action
  await page.getByRole('button', { name: 'Move (click grid)' }).click();
  await expect(page.getByText('Click on the grid to select destination.')).toBeVisible();
  
  // End Turn
  await page.getByRole('button', { name: 'End Turn' }).click();
  
  // Verify log update
  await expect(page.getByText('Tester ends their turn.')).toBeVisible();
});
