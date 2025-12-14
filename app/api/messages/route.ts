import { NextRequest, NextResponse } from "next/server";
import { getDatabase, Message } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const threadId = searchParams.get("threadId");
    
    if (!threadId) {
      return NextResponse.json({ error: "threadId is required" }, { status: 400 });
    }

    const db = getDatabase();
    const stmt = db.prepare("SELECT * FROM messages WHERE threadId = ? ORDER BY timestamp ASC");
    const messages = stmt.all(parseInt(threadId)) as Message[];
    
    return NextResponse.json(messages);
  } catch (error) {
    console.error("Error fetching messages:", error);
    return NextResponse.json({ error: "Failed to fetch messages" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { threadId, sender, message } = await request.json();
    
    if (!threadId || !sender || !message) {
      return NextResponse.json({ error: "threadId, sender, and message are required" }, { status: 400 });
    }

    const db = getDatabase();
    const insertStmt = db.prepare("INSERT INTO messages (threadId, sender, message) VALUES (?, ?, ?)");
    const result = insertStmt.run(threadId, sender, message);
    const id = result.lastInsertRowid;
    
    const selectStmt = db.prepare("SELECT * FROM messages WHERE id = ?");
    const newMessage = selectStmt.get(id) as Message;
    
    return NextResponse.json(newMessage);
  } catch (error) {
    console.error("Error creating message:", error);
    return NextResponse.json({ error: "Failed to create message" }, { status: 500 });
  }
}
