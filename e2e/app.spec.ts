import { test, expect } from '@playwright/test';

test.describe('ChatFlow Application', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should display empty state when no threads', async ({ page }) => {
    await expect(page.getByText('Выберите тред или создайте новый')).toBeVisible();
  });

  test('should create a new thread', async ({ page }) => {
    await page.getByRole('button', { name: /новый тред/i }).click();
    
    await expect(page.getByText(/новый тред/i).first()).toBeVisible();
  });

  test('should display thread list', async ({ page }) => {
    await page.getByRole('button', { name: /новый тред/i }).click();
    await page.waitForTimeout(500);
    
    const threadItems = page.locator('[class*="cursor-pointer"]');
    await expect(threadItems.first()).toBeVisible();
  });

  test('should select a thread and show chat interface', async ({ page }) => {
    await page.getByRole('button', { name: /новый тред/i }).click();
    await page.waitForTimeout(500);
    
    const threadItems = page.locator('[class*="cursor-pointer"]');
    await threadItems.first().click();
    
    await expect(page.getByPlaceholder('Введите сообщение...')).toBeVisible();
  });

  test('should send a message', async ({ page }) => {
    await page.getByRole('button', { name: /новый тред/i }).click();
    await page.waitForTimeout(500);
    
    const threadItems = page.locator('[class*="cursor-pointer"]');
    await threadItems.first().click();
    await page.waitForTimeout(500);
    
    const input = page.getByPlaceholder('Введите сообщение...');
    await input.fill('Test message');
    await page.getByRole('button', { name: /отправить/i }).click();
    
    await expect(page.getByText('Test message')).toBeVisible({ timeout: 10000 });
  });

  test('should disable send button when input is empty', async ({ page }) => {
    await page.getByRole('button', { name: /новый тред/i }).click();
    await page.waitForTimeout(500);
    
    const threadItems = page.locator('[class*="cursor-pointer"]');
    await threadItems.first().click();
    await page.waitForTimeout(500);
    
    const sendButton = page.getByRole('button', { name: /отправить/i });
    await expect(sendButton).toBeDisabled();
  });

  test('should enable send button when input has text', async ({ page }) => {
    await page.getByRole('button', { name: /новый тред/i }).click();
    await page.waitForTimeout(500);
    
    const threadItems = page.locator('[class*="cursor-pointer"]');
    await threadItems.first().click();
    await page.waitForTimeout(500);
    
    const input = page.getByPlaceholder('Введите сообщение...');
    await input.fill('Test');
    
    const sendButton = page.getByRole('button', { name: /отправить/i });
    await expect(sendButton).toBeEnabled();
  });

  test('should switch between threads', async ({ page }) => {
    await page.getByRole('button', { name: /новый тред/i }).click();
    await page.waitForTimeout(500);
    await page.getByRole('button', { name: /новый тред/i }).click();
    await page.waitForTimeout(500);
    
    const threadItems = page.locator('[class*="cursor-pointer"]');
    const count = await threadItems.count();
    expect(count).toBeGreaterThan(1);
    
    await threadItems.first().click();
    await page.waitForTimeout(500);
    
    await expect(page.getByPlaceholder('Введите сообщение...')).toBeVisible();
  });
});

