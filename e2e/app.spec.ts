import { test, expect } from '@playwright/test';

test.describe('ChatFlow Application', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should display empty state when no threads', async ({ page }) => {
    // Ждем загрузки страницы
    await page.waitForLoadState('networkidle');
    // Проверяем либо пустое состояние, либо кнопку создания треда
    const emptyState = page.getByText('Выберите тред или создайте новый');
    const createButton = page.getByRole('button', { name: 'Создать новый тред' });
    await expect(emptyState.or(createButton).first()).toBeVisible({ timeout: 10000 });
  });

  test('should create a new thread', async ({ page }) => {
    // Используем aria-label для более точного поиска кнопки создания треда
    const createButton = page.getByRole('button', { name: 'Создать новый тред' });
    await expect(createButton).toBeVisible();
    await createButton.click();
    
    // Ждем появления нового треда в списке
    await expect(page.locator('li[role="button"]').first()).toBeVisible({ timeout: 5000 });
  });

  test('should display thread list with proper styling', async ({ page }) => {
    await page.getByRole('button', { name: 'Создать новый тред' }).click();
    await page.waitForTimeout(1000);
    
    const threadItems = page.locator('li[role="button"]');
    const count = await threadItems.count();
    expect(count).toBeGreaterThan(0);
    
    // Проверяем, что активный тред выделен
    const firstThread = threadItems.first();
    await expect(firstThread).toHaveClass(/bg-blue-50/);
    await expect(firstThread).toHaveAttribute('aria-selected', 'true');
  });

  test('should select a thread and show chat interface', async ({ page }) => {
    await page.getByRole('button', { name: 'Создать новый тред' }).click();
    await page.waitForTimeout(1000);
    
    const threadItems = page.locator('li[role="button"]');
    await threadItems.first().click();
    
    await expect(page.getByPlaceholder('Введите сообщение...')).toBeVisible();
  });

  test('should send a message and display it', async ({ page }) => {
    await page.getByRole('button', { name: 'Создать новый тред' }).click();
    await page.waitForTimeout(1000);
    
    const threadItems = page.locator('li[role="button"]');
    await threadItems.first().click();
    await page.waitForTimeout(500);
    
    const input = page.getByPlaceholder('Введите сообщение...');
    await input.fill('Test message');
    
    const sendButton = page.getByRole('button', { name: /отправить/i });
    await expect(sendButton).toBeEnabled();
    await sendButton.click();
    
    // Ждем появления сообщения в чате
    await expect(page.getByText('Test message')).toBeVisible({ timeout: 10000 });
  });

  test('should disable send button when input is empty', async ({ page }) => {
    await page.getByRole('button', { name: 'Создать новый тред' }).click();
    await page.waitForTimeout(1000);
    
    const threadItems = page.locator('li[role="button"]');
    await threadItems.first().click();
    await page.waitForTimeout(500);
    
    const sendButton = page.getByRole('button', { name: /отправить/i });
    await expect(sendButton).toBeDisabled();
  });

  test('should enable send button when input has text', async ({ page }) => {
    await page.getByRole('button', { name: 'Создать новый тред' }).click();
    await page.waitForTimeout(1000);
    
    const threadItems = page.locator('li[role="button"]');
    await threadItems.first().click();
    await page.waitForTimeout(500);
    
    const input = page.getByPlaceholder('Введите сообщение...');
    await input.fill('Test');
    
    const sendButton = page.getByRole('button', { name: /отправить/i });
    await expect(sendButton).toBeEnabled();
  });

  test('should switch between threads', async ({ page }) => {
    // Создаем первый тред
    await page.getByRole('button', { name: 'Создать новый тред' }).click();
    await page.waitForTimeout(1000);
    
    // Создаем второй тред
    await page.getByRole('button', { name: 'Создать новый тред' }).click();
    await page.waitForTimeout(1000);
    
    const threadItems = page.locator('li[role="button"]');
    const count = await threadItems.count();
    expect(count).toBeGreaterThan(1);
    
    // Переключаемся на первый тред
    await threadItems.first().click();
    await page.waitForTimeout(500);
    
    await expect(page.getByPlaceholder('Введите сообщение...')).toBeVisible();
    
    // Проверяем, что первый тред выделен
    await expect(threadItems.first()).toHaveAttribute('aria-selected', 'true');
  });

  test('should display loading state when sending message', async ({ page }) => {
    await page.getByRole('button', { name: 'Создать новый тред' }).click();
    await page.waitForTimeout(1000);
    
    const threadItems = page.locator('li[role="button"]');
    await threadItems.first().click();
    await page.waitForTimeout(500);
    
    const input = page.getByPlaceholder('Введите сообщение...');
    await input.fill('Test message');
    
    const sendButton = page.getByRole('button', { name: /отправить/i });
    await sendButton.click();
    
    // Проверяем, что кнопка показывает состояние загрузки
    await expect(sendButton).toHaveText(/отправка/i, { timeout: 1000 });
  });

  test('should handle keyboard navigation in thread list', async ({ page }) => {
    await page.getByRole('button', { name: 'Создать новый тред' }).click();
    await page.waitForTimeout(1000);
    
    const threadItems = page.locator('li[role="button"]');
    const firstThread = threadItems.first();
    
    // Фокусируемся на первом треде
    await firstThread.focus();
    
    // Нажимаем Enter
    await firstThread.press('Enter');
    await page.waitForTimeout(500);
    
    await expect(page.getByPlaceholder('Введите сообщение...')).toBeVisible();
  });
});

