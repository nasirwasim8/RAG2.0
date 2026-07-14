import { useState, useRef, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Loader2, Shield, User, Lock, Zap, Database, ChevronRight, RefreshCw, CheckCircle, FileText } from 'lucide-react'
import { api } from '../services/api'
import toast from 'react-hot-toast'

// ── Types ────────────────────────────────────────────────────────────────────

interface StreamResult {
  text: string
  isDone: boolean
  isAccessDenied: boolean
  accessDeniedMsg: string
  chunksFound: number
  ttfbMs: number | null
}

const EMPTY_RESULT: StreamResult = {
  text: '',
  isDone: false,
  isAccessDenied: false,
  accessDeniedMsg: '',
  chunksFound: 0,
  ttfbMs: null,
}

// ── Sample demo questions ────────────────────────────────────────────────────

const DEMO_QUESTIONS = [
  { label: 'Confidential', q: 'What are the Q4 financial projections and revenue targets?' },
  { label: 'Confidential', q: 'What is the internal M&A strategy and acquisition roadmap?' },
  { label: 'Confidential', q: 'What are the executive compensation details?' },
  { label: 'Public', q: 'What are the main product features and capabilities?' },
  { label: 'Public', q: 'What does the documentation say about system requirements?' },
]

// ── Persona config ───────────────────────────────────────────────────────────

const STD = {
  name: 'Alex Chen',
  role: 'standard' as const,
  title: 'Standard User',
  dept: 'Engineering',
  initials: 'AC',
  avatarBg: 'bg-blue-600',
  ringClass: 'ring-blue-400/40',
  headerBg: 'bg-gradient-to-r from-blue-950/70 to-slate-900/60',
  panelBg: 'bg-gradient-to-b from-blue-950/20 to-slate-950',
  borderClass: 'border-blue-500/20',
  badgeBg: 'bg-blue-500/10 border-blue-400/30',
  badgeText: 'text-blue-300',
  accentText: 'text-blue-400',
  cursorClass: 'bg-blue-400',
}

const EXEC = {
  name: 'Sarah Mitchell',
  role: 'admin' as const,
  title: 'Executive Access',
  dept: 'C-Suite / CISO',
  initials: 'SM',
  avatarBg: 'bg-amber-600',
  ringClass: 'ring-amber-400/40',
  headerBg: 'bg-gradient-to-r from-amber-950/70 to-slate-900/60',
  panelBg: 'bg-gradient-to-b from-amber-950/20 to-slate-950',
  borderClass: 'border-amber-500/20',
  badgeBg: 'bg-amber-500/10 border-amber-400/30',
  badgeText: 'text-amber-300',
  accentText: 'text-amber-400',
  cursorClass: 'bg-amber-400',
}

// ── Main page ────────────────────────────────────────────────────────────────

