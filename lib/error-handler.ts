
export enum ErrorType {
  NETWORK = "NETWORK",
  DATABASE = "DATABASE",
  VALIDATION = "VALIDATION",
  EXTERNAL_API = "EXTERNAL_API",
  UNKNOWN = "UNKNOWN",
}

export interface AppError {
  type: ErrorType;
  message: string;
  originalError?: unknown;
  statusCode?: number;
  retryable?: boolean;
}

export function createAppError(error: unknown, context?: string): AppError {
  if (error instanceof Error) {
    const message = error.message;
    const lowerMessage = message.toLowerCase();
    if (lowerMessage.includes("network") || lowerMessage.includes("fetch") || lowerMessage.includes("econnrefused") || lowerMessage.includes("request failed")) {
      return {
        type: ErrorType.NETWORK,
        message: "Ошибка сети. Проверьте подключение к интернету.",
        originalError: error,
        retryable: true,
      };
    }
    
    if (message.includes("database") || message.includes("SQLITE") || message.includes("constraint")) {
      return {
        type: ErrorType.DATABASE,
        message: "Ошибка базы данных. Попробуйте позже.",
        originalError: error,
        statusCode: 500,
        retryable: false,
      };
    }
    
    if (message.includes("validation") || message.includes("required") || message.includes("invalid")) {
      return {
        type: ErrorType.VALIDATION,
        message: error.message,
        originalError: error,
        statusCode: 400,
        retryable: false,
      };
    }
    
    if (message.includes("OpenAI") || message.includes("API") || message.includes("429") || message.includes("401") || message.includes("403")) {
      return {
        type: ErrorType.EXTERNAL_API,
        message: getOpenAIErrorMessage(error),
        originalError: error,
        statusCode: getStatusCodeFromError(error),
        retryable: isRetryableOpenAIError(error),
      };
    }
    
    if (error.name === 'AI_APICallError' || 'statusCode' in error || 'responseBody' in error) {
      const statusCode = ('statusCode' in error ? (error as any).statusCode : undefined) || getStatusCodeFromError(error);
      let errorMessage = getOpenAIErrorMessage(error);
      
      if ('responseBody' in error && typeof (error as any).responseBody === 'string') {
        try {
          const responseData = JSON.parse((error as any).responseBody);
          if (responseData?.error) {
            if (responseData.error.code === 'unsupported_country_region_territory') {
              errorMessage = "Ваш регион не поддерживается OpenAI API. Разверните проект на сервере в поддерживаемом регионе.";
            } else if (responseData.error.message) {
              const apiMessage = responseData.error.message.toLowerCase();
              if (apiMessage.includes("country") || apiMessage.includes("region") || apiMessage.includes("territory")) {
                errorMessage = "Ваш регион не поддерживается OpenAI API. Разверните проект на сервере в поддерживаемом регионе.";
              }
            }
          }
        } catch (e) {
          // Ignore parsing errors
        }
      }
      
      return {
        type: ErrorType.EXTERNAL_API,
        message: errorMessage,
        originalError: error,
        statusCode,
        retryable: isRetryableOpenAIError(error),
      };
    }
  }
  
  return {
    type: ErrorType.UNKNOWN,
    message: "Произошла неизвестная ошибка. Попробуйте позже.",
    originalError: error,
    statusCode: 500,
    retryable: false,
  };
}

