"use client";

import { useState, useRef, useCallback } from 'react';

export interface ExcelUploadProps {
  /** Callback при успешной загрузке файла */
  onUploadSuccess?: (fileId: number, metadata: unknown) => void;
  /** Callback при ошибке загрузки */
  onUploadError?: (error: string) => void;
  /** Разрешенные типы файлов */
  acceptedTypes?: string[];
}

/**
 * Компонент для загрузки Excel файлов
 * 
 * Поддерживает drag & drop и выбор файла через диалог.
 */
export default function ExcelUpload({
  onUploadSuccess,
  onUploadError,
  acceptedTypes = ['.xlsx', '.xls', '.csv', '.xlsm'],
}: ExcelUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    async (file: File) => {
      // Проверка типа файла
      const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();
      if (!acceptedTypes.includes(fileExtension)) {
        const errorMsg = `Неподдерживаемый тип файла. Разрешенные типы: ${acceptedTypes.join(', ')}`;
        onUploadError?.(errorMsg);
        return;
      }

      setIsUploading(true);

      try {
        const formData = new FormData();
        formData.append('file', file);

        const response = await fetch('/api/excel/upload', {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ message: response.statusText }));
          throw new Error(errorData.message || `Ошибка загрузки: ${response.statusText}`);
        }

        const result = await response.json();

        if (!result.success) {
          throw new Error(result.message || 'Ошибка загрузки файла');
        }

        onUploadSuccess?.(result.fileId, result.metadata);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        onUploadError?.(errorMessage);
        console.error('Failed to upload Excel file:', error);
      } finally {
        setIsUploading(false);
      }
    },
    [acceptedTypes, onUploadSuccess, onUploadError]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      const file = e.dataTransfer.files[0];
      if (file) {
        handleFile(file);
      }
    },
    [handleFile]
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        handleFile(file);
      }
    },
    [handleFile]
  );

  const handleClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  return (
    <div className="w-full">
      <div
        className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
          isDragging
            ? 'border-blue-500 bg-blue-50'
            : 'border-gray-300 hover:border-gray-400'
        } ${isUploading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleClick}
        role="button"
        tabIndex={0}
        aria-label="Загрузить Excel файл"
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleClick();
          }
        }}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={acceptedTypes.join(',')}
          onChange={handleFileSelect}
          className="hidden"
          disabled={isUploading}
          aria-label="Выбрать Excel файл"
        />

        {isUploading ? (
          <div className="flex flex-col items-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mb-4"></div>
            <p className="text-gray-600">Загрузка файла...</p>
          </div>
        ) : (
          <div className="flex flex-col items-center">
            <svg
              className="w-12 h-12 text-gray-400 mb-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
              />
            </svg>
            <p className="text-gray-700 mb-2">
              Перетащите Excel файл сюда или нажмите для выбора
            </p>
            <p className="text-sm text-gray-500">
              Поддерживаемые форматы: {acceptedTypes.join(', ')}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

