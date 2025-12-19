# Script to clean .next directory
# This script helps remove .next folder when OneDrive is blocking it

Write-Host "Attempting to clean .next directory..." -ForegroundColor Cyan

$nextPath = Join-Path $PSScriptRoot "..\.next"
$nextPath = Resolve-Path $nextPath -ErrorAction SilentlyContinue
if (-not $nextPath) {
    $nextPath = Join-Path (Get-Location) ".next"
}

if (Test-Path $nextPath) {
    Write-Host "Found .next directory at: $nextPath" -ForegroundColor Yellow
    
    $maxRetries = 3
    $retryCount = 0
    $success = $false
    
    while ($retryCount -lt $maxRetries -and -not $success) {
        $retryCount++
        Write-Host "Attempt $retryCount of $maxRetries..." -ForegroundColor Cyan
        
        try {
            # Method 1: Try standard removal first
            Remove-Item -Path $nextPath -Recurse -Force -ErrorAction Stop
            Write-Host "Successfully removed .next directory" -ForegroundColor Green
            $success = $true
        } catch {
            Write-Host "Standard removal failed: $($_.Exception.Message)" -ForegroundColor Yellow
            
            try {
                # Method 2: Remove files first, then directories
                Get-ChildItem -Path $nextPath -Recurse -File | ForEach-Object {
                    Remove-Item $_.FullName -Force -ErrorAction SilentlyContinue
                }
                Get-ChildItem -Path $nextPath -Recurse -Directory | Sort-Object -Property FullName -Descending | ForEach-Object {
                    Remove-Item $_.FullName -Force -ErrorAction SilentlyContinue
                }
                Remove-Item -Path $nextPath -Force -ErrorAction Stop
                Write-Host "Successfully removed .next directory (method 2)" -ForegroundColor Green
                $success = $true
            } catch {
                Write-Host "Method 2 failed: $($_.Exception.Message)" -ForegroundColor Yellow
                
                if ($retryCount -lt $maxRetries) {
                    Write-Host "Waiting 2 seconds before retry..." -ForegroundColor Yellow
                    Start-Sleep -Seconds 2
                } else {
                    # Method 3: Use robocopy trick (create empty dir and mirror to delete)
                    try {
                        $emptyDir = Join-Path $env:TEMP "empty_$(Get-Random)"
                        New-Item -ItemType Directory -Path $emptyDir -Force | Out-Null
                        & robocopy $emptyDir $nextPath /MIR /NFL /NDL /NJH /NJS | Out-Null
                        Remove-Item $emptyDir -Force -ErrorAction SilentlyContinue
                        Remove-Item -Path $nextPath -Force -ErrorAction Stop
                        Write-Host "Successfully removed .next directory (robocopy method)" -ForegroundColor Green
                        $success = $true
                    } catch {
                        Write-Host "All automated methods failed" -ForegroundColor Red
                    }
                }
            }
        }
    }
    
    if (-not $success) {
        Write-Host ""
        Write-Host "Failed to remove .next directory automatically" -ForegroundColor Red
        Write-Host ""
        Write-Host "Please try one of the following:" -ForegroundColor Yellow
        Write-Host "1. Close all terminals, code editors, and file explorers" -ForegroundColor Yellow
        Write-Host "2. Pause OneDrive sync temporarily:" -ForegroundColor Yellow
        Write-Host "   - Right-click OneDrive icon in system tray" -ForegroundColor Gray
        Write-Host "   - Select 'Pause syncing' > '2 hours'" -ForegroundColor Gray
        Write-Host "   - Then run this script again" -ForegroundColor Gray
        Write-Host "3. Exclude .next from OneDrive sync (recommended):" -ForegroundColor Yellow
        Write-Host "   - Right-click OneDrive icon > Settings" -ForegroundColor Gray
        Write-Host "   - Go to Sync and backup > Advanced settings" -ForegroundColor Gray
        Write-Host "   - Add .next to excluded folders" -ForegroundColor Gray
        Write-Host "4. Delete .next folder manually in Windows Explorer" -ForegroundColor Yellow
        Write-Host "5. Restart your computer and try again" -ForegroundColor Yellow
        exit 1
    }
} else {
    Write-Host ".next directory not found - nothing to clean" -ForegroundColor Green
}

Write-Host "Cleanup complete!" -ForegroundColor Green

