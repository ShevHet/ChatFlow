/**
 * Юнит-тесты для компонента ConfirmationDialog
 */

import { render, screen, fireEvent } from "@testing-library/react";
import ConfirmationDialog from "@/components/ConfirmationDialog";

describe("ConfirmationDialog", () => {
  const mockOnConfirm = jest.fn();
  const mockOnCancel = jest.fn();

  beforeEach(() => {
    mockOnConfirm.mockClear();
    mockOnCancel.mockClear();
  });

  it("should not render when isOpen is false", () => {
    render(
      <ConfirmationDialog
        isOpen={false}
        question="Test question"
        onConfirm={mockOnConfirm}
        onCancel={mockOnCancel}
      />
    );

    expect(screen.queryByText("Test question")).not.toBeInTheDocument();
  });

  it("should render when isOpen is true", () => {
    render(
      <ConfirmationDialog
        isOpen={true}
        question="Test question"
        onConfirm={mockOnConfirm}
        onCancel={mockOnCancel}
      />
    );

    expect(screen.getByText("Test question")).toBeInTheDocument();
    expect(screen.getByText("Подтверждение действия")).toBeInTheDocument();
  });

  it("should call onConfirm when confirm button is clicked", () => {
    render(
      <ConfirmationDialog
        isOpen={true}
        question="Test question"
        onConfirm={mockOnConfirm}
        onCancel={mockOnCancel}
      />
    );

    fireEvent.click(screen.getByText("Да"));
    expect(mockOnConfirm).toHaveBeenCalledTimes(1);
  });

  it("should call onCancel when cancel button is clicked", () => {
    render(
      <ConfirmationDialog
        isOpen={true}
        question="Test question"
        onConfirm={mockOnConfirm}
        onCancel={mockOnCancel}
      />
    );

    fireEvent.click(screen.getByText("Нет"));
    expect(mockOnCancel).toHaveBeenCalledTimes(1);
  });

  it("should call onCancel when backdrop is clicked", () => {
    render(
      <ConfirmationDialog
        isOpen={true}
        question="Test question"
        onConfirm={mockOnConfirm}
        onCancel={mockOnCancel}
      />
    );

    // Backdrop - это сам элемент с role="dialog" (div с fixed inset-0)
    const backdrop = screen.getByRole("dialog");
    fireEvent.click(backdrop);
    expect(mockOnCancel).toHaveBeenCalledTimes(1);
  });

  it("should call onCancel when Escape key is pressed", () => {
    render(
      <ConfirmationDialog
        isOpen={true}
        question="Test question"
        onConfirm={mockOnConfirm}
        onCancel={mockOnCancel}
      />
    );

    fireEvent.keyDown(document, { key: "Escape" });
    expect(mockOnCancel).toHaveBeenCalledTimes(1);
  });

  it("should use custom button texts", () => {
    render(
      <ConfirmationDialog
        isOpen={true}
        question="Test question"
        onConfirm={mockOnConfirm}
        onCancel={mockOnCancel}
        confirmText="Confirm"
        cancelText="Cancel"
      />
    );

    expect(screen.getByText("Confirm")).toBeInTheDocument();
    expect(screen.getByText("Cancel")).toBeInTheDocument();
  });

  it("should have correct aria attributes", () => {
    render(
      <ConfirmationDialog
        isOpen={true}
        question="Test question"
        onConfirm={mockOnConfirm}
        onCancel={mockOnCancel}
      />
    );

    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAttribute("aria-labelledby", "confirmation-title");
  });
});

