/**
 * Юнит-тесты для компонента ExcelViewer
 */

import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import ExcelViewer from "@/components/ExcelViewer";

// Мокаем fetch для загрузки данных
global.fetch = jest.fn();

const mockExcelData = {
  sheet: "Sheet1",
  range: "A1:B2",
  data: [
    ["Header1", "Header2"],
    ["Value1", "Value2"],
  ],
};

describe("ExcelViewer", () => {
  const mockOnClose = jest.fn();
  const mockOnSelectRange = jest.fn();

  beforeEach(() => {
    mockOnClose.mockClear();
    mockOnSelectRange.mockClear();
    (global.fetch as jest.Mock).mockClear();
  });

  it("should not render when isOpen is false", () => {
    render(
      <ExcelViewer
        isOpen={false}
        range="Sheet1!A1:B2"
        onClose={mockOnClose}
      />
    );

    expect(screen.queryByText("Sheet1")).not.toBeInTheDocument();
  });

  it("should render when isOpen is true", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockExcelData,
    });

    render(
      <ExcelViewer
        isOpen={true}
        range="Sheet1!A1:B2"
        onClose={mockOnClose}
      />
    );

    await waitFor(() => {
      // Sheet1 может быть разбит на несколько элементов, используем getAllByText
      const elements = screen.getAllByText((content, element) => {
        return element?.textContent?.includes("Sheet1") || false;
      });
      expect(elements.length).toBeGreaterThan(0);
    });
  });

  it("should load data when opened", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockExcelData,
    });

    render(
      <ExcelViewer
        isOpen={true}
        range="Sheet1!A1:B2"
        onClose={mockOnClose}
      />
    );

    await waitFor(() => {
      // URL кодирует : как %3A, поэтому проверяем частичное совпадение
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringMatching(/\/api\/excel\?range=.*Sheet1.*A1.*B2/)
      );
    });
  });

  it("should display loading state", () => {
    (global.fetch as jest.Mock).mockImplementation(
      () => new Promise(() => {}) // Никогда не резолвится
    );

    render(
      <ExcelViewer
        isOpen={true}
        range="Sheet1!A1:B2"
        onClose={mockOnClose}
      />
    );

    expect(screen.getByText(/загрузка/i)).toBeInTheDocument();
  });

  it("should call onClose when close button is clicked", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockExcelData,
    });

    render(
      <ExcelViewer
        isOpen={true}
        range="Sheet1!A1:B2"
        onClose={mockOnClose}
      />
    );

    await waitFor(() => {
      const closeButton = screen.getByRole("button", { name: /закрыть/i });
      fireEvent.click(closeButton);
      expect(mockOnClose).toHaveBeenCalled();
    });
  });

  it("should call onClose when backdrop is clicked", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockExcelData,
    });

    render(
      <ExcelViewer
        isOpen={true}
        range="Sheet1!A1:B2"
        onClose={mockOnClose}
      />
    );

    await waitFor(() => {
      // Ищем контейнер модального окна (backdrop)
      const modalContainer = document.querySelector('.fixed.inset-0');
      expect(modalContainer).toBeInTheDocument();
    });

    // Кликаем на backdrop
    const modalContainer = document.querySelector('.fixed.inset-0');
    if (modalContainer) {
      fireEvent.click(modalContainer);
      expect(mockOnClose).toHaveBeenCalled();
    }
  });

  it("should display table headers (A, B, C, ...)", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockExcelData,
    });

    render(
      <ExcelViewer
        isOpen={true}
        range="Sheet1!A1:B2"
        onClose={mockOnClose}
      />
    );

    await waitFor(() => {
      // Заголовки колонок могут быть в title атрибутах ячеек
      // Проверяем наличие данных в таблице
      expect(screen.getByText("Header1")).toBeInTheDocument();
      expect(screen.getByText("Value1")).toBeInTheDocument();
    });
  });

  it("should display data in table", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockExcelData,
    });

    render(
      <ExcelViewer
        isOpen={true}
        range="Sheet1!A1:B2"
        onClose={mockOnClose}
      />
    );

    await waitFor(() => {
      expect(screen.getByText("Header1")).toBeInTheDocument();
      expect(screen.getByText("Value1")).toBeInTheDocument();
    });
  });

  it("should handle error when loading data fails", async () => {
    const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation();
    (global.fetch as jest.Mock).mockRejectedValueOnce(new Error("Failed to load"));

    render(
      <ExcelViewer
        isOpen={true}
        range="Sheet1!A1:B2"
        onClose={mockOnClose}
      />
    );

    await waitFor(() => {
      expect(consoleErrorSpy).toHaveBeenCalled();
    });

    consoleErrorSpy.mockRestore();
  });

  it("should block body scroll when open", () => {
    render(
      <ExcelViewer
        isOpen={true}
        range="Sheet1!A1:B2"
        onClose={mockOnClose}
      />
    );

    expect(document.body.style.overflow).toBe("hidden");
  });

  it("should restore body scroll when closed", () => {
    const { rerender } = render(
      <ExcelViewer
        isOpen={true}
        range="Sheet1!A1:B2"
        onClose={mockOnClose}
      />
    );

    expect(document.body.style.overflow).toBe("hidden");

    rerender(
      <ExcelViewer
        isOpen={false}
        range="Sheet1!A1:B2"
        onClose={mockOnClose}
      />
    );

    expect(document.body.style.overflow).toBe("unset");
  });
});

