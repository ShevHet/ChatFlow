"use client";

import { useEffect } from "react";

interface ConfirmationDialogProps {
  isOpen: boolean;
  question: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmText?: string;
  cancelText?: string;
}

/**
 * Компонент модального окна подтверждения действия
 * 
 * Отображает диалог с вопросом и кнопками подтверждения/отмены.
 * Блокирует прокрутку страницы при открытии.
 * 
 * @param isOpen - Флаг открытия модального окна
 * @param question - Текст вопроса для подтверждения
 * @param onConfirm - Callback при подтверждении
 * @param onCancel - Callback при отмене
 * @param confirmText - Текст кнопки подтверждения (по умолчанию "Да")
 * @param cancelText - Текст кнопки отмены (по умолчанию "Нет")
 */
export default function ConfirmationDialog({
  isOpen,
  question,
  onConfirm,
  onCancel,
  confirmText = "Да",
  cancelText = "Нет",
}: ConfirmationDialogProps) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  // Обработка закрытия по Escape
  useEffect(() => {
    if (!isOpen) return;
    
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onCancel();
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm"
      onClick={onCancel}
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirmation-title"
    >
      <div 
        className="bg-white rounded-lg shadow-2xl p-6 max-w-md w-full mx-4 transform transition-all"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 
          id="confirmation-title"
          className="text-lg font-semibold mb-4 text-gray-800"
        >
          Подтверждение действия
        </h3>
        <p className="text-gray-600 mb-6 leading-relaxed">{question}</p>
        <div className="flex space-x-3 justify-end">
          <button
            onClick={onCancel}
            className="px-4 py-2 border-2 border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 hover:border-gray-400 transition-colors font-medium focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2 min-w-[80px]"
            aria-label="Отменить действие"
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 active:bg-blue-700 transition-colors font-bold shadow-md hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 min-w-[80px]"
            aria-label="Подтвердить действие"
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}





