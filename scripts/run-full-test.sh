#!/bin/bash
# Скрипт для полного тестирования проекта ChatFlow
# Запуск: bash scripts/run-full-test.sh

set -e

# Цвета для вывода
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
GRAY='\033[0;37m'
NC='\033[0m' # No Color

echo -e "${CYAN}========================================"
echo -e "  ChatFlow - Полное тестирование проекта"
echo -e "========================================${NC}"
echo ""

# Функция для вывода секции
print_section() {
    echo ""
    echo -e "${YELLOW}--- $1 ---${NC}"
    echo ""
}

# Функция для проверки команды
test_command() {
    local cmd=$1
    local description=$2
    echo -e "${GRAY}Проверка: $description...${NC}"
    
    if eval "$cmd" > /dev/null 2>&1; then
        echo -e "${GREEN}✓ $description - УСПЕШНО${NC}"
        return 0
    else
        echo -e "${RED}✗ $description - ОШИБКА${NC}"
        return 1
    fi
}

# Шаг 1: Проверка зависимостей
print_section "Шаг 1: Проверка зависимостей"
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}Установка зависимостей...${NC}"
    npm install
fi

# Шаг 2: Линтинг
print_section "Шаг 2: Проверка линтинга"
if test_command "npm run lint" "Линтинг кода"; then
    LINT_RESULT=0
else
    LINT_RESULT=1
    echo -e "${YELLOW}Предупреждение: Обнаружены ошибки линтинга${NC}"
    read -p "Продолжить тестирование? (y/n): " continue
    if [ "$continue" != "y" ]; then
        exit 1
    fi
fi

# Шаг 3: Юнит-тесты
print_section "Шаг 3: Юнит-тесты"
echo -e "${GRAY}Запуск юнит-тестов...${NC}"

test_command "npm test -- __tests__/lib/error-handler.test.ts" "Тесты error-handler"
ERROR_HANDLER_TEST=$?

test_command "npm test -- __tests__/lib/retry.test.ts" "Тесты retry"
RETRY_TEST=$?

test_command "npm test -- __tests__/lib/excel-service.test.ts" "Тесты excel-service"
EXCEL_TEST=$?

test_command "npm test -- __tests__/lib/db.test.ts" "Тесты БД"
DB_TEST=$?

test_command "npm test -- __tests__/lib/migration-manager.test.ts" "Тесты migration-manager"
MIGRATION_TEST=$?

# Шаг 4: Интеграционные тесты API
print_section "Шаг 4: Интеграционные тесты API"
echo -e "${GRAY}Запуск API тестов...${NC}"

test_command "npm test -- __tests__/api/messages.test.ts" "Тесты API messages"
MESSAGES_TEST=$?

test_command "npm test -- __tests__/api/threads.test.ts" "Тесты API threads"
THREADS_TEST=$?

test_command "npm test -- __tests__/api/chat.test.ts" "Тесты API chat"
CHAT_TEST=$?

# Шаг 5: Тесты компонентов
print_section "Шаг 5: Тесты компонентов"
echo -e "${GRAY}Запуск тестов компонентов...${NC}"

test_command "npm test -- __tests__/components/ThreadList.test.tsx" "Тесты ThreadList"
THREAD_LIST_TEST=$?

test_command "npm test -- __tests__/components/ChatInterface.test.tsx" "Тесты ChatInterface"
CHAT_INTERFACE_TEST=$?

# Шаг 6: Покрытие кода
print_section "Шаг 6: Генерация отчета о покрытии"
echo -e "${GRAY}Запуск тестов с покрытием...${NC}"
if test_command "npm run test:coverage" "Генерация покрытия кода"; then
    COVERAGE_TEST=0
    echo ""
    echo -e "${CYAN}Отчет о покрытии создан в: coverage/lcov-report/index.html${NC}"
    echo -e "${GRAY}Откройте файл в браузере для просмотра детального отчета.${NC}"
else
    COVERAGE_TEST=1
fi

# Шаг 7: E2E тесты
print_section "Шаг 7: E2E тесты"
echo -e "${GRAY}Проверка, что сервер не запущен на порту 3000...${NC}"

if lsof -Pi :3000 -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo -e "${YELLOW}Предупреждение: Порт 3000 занят. Убедитесь, что сервер разработки остановлен.${NC}"
    read -p "Продолжить E2E тесты? (y/n): " continue
    if [ "$continue" != "y" ]; then
        echo -e "${YELLOW}E2E тесты пропущены${NC}"
        E2E_TEST=1
    else
        test_command "npm run test:e2e" "E2E тесты"
        E2E_TEST=$?
    fi
else
    test_command "npm run test:e2e" "E2E тесты"
    E2E_TEST=$?
fi

# Итоговый отчет
echo ""
echo -e "${CYAN}========================================"
echo -e "  ИТОГОВЫЙ ОТЧЕТ"
echo -e "========================================${NC}"
echo ""

PASSED=0
FAILED=0

check_result() {
    if [ $1 -eq 0 ]; then
        echo -e "${GREEN}✓ $2${NC}"
        PASSED=$((PASSED + 1))
    else
        echo -e "${RED}✗ $2${NC}"
        FAILED=$((FAILED + 1))
    fi
}

check_result $LINT_RESULT "Линтинг"
check_result $ERROR_HANDLER_TEST "Тесты error-handler"
check_result $RETRY_TEST "Тесты retry"
check_result $EXCEL_TEST "Тесты excel-service"
check_result $DB_TEST "Тесты БД"
check_result $MIGRATION_TEST "Тесты migration-manager"
check_result $MESSAGES_TEST "Тесты API messages"
check_result $THREADS_TEST "Тесты API threads"
check_result $CHAT_TEST "Тесты API chat"
check_result $THREAD_LIST_TEST "Тесты ThreadList"
check_result $CHAT_INTERFACE_TEST "Тесты ChatInterface"
check_result $COVERAGE_TEST "Покрытие кода"
check_result $E2E_TEST "E2E тесты"

echo ""
echo -e "${GREEN}Успешно: $PASSED${NC}"
if [ $FAILED -gt 0 ]; then
    echo -e "${RED}Провалено: $FAILED${NC}"
else
    echo -e "${GREEN}Провалено: $FAILED${NC}"
fi
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}========================================"
    echo -e "  ВСЕ ТЕСТЫ ПРОЙДЕНЫ УСПЕШНО!"
    echo -e "========================================${NC}"
    exit 0
else
    echo -e "${RED}========================================"
    echo -e "  ОБНАРУЖЕНЫ ОШИБКИ В ТЕСТАХ"
    echo -e "========================================${NC}"
    exit 1
fi

