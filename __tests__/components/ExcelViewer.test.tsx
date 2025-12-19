/**
 * Тесты для компонента ExcelViewer
 * 
 * Покрывает требования из промпта:
 * - Открытие таблицы в модальном окне
 * - Выделение диапазонов ячеек
 * - Отображение данных таблицы
 */

import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ExcelViewer from "@/components/ExcelViewer";

// Мокаем fetch для API вызовов
global.fetch = jest.fn();

describe("ExcelViewer", () => {
  const mockOnCellSelect = jest.fn();
  const mockOnClose = jest.fn();

  const mockMetadata = {
    fileId: 1,
    filename: "test.xlsx",
    size: 1024,
    rowCount: 5,
    columnCount: 2,
    headers: ["Email", "Sum"],
    uploadedAt: Date.now(),
  };

  const mockData = [
    { Email: "email1@example.com", Sum: 100 },
    { Email: "email2@example.com", Sum: 150 },
    { Email: "email3@example.com", Sum: 200 },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Мокаем успешный ответ API
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        metadata: mockMetadata,
        data: mockData,
        pagination: {
          offset: 0,
          limit: 100,
          total: 5,
        },
      }),
    });
  });

  describe("5. Тестирование открытия таблицы в модальном окне", () => {
    it("should open table in modal and display data correctly", async () => {
      render(
        <ExcelViewer
          fileId={1}
          onClose={mockOnClose}
          onCellSelect={mockOnCellSelect}
        />
      );

      // Проверяем, что компонент загружается
      await waitFor(() => {
        expect(screen.getByText("test.xlsx")).toBeInTheDocument();
      });

      // Проверяем, что таблица отображается
      expect(screen.getByRole("table")).toBeInTheDocument();
      
      // Проверяем заголовки
      expect(screen.getByText("Email")).toBeInTheDocument();
      expect(screen.getByText("Sum")).toBeInTheDocument();
      
      // Проверяем данные
      expect(screen.getByText("email1@example.com")).toBeInTheDocument();
      expect(screen.getByText("100")).toBeInTheDocument();
    });

    it("should allow cell selection", async () => {
      render(
        <ExcelViewer
          fileId={1}
          onClose={mockOnClose}
          onCellSelect={mockOnCellSelect}
        />
      );

      await waitFor(() => {
        expect(screen.getByText("email1@example.com")).toBeInTheDocument();
      });

      // Находим ячейку и кликаем на неё
      const cell = screen.getByText("email1@example.com");
      fireEvent.click(cell);

      // Проверяем, что callback был вызван
      await waitFor(() => {
        expect(mockOnCellSelect).toHaveBeenCalled();
      });

      // Проверяем, что была передана правильная ссылка на ячейку
      const callArgs = mockOnCellSelect.mock.calls[0];
      expect(callArgs[0]).toMatch(/^A\d+$/); // Формат A1, A2, etc.
      expect(callArgs[1]).toBe("email1@example.com");
    });

    it("should display selected cell information", async () => {
      render(
        <ExcelViewer
          fileId={1}
          onClose={mockOnClose}
          onCellSelect={mockOnCellSelect}
          initialSelectedCell="A2"
        />
      );

      await waitFor(() => {
        expect(screen.getByText(/Выбрана ячейка:/)).toBeInTheDocument();
        expect(screen.getByText("A2")).toBeInTheDocument();
      });
    });

    it("should handle range selection through multiple clicks", async () => {
      render(
        <ExcelViewer
          fileId={1}
          onClose={mockOnClose}
          onCellSelect={mockOnCellSelect}
        />
      );

      await waitFor(() => {
        expect(screen.getByText("email1@example.com")).toBeInTheDocument();
      });

      // Кликаем на первую ячейку
      const cell1 = screen.getByText("email1@example.com");
      fireEvent.click(cell1);

      // Кликаем на вторую ячейку
      const cell2 = screen.getByText("email2@example.com");
      fireEvent.click(cell2);

      // Проверяем, что оба вызова были сделаны
      expect(mockOnCellSelect).toHaveBeenCalledTimes(2);
    });

    it("should display table with correct structure", async () => {
      render(
        <ExcelViewer
          fileId={1}
          onClose={mockOnClose}
          onCellSelect={mockOnCellSelect}
        />
      );

      await waitFor(() => {
        const table = screen.getByRole("table");
        expect(table).toBeInTheDocument();
        
        // Проверяем наличие thead
        const thead = table.querySelector("thead");
        expect(thead).toBeInTheDocument();
        
        // Проверяем наличие tbody
        const tbody = table.querySelector("tbody");
        expect(tbody).toBeInTheDocument();
      });
    });

    it("should handle pagination for large files", async () => {
      const largeMetadata = {
        ...mockMetadata,
        rowCount: 250,
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          metadata: largeMetadata,
          data: mockData,
          pagination: {
            offset: 0,
            limit: 100,
            total: 250,
          },
        }),
      });

      render(
        <ExcelViewer
          fileId={1}
          onClose={mockOnClose}
          onCellSelect={mockOnCellSelect}
          pageSize={100}
        />
      );

      await waitFor(() => {
        expect(screen.getByText(/Страница 1 из/)).toBeInTheDocument();
      });

      // Проверяем наличие кнопок пагинации
      const nextButton = screen.getByLabelText("Следующая страница");
      expect(nextButton).toBeInTheDocument();
    });

    it("should call onClose when close button is clicked", async () => {
      render(
        <ExcelViewer
          fileId={1}
          onClose={mockOnClose}
          onCellSelect={mockOnCellSelect}
        />
      );

      await waitFor(() => {
        expect(screen.getByText("test.xlsx")).toBeInTheDocument();
      });

      const closeButton = screen.getByLabelText("Закрыть просмотр Excel файла");
      fireEvent.click(closeButton);

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it("should handle loading state", () => {
      (global.fetch as jest.Mock).mockImplementation(
        () => new Promise(() => {}) // Никогда не резолвится
      );

      render(
        <ExcelViewer
          fileId={1}
          onClose={mockOnClose}
          onCellSelect={mockOnCellSelect}
        />
      );

      expect(screen.getByText("Загрузка...")).toBeInTheDocument();
    });

    it("should handle error state", async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        statusText: "Not Found",
      });

      render(
        <ExcelViewer
          fileId={1}
          onClose={mockOnClose}
          onCellSelect={mockOnCellSelect}
        />
      );

      await waitFor(() => {
        expect(screen.getByText(/Ошибка загрузки файла/)).toBeInTheDocument();
      });
    });

    it("should handle empty data", async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          metadata: { ...mockMetadata, rowCount: 0 },
          data: [],
          pagination: {
            offset: 0,
            limit: 100,
            total: 0,
          },
        }),
      });

      render(
        <ExcelViewer
          fileId={1}
          onClose={mockOnClose}
          onCellSelect={mockOnCellSelect}
        />
      );

      await waitFor(() => {
        expect(screen.getByText("Файл не содержит данных")).toBeInTheDocument();
      });
    });

    it("should support keyboard navigation", async () => {
      render(
        <ExcelViewer
          fileId={1}
          onClose={mockOnClose}
          onCellSelect={mockOnCellSelect}
        />
      );

      await waitFor(() => {
        expect(screen.getByText("email1@example.com")).toBeInTheDocument();
      });

      // Находим ячейку и проверяем, что она имеет tabIndex
      const cells = screen.getAllByRole("gridcell");
      expect(cells.length).toBeGreaterThan(0);
      
      // Проверяем, что ячейки имеют обработчики клавиатуры
      const firstCell = cells[0];
      expect(firstCell).toHaveAttribute("tabIndex", "0");
    });

    it("should display column labels (A, B, C, ...)", async () => {
      render(
        <ExcelViewer
          fileId={1}
          onClose={mockOnClose}
          onCellSelect={mockOnCellSelect}
        />
      );

      await waitFor(() => {
        // Проверяем, что отображаются метки столбцов
        expect(screen.getByText("A")).toBeInTheDocument();
        expect(screen.getByText("B")).toBeInTheDocument();
      });
    });
  });
});

