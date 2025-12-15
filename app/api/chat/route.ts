
import { streamText, type CoreMessage } from "ai";
import { openai } from "@ai-sdk/openai";
import { createAppError, createErrorResponse, ErrorType } from "@/lib/error-handler";
import { createOpenAIRetry } from "@/lib/retry";

export async function POST(req: Request) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      console.error("OPENAI_API_KEY is not set");
      return createErrorResponse({
        type: ErrorType.EXTERNAL_API,
        message: "OpenAI API key is not configured. Please set OPENAI_API_KEY in .env.local",
        statusCode: 500,
        retryable: false,
      });
    }

    let body;
    try {
      body = await req.json();
    } catch (error) {
      return createErrorResponse({
        type: ErrorType.VALIDATION,
        message: "Invalid JSON in request body",
        statusCode: 400,
        retryable: false,
      });
    }

    const { messages, threadId } = body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return createErrorResponse({
        type: ErrorType.VALIDATION,
        message: "Messages array is required and must not be empty",
        statusCode: 400,
        retryable: false,
      });
    }

    if (!threadId || typeof threadId !== "number") {
      return createErrorResponse({
        type: ErrorType.VALIDATION,
        message: "Valid threadId is required",
        statusCode: 400,
        retryable: false,
      });
    }

    const lastMessage = messages[messages.length - 1];
    if (!lastMessage || lastMessage.role !== "user") {
      return createErrorResponse({
        type: ErrorType.VALIDATION,
        message: "Last message must be from user",
        statusCode: 400,
        retryable: false,
      });
    }

    const coreMessages: CoreMessage[] = messages.map(
      (msg: { role: string; content: string }) => {
        if (msg.role === "user") {
          return { role: "user", content: msg.content };
        } else if (msg.role === "assistant") {
          return { role: "assistant", content: msg.content };
        } else if (msg.role === "system") {
          return { role: "system", content: msg.content };
        }
        return { role: "user", content: String(msg.content) };
      }
    );

    const model = openai("gpt-3.5-turbo");
    const retryWithOpenAI = createOpenAIRetry();
    
    const result = await retryWithOpenAI(async () => {
      return await streamText({
        model,
        messages: coreMessages,
        maxRetries: 0,
      });
    });

    return result.toTextStreamResponse();
  } catch (error) {
    const appError = createAppError(error, "chat API");
    const errorDetails = error instanceof Error ? {
      name: error.name,
      message: error.message,
      statusCode: ('statusCode' in error ? (error as any).statusCode : undefined),
      cause: ('cause' in error ? (error as any).cause : undefined),
    } : { error };
    
    console.error(`[Chat API Error] ${appError.type} (${appError.statusCode || 'N/A'}): ${appError.message} | Original: ${JSON.stringify(errorDetails)}`);
    
    return createErrorResponse(appError, process.env.NODE_ENV === "development");
  }
}
