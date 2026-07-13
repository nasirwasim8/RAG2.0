#!/bin/bash
# deploy_to_ubuntu.sh
# Run from WSL terminal on NasirRTX — uses cp (no SSH/SCP needed since WSL IS the server)
# Usage: bash /mnt/c/DDN/AI-Dev/Projects/infinia-rag-demo-v2-main/infinia-rag-demo-v2-main/deploy_to_ubuntu.sh

WINDOWS_PROJECT="/mnt/c/DDN/AI-Dev/Projects/infinia-rag-demo-v2-main/infinia-rag-demo-v2-main"
UBUNTU_PROJECT="$HOME/projects/infinia-rag-demo-v2"

echo "=================================================="
echo "  Deploying backend changes (local WSL cp)"
echo "=================================================="

echo ""
echo "[1/3] Copying backend/app/services/ ..."
cp "$WINDOWS_PROJECT/backend/app/services/vector_store.py" "$UBUNTU_PROJECT/backend/app/services/vector_store.py" && echo "  ✓ vector_store.py"
cp "$WINDOWS_PROJECT/backend/app/services/document.py"     "$UBUNTU_PROJECT/backend/app/services/document.py"     && echo "  ✓ document.py"
cp "$WINDOWS_PROJECT/backend/app/services/storage.py"      "$UBUNTU_PROJECT/backend/app/services/storage.py"      && echo "  ✓ storage.py"

echo ""
echo "[2/3] Copying backend/app/api/routes.py ..."
cp "$WINDOWS_PROJECT/backend/app/api/routes.py" "$UBUNTU_PROJECT/backend/app/api/routes.py" && echo "  ✓ routes.py"

# Verify the new code is there
echo ""
echo "[verify] Checking code version on server ..."
if grep -q "all_aws_tasks" "$UBUNTU_PROJECT/backend/app/services/vector_store.py"; then
    echo "  ✅ NEW code confirmed (all_aws_tasks found)"
else
    echo "  ❌ OLD code detected — cp may have failed"
fi

echo ""
echo "[3/3] Restarting PM2 backend ..."
# Find pm2 wherever it's installed
PM2=$(which pm2 2>/dev/null \
  || ls ~/.nvm/versions/node/*/bin/pm2 2>/dev/null | tail -1 \
  || ls /usr/local/bin/pm2 2>/dev/null \
  || ls /usr/bin/pm2 2>/dev/null)

if [ -n "$PM2" ] && [ -x "$PM2" ]; then
    $PM2 restart infinia-rag-backend && sleep 3 && $PM2 logs infinia-rag-backend --lines 20 --nostream
else
    echo "  ⚠️  Cannot find pm2 — killing old uvicorn and restarting"
    pkill -f "infinia-rag-demo-v2.*uvicorn" 2>/dev/null
    echo "  ⚠️  Run 'pm2 restart infinia-rag-backend' manually"
fi

echo ""
echo "=================================================="
echo "  Deploy complete!"
echo "=================================================="
