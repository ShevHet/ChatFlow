/**
 * Юнит-тесты для компонента ThreadList
 */

import { render, screen, fireEvent } from "@testing-library/react";
import ThreadList from "@/components/ThreadList";
import { Thread } from "@/lib/db";

const mockThreads: Thread[] = [
  {
    id: 1,
    title: "Thread 1",
  },
  {
    id: 2,
    title: "Thread 2",
  },
  {
    id: 3,
    title: null,
  },
];

describe("ThreadList", () => {
  const mockOnSelectThread = jest.fn();

  beforeEach(() => {
    mockOnSelectThread.mockClear();
  });

  it("should render list of threads", () => {
    render(
      <ThreadList
        threads={mockThreads}
        selectedThreadId={null}
        onSelectThread={mockOnSelectThread}
      />
    );

    expect(screen.getByText("Thread 1")).toBeInTheDocument();
    expect(screen.getByText("Thread 2")).toBeInTheDocument();
    expect(screen.getByText("Без названия")).toBeInTheDocument();
  });

  it("should highlight selected thread", () => {
    render(
      <ThreadList
        threads={mockThreads}
        selectedThreadId={1}
        onSelectThread={mockOnSelectThread}
      />
    );

    const thread1 = screen.getByText("Thread 1").closest("li");
    expect(thread1).toHaveClass("bg-blue-50");
    expect(thread1).toHaveClass("border-l-blue-500");
    expect(screen.getByText("Активный тред")).toBeInTheDocument();
  });

  it("should call onSelectThread when thread is clicked", () => {
    render(
      <ThreadList
        threads={mockThreads}
        selectedThreadId={null}
        onSelectThread={mockOnSelectThread}
      />
    );

    fireEvent.click(screen.getByText("Thread 1"));
    expect(mockOnSelectThread).toHaveBeenCalledWith(1);
  });

  it("should call onSelectThread when Enter key is pressed", () => {
    render(
      <ThreadList
        threads={mockThreads}
        selectedThreadId={null}
        onSelectThread={mockOnSelectThread}
      />
    );

    const thread1 = screen.getByText("Thread 1").closest("li");
    fireEvent.keyDown(thread1!, { key: "Enter" });
    expect(mockOnSelectThread).toHaveBeenCalledWith(1);
  });

  it("should call onSelectThread when Space key is pressed", () => {
    render(
      <ThreadList
        threads={mockThreads}
        selectedThreadId={null}
        onSelectThread={mockOnSelectThread}
      />
    );

    const thread1 = screen.getByText("Thread 1").closest("li");
    fireEvent.keyDown(thread1!, { key: " " });
    expect(mockOnSelectThread).toHaveBeenCalledWith(1);
  });

  it("should display empty state when no threads", () => {
    render(
      <ThreadList
        threads={[]}
        selectedThreadId={null}
        onSelectThread={mockOnSelectThread}
      />
    );

    expect(screen.getByText("Нет тредов. Создайте новый!")).toBeInTheDocument();
  });

  it("should have correct aria-selected attribute", () => {
    render(
      <ThreadList
        threads={mockThreads}
        selectedThreadId={1}
        onSelectThread={mockOnSelectThread}
      />
    );

    const thread1 = screen.getByText("Thread 1").closest("li");
    expect(thread1).toHaveAttribute("aria-selected", "true");
  });
});

