import { useEffect, useRef, useState, useCallback, CSSProperties } from 'react'

/* ─── Slide definitions ─── */
const SLIDE_TITLES = [
  'Cover', 'The Problem', 'The Solution', 'Architecture',
  'Demo: Ingestion', 'Human in the Loop', 'Semantic Search',
  'Continuous Ingestion', 'Business Case', 'Closing'
]

/* Demo slides that contain a video slot */
const DEMO_VIDEO_SLIDE = new Set([4, 5, 6, 7])

/* ─── Shared style constants ─── */
const RED = '#ED2738'
const GREEN = '#76B900'
const AMBER = '#F59E0B'
const BLUE = '#3B82F6'
const PURPLE = '#8B5CF6'
const TEAL = '#10B981'

const pill = (bg: string, color: string, border?: string): CSSProperties => ({
  padding: '7px 16px', borderRadius: 999, fontSize: 14, fontWeight: 700,
  display: 'inline-flex', alignItems: 'center',
  background: bg, color, border: border ?? 'none',
})

const card = (bg: string, border: string): CSSProperties => ({
  borderRadius: 16, padding: 20, background: bg, border,
})

const statBox = (bg: string, border: string): CSSProperties => ({
  borderRadius: 14, padding: '20px 24px', textAlign: 'center', background: bg, border,
})

/* ─── Video Slot component ─── */
interface VideoSlotProps {
  id: string
  accentColor: string
  accentBg: string
  icon: string
  title: string
  desc: string
  badge: string
  badgeN: string
}
function VideoSlot({ id, accentColor, accentBg, icon, title, desc, badge, badgeN }: VideoSlotProps) {
  const vidRef = useRef<HTMLVideoElement>(null)
  const [loaded, setLoaded] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [muted, setMuted] = useState(false)

  const handleFile = (file: File) => {
    if (!file.type.startsWith('video/')) return
    const url = URL.createObjectURL(file)
    if (vidRef.current) { vidRef.current.src = url; vidRef.current.load() }
    setLoaded(true); setPlaying(false)
  }

  const togglePlay = (e: React.MouseEvent) => {
    e.stopPropagation()
    const v = vidRef.current; if (!v) return
    if (v.paused) { v.play(); setPlaying(true) } else { v.pause(); setPlaying(false) }
  }
  const toggleMute = (e: React.MouseEvent) => {
    e.stopPropagation()
    const v = vidRef.current; if (!v) return
    v.muted = !v.muted; setMuted(v.muted)
  }

  return (
    <div style={{ borderRadius: 16, overflow: 'hidden', display: 'flex', flexDirection: 'column', background: accentBg, border: `1.5px solid ${accentColor}40`, height: '100%' }}>
      {/* Header */}
      <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10, borderBottom: '1px solid rgba(0,0,0,.06)' }}>
        <div style={{ width: 32, height: 32, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, background: `${accentColor}18` }}>{icon}</div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>{title}</div>
          <div style={{ fontSize: 11, color: '#64748b' }}>{desc}</div>
        </div>
        <div style={{ marginLeft: 'auto', fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: 999, background: `${accentColor}18`, color: accentColor }}>{badge}</div>
      </div>
      {/* Body */}
      <div
        style={{ flex: 1, minHeight: 180, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0f172a', position: 'relative', cursor: 'pointer' }}
        onClick={() => { if (!loaded) document.getElementById(`${id}-file`)?.click() }}
        onDragOver={e => { e.preventDefault() }}
        onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f) }}
      >
        <video ref={vidRef} loop style={{ display: loaded ? 'block' : 'none', width: '100%', height: '100%', objectFit: 'cover', position: 'absolute', inset: 0 }} />
        {!loaded && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: 20, borderRadius: 12, border: '1.5px dashed rgba(255,255,255,.2)', background: 'rgba(255,255,255,.04)', cursor: 'pointer', transition: 'all .2s' }}>
            <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'rgba(255,255,255,.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>📁</div>
            <span style={{ fontSize: 12, color: 'rgba(255,255,255,.5)' }}>Click or drag a video file here</span>
          </div>
        )}
        {loaded && (
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 8, background: 'linear-gradient(to top, rgba(0,0,0,.7), transparent)' }}>
            <button onClick={togglePlay} style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(255,255,255,.2)', border: 'none', cursor: 'pointer', color: '#fff', fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{playing ? '⏸' : '▶'}</button>
            <button onClick={toggleMute} style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(255,255,255,.2)', border: 'none', cursor: 'pointer', color: '#fff', fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{muted ? '🔇' : '🔊'}</button>
            <span style={{ fontSize: 10, color: 'rgba(255,255,255,.5)', marginLeft: 4 }}>{playing ? 'Playing' : 'Paused'}</span>
            <span style={{ marginLeft: 'auto', fontSize: 10, color: 'rgba(255,255,255,.4)' }}>{badgeN}</span>
          </div>
        )}
        <input type="file" id={`${id}-file`} accept="video/*" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />
      </div>
    </div>
  )
}