export default function RBACDemo() {
  const [query, setQuery] = useState('')
  const [isQuerying, setIsQuerying] = useState(false)
  const [hasQueried, setHasQueried] = useState(false)
  const [stdResult, setStdResult] = useState<StreamResult>(EMPTY_RESULT)
  const [execResult, setExecResult] = useState<StreamResult>(EMPTY_RESULT)
  const [selectedModel] = useState('llama-3.1-8b-instruct')

  const stdAbort = useRef<AbortController | null>(null)
  const execAbort = useRef<AbortController | null>(null)

  // ── Doc list (plain fetch) ───────────────────────────────────────────────
  const [docList, setDocList] = useState<{ documents: { filename: string; chunks: number }[] } | null>(null)

  const fetchDocs = useCallback(() => {
    fetch('/api/documents/list').then(r => r.json()).then(setDocList).catch(() => {})
  }, [])

  useEffect(() => { fetchDocs(); const t = setInterval(fetchDocs, 30_000); return () => clearInterval(t) }, [fetchDocs])

  // ── Reclassify (plain fetch) ──────────────────────────────────────────
  const [reclassifyState, setReclassifyState] = useState<'idle' | 'pending' | 'done'>('idle')

  const handleReclassify = async () => {
    setReclassifyState('pending')
    try {
      const data = await fetch('/api/documents/reclassify', { method: 'POST' }).then(r => r.json())
      toast.success(`Reclassified ${data.chunks_updated} chunks — saved to Infinia`, { icon: '🔐' })
      setReclassifyState('done')
      fetchDocs()
    } catch {
      toast.error('Reclassify failed')
      setReclassifyState('idle')
    }
  }

  const handleAsk = () => {
    if (!query.trim() || isQuerying) return

    stdAbort.current?.abort()
    execAbort.current?.abort()

    setIsQuerying(true)
    setHasQueried(true)
    setStdResult({ ...EMPTY_RESULT })
    setExecResult({ ...EMPTY_RESULT })

    let stdDone = false
    let execDone = false
    const checkBothDone = () => { if (stdDone && execDone) setIsQuerying(false) }

    // ── Standard user query ──────────────────────────────────────────────────
    stdAbort.current = api.streamRAGQuery(
      query, selectedModel, 5,
      (_ttfb, _aws, chunksFound) => {
        setStdResult(prev => ({ ...prev, chunksFound: chunksFound ?? 0, ttfbMs: _ttfb }))
      },
      (token) => {
        setStdResult(prev => ({ ...prev, text: prev.text + token }))
      },
      () => {
        setStdResult(prev => ({ ...prev, isDone: true }))
        stdDone = true
        checkBothDone()
      },
      (msg) => {
        if (msg.startsWith('[ACCESS_DENIED]')) {
          setStdResult(prev => ({
            ...prev,
            isDone: true,
            isAccessDenied: true,
            accessDeniedMsg: msg.replace('[ACCESS_DENIED] ', ''),
          }))
        } else {
          setStdResult(prev => ({ ...prev, isDone: true, text: msg }))
          toast.error(`Standard user: ${msg}`)
        }
        stdDone = true
        checkBothDone()
      },
      [],        // no conversation history
      'standard', // RBAC role
    )

    // ── Executive user query ─────────────────────────────────────────────────
    execAbort.current = api.streamRAGQuery(
      query, selectedModel, 5,
      (_ttfb, _aws, chunksFound) => {
        setExecResult(prev => ({ ...prev, chunksFound: chunksFound ?? 0, ttfbMs: _ttfb }))
      },
      (token) => {
        setExecResult(prev => ({ ...prev, text: prev.text + token }))
      },
      () => {
        setExecResult(prev => ({ ...prev, isDone: true }))
        execDone = true
        checkBothDone()
      },
      (msg) => {
        setExecResult(prev => ({ ...prev, isDone: true, text: msg }))
        execDone = true
        checkBothDone()
      },
      [],     // no conversation history
      'admin', // RBAC role
    )
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAsk() }
  }

  return (
    <div className="flex flex-col gap-0 -mx-6 -my-8 min-h-[calc(100vh-var(--nav-height)-4rem)]">

      {/* ── Setup / status bar ────────────────────────────────────────────── */}
      <div className="px-6 py-3 bg-slate-900/80 border-b border-white/5 flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <Shield className="w-3.5 h-3.5 text-emerald-400" />
          <span className="text-xs font-semibold text-white">Infinia RBAC Demo</span>
          <span className="text-xs text-slate-500">— Metadata-filtered access control</span>
        </div>

        {/* Doc classification badges */}
        {docList?.documents && docList.documents.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap">
            {docList.documents.map((doc: { filename: string; chunks: number }) => {
              const upper = doc.filename.toUpperCase()
              const isConf = ['CONF_', 'CONFIDENTIAL_', '[CONF]', '[CONFIDENTIAL]', 'INTERNAL_', 'SECRET_']
                .some(p => upper.startsWith(p))
              return (
                <span key={doc.filename}
                  className={`flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border font-medium ${
                    isConf
                      ? 'bg-amber-900/30 border-amber-500/30 text-amber-400'
                      : 'bg-blue-900/20 border-blue-500/20 text-blue-400'
                  }`}
                >
                  {isConf ? <Lock className="w-2.5 h-2.5" /> : <FileText className="w-2.5 h-2.5" />}
                  {doc.filename.length > 24 ? doc.filename.slice(0, 24) + '...' : doc.filename}
                  <span className="opacity-60">{doc.chunks}c</span>
                </span>
              )
            })}
          </div>
        )}

        <div className="ml-auto flex items-center gap-3">
          {/* Reclassify button */}
          <button
            onClick={handleReclassify}
            disabled={reclassifyState === 'pending'}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-emerald-500/30 text-emerald-400 hover:bg-emerald-900/30 disabled:opacity-50 transition-colors"
            title="Re-stamp classification on all existing chunks without re-uploading"
          >
            {reclassifyState === 'pending'
              ? <Loader2 className="w-3 h-3 animate-spin" />
              : reclassifyState === 'done'
              ? <CheckCircle className="w-3 h-3" />
              : <RefreshCw className="w-3 h-3" />}
            {reclassifyState === 'pending' ? 'Reclassifying...' : 'Reclassify Docs'}
          </button>
          <div className="flex items-center gap-4 text-xs text-slate-400">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-blue-400" />
              <span><span className="text-blue-300 font-medium">Alex</span> = public only</span>
            </div>
            <ChevronRight className="w-3 h-3 text-slate-600" />
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-amber-400" />
              <span><span className="text-amber-300 font-medium">Sarah</span> = all chunks</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Split panels ──────────────────────────────────────────────────── */}
      <div className="flex flex-1 min-h-0 overflow-hidden" style={{ height: 'calc(100vh - var(--nav-height) - 14rem)' }}>
        <Panel persona={STD} result={stdResult} isQuerying={isQuerying} hasQueried={hasQueried} />
        <div className="w-px bg-gradient-to-b from-transparent via-white/10 to-transparent flex-shrink-0" />
        <Panel persona={EXEC} result={execResult} isQuerying={isQuerying} hasQueried={hasQueried} />
      </div>

      {/* ── Shared input bar ──────────────────────────────────────────────── */}
      <div className="border-t border-white/10 bg-slate-900/95 px-6 py-4 space-y-3">
        {/* Quick questions */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-slate-500 shrink-0">Try:</span>
          {DEMO_QUESTIONS.map((dq, i) => (
            <button
              key={i}
              onClick={() => setQuery(dq.q)}
              className={`text-xs px-2.5 py-1 rounded-lg border transition-colors truncate max-w-[240px] ${
                dq.label === 'Confidential'
                  ? 'border-amber-500/30 text-amber-400/70 hover:text-amber-300 hover:border-amber-400/50 bg-amber-950/20'
                  : 'border-blue-500/30 text-blue-400/70 hover:text-blue-300 hover:border-blue-400/50 bg-blue-950/20'
              }`}
              title={dq.q}
            >
              {dq.label === 'Confidential' && <Lock className="w-2.5 h-2.5 inline mr-1 mb-0.5" />}
              {dq.q.length > 48 ? dq.q.slice(0, 48) + '...' : dq.q}
            </button>
          ))}
        </div>

        {/* Input + button */}
        <div className="flex gap-3 items-end">
          <textarea
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a question — both users will answer simultaneously..."
            rows={2}
            disabled={isQuerying}
            className="flex-1 resize-none bg-slate-800/80 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 disabled:opacity-50"
          />
          <button
            onClick={handleAsk}
            disabled={!query.trim() || isQuerying}
            className="flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-semibold text-sm hover:from-emerald-500 hover:to-teal-500 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-lg shadow-emerald-900/40 shrink-0"
          >
            {isQuerying ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
            {isQuerying ? 'Querying...' : 'Ask Both'}
          </button>
        </div>
        <p className="text-[10px] text-slate-600 text-center">
          Upload docs prefixed with <code className="text-amber-500/70">CONF_</code> or <code className="text-amber-500/70">CONFIDENTIAL_</code> to mark them as restricted.
          Public docs have no prefix.
        </p>
      </div>
    </div>
  )
}

