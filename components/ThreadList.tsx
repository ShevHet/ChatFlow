"use client";

import { Thread } from "@/lib/db";
import { useCallback, KeyboardEvent } from "react";

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
  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>, threadId: number) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onSelectThread(threadId);
      }
    },
    [onSelectThread]
  );

  return (
    <nav
      className="flex-1 overflow-y-auto"
      role="navigation"
      aria-label="Список тредов"
    >
      <ul role="list" className="list-none p-0 m-0">
        {threads.map((thread, index) => (
          <li key={thread.id} role="none">
            <div
              role="button"
              tabIndex={0}
              onClick={() => onSelectThread(thread.id)}
              onKeyDown={(e) => handleKeyDown(e, thread.id)}
              className={`p-4 cursor-pointer border-b border-gray-100 hover:bg-gray-50 focus:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-inset transition ${
                selectedThreadId === thread.id
                  ? "bg-blue-50 border-l-4 border-l-blue-500"
                  : ""
              }`}
              aria-label={`Тред: ${thread.title}, создан ${new Date(
                thread.createdAt * 1000
              ).toLocaleDateString("ru-RU")}`}
              aria-selected={selectedThreadId === thread.id}
              aria-posinset={index + 1}
              aria-setsize={threads.length}
            >
              <div className="font-medium text-sm truncate">{thread.title}</div>
              <div className="text-xs text-gray-500 mt-1">
                {new Date(thread.createdAt * 1000).toLocaleDateString("ru-RU")}
              </div>
            </div>
          </li>
        ))}
      </ul>
      {threads.length === 0 && (
        <div
          className="p-4 text-sm text-gray-500 text-center"
          role="status"
          aria-live="polite"
        >
          Нет тредов. Создайте новый!
        </div>
      )}
    </nav>
  );
}

