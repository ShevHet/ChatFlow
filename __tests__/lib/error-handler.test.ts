/**
 * Тесты для модуля обработки ошибок
 */

import { createAppError, createErrorResponse, ErrorType } from '@/lib/error-handler';

describe('error-handler', () => {
  describe('createAppError', () => {
    it('должен создавать ошибку типа NETWORK для сетевых ошибок', () => {
      const error = new Error('Network request failed');
      const appError = createAppError(error);
      
      expect(appError.type).toBe(ErrorType.NETWORK);
      expect(appError.retryable).toBe(true);
      expect(appError.message).toContain('сети');
    });

    it('должен создавать ошибку типа DATABASE для ошибок БД', () => {
      const error = new Error('SQLITE_CONSTRAINT: UNIQUE constraint failed');
      const appError = createAppError(error);
      
      expect(appError.type).toBe(ErrorType.DATABASE);
      expect(appError.retryable).toBe(false);
      expect(appError.statusCode).toBe(500);
    });

    it('должен создавать ошибку типа VALIDATION для ошибок валидации', () => {
      const error = new Error('Validation failed: required field missing');
      const appError = createAppError(error);
      
      expect(appError.type).toBe(ErrorType.VALIDATION);
      expect(appError.retryable).toBe(false);
      expect(appError.statusCode).toBe(400);
    });

    it('должен создавать ошибку типа EXTERNAL_API для ошибок OpenAI', () => {
      const error = new Error('OpenAI API error: 429 Rate limit exceeded');
      const appError = createAppError(error);
      
      expect(appError.type).toBe(ErrorType.EXTERNAL_API);
      expect(appError.retryable).toBe(true);
      expect(appError.message).toContain('лимит');
    });

    it('должен создавать понятное сообщение для ошибки 401 OpenAI', () => {
      const error = new Error('OpenAI API error: 401 Unauthorized');
      const appError = createAppError(error);
      
      expect(appError.type).toBe(ErrorType.EXTERNAL_API);
      expect(appError.message).toContain('API ключ');
      expect(appError.retryable).toBe(false);
    });

    it('должен создавать ошибку типа UNKNOWN для неизвестных ошибок', () => {
      const error = new Error('Some unknown error');
      const appError = createAppError(error);
      
      expect(appError.type).toBe(ErrorType.UNKNOWN);
      expect(appError.retryable).toBe(false);
    });

    it('должен сохранять оригинальную ошибку', () => {
      const originalError = new Error('Test error');
      const appError = createAppError(originalError);
      
      expect(appError.originalError).toBe(originalError);
    });
  });

  describe('createErrorResponse', () => {
    it('должен создавать Response с правильным статус кодом', () => {
      const appError = {
        type: ErrorType.VALIDATION,
        message: 'Test error',
        statusCode: 400,
      };
      
      const response = createErrorResponse(appError);
      
      expect(response.status).toBe(400);
    });

    it('должен включать детали ошибки в режиме разработки', async () => {
      const originalError = new Error('Test error');
      const appError = {
        type: ErrorType.UNKNOWN,
        message: 'Test error',
        originalError,
      };
      
      const response = createErrorResponse(appError, true);
      const body = await response.json();
      
      expect(body.details).toBeDefined();
    });

    it('не должен включать детали ошибки в продакшене', async () => {
      const appError = {
        type: ErrorType.UNKNOWN,
        message: 'Test error',
        originalError: new Error('Test'),
      };
      
      const response = createErrorResponse(appError, false);
      const body = await response.json();
      
      expect(body.details).toBeUndefined();
    });

    it('должен включать информацию о возможности повтора', async () => {
      const appError = {
        type: ErrorType.NETWORK,
        message: 'Network error',
        retryable: true,
      };
      
      const response = createErrorResponse(appError);
      const body = await response.json();
      
      expect(body.retryable).toBe(true);
    });
  });
});

