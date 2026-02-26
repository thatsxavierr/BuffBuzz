# Accept incoming (theirs) for all unmerged files and complete the merge.
# Run this in PowerShell AFTER closing Cursor (to release file locks).
Set-Location $PSScriptRoot
Remove-Item .git\index.lock -Force -ErrorAction SilentlyContinue
$unmerged = @(
  'buffbuzz/package-lock.json',
  'buffbuzz/package.json',
  'buffbuzz/src/App.js',
  'buffbuzz/src/BlockedUsers.css',
  'buffbuzz/src/CreatePost.js',
  'buffbuzz/src/FriendRequests.js',
  'buffbuzz/src/Friends.css',
  'buffbuzz/src/Friends.js',
  'buffbuzz/src/Groups.css',
  'buffbuzz/src/Groups.js',
  'buffbuzz/src/Header.css',
  'buffbuzz/src/Header.js',
  'buffbuzz/src/ImageCropModal.js',
  'buffbuzz/src/Jobs.css',
  'buffbuzz/src/Jobs.js',
  'buffbuzz/src/LeftSidebar.js',
  'buffbuzz/src/LostFound.css',
  'buffbuzz/src/LostFound.js',
  'buffbuzz/src/MainPage.js',
  'buffbuzz/src/Marketplace.css',
  'buffbuzz/src/Marketplace.js',
  'buffbuzz/src/Notifications.css',
  'buffbuzz/src/PostCard.css',
  'buffbuzz/src/PostCard.js',
  'buffbuzz/src/ProfileEdit.js',
  'buffbuzz/src/RightSidebar.css',
  'buffbuzz/src/RightSidebar.js',
  'buffbuzz/src/SettingsPage.css',
  'buffbuzz/src/SettingsPage.js',
  'buffbuzz/src/loginPage.js',
  'buffbuzz/src/sessionUtils.js',
  'buffbuzz/src/verificationPage.js',
  'server.js'
)
foreach ($f in $unmerged) {
  git checkout --theirs -- $f
  git add $f
}
Write-Host "All conflicts resolved (incoming accepted). Now run: git commit -m `"Merge origin/main, accept incoming changes`""
