"""
Pydantic schemas for API request/response models.
"""
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field


# Storage Configuration
class AWSConfigRequest(BaseModel):
    access_key: str
    secret_key: str
    bucket_name: str
    region: str = "us-east-1"
    endpoint_url: Optional[str] = None


class DDNConfigRequest(BaseModel):
    access_key: str
    secret_key: str
    bucket_name: str
    endpoint_url: str
    region: str = "us-east-1"


class StorageConfigRequest(BaseModel):
    aws: Optional[AWSConfigRequest] = None
    ddn: Optional[DDNConfigRequest] = None


class StorageConfigResponse(BaseModel):
    success: bool
    message: str
    aws_configured: bool = False
    ddn_configured: bool = False


class ConnectionTestResponse(BaseModel):
    provider: str
    success: bool
    message: str
    latency_ms: Optional[float] = None


# Document Processing
class ChunkInfo(BaseModel):
    content: str
    chunk_id: str
    metadata: Dict[str, Any]


class DocumentUploadResponse(BaseModel):
    success: bool
    message: str
    filename: str
    total_chunks: int
    provider_performance: Dict[str, Dict[str, Any]]
    aws_simulated: bool = False
    simulation_note: Optional[str] = None
    embedding_time_ms: Optional[float] = None   # Time to generate all embeddings
    embedding_device: Optional[str] = None       # 'cuda' or 'cpu'


class DocumentListResponse(BaseModel):
    total_documents: int
    total_chunks: int
    documents: List[Dict[str, Any]]


# RAG Query
class QueryRequest(BaseModel):
    query: str
    model: str = "nvidia/nvidia-nemotron-nano-9b-v2"
    top_k: int = Field(default=5, ge=1, le=20)
    use_reranking: bool = True
    use_guardrails: bool = True


class RetrievedChunk(BaseModel):
    content: str
    distance: float
    metadata: Dict[str, Any]
    rerank_score: Optional[float] = None


class QueryResponse(BaseModel):
    success: bool
    query: str
    response: str
    model_used: str
    retrieved_chunks: List[RetrievedChunk]
    
    # NEW: Separate TTFB and total query time metrics
    storage_ttfb: Dict[str, float] = Field(default_factory=dict, description="Storage retrieval time (download only) per provider in ms")
    total_query_time: Dict[str, float] = Field(default_factory=dict, description="Total query time (retrieval + LLM) per provider in ms")
    
    # DEPRECATED: Keep for backward compatibility
    provider_times: Dict[str, Any] = Field(default_factory=dict, description="Legacy timing data")
    
    fastest_provider: Optional[str]
    ttfb_improvement: Dict[str, Any]
    guardrails_check: Optional[Dict[str, Any]] = None
    total_time_ms: float
    aws_simulated: bool = False
    simulation_note: Optional[str] = None


# Metrics
class ProviderStats(BaseModel):
    total_operations: int
    avg_time: float
    wins: int
    win_rate: float


class MetricsResponse(BaseModel):
    storage_summary: Dict[str, Any]
    retrieval_summary: Dict[str, Any]
    total_operations: int


# Health
class HealthResponse(BaseModel):
    status: str
    nvidia_configured: bool
    aws_configured: bool
    ddn_configured: bool
    vector_store_chunks: int
    embedding_model: str
    gpu_available: bool = False
    gpu_device: str = "cpu"
    gpu_count: int = 0
    gpu_names: List[str] = []
    cuda_version: str = "N/A"


# Streaming
class StreamToken(BaseModel):
    token: str
    done: bool = False


# Error
class ErrorResponse(BaseModel):
    error: str
    detail: Optional[str] = None
