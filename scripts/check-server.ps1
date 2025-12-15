# Script to check dev server availability
$url = "http://localhost:3000"
$maxAttempts = 5
$delay = 2

Write-Host "Checking dev server availability at $url..." -ForegroundColor Cyan

for ($i = 1; $i -le $maxAttempts; $i++) {
    try {
        $response = Invoke-WebRequest -Uri $url -Method Get -TimeoutSec 2 -UseBasicParsing -ErrorAction Stop
        Write-Host "Dev server is available!" -ForegroundColor Green
        exit 0
    } catch {
        if ($i -lt $maxAttempts) {
            Write-Host "Attempt ${i}/${maxAttempts}: server is not available, waiting..." -ForegroundColor Yellow
            Start-Sleep -Seconds $delay
        } else {
            Write-Host "Dev server is not available at $url" -ForegroundColor Red
            Write-Host ""
            Write-Host "Please start the dev server in a separate terminal:" -ForegroundColor Yellow
            Write-Host "  npm run dev" -ForegroundColor Yellow
            Write-Host ""
            Write-Host "Then wait for the Ready message and run the tests again" -ForegroundColor Yellow
            exit 1
        }
    }
}
