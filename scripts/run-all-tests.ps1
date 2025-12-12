# PowerShell скрипт для запуска всех тестов

Write-Host "🧪 Запуск всех тестов ChatFlow" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "📦 Установка зависимостей..." -ForegroundColor Yellow
npm install

Write-Host ""
Write-Host "🌐 Установка браузеров Playwright..." -ForegroundColor Yellow
npx playwright install --with-deps

Write-Host ""
Write-Host "🔍 Запуск линтера (опционально)..." -ForegroundColor Yellow
npm run lint 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "⚠️  Линтер пропущен (не критично)" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "✅ Запуск unit и интеграционных тестов..." -ForegroundColor Yellow
npm run test:coverage

Write-Host ""
Write-Host "🎭 Запуск E2E тестов..." -ForegroundColor Yellow
npm run test:e2e

Write-Host ""
Write-Host "✨ Все тесты завершены!" -ForegroundColor Green
Write-Host "📊 Отчет о покрытии: coverage/lcov-report/index.html" -ForegroundColor Green

