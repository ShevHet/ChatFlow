/**
 * Тесты для модуля повторных попыток
 */

import { retry, createOpenAIRetry } from '@/lib/retry';

describe('retry', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('должен выполнить функцию успешно с первой попытки', async () => {
    const fn = jest.fn().mockResolvedValue('success');
    
    const result = await retry(fn);
    
    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('должен повторить попытку при ошибке', async () => {
    const fn = jest.fn()
      .mockRejectedValueOnce(new Error('Temporary error'))
      .mockResolvedValue('success');
    
    const promise = retry(fn, { maxAttempts: 3, initialDelay: 100 });
    
    // Пропускаем задержку
    await jest.advanceTimersByTimeAsync(100);
    
    const result = await promise;
    
    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('должен выбросить ошибку после исчерпания попыток', async () => {
    const error = new Error('Permanent error');
    const fn = jest.fn()
      .mockImplementationOnce(() => Promise.reject(error))
      .mockImplementationOnce(() => Promise.reject(error));
    
    // Запускаем retry и проверяем результат
    const promise = retry(fn, { maxAttempts: 2, initialDelay: 100 });
    
    // Прокачиваем таймеры
    jest.runAllTimersAsync();
    
    // Ожидаем завершение промиса и проверяем ошибку
    await expect(promise).rejects.toThrow('Permanent error');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('должен использовать экспоненциальную задержку', async () => {
    const fn = jest.fn()
      .mockRejectedValueOnce(new Error('Error 1'))
      .mockRejectedValueOnce(new Error('Error 2'))
      .mockResolvedValue('success');
    
    const promise = retry(fn, {
      maxAttempts: 3,
      initialDelay: 100,
      backoffMultiplier: 2,
    });
    
    // Первая задержка: 100ms
    await jest.advanceTimersByTimeAsync(100);
    // Вторая задержка: 200ms
    await jest.advanceTimersByTimeAsync(200);
    
    const result = await promise;
    
    expect(result).toBe('success');
  });

  it('должен уважать максимальную задержку', async () => {
    const fn = jest.fn()
      .mockRejectedValueOnce(new Error('Error'))
      .mockResolvedValue('success');
    
    const promise = retry(fn, {
      maxAttempts: 3,
      initialDelay: 1000,
      maxDelay: 2000,
      backoffMultiplier: 10,
    });
    
    // Задержка должна быть ограничена maxDelay (2000ms), а не 10000ms
    await jest.advanceTimersByTimeAsync(2000);
    
    const result = await promise;
    
    expect(result).toBe('success');
  });

  it('должен использовать функцию retryable для определения возможности повтора', async () => {
    const retryableError = new Error('429 Rate limit');
    const nonRetryableError = new Error('401 Unauthorized');
    
    const fn = jest.fn()
      .mockImplementationOnce(() => Promise.reject(retryableError))
      .mockImplementationOnce(() => Promise.reject(nonRetryableError));
    
    const promise = retry(fn, {
      maxAttempts: 3,
      initialDelay: 100,
      retryable: (error) => {
        return error instanceof Error && error.message.includes('429');
      },
    });
    
    // Прокачиваем таймеры
    jest.runAllTimersAsync();
    
    // Ожидаем завершение промиса и проверяем ошибку
    await expect(promise).rejects.toThrow('401 Unauthorized');
    expect(fn).toHaveBeenCalledTimes(2);
  });
});

describe('createOpenAIRetry', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('должен повторять попытку для ошибок 429', async () => {
    const openAIRetry = createOpenAIRetry();
    const fn = jest.fn()
      .mockRejectedValueOnce(new Error('429 Rate limit exceeded'))
      .mockResolvedValue('success');
    
    const promise = openAIRetry(fn);
    
    await jest.advanceTimersByTimeAsync(2000);
    
    const result = await promise;
    
    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('не должен повторять попытку для ошибок 401', async () => {
    const openAIRetry = createOpenAIRetry();
    const fn = jest.fn().mockRejectedValue(new Error('401 Unauthorized'));
    
    const promise = openAIRetry(fn);
    
    await expect(promise).rejects.toThrow('401 Unauthorized');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('должен повторять попытку для ошибок timeout', async () => {
    const openAIRetry = createOpenAIRetry();
    const fn = jest.fn()
      .mockRejectedValueOnce(new Error('Request timeout'))
      .mockResolvedValue('success');
    
    const promise = openAIRetry(fn);
    
    await jest.advanceTimersByTimeAsync(2000);
    
    const result = await promise;
    
    expect(result).toBe('success');
  });
});

