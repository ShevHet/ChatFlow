# ChatFlow

Приложение чата с поддержкой тредов, построенное на Next.js 16, TypeScript и SQLite.

## Технологии

- **Next.js 16** - React фреймворк
- **TypeScript** - Типизация
- **SQLite (better-sqlite3)** - База данных
- **Vercel AI SDK** - Интеграция с AI моделями
- **npm/pnpm** - Пакетный менеджер

## Установка

1. **Установите зависимости:**
   ```bash
   npm install
   ```
   
   Или используйте pnpm:
   ```bash
   pnpm install
   ```

2. **Создайте файл `.env.local`** в корне проекта и добавьте ваш OpenAI API ключ:
   ```
   OPENAI_API_KEY=your_openai_api_key_here
   ```

3. **Запустите проект в режиме разработки:**
   ```bash
   npm run dev
   ```
   
   Или с pnpm:
   ```bash
   pnpm dev
   ```

4. Откройте [http://localhost:3000](http://localhost:3000) в браузере.

**Примечание:** Проект использует `better-sqlite3` для работы с SQLite. База данных `chatflow.db` будет создана автоматически при первом запуске.

## Структура проекта

```
ChatFlow/
├── app/
│   ├── api/
│   │   ├── chat/          # API для обработки сообщений с AI
│   │   ├── threads/       # API для управления тредами
│   │   └── messages/      # API для управления сообщениями
│   ├── layout.tsx         # Корневой layout
│   ├── page.tsx           # Главная страница
│   └── globals.css        # Глобальные стили
├── components/
│   ├── ChatInterface.tsx  # Компонент чата
│   └── ThreadList.tsx     # Список тредов
├── lib/
│   └── db.ts              # Работа с базой данных
└── package.json
```

## Функциональность

- ✅ Создание и управление тредами
- ✅ Отправка сообщений в чат
- ✅ Интеграция с AI моделями через Vercel AI SDK
- ✅ Сохранение истории сообщений в SQLite
- ✅ Загрузка истории при переключении тредов
- ✅ Стриминг ответов от AI

## Настройка AI модели

По умолчанию используется `gpt-3.5-turbo`. Для использования других моделей или настройки API ключей, отредактируйте `app/api/chat/route.ts`.

Для работы с OpenAI необходимо установить переменную окружения:
```bash
OPENAI_API_KEY=your_api_key_here
```

## Требования

- Node.js 18+ 
- npm, pnpm или yarn
- OpenAI API ключ (для работы с AI моделями)

## Тестирование

Проект включает полную систему тестирования:

- **Unit-тесты** (Jest + React Testing Library)
- **Интеграционные тесты** (API роуты)
- **E2E тесты** (Playwright)

### Быстрый старт

```bash
# Установите зависимости (включая тестовые)
npm install

# Установите браузеры для Playwright
npm run test:install-playwright

# Запустите все тесты
npm run test:all
```

### Доступные команды

```bash
# Все unit и интеграционные тесты
npm test

# С покрытием кода
npm run test:coverage

# Только E2E тесты
npm run test:e2e

# Все тесты (unit + E2E)
npm run test:all
```

