import { NextRequest, NextResponse } from "next/server";
import { getDatabase, Thread } from "@/lib/db";

export async function GET() {
  try {
    const db = getDatabase();
    const stmt = db.prepare("SELECT * FROM threads ORDER BY createdAt DESC");
    const threads = stmt.all() as Thread[];
    return NextResponse.json(threads);
  } catch (error) {
    console.error("Error fetching threads:", error);
    return NextResponse.json({ error: "Failed to fetch threads" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { title } = await request.json();
    
    // Validate input
    if (!title || typeof title !== "string" || title.trim().length === 0) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }
    
    const db = getDatabase();
    
    const insertStmt = db.prepare("INSERT INTO threads (title) VALUES (?)");
    const result = insertStmt.run(title.trim());
    const id = result.lastInsertRowid;
    
    const selectStmt = db.prepare("SELECT * FROM threads WHERE id = ?");
    const thread = selectStmt.get(id) as Thread;
    
    return NextResponse.json(thread);
  } catch (error) {
    console.error("Error creating thread:", error);
    return NextResponse.json({ error: "Failed to create thread" }, { status: 500 });
  }
}
