import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const db = getDatabase();
    const threadsRows = db.prepare('SELECT * FROM threads').all() as any[];
    
    const threads = threadsRows.map((row) => ({
      id: Number(row.id),
      title: row.title,
    }));
    
    return NextResponse.json(threads);
  } catch (error) {
    console.error('Error fetching threads:', error);
    return NextResponse.json({ error: 'Failed to fetch threads' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { threadId, userMessage, assistantMessage } = await req.json();
    
    if (!threadId) {
      return NextResponse.json({ error: 'threadId is required' }, { status: 400 });
    }
    
    const db = getDatabase();
    
    if (assistantMessage && userMessage) {
      const lastMessage = db.prepare(
        'SELECT * FROM messages WHERE thread_id = ? AND user_message = ? AND assistant_message IS NULL ORDER BY id DESC LIMIT 1'
      ).get(threadId, userMessage) as any;
      
      if (lastMessage) {
        db.prepare('UPDATE messages SET assistant_message = ? WHERE id = ?').run(assistantMessage, lastMessage.id);
        return NextResponse.json({ message: 'Message updated' });
      }
    }
    
    db.prepare('INSERT INTO messages (thread_id, user_message, assistant_message) VALUES (?, ?, ?)').run(
      threadId, userMessage || null, assistantMessage || null);
    
    return NextResponse.json({ message: 'Message saved' });
  } catch (error) {
    console.error('Error saving message:', error);
    return NextResponse.json({ error: 'Failed to save message' }, { status: 500 });
  }
}
