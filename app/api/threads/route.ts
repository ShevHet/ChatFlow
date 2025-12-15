/**
 * API роут для управления тредами (беседами)
 * 
 * Поддерживает два метода:
 * - GET: получение списка всех тредов, отсортированных по дате создания
 * - POST: создание нового треда
 * 
 * @route GET /api/threads
 * @route POST /api/threads
 */

import { NextRequest, NextResponse } from "next/server";
import { getDatabase, Thread } from "@/lib/db";
import { createAppError } from "@/lib/error-handler";

export async function GET() {
  try {
    const db = getDatabase();
    const stmt = db.prepare("SELECT * FROM threads ORDER BY createdAt DESC");
    const threads = stmt.all() as Thread[];
    return NextResponse.json(threads);
  } catch (error) {
    console.error("Error fetching threads:", error);
    const appError = createAppError(error, "threads API - GET");
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
      const appError = createAppError(
        new Error("Invalid JSON in request body"),
        "threads API - POST JSON parsing"
      );
      return NextResponse.json(
        { error: appError.message },
        { status: appError.statusCode || 400 }
      );
    }

    const { title } = body;

    if (!title || typeof title !== "string" || title.trim().length === 0) {
      const appError = createAppError(
        new Error("Title is required and must be a non-empty string"),
        "threads API - POST validation"
      );
      return NextResponse.json(
        { error: appError.message },
        { status: appError.statusCode || 400 }
      );
    }

    const trimmedTitle = title.trim();
    const MAX_TITLE_LENGTH = 500;
    if (trimmedTitle.length > MAX_TITLE_LENGTH) {
      const appError = createAppError(
        new Error(`Title must not exceed ${MAX_TITLE_LENGTH} characters`),
        "threads API - POST validation"
      );
      return NextResponse.json(
        { error: appError.message },
        { status: appError.statusCode || 400 }
      );
    }

    const db = getDatabase();
    const insertStmt = db.prepare("INSERT INTO threads (title) VALUES (?)");
    const result = insertStmt.run(trimmedTitle);
    const id = result.lastInsertRowid;

    // Получаем созданный тред для возврата
    const selectStmt = db.prepare("SELECT * FROM threads WHERE id = ?");
    const thread = selectStmt.get(id) as Thread;

    if (!thread) {
      throw new Error("Failed to retrieve created thread");
    }

    return NextResponse.json(thread, { status: 201 });
  } catch (error) {
    console.error("Error creating thread:", error);
    const appError = createAppError(error, "threads API - POST");
    return NextResponse.json(
      { error: appError.message },
      { status: appError.statusCode || 500 }
    );
  }
}
