import { NextRequest, NextResponse } from "next/server";
import { getDatabase, Thread } from "@/lib/db";

export async function GET() {
  try {
    const db = getDatabase();
    const threadsRows = db.prepare('SELECT * FROM threads').all() as any[];
    
    const threads: Thread[] = threadsRows.map((row) => ({
      id: Number(row.id),
      title: row.title,
    }));
    
    return NextResponse.json(threads);
  } catch (error) {
    console.error("Error fetching threads:", error);
    return NextResponse.json({ error: "Failed to fetch threads" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { title } = await request.json();
    
    if (!title || typeof title !== "string" || title.trim().length === 0) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }
    
    const db = getDatabase();
    const insertStmt = db.prepare('INSERT INTO threads (title) VALUES (?)');
    const result = insertStmt.run(title.trim());
    
    const rawId = result.lastInsertRowId ?? result.lastInsertRowid;
    const id = typeof rawId === 'bigint' ? Number(rawId) : Number(rawId);
    
    console.log("Insert result:", { lastInsertRowId: rawId, id, type: typeof rawId });
    
    if (!id || isNaN(id) || id === 0) {
      console.error("Failed to get valid lastInsertRowId. Result:", result);
      const lastThread = db.prepare('SELECT * FROM threads WHERE title = ? ORDER BY id DESC LIMIT 1').get(title.trim()) as any;
      if (lastThread) {
        console.log("Found thread by title:", lastThread);
        const thread: Thread = {
          id: Number(lastThread.id),
          title: lastThread.title,
        };
        return NextResponse.json(thread);
      }
      return NextResponse.json({ error: "Failed to create thread: invalid ID" }, { status: 500 });
    }
    
    const selectStmt = db.prepare('SELECT * FROM threads WHERE id = ?');
    const threadRow = selectStmt.get(id) as any;
    
    console.log("Selected thread row:", threadRow);
    
    if (!threadRow) {
      console.error("Thread not found after insert. ID:", id, "Type:", typeof id);
      const lastThread = db.prepare('SELECT * FROM threads ORDER BY id DESC LIMIT 1').get() as any;
      if (lastThread) {
        console.log("Found last thread instead:", lastThread);
        const thread: Thread = {
          id: Number(lastThread.id),
          title: lastThread.title,
        };
        return NextResponse.json(thread);
      }
      return NextResponse.json({ error: "Failed to retrieve created thread" }, { status: 500 });
    }
    
    const thread: Thread = {
      id: Number(threadRow.id),
      title: threadRow.title,
    };
    
    return NextResponse.json(thread);
  } catch (error: any) {
    console.error("Error creating thread:", error);
    const errorMessage = error?.message || error?.toString() || "Failed to create thread";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
