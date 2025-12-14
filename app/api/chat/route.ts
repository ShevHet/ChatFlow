import { streamText, type CoreMessage } from "ai";
import { openai } from "@ai-sdk/openai";

export async function POST(req: Request) {
  try {
    const { messages, threadId } = await req.json();

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return new Response("Messages are required", { status: 400 });
    }

    const lastMessage = messages[messages.length - 1];
    if (!lastMessage || lastMessage.role !== "user") {
      return new Response("Last message must be from user", { status: 400 });
    }

    const coreMessages: CoreMessage[] = messages.map((msg: { role: string; content: string }) => {
      if (msg.role === "user") {
        return { role: "user", content: msg.content };
      } else if (msg.role === "assistant") {
        return { role: "assistant", content: msg.content };
      } else if (msg.role === "system") {
        return { role: "system", content: msg.content };
      }
      return { role: "user", content: String(msg.content) };
    });

    const model = openai("gpt-3.5-turbo") as any;
    
    const result = await streamText({
      model,
      messages: coreMessages,
    });

    return result.toTextStreamResponse();
  } catch (error) {
    console.error("Error in chat API:", error);
    return new Response("Internal server error", { status: 500 });
  }
}
