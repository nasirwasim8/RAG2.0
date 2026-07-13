import axios from 'axios'

const axiosInstance = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
})

// Types
export interface StorageConfig {
  access_key: string
  secret_key: string
  bucket_name: string
  region: string
  endpoint_url?: string
}

export interface ConversationMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface InfiniaEvent {
  id: number
  type: 'READ' | 'WRITE'
  key: string
  bytes: number
  latency_ms: number
  ts: string  // e.g. "14:01:44.821"
}

export interface QueryRequest {
  query: string
  model?: string
  top_k?: number
  use_reranking?: boolean
  use_guardrails?: boolean
}

export interface QueryResponse {
  success: boolean
  query: string
  response: string
  model_used: string
  retrieved_chunks: Array<{
    content: string
    distance: number
    metadata: Record<string, unknown>
    rerank_score?: number
  }>

  // NEW: Separate TTFB and total query time metrics
  storage_ttfb?: Record<string, number>  // Pure storage download time (ms)
  total_query_time?: Record<string, number>  // Full query time including LLM (ms)

  // DEPRECATED: Legacy field (now contains dict structures)
  provider_times: Record<string, any>

  fastest_provider: string | null
  ttfb_improvement: Record<string, unknown>
  total_time_ms: number
  aws_simulated?: boolean
  simulation_note?: string
}

export interface HealthResponse {
  status: string
  nvidia_configured: boolean
  aws_configured: boolean
  ddn_configured: boolean
  vector_store_chunks: number
  embedding_model: string
  gpu_available: boolean
  gpu_device: string
  gpu_count: number
  gpu_names: string[]
  cuda_version: string
}

export interface MetricsResponse {
  storage: Record<string, unknown>
  retrieval: Record<string, unknown>
  total_operations: number
  ddn_wins?: number
  aws_wins?: number
  storage_summary?: {
    ddn_avg_ttfb?: number
    aws_avg_ttfb?: number
    aws_simulated?: boolean
    total_comparisons?: number
    ddn_infinia_wins?: number
    ddn_infinia_win_rate?: number
    provider_stats?: {
      ddn_infinia?: {
        total_operations: number
        total_time: number
        wins: number
        avg_time: number
      }
      aws?: {
        total_operations: number
        total_time: number
        wins: number
        avg_time: number
      }
    }
  }
  retrieval_summary?: {
    ddn_avg_ttfb?: number
    aws_avg_ttfb?: number
    improvement_percent?: number
    aws_simulated?: boolean
  }
}

export interface ConnectionTestResponse {
  provider: string
  success: boolean
  message: string
  latency_ms?: number
}

export interface DocumentUploadResponse {
  success: boolean
  message: string
  filename: string
  total_chunks: number
  provider_performance: Record<string, unknown>
  aws_simulated?: boolean
  simulation_note?: string
}

export interface LLMMetrics {
  total_queries: number
  avg_ttft_ms: number
  avg_itl_ms: number
  avg_tokens_per_sec: number
  p50_ttft_ms: number
  p95_ttft_ms: number
  p99_ttft_ms: number
}

export interface StorageOpsMetrics {
  ddn_infinia: {
    put_ops_per_sec: number
    get_ops_per_sec: number
    read_throughput_mbps: number
    write_throughput_mbps: number
    put_latency: { p50: number; p95: number; p99: number }
    get_latency: { p50: number; p95: number; p99: number }
    total_operations: number
    success_rate: number
  }
  aws: {
    put_ops_per_sec: number
    get_ops_per_sec: number
    read_throughput_mbps: number
    write_throughput_mbps: number
    put_latency: { p50: number; p95: number; p99: number }
    get_latency: { p50: number; p95: number; p99: number }
    total_operations: number
    success_rate: number
    simulated?: boolean
  }
}


