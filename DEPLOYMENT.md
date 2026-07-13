# Quick Start Guide - 5 Minutes to Deploy

## Prerequisites

- Python 3.10+
- Node.js 18+
- NVIDIA NIM API key ([Get one here](https://build.nvidia.com))
- DDN INFINIA storage access (or AWS S3 for comparison)

---

## Step 1: Clone & Setup (2 min)

```bash
# Clone the repository
git clone https://github.com/nasirwasim8/infinia-rag-demo-v2.git
cd infinia-rag-demo-v2

# Create environment file
cp .env.example .env
```

**Edit `.env`** with your credentials:
```bash
NVIDIA_API_KEY=your_nvidia_api_key_here
DDN_ENDPOINT_URL=https://your-ddn-endpoint:8111
DDN_ACCESS_KEY_ID=your_ddn_access_key
DDN_SECRET_ACCESS_KEY=your_ddn_secret_key
DDN_BUCKET_NAME=your-bucket-name
```

> **Note**: AWS S3 is optional. If not configured, the system will simulate AWS performance (35x slower than DDN).

---

## Step 2: Start Backend (1 min)

```bash
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Start server
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

✅ Backend running at: **http://localhost:8000**

---

## Step 3: Start Frontend (1 min)

Open a new terminal:

```bash
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev
```

✅ Frontend running at: **http://localhost:3000**

---

## Step 4: Test the Application (1 min)

1. **Open browser**: http://localhost:3000
2. **Configure Storage** (if needed):
   - Go to "Configuration" page
   - Enter DDN INFINIA credentials
   - (Optional) Enter AWS S3 credentials
3. **Upload a document**:
   - Go to "Documents" page
   - Upload a PDF or DOCX file
4. **Ask a question**:
   - Go to "RAG Chat" page
   - Type a question about your document
   - View performance comparison!

---

## What You'll See

### Performance Comparison

- **DDN INFINIA TTFB**: 
- **AWS S3 TTFB**: 
- **Total Query Time**:

### Available LLM Models

- `meta/llama-3.1-8b-instruct`  (default, fastest)
- `mistralai/mistral-7b-instruct-v0.3` 
- `google/gemma-2-9b-it` 
- `nvidia/nvidia-nemotron-nano-9b-v2` (higher quality)
- `mistralai/mixtral-8x7b-instruct-v0.1` (best quality)

---

## GPU Acceleration (Optional)

If you have an NVIDIA GPU:

1. Install CUDA toolkit
2. Install PyTorch with CUDA support:
   ```bash
   pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu118
   ```
3. Restart backend

**GPU Benefits**:
- 10x faster embeddings
- 5x faster queries
- Higher throughput

---

## Troubleshooting

### "NVIDIA API error"
- Verify your API key at https://build.nvidia.com
- Check internet connection

### "Storage connection failed"
- Verify DDN endpoint URL is accessible
- Check credentials in `.env` file

### "Module not found"
- Reinstall dependencies: `pip install -r requirements.txt` (backend) or `npm install` (frontend)

---

## Production Deployment

For production deployment, see:
- **[DEPLOYMENT.md](./DEPLOYMENT.md)** - Full deployment guide
- **[ARCHITECTURE.md](./ARCHITECTURE.md)** - System architecture

**Quick Options**:
- **Docker**: Use Docker Compose
- **Cloud**: AWS EB, Google Cloud Run, Azure App Service
- **VPS**: DigitalOcean, Linode, Vultr

---

## Next Steps

-  Read [ARCHITECTURE.md](./ARCHITECTURE.md) for system design
- Check [DEPLOYMENT.md](./DEPLOYMENT.md) for production setup
-  Explore performance metrics in the Dashboard
-  Configure continuous ingestion for auto-processing

---

## Support

- **Documentation**: See README.md
- **API Docs**: http://localhost:8000/docs
- **GitHub Issues**: [Report a bug](https://github.com/nasirwasim8/infinia-rag-demo-v2/issues)

---

**That's it! You're ready to demo DDN INFINIA's performance advantage!** 🎉
