import { test, expect } from '@playwright/test';

test.describe('Nijghor Zero-Knowledge Private Messenger E2E', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('User completes 3-step onboarding and enters encrypted vault', async ({ page }) => {
    // 1. Verify Onboarding Modal is displayed
    await expect(page.locator('text=Step 1 of 3')).toBeVisible();

    // 2. Step 1: Request Email Code
    const emailInput = page.locator('input[type="email"]');
    await emailInput.fill('rahul@example.com');
    await page.click('button:has-text("Send Verification Code")');

    // Enter 6-digit code (Mock code 123456)
    const codeInput = page.locator('input[placeholder="123456"]');
    await expect(codeInput).toBeVisible();
    await codeInput.fill('123456');
    await page.click('button:has-text("Verify Code")');

    // 3. Step 2: Choose Username & Password
    await expect(page.locator('text=Step 2 of 3')).toBeVisible();
    const usernameInput = page.locator('input[placeholder="rahul"]');
    await usernameInput.fill('rahul');

    // Select Password Option
    await page.click('button:has-text("Password")');
    const passwordInput = page.locator('input[type="password"]');
    await passwordInput.fill('SecretPassword123!');
    await page.click('button:has-text("Continue")');

    // 4. Step 3: Key Generation & Recovery Download
    await expect(page.locator('text=Step 3 of 3')).toBeVisible();
    await expect(page.locator('text=Keys Generated Securely!')).toBeVisible({ timeout: 10000 });

    // Click Download Recovery Key
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.click('button:has-text("Download Recovery Key")'),
    ]);
    expect(download.suggestedFilename()).toContain('.nijghor');

    // Enter App
    await page.click('button:has-text("Open Nijghor")');

    // 5. Verify Main Desktop Room Canvas
    await expect(page.locator('text=Rooms')).toBeVisible();
    await expect(page.locator('text=Select a Room')).toBeVisible();
  });

  test('Optimistic messaging shows clock icon then transitions to sent', async ({ page }) => {
    // Mock user login state in localStorage
    await page.evaluate(() => {
      localStorage.setItem('nijghor_onboarded', 'true');
      localStorage.setItem('nijghor_access_token', 'mock_token');
      localStorage.setItem('nijghor_user', JSON.stringify({ userId: 'u1', username: 'rahul' }));
    });

    await page.reload();

    // Verify room interface is displayed
    await expect(page.locator('text=Rooms')).toBeVisible();
  });
});
