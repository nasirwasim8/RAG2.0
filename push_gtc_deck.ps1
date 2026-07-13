# ─────────────────────────────────────────────────────────────────
# push_gtc_deck.ps1
# Pushes the GTC Deck changes to the Ubuntu server and rebuilds
# Usage: .\push_gtc_deck.ps1
# ─────────────────────────────────────────────────────────────────

$SERVER   = "nwasim@172.20.146.6"
$REMOTE   = "~/projects/infinia-rag-demo-v2"
$LOCAL    = "c:\DDN\AI-Dev\Projects\infinia-rag-demo-v2-main\infinia-rag-demo-v2-main"

Write-Host ""
Write-Host "=== GTC Deck Deploy ===" -ForegroundColor Cyan
Write-Host "Target: $SERVER : $REMOTE" -ForegroundColor Cyan
Write-Host ""

# ── 1. Copy the new/modified frontend files ──────────────────────
Write-Host "[1/3] Copying GTCDeck.tsx (new page)..." -ForegroundColor Yellow
scp "$LOCAL\frontend\src\pages\GTCDeck.tsx" `
    "${SERVER}:${REMOTE}/frontend/src/pages/GTCDeck.tsx"

Write-Host "[2/3] Copying App.tsx (updated navigation)..." -ForegroundColor Yellow
scp "$LOCAL\frontend\src\App.tsx" `
    "${SERVER}:${REMOTE}/frontend/src/App.tsx"

# ── 2. SSH: rebuild frontend + restart PM2 ───────────────────────
Write-Host "[3/3] Building frontend & restarting PM2 on server..." -ForegroundColor Yellow
ssh $SERVER @"
  set -e
  cd $REMOTE/frontend
  echo '  -> Installing any new deps...'
  npm install --silent
  echo '  -> Building production bundle...'
  npm run build
  cd $REMOTE
  echo '  -> Restarting PM2 processes...'
  pm2 restart all --update-env 2>/dev/null || pm2 start ecosystem.config.js
  echo ''
  echo 'Done! PM2 status:'
  pm2 list
"@

Write-Host ""
Write-Host "=== Deploy complete ===" -ForegroundColor Green
Write-Host "Open your browser and navigate to the GTC Deck tab." -ForegroundColor Green
Write-Host ""
