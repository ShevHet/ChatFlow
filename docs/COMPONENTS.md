# Документация компонентов

## Обзор

ChatFlow использует React компоненты для построения пользовательского интерфейса.

Все компоненты следуют принципам:
- **Accessibility** - поддержка клавиатурной навигации и ARIA атрибутов
- **Responsive Design** - адаптивность под разные размеры экранов
- **User Experience** - интуитивный интерфейс с четкой визуальной обратной связью

## Компоненты

### ChatInterface

Основной компонент для отображения чата с AI.

**Расположение:** `components/ChatInterface.tsx`

**Props:**
```typescript
interface ChatInterfaceProps {
  threadId: number;
}
```

**Функциональность:**
- Отображение сообщений пользователя и ассистента
- Отправка сообщений через AI API
- Обработка tool calls (getRange, updateCell, confirmAction, highlightCells)
- Отображение Excel данных в виде таблиц
- Поддержка упоминаний диапазонов (@Sheet1!A1:B3)
- Модальные окна для подтверждения действий

**Используемые хуки:**
- `useChat` из `ai/react` - для работы с AI чатом
- `useState` - для управления состоянием
- `useEffect` - для загрузки сообщений и обработки событий

### ThreadList

Компонент для отображения списка тредов.

**Расположение:** `components/ThreadList.tsx`

**Props:**
```typescript
interface ThreadListProps {
  threads: Thread[];
  selectedThreadId: number | null;
  onSelectThread: (threadId: number) => void;
}
```

**Функциональность:**
- Отображение списка тредов
- Выделение выбранного треда
- Обработка кликов для переключения тредов

### ConfirmationDialog

Модальное окно для подтверждения действий.

**Расположение:** `components/ConfirmationDialog.tsx`

**Props:**
```typescript
interface ConfirmationDialogProps {
  isOpen: boolean;
  question: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmText?: string;
  cancelText?: string;
}
```

**Функциональность:**
- Отображение вопроса для подтверждения
- Кнопки "Да" и "Нет"
- Блокировка прокрутки страницы при открытии

### ExcelViewer

Компонент для просмотра и работы с Excel данными.

**Расположение:** `components/ExcelViewer.tsx`

**Props:**
```typescript
interface ExcelViewerProps {
  isOpen: boolean;
  range: string;
  onClose: () => void;
  onSelectRange: (range: string) => void;
  highlightRange?: string;
}
```

**Функциональность:**
- Отображение Excel данных в виде таблицы
- Выделение диапазонов
- Выбор диапазонов для использования в чате
- Подсветка указанных диапазонов

## Утилиты

### excel-utils

Утилиты для работы с Excel диапазонами.

**Расположение:** `lib/excel-utils.ts`

**Функции:**
- `parseRange(rangeStr: string)` - парсинг диапазона
- `formatRange(sheet: string, range: string)` - форматирование диапазона
- `isRangeMention(text: string)` - проверка упоминания диапазона
- `extractRangeMentions(text: string)` - извлечение упоминаний из текста
- `isValidRange(rangeStr: string)` - валидация диапазона
- `normalizeRange(rangeStr: string)` - нормализация диапазона

### excel-service

Сервисный слой для работы с Excel файлами.

**Расположение:** `lib/excel-service.ts`

**Класс:** `ExcelService`

**Методы:**
- `ensureFile()` - создание файла, если его нет
- `readRange(range: string)` - чтение диапазона
- `writeRange(range: string, value?, values?)` - запись в диапазон
- `calculateSum(range: string)` - вычисление суммы
- `calculateAverage(range: string)` - вычисление среднего
- `calculateMin(range: string)` - вычисление минимума
- `calculateMax(range: string)` - вычисление максимума

## Архитектура

Проект следует принципам SOLID:

- **Single Responsibility** - каждый компонент и сервис имеет одну ответственность
- **Open/Closed** - компоненты открыты для расширения, закрыты для модификации
- **Liskov Substitution** - интерфейсы могут быть заменены реализациями
- **Interface Segregation** - интерфейсы разделены по функциональности
- **Dependency Inversion** - зависимости направлены на абстракции, а не на конкретные реализации

### Слои архитектуры

1. **UI Layer** - React компоненты (`components/`)
2. **API Layer** - API роуты (`app/api/`)
3. **Service Layer** - бизнес-логика (`lib/`)
4. **Data Layer** - работа с БД (`lib/db.ts`, `lib/migrate.ts`)