// API Object for easier usage
export const api = {
  // Health
  getHealth: async (): Promise<HealthResponse> => {
    const response = await axiosInstance.get<HealthResponse>('/health')
    return response.data
  },

  // Configuration
  configureAWS: async (config: StorageConfig) => {
    const response = await axiosInstance.post('/config/aws', config)
    return response.data
  },

  configureDDN: async (config: StorageConfig & { endpoint_url: string }) => {
    const response = await axiosInstance.post('/config/ddn', config)
    return response.data
  },

  testConnection: async (provider: 'aws' | 'ddn_infinia'): Promise<ConnectionTestResponse> => {
    const response = await axiosInstance.get<ConnectionTestResponse>(`/config/test/${provider}`)
    return response.data
  },

  getCurrentConfig: async () => {
    const response = await axiosInstance.get('/config/current')
    return response.data
  },

  resetConfiguration: async (provider: 'aws' | 'ddn_infinia' | 'all') => {
    const response = await axiosInstance.delete(`/config/reset/${provider}`)
    return response.data
  },

  // Documents
  uploadDocument: async (formData: FormData): Promise<DocumentUploadResponse> => {
    const response = await axiosInstance.post<DocumentUploadResponse>('/documents/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return response.data
  },

  uploadMultipleDocuments: async (files: File[]) => {
    const formData = new FormData()
    files.forEach((file) => formData.append('files', file))
    const response = await axiosInstance.post('/documents/upload-multiple', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return response.data
  },

  clearDocuments: async () => {
    const response = await axiosInstance.delete('/documents/clear')
    return response.data
  },

  getDocumentCount: async (): Promise<{ total_chunks: number }> => {
    const response = await axiosInstance.get<{ total_chunks: number }>('/documents/count')
    return response.data
  },

  getDocumentList: async (): Promise<{ documents: Array<{ filename: string; chunks: number; timestamp: string; embedding_device: string; embedding_time_ms: number }>; total_chunks: number; count: number }> => {
    const response = await axiosInstance.get('/documents/list')
    return response.data
  },

  coldStartDemo: async (): Promise<{
    success: boolean
    chunks_before: number
    chunks_restored: number
    load_time_ms: number
    load_time_s: number
  }> => {
    const response = await axiosInstance.post('/documents/cold-start-demo')
    return response.data
  },

  // RAG
  query: async (request: QueryRequest): Promise<QueryResponse> => {
    const response = await axiosInstance.post<QueryResponse>('/rag/query', request)
    return response.data
  },

  getAvailableModels: async (): Promise<{ models: string[] }> => {
    const response = await axiosInstance.get<{ models: string[] }>('/rag/models')
    return response.data
  },

  // Metrics
  getMetrics: async (): Promise<MetricsResponse> => {
    const response = await axiosInstance.get<MetricsResponse>('/metrics/')
    return response.data
  },

  getStorageMetrics: async () => {
    const response = await axiosInstance.get('/metrics/storage/')
    return response.data
  },

  getRetrievalMetrics: async () => {
    const response = await axiosInstance.get('/metrics/retrieval/')
    return response.data
  },

  getLLMMetrics: async (): Promise<LLMMetrics> => {
    const response = await axiosInstance.get<LLMMetrics>('/metrics/llm/')
    return response.data
  },

  getStorageOpsMetrics: async (): Promise<StorageOpsMetrics> => {
    const response = await axiosInstance.get<StorageOpsMetrics>('/metrics/storage-ops/')
    return response.data
  },

  clearMetrics: async () => {
    const response = await axiosInstance.delete('/metrics/clear/')
    return response.data
  },

  // Continuous Ingestion
  startMonitoring: async (bucketName: string) => {
    const response = await axiosInstance.post('/ingestion/start', null, {
      params: { bucket_name: bucketName }
    })
    return response.data
  },

  stopMonitoring: async () => {
    const response = await axiosInstance.post('/ingestion/stop')
    return response.data
  },

  getMonitoringStatus: async () => {
    const response = await axiosInstance.get('/ingestion/status')
    return response.data
  },

  getProcessedFiles: async () => {
    const response = await axiosInstance.get('/ingestion/processed-files')
    return response.data
  },

  getIngestionSummary: async () => {
    const response = await axiosInstance.get('/ingestion/summary')
    return response.data
  },

  getDirectoryListing: async () => {
    const response = await axiosInstance.get('/ingestion/directory-listing')
    return response.data
  },

  // Benchmarks
  runBasicBenchmark: async () => {
    const response = await axiosInstance.post('/benchmarks/basic')
    return response.data
  },

  runMultiSizeBenchmark: async () => {
    const response = await axiosInstance.post('/benchmarks/multi-size')
    return response.data
  },

  runScalingBenchmark: async (maxConcurrency: number = 50): Promise<{
    success: boolean
    scale_points: number[]
    ddn_latencies: number[]
    aws_latencies: number[]
    aws_simulated: boolean
  }> => {
    const response = await axiosInstance.post('/benchmarks/scaling', { max_concurrency: maxConcurrency })
    return response.data
  },

  // ── Streaming RAG (SSE via POST) ─────────────────────────────────────────────
  streamRAGQuery: (
    query: string,
    model: string,
    topK: number,
    onStart: (
      ttfbMs: number,
      awsTtfbMs: number,
      chunksFound: number,
      chunks: Array<{ content: string; distance: number; metadata: Record<string, unknown>; chunk_id: string }>,
      providerTimes: Record<string, unknown>,
      fastestProvider: string,
      ttfbImprovement: Record<string, unknown>,
    ) => void,
    onToken: (token: string) => void,
    onDone: (totalTokens: number, elapsedMs: number, tps: number) => void,
    onError: (message: string) => void,
    conversationHistory: ConversationMessage[] = [],
  ): AbortController => {
    const ctrl = new AbortController()
    const url = `/api/rag/stream`

      ; (async () => {
        try {
          const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              query,
              model,
              top_k: topK,
              conversation_history: conversationHistory,
            }),
            signal: ctrl.signal,
          })
          if (!res.ok || !res.body) {
            onError(`HTTP ${res.status}`)
            return
          }
          const reader = res.body.getReader()
          const dec = new TextDecoder()
          let buf = ''
          while (true) {
            const { done, value } = await reader.read()
            if (done) break
            buf += dec.decode(value, { stream: true })
            // Parse SSE lines
            const parts = buf.split('\n\n')
            buf = parts.pop() ?? ''
            for (const part of parts) {
              const lines = part.trim().split('\n')
              let eventType = 'message'
              let dataStr = ''
              for (const line of lines) {
                if (line.startsWith('event:')) eventType = line.slice(6).trim()
                else if (line.startsWith('data:')) dataStr = line.slice(5).trim()
              }
              if (!dataStr) continue
              try {
                const payload = JSON.parse(dataStr)
                if (eventType === 'start') {
                  onStart(
                    payload.ttfb_ms,
                    payload.aws_ttfb_ms,
                    payload.chunks_found,
                    payload.chunks ?? [],
                    payload.provider_times ?? {},
                    payload.fastest_provider ?? 'ddn_infinia',
                    payload.ttfb_improvement ?? {},
                  )
                }
                else if (eventType === 'token') onToken(payload.t)
                else if (eventType === 'done') onDone(payload.total_tokens, payload.elapsed_ms, payload.tps)
                else if (eventType === 'error') onError(payload.message)
              } catch { /* ignore malformed */ }
            }
          }
        } catch (e: unknown) {
          if (e instanceof Error && e.name !== 'AbortError') onError(String(e))
        }
      })()

    return ctrl
  },

  // ── Live Infinia Activity Feed (SSE) ────────────────────────────────────────
  subscribeToInfiniaFeed: (
    lastId: number = 0,
    onEvent: (event: InfiniaEvent) => void,
  ): AbortController => {
    const ctrl = new AbortController()
    ;(async () => {
      try {
        const res = await fetch(`/api/infinia/feed?last_id=${lastId}`, { signal: ctrl.signal })
        if (!res.ok || !res.body) return
        const reader = res.body.getReader()
        const dec = new TextDecoder()
        let buf = ''
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          buf += dec.decode(value, { stream: true })
          const parts = buf.split('\n\n')
          buf = parts.pop() ?? ''
          for (const part of parts) {
            const dataLine = part.split('\n').find(l => l.startsWith('data:'))
            if (!dataLine) continue  // keep-alive comments (': ka') are skipped
            try {
              const event = JSON.parse(dataLine.slice(5).trim()) as InfiniaEvent
              onEvent(event)
            } catch { /* ignore malformed */ }
          }
        }
      } catch (e: unknown) {
        if (e instanceof Error && e.name !== 'AbortError')
          console.warn('Infinia feed disconnected:', e.message)
      }
    })()
    return ctrl
  },
}

