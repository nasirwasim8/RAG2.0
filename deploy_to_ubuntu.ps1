# deploy_to_ubuntu.ps1
# Copies changed backend files to Ubuntu server and restarts PM2
# Usage: .\deploy_to_ubuntu.ps1
# You will be prompted for the SSH password for each scp command.
# Tip: Install openssh-askpass or use ssh-copy-id to avoid repeated prompts.

$SERVER = "nwasim@192.168.147.129"
$REMOTE_BASE = "~/projects/infinia-rag-demo-v2"
$LOCAL_BASE = "C:\DDN\AI-Dev\Projects\infinia-rag-demo-v2-main\infinia-rag-demo-v2-main"

Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "  Deploying backend changes to Ubuntu server" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host ""

# ── Backend service files ──────────────────────────────────────────────────────
Write-Host "[1/3] Copying backend/app/services/ ..." -ForegroundColor Yellow
scp "$LOCAL_BASE\backend\app\services\vector_store.py" "${SERVER}:${REMOTE_BASE}/backend/app/services/vector_store.py"
scp "$LOCAL_BASE\backend\app\services\document.py"     "${SERVER}:${REMOTE_BASE}/backend/app/services/document.py"
scp "$LOCAL_BASE\backend\app\services\storage.py"      "${SERVER}:${REMOTE_BASE}/backend/app/services/storage.py"

# ── Backend API routes ─────────────────────────────────────────────────────────
Write-Host "[2/3] Copying backend/app/api/routes.py ..." -ForegroundColor Yellow
scp "$LOCAL_BASE\backend\app\api\routes.py" "${SERVER}:${REMOTE_BASE}/backend/app/api/routes.py"

# ── Frontend (if needed) ────────────────────────────────────────────────────────
# Uncomment the lines below if you also changed frontend files:
# Write-Host "[2b] Copying frontend src files ..." -ForegroundColor Yellow
# scp "$LOCAL_BASE\frontend\src\pages\Documents.tsx" "${SERVER}:${REMOTE_BASE}/frontend/src/pages/Documents.tsx"

# ── Restart PM2 backend ────────────────────────────────────────────────────────
Write-Host "[3/3] Restarting infinia-rag-backend via PM2 ..." -ForegroundColor Yellow
ssh $SERVER "pm2 restart infinia-rag-backend && sleep 3 && pm2 logs infinia-rag-backend --lines 20 --nostream"

Write-Host ""
Write-Host "==================================================" -ForegroundColor Green
Write-Host "  Deploy complete!" -ForegroundColor Green
Write-Host "==================================================" -ForegroundColor Green
