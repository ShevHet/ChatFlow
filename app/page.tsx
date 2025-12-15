"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import ChatInterface from "@/components/ChatInterface";
import ThreadList from "@/components/ThreadList";
import { Thread } from "@/lib/db";

export default function Home() {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [selectedThreadId, setSelectedThreadId] = useState<number | null>(null);
  const router = useRouter();

  useEffect(() => {
    loadThreads();
  }, []);

  const loadThreads = async () => {
    try {
      const response = await fetch("/api/threads");
      if (response.ok) {
        const data = await response.json();
        setThreads(data);
        if (data.length > 0 && !selectedThreadId) {
          setSelectedThreadId(data[0].id);
        }
      }
    } catch (error) {
      console.error("Failed to load threads:", error);
    }
  };

  const handleCreateThread = async () => {
    try {
      const response = await fetch("/api/threads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: `Новый тред ${new Date().toLocaleString()}` }),
      });
      if (response.ok) {
        const newThread = await response.json();
        setThreads((prev) => [newThread, ...prev]);
        setSelectedThreadId(newThread.id);
      }
    } catch (error) {
      console.error("Failed to create thread:", error);
    }
  };

  return (
    <div className="flex h-screen bg-gray-100" role="application" aria-label="ChatFlow приложение">
      <aside
        className="w-64 bg-white border-r border-gray-200 flex flex-col"
        role="complementary"
        aria-label="Боковая панель с тредами"
      >
        <div className="p-4 border-b border-gray-200">
          <h1 className="text-xl font-bold mb-4">ChatFlow</h1>
          <button
            onClick={handleCreateThread}
            className="w-full bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition"
            aria-label="Создать новый тред"
          >
            + Новый тред
          </button>
        </div>
        <ThreadList
          threads={threads}
          selectedThreadId={selectedThreadId}
          onSelectThread={setSelectedThreadId}
        />
      </aside>
      <main className="flex-1 flex flex-col" role="main" aria-label="Область чата">
        {selectedThreadId ? (
          <ChatInterface threadId={selectedThreadId} />
        ) : (
          <div
            className="flex-1 flex items-center justify-center text-gray-500"
            role="status"
            aria-live="polite"
          >
            Выберите тред или создайте новый
          </div>
        )}
      </main>
    </div>
  );
}

