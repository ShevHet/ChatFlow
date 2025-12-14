# Скрипт для остановки процессов Next.js и очистки блокировки

Write-Host "Остановка процессов Next.js..."

# Находим все процессы Node.js на портах 3000 и 3001
Write-Host ""
Write-Host "Поиск процессов на портах 3000 и 3001..."
$ports = @(3000, 3001)
foreach ($port in $ports) {
    $connections = netstat -ano | Select-String ":$port.*LISTENING"
    if ($connections) {
        $pids = $connections | ForEach-Object {
            ($_ -split '\s+')[-1]
        } | Select-Object -Unique
        foreach ($pid in $pids) {
            try {
                $proc = Get-Process -Id $pid -ErrorAction Stop
                Write-Host "Останавливаю процесс на порту $port (PID: $pid - $($proc.ProcessName))"
                Stop-Process -Id $pid -Force -ErrorAction Stop
            } catch {
                Write-Host "Не удалось остановить процесс $pid"
            }
        }
    }
}

# Удаляем файл блокировки
$lockFile = ".next\dev\lock"
if (Test-Path $lockFile) {
    Write-Host ""
    Write-Host "Удаляю файл блокировки: $lockFile"
    Remove-Item $lockFile -Force -ErrorAction SilentlyContinue
    Write-Host "Файл блокировки удален"
} else {
    Write-Host ""
    Write-Host "Файл блокировки не найден"
}

Write-Host ""
Write-Host "Готово! Теперь можно запустить: bun run dev"
