# DDN Infinia RAG Demo — Deployment Guide

> For deployment team use. Share this file together with `deploy_wsl.sh`.

---

## What This Deploys

A full-stack AI/RAG application:

| Component | Technology | Port |
|-----------|-----------|------|
| Backend API | FastAPI + Uvicorn (Python) | `8000` |
| Frontend UI | React + Vite (Node.js) | `5174` |
| Process Manager | PM2 | — |
| LLM Inference | NVIDIA NIM API | external |
| Storage | DDN INFINIA (S3-compatible) | external |

Both services are managed by PM2 and auto-restart on crash.

---

## Prerequisites

| Requirement | Version | Notes |
|-------------|---------|-------|
| OS | Ubuntu 22.04 | WSL2, bare-metal, or cloud VM |
| CPU | x86-64 | Any modern CPU |
| RAM | 8 GB minimum | 16 GB+ recommended |
| GPU | NVIDIA (optional) | Enables faster embeddings |
| NVIDIA Driver | 520+ | Required only for GPU acceleration |
| Internet | Required | For GitHub clone + pip/npm packages |
| Sudo access | Required | For apt packages + Node.js install |

> **WSL2 users**: The script runs identically on WSL2. Windows browsers access the app at `http://localhost:5174` automatically.

---

## Pre-Deployment Checklist

