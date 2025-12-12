"use client";

import { Thread } from "@/lib/db";

interface ThreadListProps {
  threads: Thread[];
  selectedThreadId: number | null;
  onSelectThread: (threadId: number) => void;
}

export default function ThreadList({
  threads,
  selectedThreadId,
  onSelectThread,
}: ThreadListProps) {
  return (
    <div className="flex-1 overflow-y-auto">
      {threads.map((thread) => (
        <div
          key={thread.id}
          onClick={() => onSelectThread(thread.id)}
          className={`p-4 cursor-pointer border-b border-gray-100 hover:bg-gray-50 transition ${
            selectedThreadId === thread.id ? "bg-blue-50 border-l-4 border-l-blue-500" : ""
          }`}
        >
          <div className="font-medium text-sm truncate">{thread.title}</div>
          <div className="text-xs text-gray-500 mt-1">
            {new Date(thread.createdAt * 1000).toLocaleDateString("ru-RU")}
          </div>
        </div>
      ))}
      {threads.length === 0 && (
        <div className="p-4 text-sm text-gray-500 text-center">
          Нет тредов. Создайте новый!
        </div>
      )}
    </div>
  );
}

