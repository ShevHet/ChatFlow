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
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
        console.error("Failed to create thread:", errorData);
        alert(`Ошибка при создании треда: ${errorData.error || `HTTP ${response.status}`}`);
        return;
      }
      
      const newThread = await response.json();
      if (!newThread || !newThread.id) {
        console.error("Invalid thread response:", newThread);
        alert("Ошибка: получен некорректный ответ от сервера");
        return;
      }
      
      setThreads((prev) => [newThread, ...prev]);
      setSelectedThreadId(newThread.id);
    } catch (error) {
      console.error("Failed to create thread:", error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      alert(`Ошибка при создании треда: ${errorMessage || "Неизвестная ошибка"}`);
    }
  };

  return (
    <div className="flex h-screen bg-gray-100">
      <div className="w-64 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-4 border-b border-gray-200">
          <h1 className="text-xl font-bold mb-4">ChatFlow</h1>
          <button
            onClick={handleCreateThread}
            className="w-full bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 active:bg-blue-700 transition-colors font-medium shadow-md hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
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
      </div>
      <div className="flex-1 flex flex-col">
        {selectedThreadId ? (
          <ChatInterface threadId={selectedThreadId} />
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-500">
            Выберите тред или создайте новый
          </div>
        )}
      </div>
    </div>
  );
}

