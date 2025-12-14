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
    const messagesRows = db.prepare('SELECT * FROM messages WHERE thread_id = ?').all(Number(threadId)) as any[];
    
    const messages: Message[] = messagesRows.map((row) => ({
      id: Number(row.id),
      thread_id: Number(row.thread_id),
      user_message: row.user_message,
      assistant_message: row.assistant_message,
    }));
    
    return NextResponse.json(messages);
  } catch (error) {
    console.error("Error fetching messages:", error);
    return NextResponse.json({ error: "Failed to fetch messages" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { threadId, userMessage, assistantMessage } = await request.json();
    
    if (!threadId) {
      return NextResponse.json({ error: "threadId is required" }, { status: 400 });
    }

    const db = getDatabase();
    const insertStmt = db.prepare('INSERT INTO messages (thread_id, user_message, assistant_message) VALUES (?, ?, ?)');
    const result = insertStmt.run(threadId, userMessage || null, assistantMessage || null);
    
    const rawId = result.lastInsertRowId ?? result.lastInsertRowid;
    const id = typeof rawId === 'bigint' ? Number(rawId) : Number(rawId);
    
    if (!id || isNaN(id) || id === 0) {
      console.error("Failed to get valid lastInsertRowId for message. Result:", result);
      const lastMessage = db.prepare('SELECT * FROM messages WHERE thread_id = ? ORDER BY id DESC LIMIT 1').get(threadId) as any;
      if (lastMessage) {
        console.log("Found last message for thread:", lastMessage);
        const message: Message = {
          id: Number(lastMessage.id),
          thread_id: Number(lastMessage.thread_id),
          user_message: lastMessage.user_message,
          assistant_message: lastMessage.assistant_message,
        };
        return NextResponse.json(message);
      }
      return NextResponse.json({ error: "Failed to create message: invalid ID" }, { status: 500 });
    }
    
    const selectStmt = db.prepare('SELECT * FROM messages WHERE id = ?');
    const messageRow = selectStmt.get(id) as any;
    
    if (!messageRow) {
      console.error("Message not found after insert. ID:", id);
      const lastMessage = db.prepare('SELECT * FROM messages WHERE thread_id = ? ORDER BY id DESC LIMIT 1').get(threadId) as any;
      if (lastMessage) {
        console.log("Found last message instead:", lastMessage);
        const message: Message = {
          id: Number(lastMessage.id),
          thread_id: Number(lastMessage.thread_id),
          user_message: lastMessage.user_message,
          assistant_message: lastMessage.assistant_message,
        };
        return NextResponse.json(message);
      }
      return NextResponse.json({ error: "Failed to retrieve created message" }, { status: 500 });
    }
    
    const newMessage: Message = {
      id: Number(messageRow.id),
      thread_id: Number(messageRow.thread_id),
      user_message: messageRow.user_message,
      assistant_message: messageRow.assistant_message,
    };
    
    return NextResponse.json(newMessage);
  } catch (error) {
    console.error("Error creating message:", error);
    return NextResponse.json({ error: "Failed to create message" }, { status: 500 });
  }
}
