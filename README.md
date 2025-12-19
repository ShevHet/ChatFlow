# ChatFlow

Чат с тредами на Next.js 16 + TypeScript. Данные в SQLite: в Bun используется `bun:sqlite`, для Node-сборки есть fallback `better-sqlite3`.

## Стек
- Next.js 16 (App Router), React 18, TypeScript
- Bun 1.3+ (рекомендуемый runtime)
- SQLite (bun:sqlite / better-sqlite3)
- Jest + React Testing Library (unit/интеграция)
- Playwright (E2E при необходимости)

## Установка и запуск
```bash
cd ChatFlow
bun install
echo "OPENAI_API_KEY=your_key" > .env.local
bun run dev
```
Открыть http://localhost:3000.

## База данных и миграции
- Файл БД: `chatflow.db` в корне (в `.gitignore`).
- Команды:
  - `bun run migrate` — применить миграции
  - `bun run migrate:status` — статус
  - `bun run migrate:rollback` — откат

## XLSX
- Тестовые файлы: `data/example.xlsx`, `people_data.xlsx` (в корне).
- Просмотр через компонент ExcelViewer, меншоны ячеек кликабельны, открывают модалку/выделение.

## Тесты
- `bunx jest` — unit/интеграционные.
- `bunx jest --runTestsByPath __tests__/components/ChatInterface.test.tsx` — пример выборочного прогона.
- Playwright e2e — по желанию: `bunx playwright test` (при наличии установленного Playwright).

## Замечания по окружению
- На Windows/OneDrive возможны EPERM для `.next` и БД. Если ловите ошибки — остановите dev-сервер и очистите `.next`/`chatflow.db`, либо запустите вне синхронизируемой папки.
- Для Node дев-сборки используется `better-sqlite3`, для Bun — `bun:sqlite`.

## Структура
```
app/          — страницы и API (chat, threads, messages, excel)
components/   — ChatInterface, ThreadList, ExcelViewer, диалоги
lib/          — db, migrations, excel-service, retry, error-handler
__tests__/    — unit/интеграционные тесты
scripts/      — migrate и вспомогательные
migrations/   — файлы миграций
```

## Что реализовано
- Чат и треды: создание, выбор, хранение сообщений в SQLite.
- Стриминг ответов через Vercel AI SDK.
- Миграции БД + мок `bun:sqlite` для тестов.
- Excel: просмотр таблиц и кликабельные меншоны ячеек; базовые операции чтения/записи.
- A11y: ARIA-атрибуты, клавиатурная навигация.

## Ограничения / частично
- Линт без `eslint.config.js` не настроен.
- E2E на Playwright не покрывают весь функционал (опционально).
- Возможны EPERM на OneDrive (см. выше).

## Публикация
- В `.gitignore` уже добавлены `*.db`, `*.db-wal`, `*.db-shm`, `.next/`.
- Если база попадала в историю, удалить из индекса: `git rm --cached chatflow.db*` и сделать коммит.

