# Finish the merge so you can git pull.
# IMPORTANT: Close Cursor first, then run this script (right-click -> Run with PowerShell).
Set-Location $PSScriptRoot
Remove-Item .git\index.lock -Force -ErrorAction SilentlyContinue
git commit -m "Merge origin/main, accept incoming changes"
if ($LASTEXITCODE -eq 0) {
  Write-Host "Merge committed. You can now run: git pull" -ForegroundColor Green
} else {
  Write-Host "If you see 'Permission denied', close Cursor and run this script again." -ForegroundColor Yellow
}