- [ ] Ubuntu 22.04 machine is accessible
- [ ] You have a user account with `sudo` privileges
- [ ] Outbound internet access is available (GitHub, PyPI, npm)
- [ ] You have an **NVIDIA NIM API key** (free at https://build.nvidia.com) — needed for LLM queries
- [ ] You have **DDN INFINIA credentials** (optional — configurable via the app UI after deployment)

---

## Deployment — Step by Step

### Step 1 — Copy the script to the target machine

**Option A: Already on the machine**
```bash
# Copy deploy_wsl.sh to your home directory and run it
bash deploy_wsl.sh
```

**Option B: From a Windows machine via WSL**
```powershell
# In PowerShell — copy the script into WSL then run it
wsl bash -c "bash /mnt/c/path/to/deploy_wsl.sh"
```

**Option C: Remote server via SSH**
```bash
# Copy script to the server
scp deploy_wsl.sh user@your-server-ip:~/

# SSH into the server and run it
ssh user@your-server-ip
bash ~/deploy_wsl.sh
```

---

### Step 2 — Run the script

```bash
bash deploy_wsl.sh
```

The script will prompt for:

1. **Sudo password** — entered once at the start. Cached for the full run (≈15 min).
2. **NVIDIA API key** — paste your `nvapi-xxxxxxxxxxxxx` key, or press **Enter** to skip and add it later.

**Estimated run time**: 10–20 minutes (mostly PyTorch download, ~2 GB).

---

### Step 3 — Verify deployment

When the script completes, you will see PM2 status and access URLs:

```
┌────┬────────────────────┬──────────┬──────┬───────────┐
│ id │ name               │ mode     │ ↺    │ status    │
├────┼────────────────────┼──────────┼──────┼───────────┤
│ 0  │ infinia-rag-backe… │ fork     │ 0    │ online    │
│ 1  │ infinia-rag-front… │ fork     │ 0    │ online    │
└────┴────────────────────┴──────────┴──────┴───────────┘

  Frontend  →  http://localhost:5174
  Backend   →  http://localhost:8000
  API Docs  →  http://localhost:8000/docs
```

Open **http://localhost:5174** in a browser. The **System Status** panel (bottom-left) should show:
- `Backend API` → **Online** ✅
- `NVIDIA NeMo` → **Ready** ✅ (only after API key is set)

---

### Step 4 — Add NVIDIA API key (if skipped)

```bash
nano ~/projects/infinia-rag-demo-v2/backend/.env
```

Set this line:
```
NVIDIA_API_KEY=nvapi-xxxxxxxxxxxxx
```

Then restart the backend:
```bash
pm2 restart infinia-rag-backend
```

---

### Step 5 — Add DDN INFINIA Credentials (optional)

Storage credentials can be configured directly in the app UI:

1. Open the app → click **Configuration** in the left sidebar
2. Enter DDN INFINIA endpoint URL, access key, secret key, and bucket name
3. Click **Save & Test**

Alternatively, set them in `.env`:
```bash
nano ~/projects/infinia-rag-demo-v2/backend/.env
```
```
DDN_ENDPOINT_URL=https://your-ddn-endpoint:8111
DDN_ACCESS_KEY_ID=your-access-key
DDN_SECRET_ACCESS_KEY=your-secret-key
DDN_BUCKET_NAME=your-bucket-name
```
Then `pm2 restart infinia-rag-backend`.

> If DDN credentials are not set, the app simulates AWS performance at 35× slower than DDN for demo purposes.

---

## PM2 Management Commands

```bash
pm2 status                        # Overview of all processes
pm2 logs infinia-rag-backend      # Backend logs (live)
pm2 logs infinia-rag-backend --lines 50 --nostream   # Last 50 lines
pm2 logs infinia-rag-frontend     # Frontend logs (live)
pm2 restart infinia-rag-backend   # Restart backend only
pm2 restart all                   # Restart both services
pm2 stop all                      # Stop everything
pm2 monit                         # Live CPU/memory dashboard
pm2 save                          # Save current process list
pm2 resurrect                     # Restore saved list (after WSL restart)
```

---

## Auto-Start After Reboot

**Bare-metal / cloud VMs** (systemd enabled):
```bash
pm2 startup    # Follow the printed command (copy/paste the sudo line)
pm2 save
```

**WSL2** (no systemd by default):
Add to `~/.bashrc` so PM2 restores on every WSL session open:
```bash
echo 'pm2 resurrect 2>/dev/null || true' >> ~/.bashrc
```

---

## File Locations

```
~/projects/infinia-rag-demo-v2/
├── backend/
│   ├── .env                  ← API keys and credentials
│   ├── app/api/routes.py     ← Backend API routes
│   └── venv/                 ← Python virtual environment
├── frontend/
│   └── src/                  ← React source code
├── logs/
│   ├── backend-out.log       ← Backend stdout
│   ├── backend-error.log     ← Backend stderr
│   ├── frontend-out.log      ← Frontend stdout
│   └── frontend-error.log    ← Frontend stderr
├── start_backend.sh          ← PM2 wrapper for uvicorn
└── ecosystem.config.js       ← PM2 process config
```

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---------|-------------|-----|
| `Backend API: Offline` in UI | Backend not started or crashed | `pm2 logs infinia-rag-backend --lines 30 --nostream` |
| `vite: not found` in logs | npm install not run | `cd ~/projects/infinia-rag-demo-v2/frontend && npm install && pm2 restart infinia-rag-frontend` |
| Health check returns 500 | Pydantic validation error | Re-run deploy script or check backend error log |
| `NVIDIA API error` | Invalid or missing API key | Check `.env` → `NVIDIA_API_KEY` |
| `Storage connection failed` | Wrong DDN credentials | Check Configuration page or `.env` |
| Port already in use | Another process on 8000/5174 | `pm2 stop all` then `pm2 start ecosystem.config.js` |
| PyTorch CUDA warning (sm_120) | RTX 5090 — Blackwell arch not in PyTorch 2.1.2 stable | App still works (CPU fallback). Upgrade to PyTorch nightly for full GPU support |

---

## Architecture

```
Windows Browser
      │
      ▼
  localhost:5174  (Vite dev server — React frontend)
      │  /api/* proxy
      ▼
  localhost:8000  (Uvicorn — FastAPI backend)
      │
      ├── FAISS vector store (local, in-memory)
      ├── sentence-transformers (all-MiniLM-L6-v2)
      ├── NVIDIA NIM API  (LLM inference)
      └── DDN INFINIA / AWS S3  (document storage)
```

---

## Source Repository

https://github.com/nasirwasim8/infinia-rag-demo-v2
