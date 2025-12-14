"use client";

import { Thread } from "@/lib/db";

interface ThreadListProps {
  threads: Thread[];
  selectedThreadId: number | null;
  onSelectThread: (threadId: number) => void;
}

/**
 * Компонент списка тредов
 * 
 * Отображает список всех тредов с возможностью выбора активного.
 * Активный тред выделяется контрастным фоном и левой границей.
 * 
 * @param threads - Массив тредов для отображения
 * @param selectedThreadId - ID выбранного треда
 * @param onSelectThread - Callback функция при выборе треда
 */
export default function ThreadList({
  threads,
  selectedThreadId,
  onSelectThread,
}: ThreadListProps) {
  return (
    <div className="flex-1 overflow-y-auto">
      {threads.length === 0 ? (
        <div className="p-4 text-sm text-gray-500 text-center">
          Нет тредов. Создайте новый!
        </div>
      ) : (
        <ul className="divide-y divide-gray-100">
          {threads.map((thread) => {
            const isSelected = selectedThreadId === thread.id;
            return (
              <li
                key={thread.id}
                onClick={() => onSelectThread(thread.id)}
                className={`
                  p-4 cursor-pointer transition-all duration-200
                  ${isSelected 
                    ? "bg-blue-50 border-l-4 border-l-blue-500 shadow-sm" 
                    : "hover:bg-gray-50 border-l-4 border-l-transparent"
                  }
                `}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onSelectThread(thread.id);
                  }
                }}
                aria-selected={isSelected}
              >
                <div className="font-medium text-sm text-gray-900 truncate">
                  {thread.title || "Без названия"}
                </div>
                {isSelected && (
                  <div className="mt-1 text-xs text-blue-600 font-medium">
                    Активный тред
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

