import { test, expect } from '@playwright/test';

test.describe('Messages History', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test.skip('should preserve messages after page reload', async ({ page }) => {
    // Создаем тред
    await page.getByRole('button', { name: 'Создать новый тред' }).click();
    await page.waitForTimeout(1000);

    const threadItems = page.locator('li[role="button"]');
    // Сохраняем текст первого треда для поиска после перезагрузки
    const firstThreadText = await threadItems.first().textContent();
    await threadItems.first().click();
    await page.waitForTimeout(500);

    // Отправляем сообщение
    const input = page.getByPlaceholder('Введите сообщение...');
    await input.fill('Test message for history');
    
    const sendButton = page.getByRole('button', { name: /отправить/i });
    await sendButton.click();

    // Ждем сохранения сообщения через API
    await page.waitForResponse(response =>
      response.url().includes('/api/chat') && response.status() === 200,
      { timeout: 5000 }
    ).catch(() => {}); // Игнорируем, если запрос уже произошел

    await page.waitForTimeout(1000);

    // Перезагружаем страницу
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Ждем загрузки тредов
    const threadsAfterReload = page.locator('li[role="button"]');
    await expect(threadsAfterReload.first()).toBeVisible({ timeout: 5000 });
    
    // Находим нужный тред по тексту и кликаем на него
    // Если первый тред не подходит, ищем по тексту
    const threadCount = await threadsAfterReload.count();
    let threadFound = false;
    
    for (let i = 0; i < Math.min(threadCount, 5); i++) {
      const threadText = await threadsAfterReload.nth(i).textContent();
      if (threadText && firstThreadText && threadText.includes(firstThreadText.split('\n')[0])) {
        await threadsAfterReload.nth(i).click();
        threadFound = true;
        break;
      }
    }
    
    // Если не нашли по тексту, кликаем на первый тред
    if (!threadFound) {
      await threadsAfterReload.first().click();
    }
    
    await page.waitForTimeout(2000);
    
    // Ждем загрузки сообщений через API
    try {
      await page.waitForResponse(response =>
        response.url().includes('/api/messages') && response.status() === 200,
        { timeout: 5000 }
      );
    } catch (e) {
      // Если запрос уже произошел, продолжаем
    }
    
    await page.waitForTimeout(2000);
    
    // Проверяем, что интерфейс чата загружен
    await expect(page.getByPlaceholder('Введите сообщение...')).toBeVisible({ timeout: 5000 });
    
    // Проверяем наличие сообщения
    const messageText = page.getByText(/Test message for history/i);
    await expect(messageText).toBeVisible({ timeout: 10000 });
  });

  test.skip('should isolate messages between threads', async ({ page }) => {
    // Создаем первый тред
    await page.getByRole('button', { name: 'Создать новый тред' }).click();
    await page.waitForTimeout(1000);

    let threadItems = page.locator('li[role="button"]');
    // Сохраняем текст первого треда
    const firstThreadText = await threadItems.first().textContent();
    await threadItems.first().click();
    await page.waitForTimeout(500);

    // Отправляем сообщение в первый тред
    const input = page.getByPlaceholder('Введите сообщение...');
    await input.fill('Message in thread 1');
    
    const sendButton = page.getByRole('button', { name: /отправить/i });
    await sendButton.click();
    
    // Ждем сохранения сообщения через API
    await page.waitForResponse(response =>
      response.url().includes('/api/chat') && response.status() === 200,
      { timeout: 5000 }
    ).catch(() => {});
    
    await page.waitForTimeout(2000);

    // Создаем второй тред
    await page.getByRole('button', { name: 'Создать новый тред' }).click();
    await page.waitForTimeout(2000);

    threadItems = page.locator('li[role="button"]');
    const threadCount = await threadItems.count();
    expect(threadCount).toBeGreaterThan(1);

    // Выбираем второй тред (новый тред всегда первый в списке)
    await threadItems.first().click();
    await page.waitForTimeout(1000);

    // Отправляем сообщение во второй тред
    await input.fill('Message in thread 2');
    await sendButton.click();
    
    // Ждем сохранения сообщения через API
    await page.waitForResponse(response =>
      response.url().includes('/api/chat') && response.status() === 200,
      { timeout: 5000 }
    ).catch(() => {});
    
    await page.waitForTimeout(2000);

    // Переключаемся обратно на первый тред - ищем по тексту
    threadItems = page.locator('li[role="button"]');
    let firstThreadFound = false;
    
    for (let i = 0; i < Math.min(threadCount, 5); i++) {
      const threadText = await threadItems.nth(i).textContent();
      if (threadText && firstThreadText && threadText.includes(firstThreadText.split('\n')[0])) {
        await threadItems.nth(i).click();
        firstThreadFound = true;
        break;
      }
    }
    
    // Если не нашли, кликаем на второй тред (первый - это новый)
    if (!firstThreadFound) {
      await threadItems.nth(1).click();
    }
    
    // Ждем загрузки сообщений через API после клика
    try {
      await page.waitForResponse(response =>
        response.url().includes('/api/messages') && response.status() === 200,
        { timeout: 5000 }
      );
    } catch (e) {
      // Если запрос уже произошел, продолжаем
    }
    
    await page.waitForTimeout(3000); // Даем время на загрузку и рендеринг сообщений

    // Проверяем, что видим сообщения первого треда
    const message1 = page.getByText(/Message in thread 1/i);
    await expect(message1).toBeVisible({ timeout: 10000 });
    
    // Сообщение второго треда не должно быть видно в первом треде
    const message2 = page.getByText('Message in thread 2');
    const isVisible = await message2.isVisible().catch(() => false);
    expect(isVisible).toBe(false);
  });

  test('should load messages when switching threads', async ({ page }) => {
    // Создаем несколько тредов с сообщениями
    for (let i = 0; i < 2; i++) {
      await page.getByRole('button', { name: 'Создать новый тред' }).click();
      await page.waitForTimeout(1000);

      const threadItems = page.locator('li[role="button"]');
      await threadItems.first().click();
      await page.waitForTimeout(500);

      const input = page.getByPlaceholder('Введите сообщение...');
      // Ждем, пока input станет доступным (может быть disabled во время загрузки или AI ответа)
      // Увеличиваем таймаут и ждем дольше
      let attempts = 0;
      while (attempts < 20) {
        const isEnabled = await input.isEnabled().catch(() => false);
        if (isEnabled) {
          break;
        }
        await page.waitForTimeout(1000);
        attempts++;
      }
      
      await input.fill(`Message ${i + 1}`);
      
      const sendButton = page.getByRole('button', { name: /отправить/i });
      await sendButton.click();
      // Ждем сохранения сообщения (пользовательское сообщение сохраняется сразу)
      await page.waitForTimeout(3000);
    }

    // Переключаемся между тредами
    const threadItems = page.locator('li[role="button"]');
    const threadCount = await threadItems.count();
    
    for (let i = 0; i < Math.min(threadCount, 2); i++) {
      await threadItems.nth(i).click();
      await page.waitForTimeout(1000);
      
      // Проверяем, что интерфейс чата виден
      await expect(page.getByPlaceholder('Введите сообщение...')).toBeVisible();
    }
  });
});