/* ─── Slide components ─── */

function Slide1() {
  return (
    <div style={{ display: 'flex', height: '100%', background: '#fff' }}>
      {/* Dark left panel */}
      <div style={{ width: 300, flexShrink: 0, background: 'linear-gradient(160deg,#1e293b 60%,#0f172a)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: 36 }}>
        <div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 24 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: RED }} />
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: GREEN }} />
            <span style={{ color: 'rgba(255,255,255,.3)', fontSize: 11, marginLeft: 8 }}>GTC 2026</span>
          </div>
          <div style={{ fontSize: 40, fontWeight: 900, color: '#fff' }}>DDN</div>
          <div style={{ fontSize: 16, fontWeight: 300, color: 'rgba(255,255,255,.4)', marginBottom: 16 }}>INFINIA</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <div style={{ height: 1, width: 24, background: 'rgba(255,255,255,.2)' }} />
            <span style={{ color: 'rgba(255,255,255,.3)', fontSize: 12 }}>×</span>
            <div style={{ height: 1, width: 24, background: 'rgba(255,255,255,.2)' }} />
          </div>
          <div style={{ fontSize: 26, fontWeight: 900, color: GREEN }}>NVIDIA</div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,.3)', marginTop: 4 }}>VSS Blueprint</div>
        </div>
        <div>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,.3)', letterSpacing: '.12em', textTransform: 'uppercase' }}>DDN Theatre Booth</div>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,.2)', marginTop: 4 }}>Build.DDN:VSS · Multimodal Semantic Video Search</div>
        </div>
      </div>
      {/* Right content */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: 56 }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 14px', borderRadius: 999, background: '#FFF8E6', border: '1px solid rgba(245,158,11,.2)', marginBottom: 20 }}>
          <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: AMBER }}>✦ GTC 2026 Showcase</span>
        </div>
        <h1 style={{ fontSize: 72, fontWeight: 900, lineHeight: 1.1, color: '#0f172a', marginBottom: 4 }}>
          From Video Chaos<br />to <em style={{ fontStyle: 'normal', color: RED }}>Instant</em><br />Intelligence.
        </h1>
        <p style={{ fontSize: 18, color: '#64748b', lineHeight: 1.7, maxWidth: 480, marginBottom: 28 }}>
          AI-powered semantic search across petabyte-scale video — natural language queries, sub-2-second results, no separate vector database.
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          <span style={pill('#FFF0F1', RED, `1px solid ${RED}26`)}>GPU Accelerated</span>
          <span style={pill('#F4FBEA', GREEN, `1px solid ${GREEN}26`)}>Multimodal AI</span>
          <span style={pill('#EFF6FF', BLUE, `1px solid ${BLUE}26`)}>DDN Native</span>
          <span style={pill('#FFFBEB', AMBER, `1px solid ${AMBER}26`)}>LLM Enriched</span>
        </div>
      </div>
    </div>
  )
}

function SlideHeader({ num, label, title, titleSpan, sub }: { num: string; label: string; title: string; titleSpan?: string; sub: string }) {
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
        <div style={{ width: 36, height: 36, borderRadius: '50%', background: RED, color: '#fff', fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{num}</div>
        <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', color: RED }}>{label}</div>
      </div>
      <h2 style={{ fontSize: 40, fontWeight: 900, color: '#0f172a', lineHeight: 1.2, marginBottom: 6 }}>
        {title}{titleSpan && <> <span style={{ color: RED }}>{titleSpan}</span></>}
      </h2>
      <p style={{ fontSize: 16, color: '#94a3b8', marginBottom: 20 }}>{sub}</p>
    </>
  )
}

function Slide2() {
  return (
    <div style={{ padding: 40, display: 'flex', flexDirection: 'column', height: '100%', background: '#fff' }}>
      <SlideHeader num="02" label="The Challenge" title="The Problem with" titleSpan="Video Data" sub="Enterprises sit on petabytes of dark, untagged video. AI teams burn weeks finding edge cases for model fine-tuning." />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, flex: 1 }}>
        <div style={card('#FFF0F1', `1.5px solid ${RED}26`)}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>🕒</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: RED, marginBottom: 8 }}>Hours of Manual Search</div>
          <p style={{ fontSize: 12, color: '#64748b', lineHeight: 1.6 }}>Analysts scrub through footage frame-by-frame. Traditional CCTV has no semantic awareness. Search = play → scrub → repeat.</p>
        </div>
        <div style={card('#FFFBEB', `1.5px solid ${AMBER}26`)}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>💸</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: AMBER, marginBottom: 8 }}>$2M–$5M Wasted Annually</div>
          <p style={{ fontSize: 12, color: '#64748b', lineHeight: 1.6 }}>Manual annotation tooling, vector DB licenses, cloud egress bills, and S3 cold-storage tiers compound into runaway cost.</p>
        </div>
        <div style={card('#F5F3FF', `1.5px solid ${PURPLE}26`)}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>🔒</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: PURPLE, marginBottom: 8 }}>95% Dark Data</div>
          <p style={{ fontSize: 12, color: '#64748b', lineHeight: 1.6 }}>The vast majority of enterprise video is siloed, unindexed, and invisible to AI training pipelines — a cost center with zero intelligence value.</p>
        </div>
      </div>
    </div>
  )
}

