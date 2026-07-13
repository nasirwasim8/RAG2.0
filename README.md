# DDN INFINIA RAG Performance Demo

A high-performance Retrieval-Augmented Generation (RAG) system showcasing DDN INFINIA's storage performance compared to AWS S3, powered by NVIDIA NIM APIs.

## Features

- **Fast Storage Comparison**: Real-time performance metrics comparing DDN INFINIA vs AWS S3
- **NVIDIA NIM Integration**: LLM, Reranking, and Guardrails powered by NVIDIA
- **Optimized Performance**: 
- **Beautiful UI**: Modern React frontend with real-time metrics visualization
- **Continuous Ingestion**: Automatic S3 bucket monitoring and document processing


## Quick Start

### Prerequisites

- Python 3.10+
- Node.js 18+
- NVIDIA NIM API key
- DDN INFINIA storage access (or AWS S3 for comparison)

### 1. Clone Repository

```bash
git clone <your-repo-url>
cd Build.RAG
```

### 2. Backend Setup

```bash
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\\Scripts\\activate

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp ../.env.example .env
# Edit .env with your credentials
```

### 3. Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev
```

### 4. Start Backend

```bash
cd backend
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### 5. Access Application

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8000
- **API Docs**: http://localhost:8000/docs

## ⚙️ Configuration

### Required Environment Variables

```bash
# NVIDIA NIM API (Required)
NVIDIA_API_KEY=your_nvidia_api_key_here

# DDN INFINIA (Required)
DDN_ACCESS_KEY_ID=your_ddn_access_key
DDN_SECRET_ACCESS_KEY=your_ddn_secret_key
DDN_BUCKET_NAME=your-ddn-bucket-name
DDN_ENDPOINT_URL=https://your-ddn-endpoint:8111

# AWS S3 (Optional - for real comparison)
AWS_ACCESS_KEY_ID=your_aws_access_key
AWS_SECRET_ACCESS_KEY=your_aws_secret_key
AWS_BUCKET_NAME=your-bucket-name
```

**Note**: If AWS is not configured, the system will simulate AWS performance (35x slower than DDN).

## 📦 Project Structure

```
Build.RAG/
├── backend/              # FastAPI backend
│   ├── app/
│   │   ├── api/         # API routes
│   │   ├── models/      # Pydantic schemas
│   │   ├── services/    # Business logic
│   │   └── core/        # Configuration
│   └── requirements.txt
├── frontend/            # React frontend
│   ├── src/
│   │   ├── components/  # Reusable components
│   │   ├── pages/       # Page components
│   │   └── services/    # API client
│   └── package.json
├── Logos/              # Brand assets
├── .env.example        # Environment template
└── README.md
```

## Available LLM Models

### Fast Models (~10-15s per query)
- `meta/llama-3.1-8b-instruct` (default)
- `mistralai/mistral-7b-instruct-v0.3`
- `google/gemma-2-9b-it`

### High Quality Models (~35-40s per query)
- `nvidia/nvidia-nemotron-nano-9b-v2`
- `mistralai/mixtral-8x7b-instruct-v0.1`

## 🔧 Development

### Run Tests

```bash
cd backend
pytest
```

### Build for Production

```bash
# Frontend
cd frontend
npm run build

# Backend
cd backend
# Production server (e.g., gunicorn)
gunicorn app.main:app -w 4 -k uvicorn.workers.UvicornWorker
```

## 📖 API Documentation

Interactive API documentation available at:
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## 🏗️ Architecture

### Storage Layer
- **DDN INFINIA**: Primary storage with sub-second retrieval
- **AWS S3**: Optional comparison storage (or simulated) if not configured

### AI/ML Layer
- **Embeddings**: Sentence Transformers
- **Vector Store**: FAISS
- **LLM**: NVIDIA NIM (multiple model options)
- **Reranking**: NVIDIA NeMo Retriever (optional)
- **Guardrails**: NVIDIA Aegis Content Safety (optional)

### Performance Optimizations
1. **Sample-Based AWS Measurement**: Reduces overhead by 80%
2. **Fast Model Selection**: 3x faster query times
3. **Separate TTFB Metrics**: Clear storage performance visibility
4. **Connection Pooling**: Efficient S3 client management

## 🤝 Contributing

Contributions welcome! Please open an issue or submit a pull request.

## 💡 Support

For questions or issues, please contact [nwasim@DDN.com].

---

**Built with ❤️ using DDN INFINIA, NVIDIA NIM, FastAPI, and React**