function getOpenAIErrorMessage(error: Error): string {
  const message = error.message.toLowerCase();
  
  if ('responseBody' in error && typeof (error as any).responseBody === 'string') {
    try {
      const responseData = JSON.parse((error as any).responseBody);
      
      if (process.env.NODE_ENV === "development") {
        console.log(`[OpenAI Error] code: ${responseData?.error?.code || 'N/A'}, message: ${responseData?.error?.message || 'N/A'}`);
      }
      
      if (responseData?.error) {
        const errorCode = responseData.error.code;
        const errorMsg = responseData.error.message?.toLowerCase() || '';
        
        if (errorCode === 'unsupported_country_region_territory' || 
            errorMsg.includes("country") || 
            errorMsg.includes("region") || 
            errorMsg.includes("territory")) {
          return "Ваш регион не поддерживается OpenAI API. Разверните проект на сервере в поддерживаемом регионе.";
        }
        
        if (responseData.error.message) {
          const apiMessage = responseData.error.message.toLowerCase();
          if (apiMessage.includes("country") || apiMessage.includes("region") || apiMessage.includes("territory")) {
            return "Ваш регион не поддерживается OpenAI API. Разверните проект на сервере в поддерживаемом регионе.";
          }
        }
      }
    } catch (e) {
      if (process.env.NODE_ENV === "development") {
        console.warn("Failed to parse responseBody:", e);
      }
    }
  }
  if ('data' in error && typeof (error as any).data === 'object' && (error as any).data?.error) {
    const errorData = (error as any).data.error;
    if (errorData.code === 'unsupported_country_region_territory') {
      return "Ваш регион не поддерживается OpenAI API. Разверните проект на сервере в поддерживаемом регионе.";
    }
    if (errorData.message) {
      const errorMsg = errorData.message.toLowerCase();
      if (errorMsg.includes("country") || errorMsg.includes("region") || errorMsg.includes("territory")) {
        return "Ваш регион не поддерживается OpenAI API. Разверните проект на сервере в поддерживаемом регионе.";
      }
    }
  }
  
  if (message.includes("401") || message.includes("unauthorized") || message.includes("invalid api key")) {
    return "Неверный API ключ OpenAI. Проверьте настройки.";
  }
  
  if (message.includes("403") || message.includes("forbidden")) {
    if (message.includes("country") || message.includes("region") || message.includes("territory")) {
      return "Ваш регион не поддерживается OpenAI API. Разверните проект на сервере в поддерживаемом регионе.";
    }
    return "Доступ запрещен. Проверьте API ключ и настройки аккаунта OpenAI.";
  }
  
  if (message.includes("429") || message.includes("rate limit")) {
    return "Превышен лимит запросов к OpenAI. Подождите немного и попробуйте снова.";
  }
  
  if (message.includes("500") || message.includes("internal server error")) {
    return "Временная ошибка сервера OpenAI. Попробуйте через несколько секунд.";
  }
  
  if (message.includes("503") || message.includes("service unavailable")) {
    return "Сервис OpenAI временно недоступен. Попробуйте позже.";
  }
  
  if (message.includes("timeout") || message.includes("timed out")) {
    return "Превышено время ожидания ответа от OpenAI. Попробуйте еще раз.";
  }
  
  if (message.includes("quota") || message.includes("insufficient")) {
    return "Недостаточно средств на счете OpenAI. Пополните баланс.";
  }
  
  return "Ошибка при обращении к OpenAI API. Попробуйте позже.";
}

function getStatusCodeFromError(error: Error): number | undefined {
  const message = error.message;
  
  if (message.includes("401") || message.includes("unauthorized")) {
    return 401;
  }
  
  if (message.includes("403") || message.includes("forbidden")) {
    return 403;
  }
  
  if (message.includes("404") || message.includes("not found")) {
    return 404;
  }
  
  if (message.includes("429") || message.includes("rate limit")) {
    return 429;
  }
  
  if (message.includes("500") || message.includes("internal server error")) {
    return 500;
  }
  
  if (message.includes("503") || message.includes("service unavailable")) {
    return 503;
  }
  
  return undefined;
}

function isRetryableOpenAIError(error: Error): boolean {
  const message = error.message.toLowerCase();
  if ('responseBody' in error && typeof (error as any).responseBody === 'string') {
    try {
      const responseData = JSON.parse((error as any).responseBody);
      if (responseData?.error?.code === 'unsupported_country_region_territory') {
        return false; // Ошибка региона не повторяемая
      }
    } catch (e) {
      // Ignore parsing errors
    }
  }
  if ('data' in error && typeof (error as any).data === 'object' && (error as any).data?.error) {
    const errorData = (error as any).data.error;
    if (errorData.code === 'unsupported_country_region_territory') {
      return false; // Ошибка региона не повторяемая
    }
  }
  
  const retryablePatterns = [
    "429",
    "500",
    "503",
    "timeout",
    "timed out",
    "network",
    "connection",
  ];
  
  const nonRetryablePatterns = [
    "401",
    "403",
    "404",
    "invalid api key",
    "quota",
    "insufficient",
    "validation",
    "country",
    "region",
    "territory",
  ];
  
  for (const pattern of nonRetryablePatterns) {
    if (message.includes(pattern)) {
      return false;
    }
  }
  
  for (const pattern of retryablePatterns) {
    if (message.includes(pattern)) {
      return true;
    }
  }
  
  return false;
}

export function createErrorResponse(
  appError: AppError,
  includeDetails: boolean = false
): Response {
  const statusCode = appError.statusCode || 500;
  
  const responseBody: {
    error: string;
    type: ErrorType;
    retryable?: boolean;
    details?: unknown;
  } = {
    error: appError.message,
    type: appError.type,
  };
  
  if (appError.retryable !== undefined) {
    responseBody.retryable = appError.retryable;
  }
  
  if (includeDetails && appError.originalError) {
    responseBody.details = appError.originalError;
  }
  
  return new Response(JSON.stringify(responseBody), {
    status: statusCode,
    headers: { "Content-Type": "application/json" },
  });
}