function Slide3() {
  return (
    <div style={{ padding: 40, display: 'flex', flexDirection: 'column', height: '100%', background: '#fff' }}>
      <SlideHeader num="03" label="The Solution" title="Type It. Find It." titleSpan="Act On It." sub="" />
      <div style={{ background: '#F4FBEA', border: `1.5px solid ${GREEN}59`, borderRadius: 14, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12, flexShrink: 0 }}>
        <span style={{ fontSize: 20 }}>🔍</span>
        <span style={{ fontSize: 14, color: '#334155', fontWeight: 500 }}>"White SUV near Gate 3 between 14:00 and 20:00"</span>
        <span style={{ ...pill(`${GREEN}1e`, GREEN), marginLeft: 'auto' }}>Results in &lt;2s</span>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16, flexShrink: 0 }}>
        <span style={pill('#ECFDF5', TEAL)}>#vehicle_presence</span>
        <span style={pill('#FFF0F1', RED)}>#restricted_access</span>
        <span style={pill('#FFFBEB', AMBER)}>#crowd_density_high</span>
        <span style={pill('#EFF6FF', BLUE)}>#low_visibility_fog</span>
        <span style={pill('#F5F3FF', PURPLE)}>#pedestrian_zone</span>
        <span style={pill('#F4FBEA', GREEN)}>#gate3_perimeter</span>
      </div>
      <div style={{ height: 1, background: '#f1f5f9', marginBottom: 16, flexShrink: 0 }} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, flex: 1 }}>
        <div style={card('#F4FBEA', `1.5px solid ${GREEN}33`)}>
          <div style={{ fontSize: 24, marginBottom: 8 }}>🧠</div>
          <div style={{ fontSize: 13, fontWeight: 700, color: GREEN, marginBottom: 6 }}>Semantic Understanding</div>
          <p style={{ fontSize: 11, color: '#64748b', lineHeight: 1.5 }}>Maps synonyms automatically — "car crash" finds "vehicle collision". Understands scenes, objects, behaviors, and context.</p>
        </div>
        <div style={card('#FFF0F1', `1.5px solid ${RED}33`)}>
          <div style={{ fontSize: 24, marginBottom: 8 }}>⚡</div>
          <div style={{ fontSize: 13, fontWeight: 700, color: RED, marginBottom: 6 }}>GPU-Accelerated AI</div>
          <p style={{ fontSize: 11, color: '#64748b', lineHeight: 1.5 }}>BLIP captions every keyframe. CLIP creates semantic embeddings co-located with video in DDN Infinia. Zero data movement.</p>
        </div>
        <div style={card('#EFF6FF', `1.5px solid ${BLUE}33`)}>
          <div style={{ fontSize: 24, marginBottom: 8 }}>💬</div>
          <div style={{ fontSize: 13, fontWeight: 700, color: BLUE, marginBottom: 6 }}>LLM Enrichment</div>
          <p style={{ fontSize: 11, color: '#64748b', lineHeight: 1.5 }}>GPT-4o-mini or Ollama 7B generates narrative summaries and AI search hashtags automatically on every upload.</p>
        </div>
      </div>
    </div>
  )
}

