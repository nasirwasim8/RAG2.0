import { useState, useEffect, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Send, Loader2, Zap, Shield, ChevronDown, Clock, Trash2, Info, Database, FileText } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { api, getAvailableModels, getHealth, QueryResponse, ConversationMessage, InfiniaEvent } from '../services/api'
import toast from 'react-hot-toast'

// Persist state to localStorage
const getStoredState = <T,>(key: string, defaultValue: T): T => {
  try {
    const item = localStorage.getItem(key)
    return item ? JSON.parse(item) : defaultValue
  } catch {
    return defaultValue
  }
}

// Chat history entry type
interface ChatHistoryEntry {
  query: string
  response: QueryResponse
  timestamp: string
}

export default function ChatPage() {
  const [query, setQuery] = useState(() => getStoredState('rag_chat_query', ''))
  const [useRag, setUseRag] = useState(() => getStoredState('rag_chat_useRag', true))
  const [useReranking, setUseReranking] = useState(() => getStoredState('rag_chat_useReranking', false))
  const [useGuardrails, setUseGuardrails] = useState(() => getStoredState('rag_chat_useGuardrails', false))
  const [selectedModel, setSelectedModel] = useState(() => getStoredState('rag_chat_model', 'nvidia/nvidia-nemotron-nano-9b-v2'))
  const [response, setResponse] = useState<QueryResponse | null>(() => getStoredState('rag_chat_response', null))
  const [chatHistory, setChatHistory] = useState<ChatHistoryEntry[]>(() => getStoredState('rag_chat_history', []))

  // Track if data was loaded from localStorage
  const [hasLoadedHistory, setHasLoadedHistory] = useState(false)
  const [hasLoadedResponse, setHasLoadedResponse] = useState(false)

  // ── Streaming state ─────────────────────────────────────────────────────────
  const [isStreaming, setIsStreaming] = useState(false)
  const [streamingText, setStreamingText] = useState('')
  const [ttftMs, setTtftMs] = useState<number | null>(null)
  const [tpsValue, setTpsValue] = useState<number | null>(null)
  const [streamDdnTtfb, setStreamDdnTtfb] = useState<number | null>(null)
  const [streamAwsTtfb, setStreamAwsTtfb] = useState<number | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const queryStartRef = useRef<number>(0)
  const firstTokenRef = useRef<boolean>(false)
  // Refs to avoid stale-closure problem in onDone callback:
  const ddnTtfbRef = useRef<number>(0)
  const awsTtfbRef = useRef<number>(0)
  const chunksRef = useRef<QueryResponse['retrieved_chunks']>([])
  const providerTimesRef = useRef<Record<string, unknown>>({})
  const fastestProviderRef = useRef<string>('ddn_infinia')
  const ttfbImprovementRef = useRef<Record<string, unknown>>({})

  // ── Conversation memory (multi-turn context, session-only) ───────────────────
  const [conversationMemory, setConversationMemory] = useState<ConversationMessage[]>([])
  // Accumulates full streamed response text to add to conversation memory on done
  const fullResponseRef = useRef<string>('')

  // ── Cold-start demo state ────────────────────────────────────────────────────
  const [isColdStartLoading, setIsColdStartLoading] = useState(false)
  const [coldStartResult, setColdStartResult] = useState<{ chunks_restored: number; load_time_s: number } | null>(null)

  // ── Live Infinia Activity Feed ────────────────────────────────────────────────
  const [infiniaFeedEvents, setInfiniaFeedEvents] = useState<InfiniaEvent[]>([])
  const [showFeed, setShowFeed] = useState(false)
  const feedAbortRef = useRef<AbortController | null>(null)
  const feedTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const feedScrollRef = useRef<HTMLDivElement | null>(null)

  // Persist state changes
  useEffect(() => {
    localStorage.setItem('rag_chat_query', JSON.stringify(query))
  }, [query])

  useEffect(() => {
    localStorage.setItem('rag_chat_useRag', JSON.stringify(useRag))
  }, [useRag])

  useEffect(() => {
    localStorage.setItem('rag_chat_useReranking', JSON.stringify(useReranking))
  }, [useReranking])

  useEffect(() => {
    localStorage.setItem('rag_chat_useGuardrails', JSON.stringify(useGuardrails))
  }, [useGuardrails])

  useEffect(() => {
    localStorage.setItem('rag_chat_model', JSON.stringify(selectedModel))
  }, [selectedModel])

  useEffect(() => {
    localStorage.setItem('rag_chat_response', JSON.stringify(response))
  }, [response])

  useEffect(() => {
    localStorage.setItem('rag_chat_history', JSON.stringify(chatHistory))
  }, [chatHistory])

  // Detect if data was loaded from localStorage on mount
  useEffect(() => {
    const storedHistory = getStoredState('rag_chat_history', [])
    const storedResponse = getStoredState('rag_chat_response', null)

    if (storedHistory.length > 0) {
      setHasLoadedHistory(true)
      toast.success(`Loaded ${storedHistory.length} previous ${storedHistory.length === 1 ? 'query' : 'queries'} from session`, {
        icon: '📋',
        duration: 4000,
        position: 'bottom-right',
      })
    }

    if (storedResponse) {
      setHasLoadedResponse(true)
      toast.success('Previous response restored from session', {
        icon: '💾',
        duration: 4000,
        position: 'bottom-right',
      })
    }
  }, []) // Only run on mount

  // Clear all chat history and localStorage
  const clearChatHistory = () => {
    setChatHistory([])
    setResponse(null)
    setQuery('')

    // Clear all localStorage keys
    localStorage.removeItem('rag_chat_history')
    localStorage.removeItem('rag_chat_response')
    localStorage.removeItem('rag_chat_query')

    setHasLoadedHistory(false)
    setHasLoadedResponse(false)

    toast.success('Chat history cleared', {
      icon: '🗑️',
      duration: 2000,
    })
  }

  // Clear conversation memory (multi-turn context) without clearing display history
  const handleNewConversation = () => {
    setConversationMemory([])
    toast.success('New conversation started — memory cleared', {
      icon: '🔄',
      duration: 2000,
    })
  }

  // Cold-start demo: clear RAM, reload from Infinia, show timing
  const handleColdStart = async () => {
    if (isColdStartLoading) return
    setIsColdStartLoading(true)
    setColdStartResult(null)
    try {
      const result = await api.coldStartDemo()
      setColdStartResult({ chunks_restored: result.chunks_restored, load_time_s: result.load_time_s })
      // Auto-dismiss after 10 seconds
      setTimeout(() => setColdStartResult(null), 10_000)
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      toast.error(detail || 'Cold-start demo failed — ingest documents first')
    } finally {
      setIsColdStartLoading(false)
    }
  }

  const { data: modelsData } = useQuery({
    queryKey: ['models'],
    queryFn: () => getAvailableModels().then((res) => res.data),
  })

  const { data: health } = useQuery({
    queryKey: ['health'],
    queryFn: () => getHealth().then((res) => res.data),
  })

  // Live vector store stats — polls every 15s to reflect newly ingested documents
  const { data: docStats } = useQuery({
    queryKey: ['docListForChat'],
    queryFn: () => api.getDocumentList(),
    refetchInterval: 15_000,
  })

  // Auto-scroll the feed events list whenever new events arrive
  useEffect(() => {
    if (feedScrollRef.current) {
      feedScrollRef.current.scrollTop = feedScrollRef.current.scrollHeight
    }
  }, [infiniaFeedEvents])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!query.trim() || isStreaming) return

    // Cancel any in-flight stream
    if (abortRef.current) abortRef.current.abort()

    // Start Live Infinia Activity Feed
    if (feedAbortRef.current) feedAbortRef.current.abort()
    if (feedTimeoutRef.current) clearTimeout(feedTimeoutRef.current)
    setInfiniaFeedEvents([])
    setShowFeed(true)
    feedAbortRef.current = api.subscribeToInfiniaFeed(0, (event) => {
      setInfiniaFeedEvents(prev => [...prev, event].slice(-20))
    })

    // Reset streaming state
    setIsStreaming(true)
    setStreamingText('')
    setTtftMs(null)
    setTpsValue(null)
    setStreamDdnTtfb(null)
    setStreamAwsTtfb(null)
    setResponse(null)
    queryStartRef.current = Date.now()
    firstTokenRef.current = false
    fullResponseRef.current = ''  // reset response accumulator for memory

    abortRef.current = api.streamRAGQuery(
      query,
      selectedModel,
      5,
      // onStart — storage TTFB + full chunk data arrives
      (ttfbMs, awsTtfbMs, _chunksFound, chunks, providerTimes, fastestProvider, ttfbImprovement) => {
        // Write to both state (display) and refs (closures read refs)
        setStreamDdnTtfb(ttfbMs)
        setStreamAwsTtfb(awsTtfbMs)
        ddnTtfbRef.current = ttfbMs
        awsTtfbRef.current = awsTtfbMs
        chunksRef.current = chunks as QueryResponse['retrieved_chunks']
        providerTimesRef.current = providerTimes
        fastestProviderRef.current = fastestProvider
        ttfbImprovementRef.current = ttfbImprovement
      },
      // onToken — each token
      (token) => {
        if (!firstTokenRef.current) {
          firstTokenRef.current = true
          setTtftMs(Date.now() - queryStartRef.current)
        }
        setStreamingText(prev => prev + token)
        fullResponseRef.current += token  // accumulate for conversation memory
      },
      // onDone — read from refs (not state) to avoid stale closure
      (_totalTokens, elapsedMs, tps) => {
        setTpsValue(tps)
        setIsStreaming(false)
        const ddn = ddnTtfbRef.current
        const aws = awsTtfbRef.current
        const syntheticResponse: QueryResponse = {
          success: true,
          query,
          response: '',   // filled from streamingText in render
          model_used: selectedModel,
          retrieved_chunks: chunksRef.current,
          storage_ttfb: {
            ddn_infinia: ddn,
            aws: aws,
          },
          total_query_time: {
            ddn_infinia: ddn + elapsedMs,
            aws: aws + elapsedMs,
          },
          provider_times: providerTimesRef.current,
          fastest_provider: fastestProviderRef.current,
          ttfb_improvement: ttfbImprovementRef.current,
          total_time_ms: Date.now() - queryStartRef.current,
        }
        setResponse(syntheticResponse)
        const newEntry: ChatHistoryEntry = {
          query,
          response: syntheticResponse,
          timestamp: new Date().toISOString()
        }
        setChatHistory(prev => [newEntry, ...prev].slice(0, 5))
        // Persist
        localStorage.setItem('rag_chat_response', JSON.stringify(syntheticResponse))
        // Update conversation memory (keep last 3 exchanges = 6 messages)
        const assistantText = fullResponseRef.current
        setConversationMemory(prev => [
          ...prev,
          { role: 'user' as const, content: query },
          { role: 'assistant' as const, content: assistantText }
        ].slice(-6))
        // Close feed after 5 seconds so user can read the results
        feedTimeoutRef.current = setTimeout(() => {
          feedAbortRef.current?.abort()
          setShowFeed(false)
        }, 5000)
      },
      // onError
      (message) => {
        setIsStreaming(false)
        feedAbortRef.current?.abort()
        setShowFeed(false)
        toast.error(message)
      },
      conversationMemory,  // pass rolling memory as 8th argument
    )
  }

  return (
    <div className="space-y-6">
      {/* Section Header */}
      <div className="section-header">
        <div className="flex items-center gap-3">
          <h2 className="section-title">RAG Chat</h2>
          <span className="badge badge-nvidia">
            <Zap className="w-3 h-3" />
            NVIDIA NeMo
          </span>
        </div>
        <p className="section-description">
          Query your documents with NVIDIA NeMo reranking and DDN INFINIA acceleration.
        </p>
      </div>

      {/* Live Infinia Storage Stats Bar */}
      {docStats && docStats.total_chunks > 0 && (
        <div className="flex flex-wrap items-center gap-3 px-4 py-2.5 bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-xl text-xs">
          {/* PRIMARY METRIC: chunks stored in Infinia */}
          <div className="flex items-center gap-1.5 text-emerald-700">
            <Database className="w-3.5 h-3.5" />
            <span className="font-black font-mono text-base leading-none">{docStats.total_chunks.toLocaleString()}</span>
            <span className="font-semibold">chunks stored in Infinia</span>
          </div>
          <div className="w-px h-4 bg-emerald-200" />
          {/* Per-document chunk breakdown */}
          {docStats.documents.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap">
              {docStats.documents.slice(0, 4).map((doc: { filename: string; chunks: number }) => (
                <span key={doc.filename} className="flex items-center gap-1 px-2 py-0.5 bg-white border border-emerald-200 text-emerald-700 rounded-md font-medium group">
                  <FileText className="w-3 h-3 shrink-0" />
                  <span className="max-w-[140px] truncate">{doc.filename}</span>
                  <span className="text-emerald-500 font-mono font-bold shrink-0">· {doc.chunks}</span>
                </span>
              ))}
              {docStats.count > 4 && (
                <span className="text-emerald-500 font-medium">+{docStats.count - 4} more</span>
              )}
            </div>
          )}
          {/* Cold-start demo button + live indicator */}
          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={handleColdStart}
              disabled={isColdStartLoading}
              className="flex items-center gap-1 px-2.5 py-1 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white rounded-md text-xs font-semibold transition-colors shadow-sm"
              title="Cold start: clears in-memory FAISS then reloads everything from Infinia"
            >
              {isColdStartLoading ? (
                <><Loader2 className="w-3 h-3 animate-spin" /> Loading from Infinia...</>
              ) : (
                <><Zap className="w-3 h-3" /> Cold Start</>
              )}
            </button>
            <div className="flex items-center gap-1 text-emerald-400">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>Live</span>
            </div>
          </div>
        </div>
      )}

      {/* Cold-Start Demo Result Card */}
      <AnimatePresence>
        {coldStartResult && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: 0.25 }}
            className="flex items-center gap-4 px-5 py-3.5 bg-gradient-to-r from-emerald-600 to-teal-600 rounded-xl text-white shadow-lg"
          >
            <div className="w-9 h-9 rounded-lg bg-white/20 flex items-center justify-center shrink-0">
              <Zap className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-bold text-sm">
                <span className="font-black text-lg">{coldStartResult.chunks_restored.toLocaleString()}</span> chunks restored from Infinia in{' '}
                <span className="font-black text-lg">{coldStartResult.load_time_s}s</span>
              </div>
              <div className="text-emerald-100 text-xs mt-0.5">
                Zero re-indexing. DDN Infinia delivers instant knowledge base recovery after any restart.
              </div>
            </div>
            <button
              onClick={() => setColdStartResult(null)}
              className="text-white/60 hover:text-white text-xl leading-none shrink-0"
              aria-label="Dismiss"
            >×</button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Query Input Card */}
      <div className="card-elevated p-5">
        <form onSubmit={handleSubmit}>
          <div className="relative">
            <textarea
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Ask something about the uploaded documents..."
              rows={3}
              className="input-field pr-14 resize-none"
            />
            <button
              type="submit"
              disabled={isStreaming || !query.trim()}
              className="absolute right-3 bottom-3 w-10 h-10 flex items-center justify-center bg-ddn-red text-white rounded-xl hover:bg-ddn-red-hover disabled:opacity-40 disabled:cursor-not-allowed"
              style={{
                transition: 'all 150ms cubic-bezier(0.16, 1, 0.3, 1)',
              }}
            >
              {isStreaming ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Send className="w-5 h-5" />
              )}
            </button>
          </div>

          {/* Options */}
          <div className="flex flex-wrap items-center gap-4 mt-4 pt-4 border-t border-neutral-100">
            <label className="flex items-center gap-2 cursor-pointer group">
              <input
                type="checkbox"
                checked={useRag}
                onChange={(e) => setUseRag(e.target.checked)}
                className="checkbox-field"
              />
              <span className="text-sm text-neutral-600 group-hover:text-neutral-900">RAG</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer group">
              <input
                type="checkbox"
                checked={useReranking}
                onChange={(e) => setUseReranking(e.target.checked)}
                className="checkbox-field"
              />
              <span className="badge badge-nvidia text-xs">
                <Zap className="w-3 h-3" />
                NeMo Reranker
              </span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer group">
              <input
                type="checkbox"
                checked={useGuardrails}
                onChange={(e) => setUseGuardrails(e.target.checked)}
                className="checkbox-field"
              />
              <span className="badge badge-nvidia text-xs">
                <Shield className="w-3 h-3" />
                NeMo Guardrails
              </span>
            </label>

            <div className="ml-auto flex items-center gap-3">
              <select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                className="select-field text-sm py-2"
                style={{ width: 'auto', minWidth: '180px' }}
              >
                {modelsData?.models.map((model) => (
                  <option key={model} value={model}>
                    {model.split('/').pop()}
                  </option>
                ))}
              </select>

              <button
                type="submit"
                disabled={isStreaming || !query.trim()}
                className="btn-primary"
              >
                {isStreaming ? 'Generating…' : 'Get Answer'}
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* NVIDIA NeMo Status Bar */}
      <div className="toolbar justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className={`status-dot ${health?.nvidia_configured ? 'status-dot-success' : 'status-dot-error'}`} />
            <span className="badge badge-nvidia text-xs">
              <Zap className="w-3 h-3" />
              NeMo Reranker
            </span>
          </div>
          <div className="toolbar-divider" />
          <div className="flex items-center gap-2">
            <div className={`status-dot ${health?.nvidia_configured ? 'status-dot-success' : 'status-dot-error'}`} />
            <span className="badge badge-nvidia text-xs">
              <Shield className="w-3 h-3" />
              NeMo Guardrails
            </span>
          </div>
        </div>
        <span className="badge badge-nvidia text-xs font-mono">
          <Zap className="w-3 h-3" />
          Nemotron 70B
        </span>

        {/* Clear History + New Conversation buttons */}
        {(chatHistory.length > 0 || response || conversationMemory.length > 0) && (
          <div className="flex items-center gap-2">
            {conversationMemory.length > 0 && (
              <button
                onClick={handleNewConversation}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors border border-blue-200"
                title="Clear conversation memory and start fresh (keeps display history)"
              >
                <span>🔄</span>
                <span>New Conversation</span>
                <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded-full font-mono font-bold">{conversationMemory.length / 2}</span>
              </button>
            )}
            {(chatHistory.length > 0 || response) && (
              <button
                onClick={clearChatHistory}
                className="flex items-center gap-2 px-3 py-1.5 text-xs text-neutral-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                title="Clear all chat history and responses"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Clear History
              </button>
            )}
          </div>
        )}
      </div>

      {/* Chat History with Visual Indicator */}
      {chatHistory.length > 0 && (
        <div className="space-y-2">
          {hasLoadedHistory && (
            <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700">
              <Info className="w-4 h-4" />
              <span>Previous queries loaded from session storage</span>
            </div>
          )}
          <ChatHistory history={chatHistory} onSelectQuery={(selectedQuery) => setQuery(selectedQuery)} />
        </div>
      )}

      {/* ── Streaming Response (live) ── */}
      {isStreaming && streamingText && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4"
        >
          {/* Live TTFB banner once first token arrived */}
          {streamDdnTtfb !== null && (
            <div className="status-banner-ddn p-4">
              <div className="flex items-center gap-6">
                <div>
                  <div className="text-xs opacity-70 uppercase tracking-wide mb-1">Retrieval TTFB</div>
                  <div className="flex items-center gap-4">
                    <span className="text-xl font-bold">{streamDdnTtfb.toFixed(0)}ms</span>
                    <span className="opacity-60 text-sm">DDN INFINIA</span>
                    <span className="text-lg opacity-40">vs</span>
                    <span className="text-lg opacity-60">{streamAwsTtfb?.toFixed(0) ?? '—'}ms</span>
                    <span className="opacity-50 text-sm">AWS S3</span>
                  </div>
                </div>
                {ttftMs !== null && (
                  <div className="ml-auto flex items-center gap-2 bg-white/20 backdrop-blur rounded-xl px-3 py-2">
                    {/* SVG clock icon */}
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                      <circle cx="12" cy="12" r="10" />
                      <polyline points="12 6 12 12 16 14" />
                    </svg>
                    <span className="text-sm font-semibold">First token: {ttftMs}ms</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Streaming text card */}
          <div className="card-elevated p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xs font-medium text-neutral-500 uppercase tracking-wide">Generating Response</h3>
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 bg-ddn-red rounded-full animate-pulse" />
                <span className="text-xs text-ddn-red font-medium">Streaming</span>
              </div>
            </div>
            <p className="text-neutral-800 whitespace-pre-wrap leading-relaxed text-[15px]">
              {streamingText}
              <span className="inline-block w-0.5 h-4 bg-ddn-red ml-0.5 animate-pulse" />
            </p>
          </div>
        </motion.div>
      )}

      {/* Response */}
      <AnimatePresence>
        {response && !isStreaming && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="space-y-5"
          >
            {/* Visual Indicator for Loaded Response */}
            {hasLoadedResponse && (
              <div className="flex items-center gap-2 px-4 py-2 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
                <Info className="w-4 h-4" />
                <span>Response restored from session storage</span>
              </div>
            )}

            {/* Performance comparison */}
            <PerformanceComparison response={response} />

            {/* Answer */}
            <div className="card-elevated p-6">
              <h3 className="text-xs font-medium text-neutral-500 uppercase tracking-wide mb-4">Response</h3>
              <div className="prose prose-neutral prose-sm max-w-none">
                <p className="text-neutral-800 whitespace-pre-wrap leading-relaxed text-[15px]">{streamingText || response.response}</p>
              </div>

              {/* Sources referenced */}
              {(() => {
                const sources = [...new Set(
                  response.retrieved_chunks
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    .map((c) => (c.metadata as any)?.source as string | undefined)
                    .filter((s): s is string => Boolean(s))
                )]
                if (!sources.length) return null
                return (
                  <div className="flex flex-wrap items-center gap-2 mt-4 pt-4 border-t border-neutral-100">
                    <span className="text-xs text-neutral-500 font-semibold uppercase tracking-wide shrink-0">Sources:</span>
                    {sources.map((src) => (
                      <span key={src} className="flex items-center gap-1 px-2 py-1 bg-blue-50 border border-blue-100 text-blue-700 rounded-lg text-xs font-medium">
                        <FileText className="w-3 h-3" />
                        {src}
                      </span>
                    ))}
                  </div>
                )
              })()}

              {/* ── TPS + TTFT badges ── */}
              {(tpsValue !== null || ttftMs !== null) && (
                <div className="flex flex-wrap gap-3 mt-5 pt-4 border-t border-neutral-100">
                  {tpsValue !== null && (
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-red-50 border border-red-100">
                      {/* SVG lightning bolt */}
                      <svg className="w-3.5 h-3.5 text-ddn-red" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                      </svg>
                      <span className="text-sm font-bold text-ddn-red font-mono">{tpsValue.toFixed(0)} tok/sec</span>
                    </div>
                  )}
                  {ttftMs !== null && (
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-blue-50 border border-blue-100">
                      {/* SVG clock */}
                      <svg className="w-3.5 h-3.5 text-blue-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                        <circle cx="12" cy="12" r="10" />
                        <polyline points="12 6 12 12 16 14" />
                      </svg>
                      <span className="text-sm font-semibold text-blue-700 font-mono">First token: {ttftMs}ms</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Retrieved chunks */}
            {response.retrieved_chunks.length > 0 && (
              <RetrievedChunks chunks={response.retrieved_chunks} />
            )}

            {/* Performance metrics */}
            <div className="card p-5">
              <h3 className="text-xs font-medium text-neutral-500 uppercase tracking-wide mb-4">Performance Metrics</h3>
              <div className="grid grid-cols-2 md:grid-cols-7 gap-4">
                <div>
                  <div className="text-xs text-neutral-500 mb-1">Total Time</div>
                  <div className="text-lg font-semibold text-neutral-900 font-mono">{((response.total_time_ms ?? 0) / 1000).toFixed(1)}s</div>
                </div>

                <div>
                  <div className="text-xs text-neutral-500 mb-1">DDN TTFB</div>
                  <div className="text-lg font-semibold text-ddn-red font-mono">{(response.storage_ttfb?.ddn_infinia ?? 0).toFixed(0)}ms</div>
                </div>
                <div>
                  <div className="text-xs text-neutral-500 mb-1">DDN Total</div>
                  <div className="text-lg font-semibold text-ddn-red font-mono">{(response.total_query_time?.ddn_infinia ?? 0).toFixed(0)}ms</div>
                </div>
                <div>
                  <div className="text-xs text-neutral-500 mb-1">AWS TTFB</div>
                  <div className="text-lg font-semibold text-neutral-500 font-mono">{(response.storage_ttfb?.aws ?? 0).toFixed(0)}ms</div>
                </div>
                <div>
                  <div className="text-xs text-neutral-500 mb-1">AWS Total</div>
                  <div className="text-lg font-semibold text-neutral-500 font-mono">{(response.total_query_time?.aws ?? 0).toFixed(0)}ms</div>
                </div>
                <div>
                  <div className="text-xs text-neutral-500 mb-1">Winner</div>
                  <div className="flex items-center h-8">
                    {response.fastest_provider === 'ddn_infinia' ? (
                      <img src="/logo-ddn.svg" alt="DDN" className="h-5 w-auto" />
                    ) : (
                      <span className="text-lg font-semibold text-status-success">{response.fastest_provider ?? '—'}</span>
                    )}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-neutral-500 mb-1">Chunks</div>
                  <div className="text-lg font-semibold text-neutral-900">{response.retrieved_chunks?.length ?? 0}</div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Initial state message */}
      {!response && !isStreaming && !streamingText && (
        <div className="card-inset p-8 text-center">
          <div className="w-12 h-12 rounded-2xl bg-neutral-200/50 flex items-center justify-center mx-auto mb-4">
            <Send className="w-5 h-5 text-neutral-400" />
          </div>
          <p className="text-neutral-500">Ask a question to see the AI response</p>
          <p className="text-sm text-neutral-400 mt-1">DDN INFINIA-accelerated retrieval</p>
        </div>
      )}
    </div>
  )
}

function PerformanceComparison({ response }: { response: QueryResponse }) {
  const awsTime = response.storage_ttfb?.aws ?? 0
  const ddnTime = response.storage_ttfb?.ddn_infinia ?? 0
  const ddnFaster = ddnTime < awsTime && ddnTime > 0
  const speedup = ddnFaster && ddnTime > 0 ? awsTime / ddnTime : 0

  return (
    <div className="status-banner-ddn p-5">
      <div className="flex items-center justify-between w-full">
        <div>
          <div className="text-xs font-medium opacity-70 uppercase tracking-wide mb-2">
            Retrieval Performance
          </div>
          <div className="flex items-center gap-6">
            <div>
              <span className="text-2xl font-bold">{ddnTime.toFixed(0)}ms</span>
              <span className="text-sm opacity-70 ml-2">DDN INFINIA</span>
            </div>
            <div className="opacity-40 text-lg">vs</div>
            <div className="opacity-60">
              <span className="text-xl font-semibold">{awsTime.toFixed(0)}ms</span>
              <span className="text-sm opacity-70 ml-2">AWS S3</span>
            </div>
          </div>
        </div>

        {ddnFaster && speedup > 1 && (
          <div
            className="flex items-center gap-3 backdrop-blur px-4 py-2.5 rounded-xl shadow-sm"
            style={{ background: 'var(--surface-card)', opacity: 0.95 }}
          >
            <Zap className="w-5 h-5 text-ddn-red" />
            <div>
              <span className="text-xl font-bold text-ddn-red">{speedup.toFixed(1)}x</span>
              <span className="text-sm ml-1.5" style={{ color: 'var(--text-secondary)' }}>faster</span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function RetrievedChunks({ chunks }: { chunks: QueryResponse['retrieved_chunks'] }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="card overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-5 py-4 flex items-center justify-between transition-colors"
        style={{ transition: 'background-color 150ms ease' }}
        onMouseEnter={(e) => e.currentTarget.style.background = 'var(--surface-secondary)'}
        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: 'var(--surface-secondary)' }}
          >
            <span className="text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>{chunks.length}</span>
          </div>
          <span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Retrieved Chunks</span>
        </div>
        <ChevronDown
          className="w-5 h-5 transition-transform duration-200"
          style={{
            color: 'var(--text-muted)',
            transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)'
          }}
        />
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-5 space-y-3 border-t border-neutral-100 pt-4">
              {/* Unique sources summary when chunks come from multiple docs */}
              {(() => {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const sources = [...new Set(chunks.map(c => (c.metadata as any)?.source as string | undefined).filter(Boolean))] as string[]
                if (sources.length <= 1) return null
                return (
                  <div className="flex flex-wrap items-center gap-1.5 pb-3 border-b border-neutral-100">
                    <span className="text-xs text-neutral-400 font-semibold uppercase tracking-wide">From:</span>
                    {sources.map(src => (
                      <span key={src} className="flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-600 border border-blue-100 rounded-md text-xs font-medium">
                        <FileText className="w-3 h-3" />
                        {src}
                      </span>
                    ))}
                  </div>
                )
              })()}
              {chunks.map((chunk, i) => (
                <div
                  key={i}
                  className="p-4 bg-surface-secondary rounded-xl"
                >
                  <div className="flex items-center gap-2 mb-3 flex-wrap">
                    <span className="w-6 h-6 rounded-md bg-neutral-200 flex items-center justify-center text-xs font-semibold text-neutral-600 shrink-0">
                      {i + 1}
                    </span>
                    <span className="badge badge-neutral text-xs">
                      Distance: {chunk.distance.toFixed(4)}
                    </span>
                    {/* Source filename badge */}
                    {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                    {(chunk.metadata as any)?.source && (
                      <span className="flex items-center gap-1 px-2 py-0.5 bg-blue-50 border border-blue-100 text-blue-600 rounded-md text-xs font-medium">
                        <FileText className="w-3 h-3" />
                        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                        {(chunk.metadata as any).source}
                      </span>
                    )}
                    {chunk.rerank_score && (
                      <span className="badge badge-nvidia text-xs">
                        Rerank: {chunk.rerank_score.toFixed(2)}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-neutral-700 leading-relaxed line-clamp-3">
                    {chunk.content}
                  </p>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function ChatHistory({ history, onSelectQuery }: { history: ChatHistoryEntry[], onSelectQuery: (query: string) => void }) {
  const [expanded, setExpanded] = useState(false)

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    const diffHours = Math.floor(diffMins / 60)
    if (diffHours < 24) return `${diffHours}h ago`
    const diffDays = Math.floor(diffHours / 24)
    return `${diffDays}d ago`
  }

  return (
    <div className="card overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-5 py-4 flex items-center justify-between transition-colors"
        style={{ transition: 'background-color 150ms ease' }}
        onMouseEnter={(e) => e.currentTarget.style.background = 'var(--surface-secondary)'}
        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: 'var(--surface-secondary)' }}
          >
            <Clock className="w-4 h-4" style={{ color: 'var(--text-secondary)' }} />
          </div>
          <span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
            Previous Queries ({history.length})
          </span>
        </div>
        <ChevronDown
          className="w-5 h-5 transition-transform duration-200"
          style={{
            color: 'var(--text-muted)',
            transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)'
          }}
        />
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-5 space-y-3 border-t border-neutral-100 pt-4">
              {history.map((entry, i) => (
                <div
                  key={i}
                  className="p-4 bg-surface-secondary rounded-xl hover:bg-neutral-100 transition-colors cursor-pointer"
                  onClick={() => {
                    onSelectQuery(entry.query)
                    setExpanded(false)
                  }}
                >
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <span className="badge badge-neutral text-xs">
                      {formatTimestamp(entry.timestamp)}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-neutral-500">
                        {(entry.response.storage_ttfb?.ddn_infinia ?? 0).toFixed(0)}ms
                      </span>
                      {entry.response.fastest_provider === 'ddn_infinia' && (
                        <Zap className="w-3 h-3 text-ddn-red" />
                      )}
                    </div>
                  </div>
                  <p className="text-sm font-medium text-neutral-800 mb-2 line-clamp-2">
                    {entry.query}
                  </p>
                  <p className="text-xs text-neutral-600 line-clamp-2 leading-relaxed">
                    {entry.response.response}
                  </p>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Live Infinia Activity Feed Overlay (fixed, slides in from right) ── */}
      <AnimatePresence>
        {showFeed && (
          <motion.div
            initial={{ opacity: 0, x: 60 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 60 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            className="fixed right-5 top-1/2 -translate-y-1/2 w-80 z-50"
          >
            <div className="bg-gray-950/95 backdrop-blur-xl border border-emerald-500/40 rounded-2xl shadow-2xl overflow-hidden">
              {/* Header */}
              <div className="flex items-center gap-2 px-4 py-3 border-b border-emerald-500/20 bg-emerald-950/50">
                <div className="relative flex items-center justify-center w-3 h-3">
                  <div className="w-2 h-2 rounded-full bg-emerald-400 animate-ping absolute opacity-60" />
                  <div className="w-2 h-2 rounded-full bg-emerald-400 relative" />
                </div>
                <span className="text-emerald-300 text-xs font-bold tracking-widest uppercase ml-1">Infinia Activity</span>
                <div className="ml-auto flex items-center gap-2">
                  <span className="text-gray-500 text-xs font-mono tabular-nums">{infiniaFeedEvents.length} ops</span>
                  <button
                    onClick={() => { setShowFeed(false); feedAbortRef.current?.abort() }}
                    className="text-gray-600 hover:text-gray-300 text-lg leading-none transition-colors"
                    aria-label="Close"
                  >×</button>
                </div>
              </div>

              {/* Events scroll area */}
              <div ref={feedScrollRef} className="h-60 overflow-y-auto p-2 space-y-0.5 bg-gray-950/60">
                {infiniaFeedEvents.length === 0 ? (
                  <div className="flex items-center gap-2 px-3 py-5 text-gray-500 text-xs">
                    <Loader2 className="w-3 h-3 animate-spin text-emerald-500 shrink-0" />
                    <span>Waiting for Infinia operations…</span>
                  </div>
                ) : (
                  infiniaFeedEvents.map((event) => (
                    <motion.div
                      key={event.id}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.12 }}
                      className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-mono ${
                        event.type === 'READ'
                          ? 'bg-blue-500/10 border border-blue-500/15'
                          : 'bg-emerald-500/10 border border-emerald-500/15'
                      }`}
                    >
                      <span className="text-sm shrink-0">
                        {event.type === 'READ' ? '📖' : '✍️'}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className={`truncate ${
                          event.type === 'READ' ? 'text-blue-300' : 'text-emerald-300'
                        }`}>
                          {event.key.split('/').pop() ?? event.key}
                        </div>
                        <div className="text-gray-600 text-[10px]">
                          {(event.bytes / 1024).toFixed(1)} KB · {event.ts}
                        </div>
                      </div>
                      <span className={`shrink-0 font-bold tabular-nums ${
                        event.latency_ms < 20 ? 'text-emerald-400' :
                        event.latency_ms < 60 ? 'text-yellow-400' : 'text-red-400'
                      }`}>
                        {event.latency_ms}ms
                      </span>
                    </motion.div>
                  ))
                )}
              </div>

              {/* Summary footer */}
              {infiniaFeedEvents.length > 0 && (() => {
                const totalKB  = infiniaFeedEvents.reduce((s, e) => s + e.bytes, 0) / 1024
                const avgLat   = infiniaFeedEvents.reduce((s, e) => s + e.latency_ms, 0) / infiniaFeedEvents.length
                const reads    = infiniaFeedEvents.filter(e => e.type === 'READ').length
                const writes   = infiniaFeedEvents.filter(e => e.type === 'WRITE').length
                return (
                  <div className="border-t border-emerald-500/20 bg-gray-950/80 px-4 py-2.5 grid grid-cols-3 gap-2 text-center">
                    <div>
                      <div className="text-white font-bold text-sm font-mono">{infiniaFeedEvents.length}</div>
                      <div className="text-gray-500 text-[10px]">{reads}R / {writes}W</div>
                    </div>
                    <div>
                      <div className="text-white font-bold text-sm font-mono">{totalKB.toFixed(1)}</div>
                      <div className="text-gray-500 text-[10px]">KB total</div>
                    </div>
                    <div>
                      <div className="text-emerald-400 font-bold text-sm font-mono">{avgLat.toFixed(1)}ms</div>
                      <div className="text-gray-500 text-[10px]">avg latency</div>
                    </div>
                  </div>
                )
              })()}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
