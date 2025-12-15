
import { NextRequest, NextResponse } from "next/server";
import { getDatabase, Message } from "@/lib/db";
import { createAppError, createErrorResponse } from "@/lib/error-handler";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const threadId = searchParams.get("threadId");

    if (!threadId) {
      const appError = createAppError(
        new Error("threadId query parameter is required"),
        "messages API - GET validation"
      );
      return NextResponse.json(
        { error: appError.message },
        { status: appError.statusCode || 400 }
      );
    }

    const threadIdNum = parseInt(threadId, 10);
    if (isNaN(threadIdNum) || threadIdNum <= 0) {
      return NextResponse.json(
        { error: "threadId must be a positive integer" },
        { status: 400 }
      );
    }

    const db = getDatabase();
    const stmt = db.prepare(
      "SELECT * FROM messages WHERE threadId = ? ORDER BY timestamp ASC"
    );
    const messages = stmt.all(threadIdNum) as Message[];

    return NextResponse.json(messages);
  } catch (error) {
    console.error("Error fetching messages:", error);
    const appError = createAppError(error, "messages API - GET");
    return NextResponse.json(
      { error: appError.message },
      { status: appError.statusCode || 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    let body;
    try {
      body = await request.json();
    } catch (error) {
      return NextResponse.json(
        { error: "Invalid JSON in request body" },
        { status: 400 }
      );
    }

    const { threadId, sender, message } = body;

    if (!threadId || typeof threadId !== "number" || threadId <= 0) {
      const appError = createAppError(
        new Error("threadId is required and must be a positive integer"),
        "messages API - POST validation"
      );
      return NextResponse.json(
        { error: appError.message },
        { status: appError.statusCode || 400 }
      );
    }

    if (!sender || (sender !== "user" && sender !== "assistant")) {
      const appError = createAppError(
        new Error("sender is required and must be 'user' or 'assistant'"),
        "messages API - POST validation"
      );
      return NextResponse.json(
        { error: appError.message },
        { status: appError.statusCode || 400 }
      );
    }

    if (!message || typeof message !== "string" || message.trim().length === 0) {
      const appError = createAppError(
        new Error("message is required and must be a non-empty string"),
        "messages API - POST validation"
      );
      return NextResponse.json(
        { error: appError.message },
        { status: appError.statusCode || 400 }
      );
    }

    // Проверяем существование треда перед вставкой сообщения
    const db = getDatabase();
    const threadCheckStmt = db.prepare("SELECT id FROM threads WHERE id = ?");
    const thread = threadCheckStmt.get(threadId);
    
    if (!thread) {
      return NextResponse.json(
        { error: `Thread with id ${threadId} does not exist` },
        { status: 404 }
      );
    }

    const insertStmt = db.prepare(
      "INSERT INTO messages (threadId, sender, message) VALUES (?, ?, ?)"
    );
    const result = insertStmt.run(threadId, sender, message.trim());
    const id = result.lastInsertRowid;

    const selectStmt = db.prepare("SELECT * FROM messages WHERE id = ?");
    const newMessage = selectStmt.get(id) as Message;

    if (!newMessage) {
      throw new Error("Failed to retrieve created message");
    }

    return NextResponse.json(newMessage, { status: 201 });
  } catch (error) {
    console.error("Error creating message:", error);
    const appError = createAppError(error, "messages API - POST");
    return NextResponse.json(
      { error: appError.message },
      { status: appError.statusCode || 500 }
    );
  }
}
