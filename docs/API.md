# API Документация

## Обзор

ChatFlow предоставляет RESTful API для работы с тредами, сообщениями и Excel файлами.

**Базовый URL:** `http://localhost:3000/api`

**Формат ответов:** Все ответы возвращаются в формате JSON, кроме `/api/ai-chat`, который возвращает стриминг (SSE).

**Коды ошибок:**
- `200` - Успешный запрос
- `400` - Неверный запрос (отсутствуют обязательные параметры или неверный формат)
- `404` - Ресурс не найден
- `500` - Внутренняя ошибка сервера

## Эндпоинты

### Threads API

#### GET /api/threads
Получить все треды.

**Ответ:**
```json
[
  {
    "id": 1,
    "title": "Название треда"
  }
]
```

#### POST /api/threads
Создать новый тред.

**Тело запроса:**
```json
{
  "title": "Название треда"
}
```

**Ответ:**
```json
{
  "id": 1,
  "title": "Название треда"
}
```

### Messages API

#### GET /api/messages?threadId={id}
Получить все сообщения для треда.

**Параметры:**
- `threadId` (required) - ID треда

**Ответ:**
```json
[
  {
    "id": 1,
    "thread_id": 1,
    "user_message": "Сообщение пользователя",
    "assistant_message": "Ответ ассистента"
  }
]
```

#### POST /api/messages
Создать новое сообщение.

**Тело запроса:**
```json
{
  "threadId": 1,
  "userMessage": "Сообщение пользователя",
  "assistantMessage": "Ответ ассистента"
}
```

### Chat API

#### GET /api/chat
Получить все треды (алиас для /api/threads).

#### POST /api/chat
Сохранить сообщение в базе данных.

**Тело запроса:**
```json
{
  "threadId": 1,
  "userMessage": "Сообщение пользователя",
  "assistantMessage": "Ответ ассистента"
}
```

### AI Chat API

#### POST /api/ai-chat
Отправить сообщение в AI чат и получить стриминг ответа.

**Тело запроса:**
```json
{
  "messages": [
    {
      "role": "user",
      "content": "Привет"
    }
  ],
  "threadId": 1
}
```

**Ответ:** Stream текста (SSE формат)

### Excel API

#### GET /api/excel?range={range}
Прочитать диапазон из Excel файла.

**Параметры:**
- `range` (optional) - Диапазон в формате "Sheet1!A1:B3" (по умолчанию "Sheet1!A1:D5")

**Ответ:**
```json
{
  "sheet": "Sheet1",
  "range": "A1:B3",
  "data": [
    ["Значение1", "Значение2"],
    ["Значение3", "Значение4"]
  ]
}
```

#### POST /api/excel
Обновить ячейку или диапазон в Excel файле.

**Тело запроса:**
```json
{
  "range": "Sheet1!A1",
  "value": "Новое значение"
}
```

Или для диапазона:
```json
{
  "range": "Sheet1!A1:B2",
  "values": [
    ["Значение1", "Значение2"],
    ["Значение3", "Значение4"]
  ]
}
```

**Ответ:**
```json
{
  "success": true,
  "message": "Updated Sheet1!A1"
}
```

### Excel Calculate API

#### POST /api/excel/calculate
Вычислить значение для диапазона (сумма, среднее, минимум, максимум).

**Тело запроса:**
```json
{
  "range": "Sheet1!A1:A10",
  "operation": "sum"
}
```

**Операции:**
- `sum` - сумма всех числовых значений
- `average` - среднее арифметическое
- `min` - минимальное значение
- `max` - максимальное значение

**Ответ:**
```json
{
  "success": true,
  "operation": "sum",
  "range": "Sheet1!A1:A10",
  "result": 100
}
```

## Примеры использования

### Создание треда и отправка сообщения

```javascript
// 1. Создать тред
const threadResponse = await fetch('/api/threads', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ title: 'Мой первый тред' })
});
const thread = await threadResponse.json();

// 2. Отправить сообщение в AI чат
const chatResponse = await fetch('/api/ai-chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    messages: [{ role: 'user', content: 'Привет!' }],
    threadId: thread.id
  })
});
// Ответ приходит в виде стрима

// 3. Сохранить сообщение в БД
await fetch('/api/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    threadId: thread.id,
    userMessage: 'Привет!',
    assistantMessage: 'Привет! Чем могу помочь?'
  })
});
```

### Работа с Excel

```javascript
// Чтение диапазона
const readResponse = await fetch('/api/excel?range=Sheet1!A1:B3');
const data = await readResponse.json();

// Запись в ячейку
await fetch('/api/excel', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    range: 'Sheet1!A1',
    value: 'Новое значение'
  })
});

// Вычисление суммы
const calcResponse = await fetch('/api/excel/calculate', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    range: 'Sheet1!A1:A10',
    operation: 'sum'
  })
});
const result = await calcResponse.json();
```