// Legacy exports for backward compatibility
export const getHealth = () => axiosInstance.get<HealthResponse>('/health')
export const configureAWS = (config: StorageConfig) => axiosInstance.post('/config/aws', config)
export const configureDDN = (config: StorageConfig & { endpoint_url: string }) => axiosInstance.post('/config/ddn', config)
export const testConnection = (provider: 'aws' | 'ddn_infinia') => axiosInstance.get(`/config/test/${provider}`)
export const uploadDocument = (file: File) => {
  const formData = new FormData()
  formData.append('file', file)
  return axiosInstance.post('/documents/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
}
export const uploadMultipleDocuments = (files: File[]) => {
  const formData = new FormData()
  files.forEach((file) => formData.append('files', file))
  return axiosInstance.post('/documents/upload-multiple', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
}
export const clearDocuments = () => axiosInstance.delete('/documents/clear')
export const getDocumentCount = () => axiosInstance.get<{ total_chunks: number }>('/documents/count')
export const queryRAG = (request: QueryRequest) => axiosInstance.post<QueryResponse>('/rag/query', request)
export const getAvailableModels = () => axiosInstance.get<{ models: string[] }>('/rag/models')
export const getMetrics = () => axiosInstance.get<MetricsResponse>('/metrics/')
export const getStorageMetrics = () => axiosInstance.get('/metrics/storage/')
export const getRetrievalMetrics = () => axiosInstance.get('/metrics/retrieval/')
export const clearMetrics = () => axiosInstance.delete('/metrics/clear/')

export default axiosInstance