// ── Panel sub-component ──────────────────────────────────────────────────────

type Persona = typeof STD

interface PanelProps {
  persona: Persona
  result: StreamResult
  isQuerying: boolean
  hasQueried: boolean
}

function Panel({ persona, result, isQuerying, hasQueried }: PanelProps) {
  const isStd = persona.role === 'standard'

  return (
    <div className={`flex-1 flex flex-col ${persona.panelBg} overflow-hidden`}>
      {/* User badge header */}
      <div className={`flex items-center gap-3 px-5 py-3.5 border-b ${persona.borderClass} ${persona.headerBg}`}>
        <div className={`w-9 h-9 rounded-full ${persona.avatarBg} flex items-center justify-center font-bold text-white text-sm ring-2 ${persona.ringClass} shrink-0`}>
          {persona.initials}
        </div>
        <div className="min-w-0">
          <div className="font-semibold text-white text-sm leading-tight">{persona.name}</div>
          <div className="text-xs text-slate-400 truncate">{persona.dept}</div>
        </div>
        <div className={`ml-auto flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium shrink-0 ${persona.badgeBg} ${persona.badgeText}`}>
          {isStd ? <User className="w-3 h-3" /> : <Shield className="w-3 h-3" />}
          {persona.title}
        </div>
      </div>

      {/* Access level bar */}
      <div className={`flex items-center gap-2 px-5 py-1.5 border-b ${persona.borderClass} bg-black/20 text-[10px]`}>
        <span className="text-slate-500">Chunk access:</span>
        {isStd ? (
          <span className={`flex items-center gap-1 ${persona.accentText}`}>
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400 inline-block" />
            public only
          </span>
        ) : (
          <span className={`flex items-center gap-1 ${persona.accentText}`}>
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" />
            public + confidential
          </span>
        )}
        {hasQueried && (
          <span className="ml-auto text-slate-500">
            {result.chunksFound} chunk{result.chunksFound !== 1 ? 's' : ''} retrieved
          </span>
        )}
      </div>

      {/* Response area */}
      <div className="flex-1 overflow-y-auto px-5 py-5 min-h-0">
        <AnimatePresence mode="wait">
          {!hasQueried && (
            <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="h-full flex flex-col items-center justify-center text-center gap-3">
              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${isStd ? 'bg-blue-900/30' : 'bg-amber-900/30'}`}>
                {isStd ? <User className="w-6 h-6 text-blue-400" /> : <Shield className="w-6 h-6 text-amber-400" />}
              </div>
              <p className={`font-semibold text-sm ${persona.badgeText}`}>{persona.name}</p>
              <p className="text-slate-500 text-xs max-w-[200px]">
                {isStd ? 'Will only see publicly accessible knowledge' : 'Has full access to all classified knowledge'}
              </p>
            </motion.div>
          )}

          {hasQueried && isQuerying && !result.text && !result.isAccessDenied && (
            <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="flex items-center gap-2 text-slate-400 text-sm">
              <Loader2 className={`w-4 h-4 animate-spin ${persona.accentText}`} />
              <span>Querying Infinia...</span>
            </motion.div>
          )}

          {hasQueried && result.isAccessDenied && (
            <motion.div key="denied" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
              <div className="flex items-start gap-3 p-4 rounded-xl bg-red-950/40 border border-red-500/30">
                <Lock className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-red-300 font-semibold text-sm mb-1">Access Restricted</p>
                  <p className="text-red-400/80 text-xs leading-relaxed">{result.accessDeniedMsg}</p>
                </div>
              </div>
              <div className="p-3 rounded-xl bg-slate-800/40 border border-white/5">
                <p className="text-slate-500 text-xs leading-relaxed">
                  <span className="text-slate-400 font-medium">Why?</span> The matching chunks in Infinia are tagged{' '}
                  <code className="bg-red-900/30 text-red-400 px-1 rounded">classification: confidential</code>.
                  RBAC filtering at query time blocked retrieval for this role.
                </p>
              </div>
            </motion.div>
          )}

          {hasQueried && (result.text || (result.isDone && !result.isAccessDenied && result.chunksFound > 0)) && (
            <motion.div key="response" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
              {result.ttfbMs !== null && (
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] px-2 py-0.5 rounded-full ${isStd ? 'bg-blue-900/40 text-blue-400' : 'bg-amber-900/40 text-amber-400'}`}>
                    {result.ttfbMs.toFixed(0)}ms Infinia TTFB
                  </span>
                  {!result.isDone && (
                    <span className="flex items-center gap-1 text-[10px] text-emerald-400">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      LIVE
                    </span>
                  )}
                </div>
              )}
              <div className="text-sm text-slate-200 leading-relaxed whitespace-pre-wrap">
                {result.text}
                {!result.isDone && (
                  <span className={`inline-block w-0.5 h-4 ml-0.5 align-middle animate-pulse ${persona.cursorClass}`} />
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Footer stats */}
      {hasQueried && (
        <div className={`px-5 py-2.5 border-t ${persona.borderClass} bg-black/20 flex items-center gap-4 text-[10px] text-slate-500`}>
          <Database className="w-3 h-3 text-emerald-500 shrink-0" />
          <span>Infinia chunks retrieved: <span className={`font-mono font-bold ${persona.badgeText}`}>{result.chunksFound}</span></span>
          {result.isAccessDenied && (
            <span className="ml-auto text-red-400 font-medium">BLOCKED by RBAC</span>
          )}
          {result.isDone && !result.isAccessDenied && result.chunksFound > 0 && (
            <span className="ml-auto text-emerald-400 font-medium">Complete</span>
          )}
        </div>
      )}
    </div>
  )
}
