# Restore your code to the state BEFORE you pulled from GitHub
# Run this from PowerShell AFTER closing Cursor/VS Code and any terminals using this folder.
# Right-click this file -> Run with PowerShell, or in PowerShell: .\restore-my-code.ps1

Set-Location $PSScriptRoot

Write-Host "Removing stale Git lock (if any)..." -ForegroundColor Yellow
Remove-Item -Force ".git\index.lock" -ErrorAction SilentlyContinue

Write-Host "Aborting merge..." -ForegroundColor Yellow
git merge --abort 2>$null

Write-Host "Resetting to your last commit before the pull (949b296 'my local updates')..." -ForegroundColor Yellow
git reset --hard 949b296

if ($LASTEXITCODE -eq 0) {
    Write-Host "Done. Your code is back to how it was before the pull." -ForegroundColor Green
    Write-Host "You can reopen Cursor and continue working." -ForegroundColor Green
} else {
    Write-Host "Reset had issues. Try running these commands manually in a NEW PowerShell (outside Cursor):" -ForegroundColor Red
    Write-Host "  cd $PSScriptRoot" -ForegroundColor White
    Write-Host "  Remove-Item -Force .git\index.lock -ErrorAction SilentlyContinue" -ForegroundColor White
    Write-Host "  git merge --abort" -ForegroundColor White
    Write-Host "  git reset --hard 949b296" -ForegroundColor White
}
