# Скрипт для полного тестирования проекта ChatFlow
# Запуск: powershell -ExecutionPolicy Bypass -File scripts/run-full-test.ps1

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  ChatFlow - Полное тестирование проекта" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$ErrorActionPreference = "Stop"

# Функция для вывода секции
function Write-Section {
    param([string]$Title)
    Write-Host ""
    Write-Host "--- $Title ---" -ForegroundColor Yellow
    Write-Host ""
}

# Функция для проверки команды
function Test-Command {
    param([string]$Command, [string]$Description)
    Write-Host "Проверка: $Description..." -ForegroundColor Gray
    try {
        $result = & $Command 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✓ $Description - УСПЕШНО" -ForegroundColor Green
            return $true
        } else {
            Write-Host "✗ $Description - ОШИБКА" -ForegroundColor Red
            Write-Host $result -ForegroundColor Red
            return $false
        }
    } catch {
        Write-Host "✗ $Description - ОШИБКА: $_" -ForegroundColor Red
        return $false
    }
}

# Шаг 1: Проверка зависимостей
Write-Section "Шаг 1: Проверка зависимостей"
if (-not (Test-Path "node_modules")) {
    Write-Host "Установка зависимостей..." -ForegroundColor Yellow
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Ошибка при установке зависимостей!" -ForegroundColor Red
        exit 1
    }
}

# Шаг 2: Линтинг
Write-Section "Шаг 2: Проверка линтинга"
$lintResult = Test-Command "npm run lint" "Линтинг кода"
if (-not $lintResult) {
    Write-Host "Предупреждение: Обнаружены ошибки линтинга" -ForegroundColor Yellow
    $continue = Read-Host "Продолжить тестирование? (y/n)"
    if ($continue -ne "y") {
        exit 1
    }
}

# Инициализация переменных результатов тестов
$errorHandlerTest = $false
$retryTest = $false
$excelTest = $false
$dbTest = $false
$migrationTest = $false
$messagesTest = $false
$threadsTest = $false
$chatTest = $false
$threadListTest = $false
$chatInterfaceTest = $false
$coverageTest = $false
$e2eTest = $false

# Шаг 3: Юнит-тесты
Write-Section "Шаг 3: Юнит-тесты"
Write-Host "Запуск юнит-тестов..." -ForegroundColor Gray

# Тесты error-handler
$errorHandlerTest = Test-Command "npm test -- __tests__/lib/error-handler.test.ts" "Тесты error-handler"

# Тесты retry
$retryTest = Test-Command "npm test -- __tests__/lib/retry.test.ts" "Тесты retry"

# Тесты excel-service
$excelTest = Test-Command "npm test -- __tests__/lib/excel-service.test.ts" "Тесты excel-service"

# Тесты БД
$dbTest = Test-Command "npm test -- __tests__/lib/db.test.ts" "Тесты БД"

# Тесты migration-manager
$migrationTest = Test-Command "npm test -- __tests__/lib/migration-manager.test.ts" "Тесты migration-manager"

# Шаг 4: Интеграционные тесты API
Write-Section "Шаг 4: Интеграционные тесты API"
Write-Host "Запуск API тестов..." -ForegroundColor Gray

# Тесты messages API
$messagesTest = Test-Command "npm test -- __tests__/api/messages.test.ts" "Тесты API messages"

# Тесты threads API
$threadsTest = Test-Command "npm test -- __tests__/api/threads.test.ts" "Тесты API threads"

# Тесты chat API
$chatTest = Test-Command "npm test -- __tests__/api/chat.test.ts" "Тесты API chat"

# Шаг 5: Тесты компонентов
Write-Section "Шаг 5: Тесты компонентов"
Write-Host "Запуск тестов компонентов..." -ForegroundColor Gray

# Тесты ThreadList
$threadListTest = Test-Command "npm test -- __tests__/components/ThreadList.test.tsx" "Тесты ThreadList"

# Тесты ChatInterface
$chatInterfaceTest = Test-Command "npm test -- __tests__/components/ChatInterface.test.tsx" "Тесты ChatInterface"

# Шаг 6: Покрытие кода
Write-Section "Шаг 6: Генерация отчета о покрытии"
Write-Host "Запуск тестов с покрытием..." -ForegroundColor Gray
$coverageTest = Test-Command "npm run test:coverage" "Генерация покрытия кода"

if ($coverageTest) {
    Write-Host ""
    Write-Host "Отчет о покрытии создан в: coverage/lcov-report/index.html" -ForegroundColor Cyan
    Write-Host "Откройте файл в браузере для просмотра детального отчета." -ForegroundColor Gray
}

# Шаг 7: E2E тесты
Write-Section "Шаг 7: E2E тесты"
Write-Host "Проверка, что сервер не запущен на порту 3000..." -ForegroundColor Gray

$e2eTest = $false
$portCheck = Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue
if ($portCheck) {
    Write-Host "Предупреждение: Порт 3000 занят. Убедитесь, что сервер разработки остановлен." -ForegroundColor Yellow
    $continue = Read-Host "Продолжить E2E тесты? (y/n)"
    if ($continue -eq "y") {
        $e2eTest = Test-Command "npm run test:e2e" "E2E тесты"
    } else {
        Write-Host "E2E тесты пропущены" -ForegroundColor Yellow
    }
} else {
    $e2eTest = Test-Command "npm run test:e2e" "E2E тесты"
}

# Итоговый отчет
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  ИТОГОВЫЙ ОТЧЕТ" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$results = @(
    @{Name="Линтинг"; Result=$lintResult},
    @{Name="Тесты error-handler"; Result=$errorHandlerTest},
    @{Name="Тесты retry"; Result=$retryTest},
    @{Name="Тесты excel-service"; Result=$excelTest},
    @{Name="Тесты БД"; Result=$dbTest},
    @{Name="Тесты migration-manager"; Result=$migrationTest},
    @{Name="Тесты API messages"; Result=$messagesTest},
    @{Name="Тесты API threads"; Result=$threadsTest},
    @{Name="Тесты API chat"; Result=$chatTest},
    @{Name="Тесты ThreadList"; Result=$threadListTest},
    @{Name="Тесты ChatInterface"; Result=$chatInterfaceTest},
    @{Name="Покрытие кода"; Result=$coverageTest},
    @{Name="E2E тесты"; Result=$e2eTest}
)

$passed = 0
$failed = 0

foreach ($result in $results) {
    if ($result.Result) {
        Write-Host "✓ $($result.Name)" -ForegroundColor Green
        $passed++
    } else {
        Write-Host "✗ $($result.Name)" -ForegroundColor Red
        $failed++
    }
}

Write-Host ""
Write-Host "Успешно: $passed" -ForegroundColor Green
Write-Host "Провалено: $failed" -ForegroundColor $(if ($failed -gt 0) { "Red" } else { "Green" })
Write-Host ""

if ($failed -eq 0) {
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "  ВСЕ ТЕСТЫ ПРОЙДЕНЫ УСПЕШНО!" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    exit 0
} else {
    Write-Host "========================================" -ForegroundColor Red
    Write-Host "  ОБНАРУЖЕНЫ ОШИБКИ В ТЕСТАХ" -ForegroundColor Red
    Write-Host "========================================" -ForegroundColor Red
    exit 1
}

