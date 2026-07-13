"""
DDN RAG v2 - FastAPI Backend
A clean, modular RAG application comparing DDN INFINIA vs AWS S3 performance.
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.api.routes import (
    config_router,
    documents_router,
    rag_router,
    metrics_router,
    ingestion_router,
    benchmarks_router,
    health_router
)

# Create FastAPI app
app = FastAPI(
    title="DDN RAG API",
    description="RAG application comparing DDN INFINIA vs AWS S3 storage performance",
    version="2.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(health_router, prefix="/api")
app.include_router(config_router, prefix="/api")
app.include_router(documents_router, prefix="/api")
app.include_router(rag_router, prefix="/api")
app.include_router(metrics_router, prefix="/api")
app.include_router(ingestion_router, prefix="/api")
app.include_router(benchmarks_router, prefix="/api")


@app.get("/")
async def root():
    """Root endpoint."""
    return {
        "name": "DDN RAG API",
        "version": "2.0.0",
        "docs": "/docs",
        "health": "/health"
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8003, reload=True)
