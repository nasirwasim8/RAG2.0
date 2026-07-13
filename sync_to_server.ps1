# =============================================================================
#  sync_to_server.ps1
#  Syncs local project to Ubuntu server — EXCLUDES all credentials & junk
#  Server: nwasim@192.168.147.129
#  Dest:   /home/nwasim/Build.DDN.RAG-V3-GPU
#  Usage:  .\sync_to_server.ps1
#          .\sync_to_server.ps1 -DryRun   (preview only)
# =============================================================================

param([switch]$DryRun)

$SERVER      = "nwasim@192.168.147.129"
$REMOTE_PATH = "/home/nwasim/Build.DDN.RAG-V3-GPU"
$LOCAL_PATH  = "c:\DDN\AI-Dev\Projects\infinia-rag-demo-v2-main\infinia-rag-demo-v2-main"

# Convert Windows path → WSL path
$wslLocal = "/mnt/" + $LOCAL_PATH.Substring(0,1).ToLower() + "/" + $LOCAL_PATH.Substring(3).Replace("\","/")

# ── Prompt for SSH password (used by sshpass so rsync doesn't hang) ──────────
$sshPasswd = Read-Host -Prompt "Enter SSH password for $SERVER" -AsSecureString
$plain = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
             [Runtime.InteropServices.Marshal]::SecureStringToBSTR($sshPasswd))

# Install sshpass in WSL if missing (needed once only)
$hasSshpass = wsl which sshpass 2>$null
if (-not $hasSshpass) {
    Write-Host "Installing sshpass in WSL (one-time)..." -ForegroundColor Yellow
    wsl sudo apt-get install -y sshpass 2>&1 | Out-Null
}

$rsyncArgs = @(
    "-avz"
    "--progress"
    "-e"
    "ssh -o StrictHostKeyChecking=no"
    "--exclude=.git"
    "--exclude=__pycache__"
    "--exclude=*.pyc"
    "--exclude=*.pyo"
    "--exclude=backend/.env"
    "--exclude=backend/.env.*"
    "--exclude=backend/data/storage_config.json"
    "--exclude=backend/data/*.json"
    "--include=backend/data/*.example.json"   # keep blank template
    "--exclude=backend/venv"
    "--exclude=frontend/node_modules"
    "--exclude=frontend/dist"
    "--exclude=dist"
    "--exclude=*.log"
    "--exclude=logs/"
    # Patch scripts (contain credentials or are internal-only)
    "--exclude=apply_s3_toggle_patch.py"
    "--exclude=apply_aws_sync_patch.py"
    "--exclude=apply_aws_sync_patch.sh"
    "--exclude=diagnose_s3.py"
    "--exclude=test_aws_upload.py"
    "--exclude=push_to_server.ps1"
    "--exclude=sync_to_server.ps1"
    "--exclude=create_deployment_package.sh"
    "--exclude=deploy_wsl.sh"
    "--exclude=deployment/"
    "--exclude=NEXT_SESSION.md"
    "--exclude=*.backup"
    "--exclude=*.pdf"
    "--exclude=.gemini/"
    "--exclude=.DS_Store"
    "--exclude=Thumbs.db"
    "$wslLocal/"
    "${SERVER}:${REMOTE_PATH}"
)

if ($DryRun) {
    $rsyncArgs = @("--dry-run") + $rsyncArgs
    Write-Host "DRY RUN — no files will be transferred" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Syncing to: ${SERVER}:${REMOTE_PATH}" -ForegroundColor Cyan
Write-Host "Source:     $LOCAL_PATH" -ForegroundColor Gray
Write-Host ""

# Use sshpass so rsync doesn't hang on password prompt
wsl sshpass -p $plain rsync @rsyncArgs

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "Sync complete!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Now SSH into the server and run:" -ForegroundColor Yellow
    Write-Host "  ssh $SERVER" -ForegroundColor Cyan
    Write-Host "  bash ~/Build.DDN.RAG-V3-GPU/github_push_setup.sh" -ForegroundColor Cyan
    Write-Host ""
} else {
    Write-Host ""
    Write-Host "rsync failed (exit code $LASTEXITCODE)" -ForegroundColor Red
    Write-Host "Try the manual SCP approach below:" -ForegroundColor Yellow
    Write-Host '  wsl tar -czf /tmp/rag-code.tar.gz -C "/mnt/c/DDN/AI-Dev/Projects/infinia-rag-demo-v2-main/infinia-rag-demo-v2-main" --exclude=".git" --exclude="backend/data/storage_config.json" --exclude="backend/.env" --exclude="venv" --exclude="node_modules" --exclude="*.pdf" --exclude="*.backup" .' -ForegroundColor Gray
    Write-Host "  scp nwasim@192.168.147.129:/tmp < \\wsl.localhost\Ubuntu\tmp\rag-code.tar.gz" -ForegroundColor Gray
}
