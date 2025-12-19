#!/bin/bash

# Скрипт для полного автоматического тестирования новых функций
# Использование: bash scripts/test-new-features.sh

set -e  # Остановка при ошибке

echo "╔═══════════════════════════════════════════════════════════╗"
echo "║     Полное тестирование новых функций ChatFlow            ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo ""

# Цвета для вывода
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

PASSED=0
FAILED=0
TOTAL=0

# Функция для выполнения команды и проверки результата
run_test() {
    local test_name="$1"
    local command="$2"
    
    TOTAL=$((TOTAL + 1))
    echo -e "\n[${CYAN}${TOTAL}${NC}] ${BLUE}${test_name}...${NC}"
    
    if eval "$command"; then
        echo -e "${GREEN}✓ PASSED${NC}"
        PASSED=$((PASSED + 1))
        return 0
    else
        echo -e "${RED}✗ FAILED${NC}"
        FAILED=$((FAILED + 1))
        return 1
    fi
}

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Шаг 1: Проверка зависимостей"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Проверка Node.js
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js не установлен${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Node.js установлен${NC}"

# Проверка npm
if ! command -v npm &> /dev/null; then
    echo -e "${RED}❌ npm не установлен${NC}"
    exit 1
fi
echo -e "${GREEN}✓ npm установлен${NC}"

# Проверка установки зависимостей
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}⚠ Установка зависимостей...${NC}"
    npm install
fi
echo -e "${GREEN}✓ Зависимости установлены${NC}"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Шаг 2: Создание тестового Excel файла"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

run_test "Создание тестового Excel файла" "npm run create-test-excel"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Шаг 3: Проверка базы данных"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

run_test "Применение миграций БД" "npm run migrate"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Шаг 4: Проверка TypeScript"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

run_test "Проверка типов TypeScript" "npx tsc --noEmit"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Шаг 5: Запуск сервера и тестирование API"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Проверка, запущен ли сервер
if ! curl -s http://localhost:3000 > /dev/null 2>&1; then
    echo -e "${YELLOW}⚠ Сервер не запущен. Запускаю сервер в фоновом режиме...${NC}"
    npm run dev > /dev/null 2>&1 &
    SERVER_PID=$!
    echo -e "${GREEN}✓ Сервер запущен (PID: $SERVER_PID)${NC}"
    
    # Ждем запуска сервера
    echo -e "${YELLOW}⏳ Ожидание запуска сервера...${NC}"
    for i in {1..30}; do
        if curl -s http://localhost:3000 > /dev/null 2>&1; then
            echo -e "${GREEN}✓ Сервер готов${NC}"
            break
        fi
        sleep 1
    done
else
    echo -e "${GREEN}✓ Сервер уже запущен${NC}"
    SERVER_PID=""
fi

# Тестирование API
run_test "Тестирование Excel API endpoints" "node scripts/test-excel-api.js"

# Остановка сервера, если мы его запустили
if [ ! -z "$SERVER_PID" ]; then
    echo -e "\n${YELLOW}⏹ Остановка сервера...${NC}"
    kill $SERVER_PID 2>/dev/null || true
    echo -e "${GREEN}✓ Сервер остановлен${NC}"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Шаг 6: Unit тесты"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

run_test "Запуск unit тестов" "npm test -- --passWithNoTests"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "                    Итоги тестирования"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

PASS_RATE=$(awk "BEGIN {printf \"%.1f\", ($PASSED/$TOTAL)*100}")

echo ""
echo -e "Всего тестов: ${CYAN}${TOTAL}${NC}"
echo -e "Пройдено: ${GREEN}${PASSED}${NC}"
echo -e "Провалено: ${RED}${FAILED}${NC}"
echo -e "Процент успеха: ${GREEN}${PASS_RATE}%${NC}"

if [ $FAILED -eq 0 ]; then
    echo ""
    echo -e "${GREEN}✅ Все тесты пройдены успешно!${NC}"
    exit 0
else
    echo ""
    echo -e "${RED}❌ Некоторые тесты провалились.${NC}"
    exit 1
fi

