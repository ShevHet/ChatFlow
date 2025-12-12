# Скрипт для проверки доступности dev сервера
$url = "http://localhost:3000"
$maxAttempts = 5
$delay = 2

Write-Host "Проверка доступности dev сервера на $url..." -ForegroundColor Cyan

for ($i = 1; $i -le $maxAttempts; $i++) {
    try {
        $response = Invoke-WebRequest -Uri $url -Method Get -TimeoutSec 2 -UseBasicParsing -ErrorAction Stop
        Write-Host "✓ Dev сервер доступен!" -ForegroundColor Green
        exit 0
    } catch {
        if ($i -lt $maxAttempts) {
            Write-Host "Попытка $i/$maxAttempts: сервер не доступен, ожидание..." -ForegroundColor Yellow
            Start-Sleep -Seconds $delay
        } else {
            Write-Host "✗ Dev сервер не доступен на $url" -ForegroundColor Red
            Write-Host ""
            Write-Host "Пожалуйста, запустите dev сервер в отдельном терминале:" -ForegroundColor Yellow
            Write-Host "  npm run dev" -ForegroundColor Yellow
            Write-Host ""
            Write-Host "Затем дождитесь сообщения 'Ready' и запустите тесты снова." -ForegroundColor Yellow
            exit 1
        }
    }
}

