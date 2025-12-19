"use client";

import { useEffect, useRef, useCallback } from 'react';

export interface ConfirmationDialogProps {
  /** Открыт ли диалог */
  isOpen: boolean;
  /** Заголовок диалога */
  title: string;
  /** Сообщение в диалоге */
  message: string;
  /** Текст кнопки подтверждения */
  confirmText?: string;
  /** Текст кнопки отмены */
  cancelText?: string;
  /** Тип диалога (определяет цвет кнопки подтверждения) */
  type?: 'default' | 'danger' | 'warning';
  /** Callback при подтверждении */
  onConfirm: () => void;
  /** Callback при отмене */
  onCancel: () => void;
}

/**
 * Компонент диалога подтверждения действий
 * 
 * Поддерживает клавиатурную навигацию (Escape для отмены, Enter для подтверждения)
 * и доступность (ARIA атрибуты).
 */
export default function ConfirmationDialog({
  isOpen,
  title,
  message,
  confirmText = 'Подтвердить',
  cancelText = 'Отмена',
  type = 'default',
  onConfirm,
  onCancel,
}: ConfirmationDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const confirmButtonRef = useRef<HTMLButtonElement>(null);
  const previouslyFocusedElementRef = useRef<HTMLElement | null>(null);

  // Управление открытием/закрытием диалога
  useEffect(() => {
    if (!dialogRef.current) return;

    if (isOpen) {
      // Сохраняем текущий фокус
      previouslyFocusedElementRef.current = document.activeElement as HTMLElement;
      dialogRef.current.showModal();
      // Фокусируемся на кнопке подтверждения
      setTimeout(() => {
        confirmButtonRef.current?.focus();
      }, 0);
    } else {
      dialogRef.current.close();
      // Возвращаем фокус на предыдущий элемент
      if (previouslyFocusedElementRef.current) {
        previouslyFocusedElementRef.current.focus();
      }
    }
  }, [isOpen]);

  // Обработка Escape для закрытия
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDialogElement>) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCancel();
      } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        // Ctrl+Enter или Cmd+Enter для подтверждения
        e.preventDefault();
        onConfirm();
      }
    },
    [onConfirm, onCancel]
  );

  // Обработка клика по backdrop для закрытия
  const handleBackdropClick = useCallback(
    (e: React.MouseEvent<HTMLDialogElement>) => {
      if (e.target === dialogRef.current) {
        onCancel();
      }
    },
    [onCancel]
  );

  if (!isOpen) return null;

  const confirmButtonClass =
    type === 'danger'
      ? 'bg-red-500 hover:bg-red-600 focus:ring-red-500'
      : type === 'warning'
      ? 'bg-yellow-500 hover:bg-yellow-600 focus:ring-yellow-500'
      : 'bg-blue-500 hover:bg-blue-600 focus:ring-blue-500';

  return (
    <dialog
      ref={dialogRef}
      className="rounded-lg p-0 w-full max-w-md shadow-xl backdrop:bg-black/50 backdrop:backdrop-blur-sm"
      onKeyDown={handleKeyDown}
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirmation-dialog-title"
      aria-describedby="confirmation-dialog-description"
    >
      <div className="p-6" onClick={(e) => e.stopPropagation()}>
        <h2
          id="confirmation-dialog-title"
          className="text-xl font-semibold mb-4 text-gray-900"
        >
          {title}
        </h2>
        <p
          id="confirmation-dialog-description"
          className="text-gray-700 mb-6"
        >
          {message}
        </p>
        <div className="flex justify-end space-x-3">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition"
            aria-label={cancelText}
          >
            {cancelText}
          </button>
          <button
            ref={confirmButtonRef}
            type="button"
            onClick={onConfirm}
            className={`px-4 py-2 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 transition ${confirmButtonClass}`}
            aria-label={confirmText}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </dialog>
  );
}

