# =============================================================================
#  scp_to_server.ps1
#  Copies project files from Windows to Ubuntu server using native scp.exe
#  Server:  nwasim@192.168.147.129
#  Dest:    ~/projects/Build.DDN.Semantic_Search/
#  Usage:   .\scp_to_server.ps1
# =============================================================================

$SERVER      = "nwasim@192.168.147.129"
$REMOTE_DIR  = "/home/nwasim/projects/Build.DDN.Semantic_Search"
$LOCAL_PATH  = "c:\DDN\AI-Dev\Projects\infinia-rag-demo-v2-main\infinia-rag-demo-v2-main"

Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  SCP to Ubuntu: $SERVER" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

# ── Step 1: Create remote destination directory ───────────────────────────────
Write-Host "[1/3] Creating remote directory..." -ForegroundColor Yellow
ssh -o StrictHostKeyChecking=no $SERVER "mkdir -p $REMOTE_DIR"
if ($LASTEXITCODE -ne 0) { Write-Host "ERROR: Could not create remote directory" -ForegroundColor Red; exit 1 }
Write-Host "      Remote dir ready: $REMOTE_DIR" -ForegroundColor Green

# ── Step 2: Copy github_push_setup.sh first ──────────────────────────────────
Write-Host ""
Write-Host "[2/3] Copying github_push_setup.sh to server..." -ForegroundColor Yellow
scp -o StrictHostKeyChecking=no `
    "$LOCAL_PATH\github_push_setup.sh" `
    "${SERVER}:${REMOTE_DIR}/github_push_setup.sh"
if ($LASTEXITCODE -ne 0) { Write-Host "ERROR: SCP failed for github_push_setup.sh" -ForegroundColor Red; exit 1 }
Write-Host "      github_push_setup.sh copied OK" -ForegroundColor Green

# ── Step 3: Copy all project files ───────────────────────────────────────────
# NOTE: scp -r copies everything. The github_push_setup.sh script will
#       scrub credentials (storage_config.json, .env) before git push.
Write-Host ""
Write-Host "[3/3] Copying project files (this may take a minute)..." -ForegroundColor Yellow
Write-Host "      Skipping venv / node_modules via server-side cleanup..." -ForegroundColor Gray

# Copy directory by directory — skip bulky/sensitive folders
$folders = @("backend\app", "backend\data", "frontend\src", "frontend\public", "frontend\Logos")
foreach ($folder in $folders) {
    $src = "$LOCAL_PATH\$folder"
    $remotePart = $folder.Replace("\", "/")
    $remoteParent = "$REMOTE_DIR/" + ($remotePart -replace "/[^/]+$", "")
    Write-Host "  → $folder" -ForegroundColor Gray
    ssh -o StrictHostKeyChecking=no $SERVER "mkdir -p $remoteParent" | Out-Null
    scp -r -o StrictHostKeyChecking=no "$src" "${SERVER}:${REMOTE_DIR}/${remotePart}/../" 2>$null
}

# Copy individual root files
$rootFiles = @(
    "backend\main.py",
    "backend\requirements.txt",
    "backend\.env.example",
    "frontend\package.json",
    "frontend\tsconfig.json",
    "frontend\tsconfig.node.json",
    "frontend\vite.config.ts",
    "frontend\tailwind.config.js",
    "frontend\postcss.config.js",
    "frontend\index.html",
    ".gitignore",
    "README.md",
    "ARCHITECTURE.md",
    "DEPLOYMENT.md",
    "DEPLOY_README.md",
    "STORAGE_CONFIGURATION.md",
    "CHANGELOG.md",
    "ecosystem.config.js",
    "deploy.sh",
    "install.sh"
)

Write-Host "  → Root files..." -ForegroundColor Gray
foreach ($file in $rootFiles) {
    $src = "$LOCAL_PATH\$file"
    if (Test-Path $src) {
        $remoteSubDir = "$REMOTE_DIR/" + (Split-Path ($file.Replace("\","/")) -Parent)
        ssh -o StrictHostKeyChecking=no $SERVER "mkdir -p $remoteSubDir" 2>$null | Out-Null
        scp -o StrictHostKeyChecking=no "$src" "${SERVER}:${REMOTE_DIR}/${file.Replace('\','/')}" 2>$null
    }
}

Write-Host ""
Write-Host "============================================================" -ForegroundColor Green
Write-Host "  Transfer complete!" -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Green
Write-Host ""
Write-Host "Now SSH into the server and run:" -ForegroundColor Yellow
Write-Host "  ssh $SERVER" -ForegroundColor Cyan
Write-Host "  chmod +x ~/projects/Build.DDN.Semantic_Search/github_push_setup.sh" -ForegroundColor Cyan
Write-Host "  bash ~/projects/Build.DDN.Semantic_Search/github_push_setup.sh" -ForegroundColor Cyan
Write-Host ""