function Slide4() {
  const steps = [
    { n: '01', name: 'Video Upload', sub: 'MP4 / MOV drag-in', bg: '#FFF0F1', border: RED, color: RED },
    { n: '02', name: 'GPU Chunking', sub: 'Scene segmentation', bg: '#FFFBEB', border: AMBER, color: AMBER },
    { n: '03', name: 'AI Analysis', sub: 'BLIP + CLIP embeds', bg: '#F4FBEA', border: GREEN, color: GREEN },
    { n: '04', name: 'LLM Enrich', sub: 'GPT-4o / Ollama 7B', bg: '#EFF6FF', border: BLUE, color: BLUE },
    { n: '05', name: 'DDN Infinia', sub: 'Metadata + vectors', bg: '#ECFDF5', border: TEAL, color: TEAL },
  ]
  const bullets = [
    'Distributed key-value store — unlimited metadata capacity',
    'GPU-Direct NVMe: disk → GPU with zero CPU bottleneck',
    'No separate vector DB — CLIP embeddings stored natively',
    'Linear scale: 1PB and 100PB respond identically',
  ]
  const stats = [
    { val: '~85%', lbl: 'GPU Utilization', bg: '#FFF0F1', border: `1.5px solid ${RED}26`, color: RED },
    { val: '<2s', lbl: 'Query Latency', bg: '#F4FBEA', border: `1.5px solid ${GREEN}26`, color: GREEN },
    { val: '$0', lbl: 'Vector DB Cost', bg: '#EFF6FF', border: `1.5px solid ${BLUE}26`, color: BLUE },
    { val: '∞', lbl: 'Scale Ceiling', bg: '#ECFDF5', border: `1.5px solid ${TEAL}26`, color: TEAL },
  ]
  return (
    <div style={{ padding: 40, display: 'flex', flexDirection: 'column', height: '100%', background: '#fff' }}>
      <SlideHeader num="04" label="Architecture" title="How It Works" titleSpan="Under the Hood" sub="Built on NVIDIA VSS Blueprint · Powered by DDN Infinia" />
      {/* Pipeline */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 0, overflowX: 'auto', marginBottom: 20, flexShrink: 0 }}>
        {steps.map((s, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
            <div style={{ borderRadius: 14, padding: '12px 14px', background: s.bg, border: `1.5px solid ${s.border}`, flexShrink: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', marginBottom: 4, color: s.color }}>{s.n}</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#1e293b', lineHeight: 1.2 }}>{s.name}</div>
              <div style={{ fontSize: 13, color: '#64748b', marginTop: 2 }}>{s.sub}</div>
            </div>
            {i < steps.length - 1 && <div style={{ fontSize: 18, color: '#cbd5e1', flexShrink: 0, padding: '0 4px' }}>→</div>}
          </div>
        ))}
      </div>
      {/* Infinia callout */}
      <div style={{ background: '#F4FBEA', border: `1.5px solid ${GREEN}59`, borderRadius: 16, padding: 16, marginBottom: 16, flexShrink: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: GREEN, marginBottom: 10 }}>★ DDN Infinia — The Intelligence Layer</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {bullets.map((b, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 11, color: '#475569', lineHeight: 1.5 }}>
              <span style={{ flexShrink: 0, fontWeight: 700 }}>→</span><span>{b}</span>
            </div>
          ))}
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
        {stats.map((s, i) => (
          <div key={i} style={statBox(s.bg, s.border)}>
            <div style={{ fontSize: 42, fontWeight: 900, color: s.color }}>{s.val}</div>
            <div style={{ fontSize: 14, color: '#64748b', marginTop: 4, fontWeight: 500 }}>{s.lbl}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

function Slide5() {
  const steps = [
    { n: 1, color: RED, title: 'Upload Trigger', desc: 'Video dropped into the Media Intelligence page — stored instantly to DDN Infinia raw bucket.' },
    { n: 2, color: AMBER, title: 'GPU Frame Analysis', desc: 'BLIP generates captions for every keyframe. CLIP creates 512-dim semantic embeddings — all on GPU, co-located with storage.' },
    { n: 3, color: GREEN, title: 'LLM Enrichment', desc: 'GPT-4o-mini or Ollama 7B synthesizes captions into a narrative summary and generates AI search hashtags.' },
    { n: 4, color: BLUE, title: 'Manifest Written', desc: 'All metadata — summary, enriched tags, embeddings, chunk paths — stored natively on the Infinia object. No separate DB.' },
  ]
  const stepColors = [RED, AMBER, GREEN, BLUE]
  return (
    <div style={{ padding: 40, display: 'flex', flexDirection: 'column', height: '100%', background: '#fff' }}>
      <SlideHeader num="05" label="Demo 01 · Ingestion" title="Video" titleSpan="Ingestion Pipeline" sub="Upload any video → GPU chunking → AI analysis → LLM enrichment → stored in DDN Infinia with full metadata" />
      <div style={{ display: 'flex', gap: 24, flex: 1 }}>
        <div style={{ width: '52%', flexShrink: 0 }}>
          <VideoSlot id="vs1" accentColor={RED} accentBg="#FFF8F8" icon="📥" title="Ingestion Demo" desc="Upload video & watch AI processing" badge="Demo 01" badgeN="Live Demo" />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, flex: 1 }}>
          {steps.map((s, i) => (
            <div key={i} style={{ borderRadius: 16, padding: 20, background: `${stepColors[i]}0d`, border: `1px solid ${stepColors[i]}26` }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <div style={{ width: 22, height: 22, borderRadius: '50%', background: s.color, color: '#fff', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{s.n}</div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#1e293b' }}>{s.title}</div>
                  <div style={{ fontSize: 11, color: '#64748b', marginTop: 3, lineHeight: 1.5 }}>{s.desc}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function Slide6() {
  return (
    <div style={{ padding: 40, display: 'flex', flexDirection: 'column', height: '100%', background: '#fff' }}>
      <SlideHeader num="06" label="Demo 02 · Human in the Loop" title="Human-in-the-Loop" titleSpan="Curation" sub="Review AI-generated tags, refine summaries, add context — every edit persists to DDN Infinia instantly" />
      <div style={{ display: 'flex', gap: 24, flex: 1 }}>
        <div style={{ width: '52%', flexShrink: 0 }}>
          <VideoSlot id="vs2" accentColor={PURPLE} accentBg="#F8F5FF" icon="🧑‍💼" title="Human in the Loop Demo" desc="Edit AI tags & summaries on the video card" badge="Demo 02" badgeN="Live Demo" />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, flex: 1 }}>
          <div style={card('#F8F5FF', `1.5px solid ${PURPLE}26`)}>
            <div style={{ fontSize: 13, fontWeight: 700, color: PURPLE, marginBottom: 10 }}>What the Analyst Sees</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              {['🔮  AI-generated summary shown in orange "Enriched" card', '#️⃣  LLM search tags displayed as orange hashtag pills', '✏️  Click Edit to modify tags or summary inline', '💾  Save writes directly back to DDN Infinia manifest'].map((t, i) => (
                <div key={i} style={{ fontSize: 12, color: '#475569' }}>{t}</div>
              ))}
            </div>
          </div>
          <div style={card('#F4FBEA', `1.5px solid ${GREEN}26`)}>
            <div style={{ fontSize: 13, fontWeight: 700, color: GREEN, marginBottom: 8 }}>Why This Matters</div>
            <p style={{ fontSize: 12, color: '#475569', lineHeight: 1.6 }}>Ground-truth annotations from domain experts improve search precision over time. AI does the heavy lifting; humans add the context models miss. All corrections are stored as enriched metadata — searchable immediately.</p>
          </div>
        </div>
      </div>
    </div>
  )
}

function Slide7() {
  const queries = ['"Person in red jacket near entrance"', '"Crowded corridor with bags"', '"Empty parking lot at night"', '"Two people arguing"']
  const cards7 = [
    { icon: '🔤', color: BLUE, bg: `${BLUE}0d`, border: `${BLUE}26`, title: 'Query Embedding', desc: 'Your text query is embedded via CLIP into the same 512-dim vector space as the video frames.' },
    { icon: '🔍', color: PURPLE, bg: `${PURPLE}0d`, border: `${PURPLE}26`, title: 'Cosine Similarity', desc: 'Similarity search runs across all stored embeddings in DDN Infinia — no round-trip to a separate vector DB.' },
    { icon: '🏷️', color: TEAL, bg: `${TEAL}0d`, border: `${TEAL}26`, title: 'Tag Matching', desc: 'LLM-enriched hashtags are also matched — boosting recall for domain-specific terminology.' },
    { icon: '⚡', color: AMBER, bg: `${AMBER}0d`, border: `${AMBER}26`, title: 'Sub-2s Results', desc: 'Ranked results surface with presigned video URLs, AI summaries, and matched tags — ready to play.' },
  ]
  return (
    <div style={{ padding: 40, display: 'flex', flexDirection: 'column', height: '100%', background: '#fff' }}>
      <SlideHeader num="07" label="Demo 03 · Semantic Search" title="Natural Language" titleSpan="Search" sub="Search the entire video archive with plain English — results in under 2 seconds, at any scale" />
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16, flexShrink: 0 }}>
        {queries.map((q, i) => <span key={i} style={pill('#f1f5f9', '#475569')}>{q}</span>)}
      </div>
      <div style={{ display: 'flex', gap: 24, flex: 1 }}>
        <div style={{ width: '52%', flexShrink: 0 }}>
          <VideoSlot id="vs3" accentColor={BLUE} accentBg="#F0F7FF" icon="🔍" title="Search Demo" desc="Watch natural language query return video clips" badge="Demo 03" badgeN="Live Demo" />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, flex: 1 }}>
          {cards7.map((c, i) => (
            <div key={i} style={{ borderRadius: 16, padding: 20, background: c.bg, border: `1px solid ${c.border}` }}>
              <div style={{ fontSize: 18, marginBottom: 6 }}>{c.icon}</div>
              <div style={{ fontSize: 12, fontWeight: 700, color: c.color, marginBottom: 4 }}>{c.title}</div>
              <p style={{ fontSize: 11, color: '#64748b', lineHeight: 1.5 }}>{c.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function Slide8() {
  const how = ['👁️  Bucket Monitor polls DDN Infinia every 30s for new objects', '🤖  New video triggers automatic GPU-accelerated AI processing', '✨  LLM enrichment runs on completion — tags + summary written to manifest', '🔎  Video is immediately searchable — no manual intervention required']
  return (
    <div style={{ padding: 40, display: 'flex', flexDirection: 'column', height: '100%', background: '#fff' }}>
      <SlideHeader num="08" label="Demo 04 · Continuous Ingestion" title="Continuous Ingestion —" titleSpan="Always On" sub="Bucket monitor watches DDN Infinia for new uploads — AI enrichment runs automatically, 24/7" />
      <div style={{ display: 'flex', gap: 24, flex: 1 }}>
        <div style={{ width: '52%', flexShrink: 0 }}>
          <VideoSlot id="vs4" accentColor={TEAL} accentBg="#F0FDF8" icon="♻️" title="Continuous Ingestion Demo" desc="Watch the pipeline auto-process new uploads" badge="Demo 04" badgeN="Live Demo" />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, flex: 1 }}>
          <div style={card('#ECFDF5', `1.5px solid ${TEAL}33`)}>
            <div style={{ fontSize: 13, fontWeight: 700, color: TEAL, marginBottom: 10 }}>How the Pipeline Runs</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {how.map((h, i) => <div key={i} style={{ fontSize: 12, color: '#475569' }}>{h}</div>)}
            </div>
          </div>
          <div style={card('#F4FBEA', `1px solid ${GREEN}26`)}>
            <div style={{ fontSize: 13, fontWeight: 700, color: GREEN, marginBottom: 6 }}>Scalability</div>
            <p style={{ fontSize: 12, color: '#475569', lineHeight: 1.6 }}>Scales linearly with DDN Infinia — adding 100TB of new video requires zero rebalancing, zero reindexing, zero downtime. Every new asset is live the moment processing completes.</p>
          </div>
        </div>
      </div>
    </div>
  )
}

function Slide9() {
  const cols = [
    {
      color: TEAL, bg: '#ECFDF5', border: `1.5px solid ${TEAL}33`, title: 'Business Outcome',
      badge: 'Dark Data → Intelligence', badgeBg: '#fff', badgeColor: TEAL, badgeBorder: `${TEAL}40`,
      bullets: ['1 analyst replaces 3-person tagging team', 'PB-scale NLP results in <2 seconds', 'Edge-case curation: weeks → minutes', 'AI iteration: months → days'],
      quote: '"Our data estate became an active intelligence asset."',
    },
    {
      color: AMBER, bg: '#FFFBEB', border: `1.5px solid ${AMBER}33`, title: 'Financial Outcome',
      badge: '$2M–$5M Eliminated', badgeBg: '#fff', badgeColor: AMBER, badgeBorder: `${AMBER}40`,
      bullets: ['$500K–$2M vector DB deferred to $0', '$800K–$3M/yr egress costs removed', 'Annotation budget eliminated', 'CLIP reuse → zero marginal cost per query'],
      quote: '"One infra decision eliminated three budget lines."',
    },
    {
      color: RED, bg: '#FFF0F1', border: `1.5px solid ${RED}33`, title: 'AI Infra Impact',
      badge: 'GPU: 40% → >85%', badgeBg: '#fff', badgeColor: RED, badgeBorder: `${RED}40`,
      bullets: ['Co-located inference — zero I/O starvation', 'Sub-2s TTFT (time-to-first-token)', 'NVIDIA VSS blueprint — zero integration debt', 'Linear scale — no rebalancing needed'],
      quote: '"GPUs now run at the speed we paid for."',
    },
  ]
  return (
    <div style={{ padding: 40, display: 'flex', flexDirection: 'column', height: '100%', background: '#fff' }}>
      <SlideHeader num="09" label="Business Case" title="Strategic" titleSpan="Value Framework" sub="GTC 2026 Showcase · NVIDIA VSS × DDN Infinia" />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, flex: 1 }}>
        {cols.map((c, i) => (
          <div key={i} style={{ ...card(c.bg, c.border), display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: c.color, marginBottom: 6 }}>{c.title}</div>
            <span style={{ ...pill(c.badgeBg, c.badgeColor, `1px solid ${c.badgeBorder}`), marginBottom: 12, width: 'fit-content' }}>{c.badge}</span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, flex: 1 }}>
              {c.bullets.map((b, j) => (
                <div key={j} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 15, color: '#475569', lineHeight: 1.5 }}>
                  <span style={{ flexShrink: 0, fontWeight: 700 }}>→</span><span>{b}</span>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${c.color}33`, fontSize: 11, fontStyle: 'italic', color: c.color }}>{c.quote}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

function Slide10() {
  const stats10 = [
    { val: '<2s', lbl: 'results at any scale', bg: '#FFF0F1', border: `1.5px solid ${RED}26`, color: RED },
    { val: '>85%', lbl: 'GPU utilization', bg: '#F4FBEA', border: `1.5px solid ${GREEN}26`, color: GREEN },
    { val: '$0', lbl: 'vector DB cost', bg: '#EFF6FF', border: `1.5px solid ${BLUE}26`, color: BLUE },
  ]
  return (
    <div style={{ display: 'flex', height: '100%', background: '#fff' }}>
      <div style={{ width: 300, flexShrink: 0, background: 'linear-gradient(160deg,#1e293b 60%,#0f172a)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: 36 }}>
        <div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 24 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: RED }} />
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: GREEN }} />
            <span style={{ color: 'rgba(255,255,255,.3)', fontSize: 11, marginLeft: 8 }}>GTC 2026</span>
          </div>
          <p style={{ color: 'rgba(255,255,255,.7)', fontSize: 24, fontWeight: 300, lineHeight: 1.6, marginBottom: 14 }}>Enterprise-scale video is growing faster than humans can manage it.</p>
          <p style={{ color: AMBER, fontSize: 28, fontWeight: 700, lineHeight: 1.3 }}>Your AI infrastructure should be built for what's next.</p>
        </div>
        <div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
            {['● Scan QR for live demo access', '● Proof of concept discussions', '● Build.DDN.com documentation'].map((t, i) => (
              <div key={i} style={{ fontSize: 12, color: 'rgba(255,255,255,.4)' }}>{t}</div>
            ))}
          </div>
          <div style={{ fontSize: 14, fontStyle: 'italic', color: 'rgba(245,158,11,.7)' }}>"Let me show you how."</div>
        </div>
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: 56 }}>
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 44, fontWeight: 900, color: '#0f172a' }}>Build.DDN:VSS</div>
          <div style={{ fontSize: 15, color: '#94a3b8', marginTop: 4 }}>Multimodal Semantic Video Search</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 28 }}>
          <span style={{ fontSize: 32, fontWeight: 900, color: RED }}>DDN</span>
          <span style={{ fontSize: 24, color: '#cbd5e1' }}>×</span>
          <span style={{ fontSize: 32, fontWeight: 900, color: GREEN }}>NVIDIA</span>
        </div>
        <div style={{ height: 1, background: '#f1f5f9', marginBottom: 28 }} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 28 }}>
          {stats10.map((s, i) => (
            <div key={i} style={statBox(s.bg, s.border)}>
              <div style={{ fontSize: 42, fontWeight: 900, color: s.color }}>{s.val}</div>
              <div style={{ fontSize: 14, color: '#64748b', marginTop: 4, fontWeight: 500 }}>{s.lbl}</div>
            </div>
          ))}
        </div>
        <p style={{ fontSize: 12, color: '#cbd5e1' }}>Powered by NVIDIA GPU · Stored on DDN Infinia · GTC 2026</p>
      </div>
    </div>
  )
}

const SLIDES = [Slide1, Slide2, Slide3, Slide4, Slide5, Slide6, Slide7, Slide8, Slide9, Slide10]

/* ─── Main GTCDeck component ─── */
export default function GTCDeck() {
  const [cur, setCur] = useState(0)
  const [videoRevealed, setVideoRevealed] = useState<Record<number, boolean>>({})
  const [, forceUpdate] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)

  const goTo = useCallback((n: number) => {
    const next = Math.max(0, Math.min(n, SLIDES.length - 1))
    setVideoRevealed(prev => ({ ...prev, [cur]: false }))
    setCur(next)
  }, [cur])

  const navigate = useCallback((d: number) => {
    if (d > 0 && DEMO_VIDEO_SLIDE.has(cur)) {
      if (!videoRevealed[cur]) {
        setVideoRevealed(prev => ({ ...prev, [cur]: true }))
        return
      }
    }
    goTo(cur + d)
  }, [cur, videoRevealed, goTo])

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === ' ') { e.preventDefault(); navigate(1) }
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); navigate(-1) }
      if (e.key === 'f' || e.key === 'F') { toggleFS() }
      if (e.key === 'Escape') { document.exitFullscreen?.() }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [navigate])

  // Touch swipe
  const touchStartX = useRef(0)

  // Auto-zoom for large screens
  useEffect(() => {
    const applyZoom = () => {
      const zoomW = window.innerWidth / 1200
      const zoomH = window.innerHeight / 720
      const zoom = Math.min(2.0, Math.max(0.7, Math.min(zoomW, zoomH)))
      if (containerRef.current) {
        containerRef.current.style.setProperty('--deck-zoom', String(zoom))
      }
    }
    applyZoom()
    window.addEventListener('resize', applyZoom)
    return () => window.removeEventListener('resize', applyZoom)
  }, [])

  const toggleFS = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen?.()
    } else {
      document.exitFullscreen?.()
    }
  }

  const pct = ((cur + 1) / SLIDES.length) * 100
  const SlideComp = SLIDES[cur]

  return (
    <div
      ref={containerRef}
      style={{
        position: 'fixed',
        inset: 0,
        top: 'var(--nav-height, 60px)',
        display: 'flex',
        flexDirection: 'column',
        background: '#fff',
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        zIndex: 10,
        overflow: 'hidden',
      }}
    >
      {/* Internal nav bar */}
      <div style={{ background: '#fff', borderBottom: '1px solid #e2e8f0', padding: '0 24px', height: 52, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: RED, letterSpacing: '.08em' }}>GTC 2026 DECK</span>
          <span style={{ color: '#cbd5e1' }}>·</span>
          <span style={{ fontSize: 13, color: '#94a3b8' }}>{SLIDE_TITLES[cur]}</span>
        </div>
        {/* Dot navigation */}
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {SLIDE_TITLES.map((title, i) => (
            <button
              key={i}
              title={title}
              onClick={() => goTo(i)}
              style={{
                width: i === cur ? 20 : 8,
                height: 8,
                borderRadius: i === cur ? 4 : '50%',
                border: 'none',
                background: i === cur ? RED : '#e2e8f0',
                cursor: 'pointer',
                transition: 'all .2s',
                padding: 0,
              }}
            />
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            onClick={toggleFS}
            style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: '8px 14px', borderRadius: 6, fontSize: 13, color: '#64748b', transition: 'background .15s' }}
            onMouseEnter={e => (e.currentTarget.style.background = '#f1f5f9')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            ⛶ Fullscreen
          </button>
          <span style={{ fontSize: 12, color: '#94a3b8' }}>{cur + 1} / {SLIDES.length}</span>
        </div>
      </div>

      {/* Progress bar */}
      <div style={{ height: 3, background: `linear-gradient(90deg, ${RED}, ${GREEN})`, width: `${pct}%`, transition: 'width .3s', flexShrink: 0 }} />

      {/* Slide stage */}
      <div
        style={{ flex: 1, overflow: 'hidden', position: 'relative', minHeight: 0 }}
        onTouchStart={e => { touchStartX.current = e.touches[0].clientX }}
        onTouchEnd={e => { const dx = e.changedTouches[0].clientX - touchStartX.current; if (Math.abs(dx) > 50) navigate(dx < 0 ? 1 : -1) }}
      >
        <div style={{ position: 'absolute', inset: 0, overflowY: 'auto', overflowX: 'hidden', animation: 'gtcFadeIn .3s ease' }}>
          <SlideComp />
        </div>
      </div>

      {/* Prev / Next arrows */}
      {[{ id: 'prev', d: -1, side: 12, label: '‹' }, { id: 'next', d: 1, side: undefined, label: '›' }].map(({ id, d, side, label }) => (
        <button
          key={id}
          onClick={() => navigate(d)}
          style={{
            position: 'fixed',
            top: '50%',
            transform: 'translateY(-50%)',
            [d === -1 ? 'left' : 'right']: side ?? 12,
            background: 'rgba(255,255,255,.85)',
            backdropFilter: 'blur(4px)',
            border: '1.5px solid #e2e8f0',
            borderRadius: 12,
            width: 40,
            height: 40,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            fontSize: 22,
            color: '#475569',
            zIndex: 20,
            transition: 'all .15s',
            boxShadow: '0 2px 8px rgba(0,0,0,.08)',
            opacity: (d === -1 && cur === 0) || (d === 1 && cur === SLIDES.length - 1) ? 0.3 : 1,
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = RED; (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 4px 16px rgba(0,0,0,.12)' }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = '#475569'; (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 2px 8px rgba(0,0,0,.08)' }}
        >
          {label}
        </button>
      ))}

      <style>{`
        @keyframes gtcFadeIn {
          from { opacity: 0; transform: translateX(30px); }
          to   { opacity: 1; transform: translateX(0); }
        }
      `}</style>
    </div>
  )
}
