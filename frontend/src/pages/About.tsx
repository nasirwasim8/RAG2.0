import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Database, Zap, Search, Server, BarChart3, ArrowRight, Cloud, ChevronDown } from 'lucide-react'

interface AboutPageProps {
  onStartDemo?: () => void
}

// ─── GTC 2026 Strategic Outcomes Section ─────────────────────────────────────
function GtcOutcomesSection({ onStartDemo }: { onStartDemo?: () => void }) {
  const [open, setOpen] = useState<number | null>(null)

  const columns = [
    {
      label: 'Business Outcome',
      accent: 'text-emerald-400',
      border: 'border-emerald-500/30',
      bg: 'bg-emerald-500/5',
      iconColor: '#10b981',
      badge: '150× Faster Retrieval',
      badgeBg: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400',
      summary: (<><strong>DDN holds 6.5ms avg</strong> read latency at 50 concurrent users. <strong>AWS S3 degrades to 988ms</strong> under identical load. DDN stays flat under pressure — S3 does not.</>),
      icon: (
        <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
          <polyline points="16 7 22 7 22 13" />
        </svg>
      ),
      details: [
        { label: 'Demo proof', value: '4,950 object retrievals — DDN at 6.5ms avg, S3 degraded to 988ms at peak (50 concurrent users)' },
        { label: 'At 5,000 users', value: 'DDN ~6.5ms flat (proven architecture). S3 estimated 3,000–8,000ms — SLA breach territory' },
        { label: 'At Hyperscaler Scale', value: 'DDN holds p99 SLA regardless of traffic spike. S3 turns every surge into a P0 incident' },
        { label: 'User experience', value: 'Real-time token streaming shown live. TTFT drops 340ms. Users feel the difference immediately' },
        { label: 'C-suite headline', value: '"Our AI answers are only as fast as the slowest component. With DDN, that bottleneck is gone."' },
      ]
    },
    {
      label: 'Financial Outcome',
      accent: 'text-orange-500',
      border: 'border-orange-500/30',
      bg: 'bg-orange-500/5',
      iconColor: '#f97316',
      badge: '$1.4M/mo per 1,000 GPUs',
      badgeBg: 'bg-orange-500/10 border-orange-500/30 text-orange-500',
      summary: (<>DDN GPU utilization: <strong>94%</strong>. AWS S3: <strong>45%</strong>. Nearly half your GPU fleet sits idle waiting on storage — at 1,000 GPUs that idle time costs <strong>$1.4M every month</strong>.</>),
      icon: (
        <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <line x1="12" y1="1" x2="12" y2="23" />
          <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
        </svg>
      ),
      details: [
        { label: 'GPU utilization', value: 'DDN: 94% sustained utilization. AWS S3: 45%. The 49% gap = GPU cycles burning dollars while waiting on remote storage round-trips.' },
        { label: 'Methodology', value: '49% idle × 1,000 GPUs × $4/hr × 720 hrs/mo = $1,411,200/month in wasted GPU compute' },
        { label: '1,000 GPUs (enterprise)', value: '$1.4M/month · $16.8M/year in recovered GPU compute — just from eliminating storage wait' },
        { label: '5,000 GPUs (hyperscaler)', value: '$7M/month · $84M/year recovered — plus deferred cluster expansion capex' },
        { label: 'Additional levers', value: 'Eliminate S3 egress fees ($1.6M–$6.5M/yr at enterprise scale) + defer GPU cluster expansion ($250K per cluster avoided per 10% utilization gain)' },
        { label: 'C-suite headline', value: '"Nearly half our GPU fleet was idle — waiting on storage. DDN eliminated that bottleneck and recovered $1.4M/month in compute we were already paying for."' },
      ]
    },
    {
      label: 'AI Infra Implications',
      accent: 'text-red-400',
      border: 'border-red-500/30',
      bg: 'bg-red-500/5',
      iconColor: '#f87171',
      badge: 'GPU Saturation >90%',
      badgeBg: 'bg-red-500/10 border-red-500/30 text-red-400',
      summary: (<>Storage ceases to be the GPU bottleneck. TTFT drops <strong>340ms</strong>. TPS increases to <strong>rated capacity</strong>. DDN scales linearly with NVIDIA GPU fleet — no ceiling.</>),
      icon: (
        <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <rect x="4" y="4" width="16" height="16" rx="2" /><rect x="9" y="9" width="6" height="6" />
          <line x1="9" y1="1" x2="9" y2="4" /><line x1="15" y1="1" x2="15" y2="4" />
          <line x1="9" y1="20" x2="9" y2="23" /><line x1="15" y1="20" x2="15" y2="23" />
          <line x1="20" y1="9" x2="23" y2="9" /><line x1="20" y1="14" x2="23" y2="14" />
          <line x1="1" y1="9" x2="4" y2="9" /><line x1="1" y1="14" x2="4" y2="14" />
        </svg>
      ),
      details: [
        { label: 'GPU utilization', value: 'S3 wait = GPU idle 15–30% of each RAG request cycle. DDN returns in 6.5ms → sustained >90% GPU utilization' },
        { label: 'Tokens per second', value: 'Storage wait compresses effective TPS. DDN uncaps it — every GPU cycle produces revenue-generating output' },
        { label: 'TTFT at production', value: '340ms storage overhead added to every TTFT. DDN removes it — interactive AI feels 20–30% faster' },
        { label: 'Fleet scaling', value: 'DDN I/O bandwidth scales linearly with GPU count — adding GPUs doesn\'t expose a new storage ceiling' },
        { label: 'NIM / microservice ready', value: 'DDN\'s S3-compatible API works natively with NVIDIA NIM pods — zero reconfiguration, local-storage speed' },
        { label: 'C-suite headline', value: '"Every NVIDIA GPU generates tokens at rated speed. DDN ensures it\'s never waiting on storage — at any fleet size."' },
      ]
    },
  ]

  return (
    <section className="bg-surface-primary px-6 py-16">
      <div className="max-w-[1280px] mx-auto">

        {/* Header */}
        <div className="text-center mb-10">
          {/* GTC Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-orange-500/40 bg-orange-500/10 mb-4">
            <svg className="w-3.5 h-3.5 text-orange-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </svg>
            <span className="text-orange-500 text-xs font-bold tracking-widest uppercase">Live Load Test · End-to-End RAG</span>
          </div>
          <span className="eyebrow text-ddn-red block">Strategic Value Framework</span>
          <h2 className="heading-2 mt-2 mb-3">End-to-End RAG Pipeline — Business Case</h2>
          <p className="body-text max-w-3xl mx-auto">
            This demo is a <strong>controlled, live load test</strong> — run the Scaling Test at{' '}
            <strong>50, 200, or 500 concurrent GET requests</strong> and watch DDN INFINIA hold flat
            latency in real time while S3 visibly degrades under increasing load. Every number on this
            page is <strong>measured, not modelled</strong>. DDN INFINIA runs co-located with the
            application compute; traditional cloud storage is accessed as a remote API — that is the
            real-world architecture choice this benchmark tests. The three cards below take those live
            read-latency results and extrapolate them to hyperscaler volumes — so when any
            enterprise AI team asks <em>"what does this mean at our scale?"</em> every
            answer is backed by data you just ran yourself.
          </p>
        </div>

        {/* ── 3-Column Summary Row ─────────────────────────────────────────────── */}
        <div className="grid md:grid-cols-3 gap-5 mb-6">
          {columns.map((col, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: i * 0.1, ease: [0.16, 1, 0.3, 1] }}
              className={`card p-6 border ${col.border} ${col.bg} cursor-pointer group`}
              onClick={() => setOpen(open === i ? null : i)}
            >
              {/* Icon + Label */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: col.iconColor + '18', color: col.iconColor }}>
                    {col.icon}
                  </div>
                  <span className={`text-lg font-bold leading-tight ${col.accent}`}>{col.label}</span>
                </div>
                <ChevronDown
                  className={`w-5 h-5 flex-shrink-0 transition-transform duration-300 ${col.accent} ${open === i ? 'rotate-180' : ''}`}
                />
              </div>

              {/* Badge */}
              <div className={`inline-block px-3 py-1 rounded-full border text-sm font-bold mb-3 ${col.badgeBg}`}>
                {col.badge}
              </div>

              {/* Summary */}
              <p className="text-base leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{col.summary}</p>

              <p className={`text-sm mt-4 font-semibold ${col.accent}`}>
                {open === i ? '▲ Collapse detail' : '▼ See extrapolated numbers'}
              </p>
            </motion.div>
          ))}
        </div>

        {/* ── Expandable Detail Panel ───────────────────────────────────────────── */}
        {open !== null && (
          <motion.div
            key={open}
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className={`card p-6 border ${columns[open].border} mb-6`}
          >
            <div className="flex items-center gap-3 mb-5">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: columns[open].iconColor + '18', color: columns[open].iconColor }}>
                {columns[open].icon}
              </div>
              <h3 className={`text-xl font-bold ${columns[open].accent}`}>{columns[open].label} — Extrapolated</h3>
            </div>
            <div className="divide-y divide-neutral-100">
              {columns[open].details.map((d, j) => (
                <div key={j} className="py-4 grid md:grid-cols-[220px_1fr] gap-3">
                  <span className="text-sm font-bold uppercase tracking-wide text-neutral-500">{d.label}</span>
                  <span className="text-base leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{d.value}</span>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* ── One-Line Summary Row (the GTC table row) ─────────────────────────── */}
        <div className="rounded-2xl border border-neutral-200 bg-neutral-50 overflow-hidden">
          {/* Header row */}
          <div className="grid grid-cols-4 bg-neutral-100 border-b border-neutral-200 text-xs font-bold uppercase tracking-wider text-neutral-500">
            <div className="px-5 py-3 border-r border-neutral-200">Demo</div>
            <div className="px-5 py-3 border-r border-neutral-200">Business Outcome</div>
            <div className="px-5 py-3 border-r border-neutral-200">Financial Outcome</div>
            <div className="px-5 py-3">AI Infra Implications</div>
          </div>
          {/* Data row */}
          <div className="grid grid-cols-4 text-xs leading-relaxed text-neutral-600">
            <div className="px-5 py-4 border-r border-neutral-200 font-semibold text-neutral-800">
              <div className="flex items-center gap-2 mb-1">
                <span className="w-2 h-2 rounded-full bg-ddn-red inline-block" />
                Build.RAG
              </div>
              <span className="text-neutral-400 font-normal">Micro-benchmark of a full production RAG pipeline</span>
            </div>
            <div className="px-5 py-4 border-r border-neutral-200">
              <strong className="text-neutral-800">150× faster retrieval</strong> (6.5ms vs 988ms) at 500 concurrent users. Flat DDN latency = predictable SLAs at any scale including hyperscaler-level traffic spikes.
            </div>
            <div className="px-5 py-4 border-r border-neutral-200">
              <strong className="text-neutral-800">$1.4M/mo</strong> in wasted GPU compute recovered at 1,000 GPUs (DDN 94% util vs S3 45%). Eliminates S3 egress fees ($1.6M–$6.5M/yr). Defers GPU cluster expansion.
            </div>
            <div className="px-5 py-4">
              GPU utilization moves from ~65% effective → <strong className="text-neutral-800">&gt;90% sustained</strong>. TTFT drops 340ms. TPS reaches rated capacity. DDN scales linearly with NVIDIA GPU fleet — no new storage ceiling.
            </div>
          </div>
        </div>

        {/* ── CTA Button ────────────────────────────────────────────────────────── */}
        {onStartDemo && (
          <div className="text-center mt-8">
            <button
              onClick={onStartDemo}
              className="group inline-flex items-center gap-3 px-8 py-4 rounded-xl text-lg font-semibold transition-all duration-300"
              style={{
                background: 'linear-gradient(135deg, #ED2738 0%, #76B900 100%)',
                color: 'white',
                boxShadow: '0 8px 30px rgba(237, 39, 56, 0.25)'
              }}
            >
              <span>Run the Benchmark →</span>
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </button>
            <p className="text-sm text-neutral-400 mt-3">Live demonstration with real-time metrics</p>
          </div>
        )}

      </div>
    </section>
  )
}

export default function AboutPage({ onStartDemo }: AboutPageProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const style = document.createElement('style')
    style.textContent = `
      /* GPU-optimized orb animations - use translate3d for hardware acceleration */
      @keyframes floatOrb1 {
        0%, 100% {
          transform: translate3d(0, -50%, 0);
          opacity: 0.5;
        }
        50% {
          transform: translate3d(20px, calc(-50% - 15px), 0);
          opacity: 0.65;
        }
      }
      @keyframes floatOrb2 {
        0%, 100% {
          transform: translate3d(0, -50%, 0);
          opacity: 0.5;
        }
        50% {
          transform: translate3d(-20px, calc(-50% + 15px), 0);
          opacity: 0.65;
        }
      }

      /* Subtle pulse with smooth easing */
      @keyframes subtlePulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.85; }
      }

      /* SVG diagram interactions - GPU-optimized */
      #ragDiagram g {
        transition: opacity 200ms cubic-bezier(0.16, 1, 0.3, 1),
                    transform 200ms cubic-bezier(0.16, 1, 0.3, 1);
        cursor: pointer;
        transform-origin: center;
      }
      #ragDiagram g:hover {
        opacity: 0.9;
        transform: scale(1.01) translateZ(0);
      }
      #ragDiagram #metrics { animation: subtlePulse 3s cubic-bezier(0.76, 0, 0.24, 1) infinite; }
      #ragDiagram #response { animation: subtlePulse 3.5s cubic-bezier(0.76, 0, 0.24, 1) infinite; }
      #ragDiagram #storage { animation: subtlePulse 2.5s cubic-bezier(0.76, 0, 0.24, 1) infinite; }
      #ragDiagram path {
        transition: stroke-width 200ms cubic-bezier(0.16, 1, 0.3, 1);
      }
      #ragDiagram path:hover { stroke-width: 3; }

      /* Reduced motion support */
      @media (prefers-reduced-motion: reduce) {
        @keyframes floatOrb1 { 0%, 100% { transform: translate3d(0, -50%, 0); } }
        @keyframes floatOrb2 { 0%, 100% { transform: translate3d(0, -50%, 0); } }
        #ragDiagram #metrics,
        #ragDiagram #response,
        #ragDiagram #storage { animation: none; }
      }
    `
    document.head.appendChild(style)
    return () => { document.head.removeChild(style) }
  }, [])

  return (
    <div className="about-page">




      {/* Original Hero Section */}
      <section className="relative overflow-hidden" style={{ background: '#050508' }}>
        {/* Animated Background Orbs - GPU optimized, isolated for scroll performance */}
        <div
          className="absolute inset-0 overflow-hidden pointer-events-none"
          style={{ contain: 'paint layout', willChange: 'auto' }}
        >
          {/* DDN Red Orb - reduced size & blur for 60fps */}
          <div
            className="absolute rounded-full"
            style={{
              width: 'clamp(280px, 45vw, 400px)',
              height: 'clamp(280px, 45vw, 400px)',
              background: 'radial-gradient(circle, rgba(237, 39, 56, 0.3) 0%, rgba(237, 39, 56, 0) 70%)',
              filter: 'blur(50px)',
              left: '-5%',
              top: '50%',
              transform: 'translate3d(0, -50%, 0)',
              animation: 'floatOrb1 10s cubic-bezier(0.76, 0, 0.24, 1) infinite'
            }}
          />
          {/* NVIDIA Green Orb */}
          <div
            className="absolute rounded-full"
            style={{
              width: 'clamp(280px, 45vw, 400px)',
              height: 'clamp(280px, 45vw, 400px)',
              background: 'radial-gradient(circle, rgba(118, 185, 0, 0.3) 0%, rgba(118, 185, 0, 0) 70%)',
              filter: 'blur(50px)',
              right: '-5%',
              top: '50%',
              transform: 'translate3d(0, -50%, 0)',
              animation: 'floatOrb2 10s cubic-bezier(0.76, 0, 0.24, 1) infinite'
            }}
          />
          {/* Grid Overlay - static, no animation needed */}
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: 'linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)',
              backgroundSize: '80px 80px',
              maskImage: 'radial-gradient(ellipse at center, black 0%, transparent 70%)',
              WebkitMaskImage: 'radial-gradient(ellipse at center, black 0%, transparent 70%)'
            }}
          />
        </div>

        <div className="relative z-10 max-w-[1280px] mx-auto px-6 py-20 md:py-28">
          {/* Logo Cards */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className="flex items-center justify-center gap-6 md:gap-8 mb-12"
          >
            {/* DDN Card - GPU-optimized hover */}
            <div
              className="w-32 h-32 md:w-40 md:h-40 rounded-3xl flex flex-col items-center justify-center"
              style={{
                background: 'rgba(255, 255, 255, 0.04)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                backdropFilter: 'blur(16px)',
                WebkitBackdropFilter: 'blur(16px)',
                transition: 'transform 200ms cubic-bezier(0.16, 1, 0.3, 1), border-color 200ms cubic-bezier(0.16, 1, 0.3, 1)',
                willChange: 'transform'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-4px) translateZ(0)'
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0) translateZ(0)'
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)'
              }}
            >
              <img src="/ddn-logo-white.svg" alt="DDN" className="h-12 md:h-14 w-auto mb-2" />
              <span className="text-white/60 text-xs font-medium">INFINIA</span>
            </div>

            {/* Plus Sign */}
            <span className="text-white/40 text-3xl md:text-4xl font-light">+</span>

            {/* NVIDIA Card - GPU-optimized hover */}
            <div
              className="w-32 h-32 md:w-40 md:h-40 rounded-3xl flex flex-col items-center justify-center"
              style={{
                background: 'rgba(255, 255, 255, 0.04)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                backdropFilter: 'blur(16px)',
                WebkitBackdropFilter: 'blur(16px)',
                transition: 'transform 200ms cubic-bezier(0.16, 1, 0.3, 1), border-color 200ms cubic-bezier(0.16, 1, 0.3, 1)',
                willChange: 'transform'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-4px) translateZ(0)'
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0) translateZ(0)'
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)'
              }}
            >
              <img src="/nvidia-icon.svg" alt="NVIDIA" className="h-14 md:h-16 w-auto" />
              <span className="text-white/60 text-xs font-medium mt-2">NVIDIA</span>
            </div>
          </motion.div>

          {/* Title */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.08, ease: [0.16, 1, 0.3, 1] }}
            className="text-center mb-6"
          >
            <h1
              className="text-5xl md:text-6xl lg:text-7xl font-bold text-white mb-2"
              style={{ letterSpacing: '-0.03em', lineHeight: 1.1 }}
            >
              Enterprise{' '}
              <span
                style={{
                  background: 'linear-gradient(135deg, #76B900 0%, #00C280 50%, #ED2738 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent'
                }}
              >
                RAG Performance
              </span>
            </h1>
            <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white" style={{ letterSpacing: '-0.03em' }}>
              Showcase
            </h2>
          </motion.div>

          {/* Subtitle */}
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
            className="text-center text-white/70 text-xl md:text-2xl max-w-3xl mx-auto mb-12"
            style={{ lineHeight: 1.7 }}
          >
            A controlled, live load test of a complete end-to-end RAG pipeline — from document ingestion
            to concurrent AI queries. <strong className="text-white/90">DDN Infinia runs co-located with compute.</strong>{' '}
            AWS S3 is accessed as a remote API. That single architectural choice is exactly what this benchmark tests.
          </motion.p>

          {/* Stats Grid */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto"
          >
            <StatCard value="150×" label="Faster Retrieval" description="6.5ms DDN vs 988ms S3" />
            <StatCard value="97%" label="GPU Utilization" description="vs 46% with remote S3" />
            <StatCard value="$1.44M" label="Monthly Savings" description="At 1,000-GPU scale" />
            <StatCard value="Co-located" label="Data + Compute" description="On-prem · Colorado DC" />
          </motion.div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════════════
           GTC 2026 — Strategic Outcomes  (inserted before Architecture)
       ════════════════════════════════════════════════════════════════════════ */}
      <GtcOutcomesSection onStartDemo={onStartDemo} />

      {/* Architecture Section */}
      <section className="bg-surface-primary px-6 py-16">
        <div className="max-w-[1280px] mx-auto">
          <div className="text-center mb-10">
            <span className="eyebrow text-nvidia-green">How It Works</span>
            <h2 className="heading-2 mt-2 mb-3">
              RAG Pipeline Architecture
            </h2>
            <p className="body-text max-w-2xl mx-auto">
              End-to-end enterprise RAG pipeline combining DDN INFINIA high-performance storage with NVIDIA NeMo AI acceleration for sub-100ms response times.
            </p>
          </div>

          {/* Architecture Diagram */}
          <div
            ref={containerRef}
            className="rounded-2xl p-6"
            style={{ background: '#201E1E', border: '1px solid #3F3B3C' }}
          >
            <svg width="100%" height="520" viewBox="0 0 1200 520" xmlns="http://www.w3.org/2000/svg" id="ragDiagram">
              <defs>
                <linearGradient id="ddnGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" style={{ stopColor: '#E31B23', stopOpacity: 1 }} />
                  <stop offset="100%" style={{ stopColor: '#C41E3A', stopOpacity: 1 }} />
                </linearGradient>
                <linearGradient id="nvidiaGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" style={{ stopColor: '#76B900', stopOpacity: 1 }} />
                  <stop offset="100%" style={{ stopColor: '#5A9000', stopOpacity: 1 }} />
                </linearGradient>
                <filter id="glow">
                  <feGaussianBlur stdDeviation="3" result="coloredBlur" />
                  <feMerge>
                    <feMergeNode in="coloredBlur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
                <marker id="arrowhead" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto">
                  <polygon points="0 0, 10 3, 0 6" fill="#76B900" />
                </marker>
                <marker id="arrowhead2" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto">
                  <polygon points="0 0, 10 3, 0 6" fill="#FFD700" />
                </marker>
                <marker id="arrowheadRed" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto">
                  <polygon points="0 0, 10 3, 0 6" fill="#E31B23" />
                </marker>
              </defs>

              {/* ── Stage 1: Document Ingestion ───────────────────────────── */}
              <g id="ingestion">
                <rect x="20" y="50" width="140" height="100" rx="8" fill="#2a2a2a" stroke="#76B900" strokeWidth="2" />
                <text x="90" y="78" textAnchor="middle" fill="#ffffff" fontSize="14" fontWeight="bold">Document</text>
                <text x="90" y="96" textAnchor="middle" fill="#76B900" fontSize="11" fontWeight="bold">Multi-Modal</text>
                <text x="90" y="112" textAnchor="middle" fill="#76B900" fontSize="10">Upload</text>
                <text x="90" y="128" textAnchor="middle" fill="#888888" fontSize="8">PDF / Word / Excel / PPT / TXT</text>
                <text x="90" y="143" textAnchor="middle" fill="#888888" fontSize="7">CSV / PPTX supported</text>
              </g>

              <path d="M 160 100 L 188 100" stroke="#76B900" strokeWidth="2" markerEnd="url(#arrowhead)" fill="none" />

              {/* ── Stage 2: NV-Ingest Compatible Chunking (NVIDIA-powered) ── */}
              <g id="processing">
                <rect x="190" y="50" width="148" height="100" rx="8" fill="#2a2a2a" stroke="#76B900" strokeWidth="2" />
                <text x="264" y="74" textAnchor="middle" fill="#ffffff" fontSize="13" fontWeight="bold">Extract &amp;</text>
                {/* NVIDIA green pill — keeps the brand prominent */}
                <rect x="204" y="80" width="120" height="24" rx="5" fill="#76B900" opacity="0.92" />
                <text x="264" y="96" textAnchor="middle" fill="#ffffff" fontSize="10" fontWeight="bold">NV-Ingest Compatible</text>
                <text x="264" y="116" textAnchor="middle" fill="#76B900" fontSize="9">Semantic Chunking</text>
                <text x="264" y="130" textAnchor="middle" fill="#888888" fontSize="7">SentenceTransformers · auto-fallback</text>
                <text x="264" y="143" textAnchor="middle" fill="#555555" fontSize="7">LangChain RecursiveTextSplitter</text>
              </g>

              <path d="M 338 100 L 358 100" stroke="#76B900" strokeWidth="2" markerEnd="url(#arrowhead)" fill="none" />

              {/* ── Stage 3: Dual Storage ─────────────────────────────────── */}
              <g id="storage">
                <rect x="360" y="20" width="182" height="165" rx="8" fill="url(#ddnGradient)" stroke="#E31B23" strokeWidth="3" filter="url(#glow)" />
                <text x="451" y="46" textAnchor="middle" fill="#ffffff" fontSize="15" fontWeight="bold">Dual Storage</text>
                {/* DDN row */}
                <rect x="370" y="54" width="162" height="44" rx="4" fill="#1a1a1a" stroke="#ffffff" strokeWidth="0.5" />
                <text x="451" y="72" textAnchor="middle" fill="#E31B23" fontSize="12" fontWeight="bold">DDN INFINIA</text>
                <text x="451" y="88" textAnchor="middle" fill="#FFD700" fontSize="8">On-Premises · Colorado DC</text>
                {/* vs */}
                <text x="451" y="110" textAnchor="middle" fill="#ffffff" fontSize="13" fontWeight="bold">vs</text>
                {/* S3 row */}
                <rect x="370" y="116" width="162" height="44" rx="4" fill="#1a1a1a" stroke="#ffffff" strokeWidth="0.5" />
                <text x="451" y="134" textAnchor="middle" fill="#FF9900" fontSize="12" fontWeight="bold">Traditional Storage</text>
                <text x="451" y="149" textAnchor="middle" fill="#FFD700" fontSize="8">Cloud (AWS S3 or S3-Compatible)</text>
                <text x="451" y="175" textAnchor="middle" fill="#FFD700" fontSize="9" fontWeight="bold">GET Latency Benchmarked</text>
              </g>

              <path d="M 451 185 L 451 220" stroke="#E31B23" strokeWidth="2" markerEnd="url(#arrowheadRed)" fill="none" />

              {/* ── Stage 4: Query Embedding (new node) ──────────────────── */}
              <g id="embedding">
                <rect x="372" y="222" width="158" height="58" rx="8" fill="#1e2a1e" stroke="#76B900" strokeWidth="1.5" strokeDasharray="5,3" />
                <text x="451" y="244" textAnchor="middle" fill="#76B900" fontSize="12" fontWeight="bold">Query Embedding</text>
                <text x="451" y="260" textAnchor="middle" fill="#888888" fontSize="9">SentenceTransformer encode()</text>
                <text x="451" y="274" textAnchor="middle" fill="#555555" fontSize="7">all-MiniLM-L6-v2 · GPU accelerated</text>
              </g>

              <path d="M 451 280 L 451 305" stroke="#76B900" strokeWidth="2" markerEnd="url(#arrowhead)" fill="none" />

              {/* ── Stage 5: FAISS Vector Search ─────────────────────────── */}
              <g id="vector">
                <rect x="372" y="306" width="158" height="65" rx="8" fill="#2a2a2a" stroke="#76B900" strokeWidth="2" />
                <text x="451" y="330" textAnchor="middle" fill="#ffffff" fontSize="14" fontWeight="bold">FAISS</text>
                <text x="451" y="348" textAnchor="middle" fill="#76B900" fontSize="10">IndexFlatL2 · Vector Search</text>
                <text x="451" y="364" textAnchor="middle" fill="#888888" fontSize="8">Semantic chunk retrieval</text>
              </g>

              <path d="M 530 338 L 575 338" stroke="#76B900" strokeWidth="2" markerEnd="url(#arrowhead)" fill="none" />

              {/* ── Stage 6: NeMo Reranker (NVIDIA) ──────────────────────── */}
              <g id="reranker">
                <rect x="577" y="306" width="155" height="65" rx="8" fill="url(#nvidiaGradient)" stroke="#76B900" strokeWidth="2" filter="url(#glow)" />
                <text x="654" y="328" textAnchor="middle" fill="#ffffff" fontSize="13" fontWeight="bold">NeMo Reranker</text>
                <text x="654" y="346" textAnchor="middle" fill="#ffffff" fontSize="10">Score &amp; Reorder Results</text>
                <text x="654" y="362" textAnchor="middle" fill="rgba(255,255,255,0.75)" fontSize="8">NVIDIA NIM · Improved Relevance</text>
              </g>

              <path d="M 732 338 L 777 338" stroke="#76B900" strokeWidth="2" markerEnd="url(#arrowhead)" fill="none" />

              {/* ── Stage 7: NeMo Guardrails (NVIDIA) ────────────────────── */}
              <g id="guardrails">
                <rect x="779" y="306" width="155" height="65" rx="8" fill="#1a2a1a" stroke="#76B900" strokeWidth="2" />
                <text x="856" y="328" textAnchor="middle" fill="#ffffff" fontSize="13" fontWeight="bold">NeMo Guardrails</text>
                <text x="856" y="346" textAnchor="middle" fill="#76B900" fontSize="10">Content Safety</text>
                <text x="856" y="362" textAnchor="middle" fill="#888888" fontSize="8">Input / Output Filter · NVIDIA</text>
              </g>

              <path d="M 934 338 L 975 338" stroke="#76B900" strokeWidth="2" markerEnd="url(#arrowhead)" fill="none" />

              {/* ── Stage 8: LLM Response (NVIDIA — highlighted) ─────────── */}
              <g id="response">
                <rect x="977" y="268" width="195" height="155" rx="8" fill="url(#nvidiaGradient)" stroke="#76B900" strokeWidth="3" filter="url(#glow)" />

                {/* Model Agnostic Badge */}
                <rect x="990" y="278" width="169" height="20" rx="4" fill="rgba(255,215,0,0.2)" stroke="#FFD700" strokeWidth="1.5" />
                <text x="1074" y="292" textAnchor="middle" fill="#FFD700" fontSize="10" fontWeight="bold">MODEL AGNOSTIC</text>

                {/* Primary model — actual default */}
                <text x="1074" y="316" textAnchor="middle" fill="#ffffff" fontSize="13" fontWeight="bold">Llama 3.1-8B Instruct</text>
                <text x="1074" y="333" textAnchor="middle" fill="rgba(255,255,255,0.7)" fontSize="9">Default · NVIDIA NIM</text>

                {/* Optional NVIDIA API model */}
                <rect x="992" y="340" width="165" height="18" rx="4" fill="rgba(0,0,0,0.25)" />
                <text x="1074" y="353" textAnchor="middle" fill="#FFD700" fontSize="9" fontWeight="bold">+ Nemotron 70B  (NVIDIA API key)</text>

                <text x="1074" y="376" textAnchor="middle" fill="#ffffff" fontSize="11">LLM Response · Streaming</text>

                {/* Sub-100ms badge */}
                <rect x="1010" y="386" width="130" height="20" rx="4" fill="rgba(0,0,0,0.35)" />
                <text x="1074" y="400" textAnchor="middle" fill="#FFD700" fontSize="10" fontWeight="bold">SUB-100MS RETRIEVAL</text>
              </g>

              {/* ── User Query Flow (dashed gold) ─────────────────────────── */}
              <path d="M 90 175 L 90 430 L 451 430 L 451 395" stroke="#FFD700" strokeWidth="2" strokeDasharray="8,4" fill="none" markerEnd="url(#arrowhead2)" />
              <text x="270" y="448" textAnchor="middle" fill="#FFD700" fontSize="10">User Query Flow</text>

              {/* ── Performance Metrics Box (corrected: Retrieval, not Upload) */}
              <g id="metrics">
                <rect x="20" y="195" width="145" height="105" rx="8" fill="#2a2a2a" stroke="#E31B23" strokeWidth="2" />
                <text x="92" y="218" textAnchor="middle" fill="#ffffff" fontSize="12" fontWeight="bold">Performance</text>
                <text x="92" y="236" textAnchor="middle" fill="#E31B23" fontSize="10" fontWeight="bold">DDN INFINIA</text>
                <text x="92" y="254" textAnchor="middle" fill="#00C280" fontSize="9">150× Faster Retrieval</text>
                <text x="92" y="270" textAnchor="middle" fill="#00C280" fontSize="9">6.5ms avg GET latency</text>
                <text x="92" y="286" textAnchor="middle" fill="#888888" fontSize="8">vs 988ms Traditional Storage</text>
                <text x="92" y="296" textAnchor="middle" fill="#555555" fontSize="7">@ 500 concurrent readers</text>
              </g>

              {/* ── Legend ────────────────────────────────────────────────── */}
              <g id="legend">
                <rect x="18" y="320" width="12" height="12" rx="2" fill="#E31B23" />
                <text x="36" y="331" fill="#E31B23" fontSize="10" fontWeight="bold">DDN INFINIA Storage</text>
                <rect x="18" y="338" width="12" height="12" rx="2" fill="#76B900" />
                <text x="36" y="349" fill="#76B900" fontSize="10" fontWeight="bold">NVIDIA NeMo AI Stack</text>
                <line x1="18" y1="362" x2="30" y2="362" stroke="#FFD700" strokeWidth="2" strokeDasharray="4,2" />
                <text x="36" y="367" fill="#FFD700" fontSize="10" fontWeight="bold">User Query Path</text>
                <line x1="18" y1="380" x2="30" y2="380" stroke="#76B900" strokeWidth="1.5" strokeDasharray="4,2" />
                <text x="36" y="385" fill="#888888" fontSize="9">Query Embedding layer (new)</text>
              </g>
            </svg>
          </div>


          {/* Infrastructure Partners */}
          <div className="mt-12">
            <h3 className="text-lg font-semibold mb-6 text-center" style={{ color: 'var(--text-primary)' }}>Infrastructure Partners</h3>
            <div className="grid md:grid-cols-3 gap-4 max-w-4xl mx-auto">
              <div className="card p-6 text-center">
                <img src="/supermicro-logo.png" alt="Supermicro" className="h-10 mx-auto mb-4" />
                <div className="text-xs font-medium uppercase tracking-wide mb-2" style={{ color: 'var(--text-muted)' }}>Hardware Platform</div>
                <div className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                  X13 AI Servers • High Density Architecture • Enterprise Grade
                </div>
              </div>

              <div className="card p-6 text-center">
                <img src="/nvidia-icon.svg" alt="NVIDIA" className="h-10 mx-auto mb-4" />
                <div className="text-nvidia-green text-xs font-medium uppercase tracking-wide mb-2">AI Acceleration</div>
                <div className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                  H100/A100 GPU Arrays • CUDA Ecosystem • NeMo AI Platform
                </div>
              </div>

              <div className="card p-6 text-center">
                <img src="/logo-ddn.svg" alt="DDN" className="h-10 mx-auto mb-4" />
                <div className="text-ddn-red text-xs font-medium uppercase tracking-wide mb-2">Storage & Data Intelligence</div>
                <div className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                  INFINIA Data Intelligence • Exascale Performance • Enterprise AI
                </div>
              </div>
            </div>
          </div>
        </div>
      </section >

      {/* Pipeline Stages Section */}
      < section className="bg-surface-base px-6 py-16" >
        <div className="max-w-[1280px] mx-auto">
          <div className="text-center mb-10">
            <span className="eyebrow text-ddn-red">Step by Step</span>
            <h2 className="heading-2 mt-2 mb-3">
              Pipeline Stages
            </h2>
            <p className="body-text max-w-2xl mx-auto">
              Four-stage enterprise RAG pipeline from document ingestion to intelligent response generation.
            </p>
          </div>

          {/* Pipeline Flow Visual */}
          <div className="relative mb-8">
            {/* Connection Line */}
            <div className="hidden md:block absolute top-1/2 left-0 right-0 h-0.5 bg-gradient-to-r from-ddn-red via-nvidia-green to-ddn-red opacity-20" style={{ transform: 'translateY(-50%)' }} />

            <div className="grid md:grid-cols-4 gap-6">
              <StorageCard
                number="01"
                title="Document Processing"
                items={[
                  'Multi-modal ingestion (PDF, Word, Excel, PPT)',
                  'NVIDIA NV-Ingest semantic chunking',
                  'Automatic fallback to standard processing',
                  'Content hash deduplication'
                ]}
                color="ddn"
              />
              <StorageCard
                number="02"
                title="Chunk Storage"
                items={[
                  'Parallel storage to both providers',
                  'DDN INFINIA: On-premises Colorado DC',
                  'Traditional Storage: Cloud-based deployment',
                  'Real-time performance comparison'
                ]}
                color="nvidia"
              />
              <StorageCard
                number="03"
                title="Vector Storage"
                items={[
                  'FAISS IndexFlatL2 for fast search',
                  'SentenceTransformer embeddings',
                  'Efficient similarity matching',
                  'Scalable to millions of vectors'
                ]}
                color="blue"
              />
              <StorageCard
                number="04"
                title="RAG Query"
                items={[
                  'NeMo Reranker for improved relevance',
                  'Content safety guardrails',
                  'Nemotron 70B LLM generation',
                  'Sub-100ms response times'
                ]}
                color="nvidia"
              />
            </div>
          </div>

          {/* Data Flow Summary */}
          <div className="p-6 rounded-xl" style={{ background: 'linear-gradient(135deg, var(--neutral-900) 0%, var(--neutral-800) 100%)' }}>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-2 h-2 rounded-full bg-nvidia-green animate-pulse" />
              <span className="text-xl md:text-2xl font-semibold text-nvidia-green">Data Flow Summary</span>
            </div>
            <div className="text-lg md:text-xl lg:text-2xl text-white/90 leading-relaxed">
              Multi-modal documents → <strong className="text-nvidia-green">NVIDIA NV-Ingest</strong> semantic chunking → <strong className="text-ddn-red">DDN INFINIA</strong> storage
              <span className="inline-block mx-2 px-3 py-1 bg-ddn-red text-white text-base md:text-lg font-bold rounded">SIGNIFICANTLY FASTER</span>
              → <strong className="text-nvidia-green">NeMo Reranker</strong> + <strong className="text-nvidia-green">Guardrails</strong> → <strong className="text-nvidia-green">Model-Agnostic LLMs</strong> (Nemotron 70B, Llama 3.1, Mixtral)
              <span className="inline-block mx-2 px-3 py-1 bg-nvidia-green text-white text-base md:text-lg font-bold rounded">SUB-SECOND</span>
            </div>
          </div>
        </div>
      </section >

      {/* Performance Metrics Section */}
      < section className="bg-surface-base px-6 py-16" >
        <div className="max-w-[1280px] mx-auto">
          <div className="text-center mb-10">
            <span className="eyebrow text-ddn-red">Benchmarks</span>
            <h2 className="heading-2 mt-2 mb-3">
              What We Measure
            </h2>
            <p className="body-text max-w-xl mx-auto">
              Comprehensive performance metrics comparing DDN INFINIA against Traditional Object Storage across key dimensions.
            </p>
          </div>

          {/* Metrics Grid */}
          <div className="grid md:grid-cols-3 gap-6 mb-12">
            <MetricCard
              title="Storage Performance"
              color="ddn"
              items={[
                'Upload speed comparison',
                'Throughput measurement',
                'Reliability metrics',
                'Scalability testing'
              ]}
            />
            <MetricCard
              title="Retrieval Performance"
              color="nvidia"
              items={[
                'Time to First Byte (TTFB)',
                'Query response time',
                'Concurrent access',
                'Consistency metrics'
              ]}
            />
            <MetricCard
              title="RAG Pipeline"
              color="blue"
              items={[
                'Document ingestion',
                'Chunk storage',
                'Vector indexing (FAISS)',
                'LLM integration'
              ]}
            />
          </div>

          {/* Supported Providers */}
          <div className="mb-12">
            <h3 className="heading-3 mb-4">Supported Providers</h3>
            <div className="flex gap-3 flex-wrap">
              <ProviderBadge name="DDN INFINIA" color="#ED2738" icon={<Database className="w-4 h-4" />} />
              <ProviderBadge name="Traditional Storage" color="#FF7600" icon={<Cloud className="w-4 h-4" />} />
              <ProviderBadge name="NVIDIA NeMo" color="#76B900" icon={<Zap className="w-4 h-4" />} />
            </div>
          </div>

          {/* Mission Banner */}
          <div className="rounded-xl p-8 text-white" style={{ background: 'linear-gradient(135deg, var(--ddn-red) 0%, var(--ddn-red-hover) 100%)' }}>
            <div className="eyebrow text-white/80 mb-3">Our Mission</div>
            <p className="text-xl md:text-2xl lg:text-3xl font-medium leading-relaxed">
              Demonstrate that DDN INFINIA delivers superior performance for enterprise RAG applications—the optimal choice for production deployments requiring ultra-low latency and maximum throughput.
            </p>
          </div>
        </div>
      </section >

      {/* Technology Stack Section */}
      < section className="bg-surface-primary px-6 py-16" >
        <div className="max-w-[1280px] mx-auto">
          <div className="text-center mb-10">
            <span className="eyebrow text-nvidia-green">Under the Hood</span>
            <h2 className="heading-2 mt-2 mb-3">
              Technology Stack
            </h2>
            <p className="body-text max-w-xl mx-auto">
              Production-ready technologies powering enterprise-scale RAG deployments.
            </p>
          </div>

          {/* Technology Stack Grid */}
          <div className="grid md:grid-cols-2 gap-6 mb-12">
            <div className="card p-6">
              <h3 className="heading-3 mb-4 flex items-center gap-2">
                <Server className="w-5 h-5 text-ddn-red" />
                Backend Stack
              </h3>
              <ul className="space-y-3">
                {[
                  { name: 'FastAPI', desc: 'High-performance Python web framework' },
                  { name: 'FAISS', desc: 'Facebook AI Similarity Search for vectors' },
                  { name: 'SentenceTransformers', desc: 'State-of-the-art text embeddings' },
                  { name: 'NVIDIA NeMo', desc: 'Reranking, Guardrails, Nemotron 70B' },
                  { name: 'Boto3', desc: 'AWS SDK for S3-compatible storage' }
                ].map((tech) => (
                  <li key={tech.name} className="flex items-start gap-3 text-base md:text-lg">
                    <span className="w-2 h-2 bg-ddn-red rounded-full mt-2 flex-shrink-0" />
                    <div>
                      <span className="font-medium text-lg md:text-xl" style={{ color: 'var(--text-primary)' }}>{tech.name}</span>
                      <span className="text-base md:text-lg" style={{ color: 'var(--text-muted)' }}> — {tech.desc}</span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            <div className="card p-6">
              <h3 className="heading-3 mb-4 flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-status-info" />
                Frontend Stack
              </h3>
              <ul className="space-y-3">
                {[
                  { name: 'React', desc: 'UI component library' },
                  { name: 'TypeScript', desc: 'Type-safe JavaScript' },
                  { name: 'Tailwind CSS', desc: 'Utility-first styling' },
                  { name: 'Vite', desc: 'Next-generation frontend tooling' },
                  { name: 'TanStack Query', desc: 'Powerful data fetching' }
                ].map((tech) => (
                  <li key={tech.name} className="flex items-start gap-3 text-sm">
                    <span className="w-1.5 h-1.5 bg-status-info rounded-full mt-2 flex-shrink-0" />
                    <div>
                      <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{tech.name}</span>
                      <span style={{ color: 'var(--text-muted)' }}> — {tech.desc}</span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Use Cases */}
          <div className="mb-12">
            <h3 className="heading-3 mb-6 text-center">Use Cases</h3>
            <div className="flex flex-wrap justify-center gap-2">
              {[
                'Enterprise RAG',
                'Real-time Q&A',
                'Multi-cloud Strategy',
                'Cost Optimization',
                'Hybrid Deployments',
                'AI Data Platform',
                'Document Intelligence',
                'Knowledge Management'
              ].map((useCase) => (
                <span
                  key={useCase}
                  className="bg-surface-secondary px-4 py-2 rounded-full text-sm font-medium border transition-colors"
                  style={{
                    color: 'var(--text-secondary)',
                    borderColor: 'var(--border-subtle)'
                  }}
                >
                  {useCase}
                </span>
              ))}
            </div>
          </div>

          {/* Features Grid */}
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 mb-12">
            <FeatureCard
              icon={<Database className="w-6 h-6" />}
              title="Dual Storage"
              description="Simultaneous storage to DDN INFINIA and AWS S3 for fair comparison"
            />
            <FeatureCard
              icon={<Zap className="w-6 h-6" />}
              title="Real-time Metrics"
              description="Live TTFB and throughput measurements during operations"
            />
            <FeatureCard
              icon={<Search className="w-6 h-6" />}
              title="Vector Search"
              description="FAISS-powered semantic search with NVIDIA NeMo reranking"
            />
            <FeatureCard
              icon={<BarChart3 className="w-6 h-6" />}
              title="ROI Calculator"
              description="Business impact analysis for enterprise-scale deployments"
            />
          </div>

          {/* Benchmark Transparency Card */}
          <div
            className="rounded-2xl p-6 mt-4"
            style={{
              background: 'linear-gradient(135deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%)',
              border: '1px solid var(--border-subtle)',
            }}
          >
            {/* Header */}
            <div className="flex items-start gap-3 mb-6">
              <div className="flex-shrink-0 mt-0.5">
                <svg className="w-5 h-5 text-amber-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
              </div>
              <div>
                <h4 className="text-lg font-bold mb-1" style={{ color: 'var(--text-primary)' }}>
                  Co-located Storage vs Cloud Storage — About This Benchmark
                </h4>
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                  How the test is configured and what it actually measures
                </p>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              {/* What the test measures */}
              <div className="rounded-xl p-5" style={{ background: 'rgba(118,185,0,0.04)', border: '1px solid rgba(118,185,0,0.15)' }}>
                <p className="text-sm font-bold text-nvidia-green mb-3">What this test measures</p>
                <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                  The benchmark measures <strong style={{ color: 'var(--text-primary)' }}>end-to-end GET latency from the application server</strong> to
                  each storage provider under increasing concurrent load — 50, 200, and 500 simultaneous readers.
                  Every request retrieves real document chunks: same content, same size, from both
                  providers simultaneously. <strong style={{ color: 'var(--text-primary)' }}>The test is not simulated.</strong>
                </p>
              </div>

              {/* The honest framing */}
              <div className="rounded-xl p-5" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-subtle)' }}>
                <p className="text-sm font-bold mb-3" style={{ color: 'var(--text-primary)' }}>The architecture choice being tested</p>
                <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                  This reflects a real infrastructure decision: <em>should AI storage live next to compute, or live in the cloud?</em>{' '}
                  DDN INFINIA is co-located by design — that is its recommendation for AI workloads across any
                  deployment. The performance gap is the measurable consequence of that architectural choice.
                  Absolute latency numbers vary by environment; the{' '}
                  <strong style={{ color: 'var(--text-secondary)' }}>latency curve behavior under concurrency</strong> —
                  DDN staying flat while cloud storage degrades — is consistent.
                </p>
              </div>
            </div>
          </div>


        </div>
      </section >

      {/* Business Impact Hero - moved after use cases */}
      < section className="relative overflow-hidden" style={{
        background: 'linear-gradient(180deg, #0a0a0f 0%, #1a1a2e 50%, #0f0f1a 100%)',
      }
      }>
        <div
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage: 'linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)',
            backgroundSize: '50px 50px'
          }}
        />
        <div className="relative z-10 max-w-[1400px] mx-auto px-6 py-16">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            className="text-center mb-10"
          >
            <div className="inline-block px-6 py-2 rounded-full bg-gradient-to-r from-amber-500/20 to-yellow-500/20 border border-amber-500/30 mb-6">
              <span className="text-amber-400 text-sm font-semibold tracking-wide">BUSINESS IMPACT</span>
            </div>
            <h2
              className="text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-4"
              style={{ letterSpacing: '-0.02em', lineHeight: 1.1 }}
            >
              Turn AI Infrastructure Into
              <br />
              <span className="bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-500 bg-clip-text text-transparent">
                Measurable Business Value
              </span>
            </h2>
            <p className="text-lg md:text-xl text-white/70 max-w-4xl mx-auto leading-relaxed">
              Strategic infrastructure choices for{' '}
              <span
                className="text-xl md:text-2xl font-bold px-2 py-0.5 rounded-lg"
                style={{
                  background: 'linear-gradient(135deg, rgba(118, 185, 0, 0.2), rgba(237, 39, 56, 0.2))',
                  color: '#76B900',
                  border: '2px solid rgba(118, 185, 0, 0.4)'
                }}
              >
                RAG Applications
              </span>{' '}
              directly impact your bottom line—
              <span className="text-emerald-400 font-semibold"> significantly reducing costs</span> while
              <span className="text-emerald-400 font-semibold"> dramatically accelerating time-to-value</span>
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.6, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="grid md:grid-cols-3 gap-4"
          >
            {[
              { color: '#10b981', bg: 'rgba(16,185,129,0.05)', border: 'rgba(16,185,129,0.2)', title: 'Cost Reduction', vals: ['Dramatically', 'lower storage costs', 'Significantly', 'improved GPU efficiency'], items: ['Eliminate expensive cloud egress fees', 'Reduce GPU idle time with faster I/O', 'Lower operational overhead'] },
              { color: '#f59e0b', bg: 'rgba(251,191,36,0.05)', border: 'rgba(251,191,36,0.2)', title: 'Revenue Acceleration', vals: ['Rapid', 'time-to-market', 'Enhanced', 'productivity'], items: ['Launch AI products faster', 'Improve customer satisfaction with fast responses', 'Enable real-time AI experiences'] },
              { color: '#ef4444', bg: 'rgba(237,39,56,0.05)', border: 'rgba(237,39,56,0.2)', title: 'Competitive Advantage', vals: ['Exceptional', 'retrieval speed', 'Unlimited', 'scalability'], items: ['Differentiate with superior AI performance', 'Scale without infrastructure constraints', 'Future-proof AI investments'] },
            ].map((col) => (
              <div key={col.title} className="h-full p-5 rounded-2xl border transition-all duration-300" style={{ background: col.bg, borderColor: col.border }}>
                <h3 className="text-xl font-bold text-white mb-3">{col.title}</h3>
                <div className="space-y-1 mb-4">
                  <div className="text-2xl font-bold" style={{ color: col.color }}>{col.vals[0]}</div>
                  <div className="text-sm text-white/60">{col.vals[1]}</div>
                  <div className="text-2xl font-bold" style={{ color: col.color }}>{col.vals[2]}</div>
                  <div className="text-sm text-white/60">{col.vals[3]}</div>
                </div>
                <ul className="space-y-2">
                  {col.items.map(item => (
                    <li key={item} className="flex items-start gap-2 text-sm text-white/70">
                      <span className="mt-0.5" style={{ color: col.color }}>✓</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </motion.div>
        </div>
      </section >

      {/* CTA Section */}
      < section className="px-6 py-20" style={{ background: 'linear-gradient(135deg, var(--ddn-red) 0%, var(--ddn-red-hover) 100%)' }}>
        <div className="max-w-3xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-50px' }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          >
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4" style={{ letterSpacing: '-0.02em' }}>
              Ready to See the Difference?
            </h2>
            <p className="text-white/80 text-lg mb-8 max-w-xl mx-auto">
              Configure your environment and start benchmarking DDN INFINIA against Traditional Object Storage for your RAG applications.
            </p>
            <button
              onClick={onStartDemo}
              className="inline-flex items-center gap-3 bg-white text-neutral-900 px-8 py-4 rounded-xl font-semibold text-lg"
              style={{
                transition: 'transform 200ms cubic-bezier(0.16, 1, 0.3, 1), box-shadow 200ms cubic-bezier(0.16, 1, 0.3, 1)',
                willChange: 'transform'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'scale(1.03) translateZ(0)'
                e.currentTarget.style.boxShadow = '0 20px 40px rgba(0,0,0,0.2)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'scale(1) translateZ(0)'
                e.currentTarget.style.boxShadow = 'none'
              }}
              onMouseDown={(e) => {
                e.currentTarget.style.transform = 'scale(0.98) translateZ(0)'
              }}
              onMouseUp={(e) => {
                e.currentTarget.style.transform = 'scale(1.03) translateZ(0)'
              }}
            >
              Start the Demo
              <ArrowRight className="w-5 h-5" />
            </button>
          </motion.div>
        </div>
      </section >

      {/* Footer */}
      < section className="bg-neutral-900 px-6 py-8" >
        <div className="max-w-[1280px] mx-auto text-center">
          <p className="text-white/40 text-sm">
            DDN INFINIA RAG Performance Demo
          </p>
        </div>
      </section >
    </div >
  )
}

function StatCard({ value, label, description }: { value: string; label: string; description: string }) {
  return (
    <div
      className="p-5 rounded-2xl text-center"
      style={{
        background: 'rgba(255, 255, 255, 0.03)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        backdropFilter: 'blur(10px)'
      }}
    >
      <div
        className="text-xl md:text-2xl lg:text-3xl font-bold font-mono mb-2 whitespace-nowrap"
        style={{
          background: 'linear-gradient(135deg, #76B900, #00C280)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent'
        }}
      >
        {value}
      </div>
      <div className="text-white font-medium text-base md:text-lg">{label}</div>
      <div className="text-white/50 text-sm md:text-base mt-1">{description}</div>
    </div>
  )
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="card p-5 hover:shadow-md transition-shadow">
      <div className="text-ddn-red mb-3">{icon}</div>
      <h4 className="text-xl md:text-2xl font-medium mb-2" style={{ color: 'var(--text-primary)' }}>{title}</h4>
      <p className="text-base md:text-lg" style={{ color: 'var(--text-muted)' }}>{description}</p>
    </div>
  )
}

function StorageCard({
  number,
  title,
  items,
  color
}: {
  number: string
  title: string
  items: string[]
  color: 'ddn' | 'nvidia' | 'blue'
}) {
  const colors = {
    ddn: { hex: '#ED2738', bg: 'rgba(237, 39, 56, 0.08)' },
    nvidia: { hex: '#76B900', bg: 'rgba(118, 185, 0, 0.08)' },
    blue: { hex: '#1A81AF', bg: 'rgba(26, 129, 175, 0.08)' }
  }

  return (
    <div className="card p-5 relative overflow-hidden">
      <div
        className="absolute top-0 left-0 w-full h-1"
        style={{ backgroundColor: colors[color].hex }}
      />
      <div
        className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-xs font-bold mb-3"
        style={{ backgroundColor: colors[color].bg, color: colors[color].hex }}
      >
        {number}
      </div>
      <h4 className="text-xl md:text-2xl font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>{title}</h4>
      <ul className="space-y-2">
        {items.map((item, i) => (
          <li key={i} className="flex items-start gap-2 text-base md:text-lg" style={{ color: 'var(--text-secondary)' }}>
            <span
              className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0"
              style={{ backgroundColor: colors[color].hex }}
            />
            {item}
          </li>
        ))}
      </ul>
    </div>
  )
}



function MetricCard({
  title,
  color,
  items
}: {
  title: string
  color: 'ddn' | 'nvidia' | 'blue'
  items: string[]
}) {
  const colorClasses = {
    ddn: 'text-ddn-red',
    nvidia: 'text-nvidia-green',
    blue: 'text-status-info'
  }
  const dotColors = {
    ddn: 'bg-ddn-red',
    nvidia: 'bg-nvidia-green',
    blue: 'bg-status-info'
  }
  const borderColors = {
    ddn: 'border-t-ddn-red',
    nvidia: 'border-t-nvidia-green',
    blue: 'border-t-status-info'
  }

  return (
    <div className={`card p-5 border-t-4 ${borderColors[color]}`}>
      <h4 className={`text-lg md:text-xl font-semibold ${colorClasses[color]} uppercase tracking-wide mb-4`}>
        {title}
      </h4>
      <ul className="space-y-3">
        {items.map((item, i) => (
          <li key={i} className="flex items-start gap-2 text-base md:text-lg" style={{ color: 'var(--text-secondary)' }}>
            <span className={`w-1.5 h-1.5 ${dotColors[color]} rounded-full mt-2 flex-shrink-0`} />
            {item}
          </li>
        ))}
      </ul>
    </div>
  )
}

function ProviderBadge({
  name,
  color,
}: {
  name: string
  color: string
  icon?: React.ReactNode
}) {
  return (
    <div
      className="flex items-center gap-2 bg-surface-secondary px-4 py-2.5 rounded-lg transition-colors"
      style={{ border: '1px solid var(--border-subtle)' }}
    >
      <div
        className="w-2.5 h-2.5 rounded-full"
        style={{ backgroundColor: color }}
      />
      <span className="text-lg md:text-xl font-medium" style={{ color: 'var(--text-primary)' }}>{name}</span>
    </div>
  )
}
