# Script to clean .next directory
# This script helps remove .next folder when OneDrive is blocking it

Write-Host "Attempting to clean .next directory..." -ForegroundColor Cyan

$nextPath = Join-Path $PSScriptRoot "..\.next"

if (Test-Path $nextPath) {
    Write-Host "Found .next directory at: $nextPath" -ForegroundColor Yellow
    
    try {
        # Try to remove with force
        Remove-Item -Path $nextPath -Recurse -Force -ErrorAction Stop
        Write-Host "Successfully removed .next directory" -ForegroundColor Green
    } catch {
        Write-Host "Failed to remove .next directory automatically" -ForegroundColor Red
        Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
        Write-Host ""
        Write-Host "Please try one of the following:" -ForegroundColor Yellow
        Write-Host "1. Close all terminals and code editors" -ForegroundColor Yellow
        Write-Host "2. Stop OneDrive sync for this folder" -ForegroundColor Yellow
        Write-Host "3. Delete .next folder manually in Windows Explorer" -ForegroundColor Yellow
        Write-Host "4. Restart your computer" -ForegroundColor Yellow
        exit 1
    }
} else {
    Write-Host ".next directory not found - nothing to clean" -ForegroundColor Green
}

Write-Host "Cleanup complete!" -ForegroundColor Green

