import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ThreadList from "@/components/ThreadList";
import { Thread } from "@/lib/db";

const mockThreads: Thread[] = [
  {
    id: 1,
    title: "Thread 1",
    createdAt: Math.floor(Date.now() / 1000),
  },
  {
    id: 2,
    title: "Thread 2",
    createdAt: Math.floor(Date.now() / 1000) - 86400,
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
  });

  it("should highlight selected thread", () => {
    const { container } = render(
      <ThreadList
        threads={mockThreads}
        selectedThreadId={1}
        onSelectThread={mockOnSelectThread}
      />
    );

    const thread1Text = screen.getByText("Thread 1");
    const threadContainer = thread1Text.parentElement;
    expect(threadContainer).toHaveClass("bg-blue-50");
  });

  it("should call onSelectThread when thread is clicked", () => {
    render(
      <ThreadList
        threads={mockThreads}
        selectedThreadId={null}
        onSelectThread={mockOnSelectThread}
      />
    );

    screen.getByText("Thread 1").click();
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

  it("should format date correctly", () => {
    const thread: Thread = {
      id: 1,
      title: "Test Thread",
      createdAt: Math.floor(new Date("2024-01-15").getTime() / 1000),
    };

    render(
      <ThreadList
        threads={[thread]}
        selectedThreadId={null}
        onSelectThread={mockOnSelectThread}
      />
    );

    const dateElement = screen.getByText(/15\.01\.2024/);
    expect(dateElement).toBeInTheDocument();
  });

  it("should have proper ARIA attributes", () => {
    render(
      <ThreadList
        threads={mockThreads}
        selectedThreadId={1}
        onSelectThread={mockOnSelectThread}
      />
    );

    const nav = screen.getByRole("navigation", { name: /список тредов/i });
    expect(nav).toBeInTheDocument();

    const threadItems = screen.getAllByRole("button");
    expect(threadItems.length).toBeGreaterThan(0);

    const selectedThread = threadItems[0];
    expect(selectedThread).toHaveAttribute("aria-selected", "true");
  });

  it("should support keyboard navigation with Enter key", async () => {
    const user = userEvent.setup();
    render(
      <ThreadList
        threads={mockThreads}
        selectedThreadId={null}
        onSelectThread={mockOnSelectThread}
      />
    );

    const threadButton = screen.getByRole("button", { name: /thread 1/i });
    threadButton.focus();

    await user.keyboard("{Enter}");

    expect(mockOnSelectThread).toHaveBeenCalledWith(1);
  });

  it("should support keyboard navigation with Space key", async () => {
    const user = userEvent.setup();
    render(
      <ThreadList
        threads={mockThreads}
        selectedThreadId={null}
        onSelectThread={mockOnSelectThread}
      />
    );

    const threadButton = screen.getByRole("button", { name: /thread 1/i });
    threadButton.focus();

    await user.keyboard(" ");

    expect(mockOnSelectThread).toHaveBeenCalledWith(1);
  });

  it("should have proper aria-posinset and aria-setsize", () => {
    render(
      <ThreadList
        threads={mockThreads}
        selectedThreadId={null}
        onSelectThread={mockOnSelectThread}
      />
    );

    const threadButtons = screen.getAllByRole("button");
    expect(threadButtons[0]).toHaveAttribute("aria-posinset", "1");
    expect(threadButtons[0]).toHaveAttribute("aria-setsize", "2");
    expect(threadButtons[1]).toHaveAttribute("aria-posinset", "2");
    expect(threadButtons[1]).toHaveAttribute("aria-setsize", "2");
  });

  it("should have focus styles", () => {
    const { container } = render(
      <ThreadList
        threads={mockThreads}
        selectedThreadId={null}
        onSelectThread={mockOnSelectThread}
      />
    );

    const threadButton = screen.getByRole("button", { name: /thread 1/i });
    threadButton.focus();

    expect(threadButton).toHaveClass("focus:outline-none", "focus:ring-2");
  });
});

