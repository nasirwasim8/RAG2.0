import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { RefreshCw, Trash2, Download, Activity, Server, Zap, TrendingUp, Loader2, Info, Clock, Gauge } from 'lucide-react'
import { api } from '../services/api'
import toast from 'react-hot-toast'

export default function MetricsPage() {
  const queryClient = useQueryClient()

  const { data: metrics, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['metrics'],
    queryFn: api.getMetrics,
    refetchInterval: 5000,
  })

  const { data: llmMetrics } = useQuery({
    queryKey: ['llm-metrics'],
    queryFn: api.getLLMMetrics,
    refetchInterval: 5000,
  })

  const { data: storageOps } = useQuery({
    queryKey: ['storage-ops'],
    queryFn: api.getStorageOpsMetrics,
    refetchInterval: 5000,
  })

  const clearMutation = useMutation({
    mutationFn: api.clearMetrics,
    onSuccess: () => {
      toast.success('Metrics cleared')
      queryClient.invalidateQueries({ queryKey: ['metrics'] })
      queryClient.invalidateQueries({ queryKey: ['llm-metrics'] })
      queryClient.invalidateQueries({ queryKey: ['storage-ops'] })
    },
  })

  const exportReport = () => {
    if (!metrics) return
    const report = `
# DDN RAG Performance Report
Generated: ${new Date().toISOString()}

## Summary
- Total Operations: ${metrics.total_operations || 0}
- DDN INFINIA Wins: ${metrics.ddn_wins || 0}
- AWS S3 Wins: ${metrics.aws_wins || 0}

## LLM Performance
- Average TTFT: ${llmMetrics?.avg_ttft_ms?.toFixed(2) || 'N/A'}ms
- Average ITL: ${llmMetrics?.avg_itl_ms?.toFixed(2) || 'N/A'}ms
- Tokens per Second: ${llmMetrics?.avg_tokens_per_sec?.toFixed(1) || 'N/A'}

## Storage Operations
- DDN PUT ops/sec: ${storageOps?.ddn_infinia.put_ops_per_sec?.toFixed(2) || 'N/A'}
- DDN GET ops/sec: ${storageOps?.ddn_infinia.get_ops_per_sec?.toFixed(2) || 'N/A'}
- DDN Write Throughput: ${storageOps?.ddn_infinia.write_throughput_mbps?.toFixed(2) || 'N/A'} MB/s
- DDN Read Throughput: ${storageOps?.ddn_infinia.read_throughput_mbps?.toFixed(2) || 'N/A'} MB/s

## Write Performance (Upload)
- DDN Average Upload Time: ${metrics.storage_summary?.ddn_avg_ttfb?.toFixed(2) || 'N/A'}ms
- AWS Average Upload Time: ${metrics.storage_summary?.aws_avg_ttfb?.toFixed(2) || 'N/A'}ms

## Retrieval Performance
- DDN Average TTFB: ${metrics.retrieval_summary?.ddn_avg_ttfb?.toFixed(2) || 'N/A'}ms
- AWS Average TTFB: ${metrics.retrieval_summary?.aws_avg_ttfb?.toFixed(2) || 'N/A'}ms
    `.trim()

    const blob = new Blob([report], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `ddn-rag-metrics-${new Date().toISOString().split('T')[0]}.md`
    a.click()
    URL.revokeObjectURL(url)
    toast.success('Report exported')
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex items-center gap-3 text-neutral-400">
          <Loader2 className="w-5 h-5 animate-spin" />
          Loading metrics...
        </div>
      </div>
    )
  }

  const totalOps = metrics?.storage_summary?.total_comparisons || 0
  const ddnWins = metrics?.storage_summary?.ddn_infinia_wins || 0
  const winRate = totalOps > 0 ? ((ddnWins / totalOps) * 100).toFixed(1) : '0'
  const improvement = metrics?.storage_summary?.ddn_infinia_win_rate?.toFixed(1) || '0'

  return (
    <div className="space-y-6">
      {/* Section Header */}
      <div className="section-header">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="section-title">Performance Dashboard</h2>
              {isFetching && <Loader2 className="w-4 h-4 animate-spin text-neutral-400" />}
            </div>
            <p className="section-description">
              Real-time performance metrics for AI workloads and storage operations.
            </p>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => refetch()}
              className="btn-secondary flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh
            </button>
            <button
              onClick={() => clearMutation.mutate()}
              disabled={clearMutation.isPending}
              className="btn-secondary flex items-center gap-2"
            >
              {clearMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              Clear
            </button>
            <button
              onClick={exportReport}
              className="btn-primary flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              Export
            </button>
          </div>
        </div>
      </div>

      {/* LLM Performance Metrics */}
      {llmMetrics && llmMetrics.total_queries > 0 && (
        <div className="card-elevated p-6">
          <div className="flex items-center gap-2 mb-5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'var(--surface-secondary)' }}>
              <Zap className="w-4 h-4 text-ddn-red" />
            </div>
            <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>LLM Generation Performance</h3>
          </div>
          <div className="grid grid-cols-4 gap-4">
            <MetricCard
              icon={<Clock className="w-5 h-5" />}
              label="Time to First Token"
              value={llmMetrics.avg_ttft_ms.toFixed(0)}
              suffix="ms"
              benchmark="< 500ms"
              isBenchmarkMet={llmMetrics.avg_ttft_ms < 500}
            />
            <MetricCard
              icon={<Activity className="w-5 h-5" />}
              label="Inter-Token Latency"
              value={llmMetrics.avg_itl_ms.toFixed(1)}
              suffix="ms"
              benchmark="< 50ms"
              isBenchmarkMet={llmMetrics.avg_itl_ms < 50}
            />
            <MetricCard
              icon={<Gauge className="w-5 h-5" />}
              label="Tokens per Second"
              value={llmMetrics.avg_tokens_per_sec.toFixed(1)}
              suffix="tok/s"
              benchmark="> 50"
              isBenchmarkMet={llmMetrics.avg_tokens_per_sec > 50}
            />
            <MetricCard
              icon={<TrendingUp className="w-5 h-5" />}
              label="p95 TTFT"
              value={llmMetrics.p95_ttft_ms.toFixed(0)}
              suffix="ms"
            />
          </div>
        </div>
      )}

      {/* Storage Operations Performance */}
      {storageOps && (storageOps.ddn_infinia.total_operations > 0 || storageOps.aws.total_operations > 0) && (
        <div className="card-elevated p-6">
          <div className="flex items-center gap-2 mb-5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'var(--surface-secondary)' }}>
              <Server className="w-4 h-4" style={{ color: 'var(--text-secondary)' }} />
            </div>
            <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Object Storage Performance</h3>
          </div>

          {/* PUT/GET Ops per Second */}
          <div className="grid grid-cols-2 gap-6 mb-6">
            <div>
              <h4 className="text-sm font-medium mb-3" style={{ color: 'var(--text-secondary)' }}>Write Operations (PUT/sec)</h4>
              <ProviderComparison
                ddnValue={storageOps.ddn_infinia.put_ops_per_sec}
                awsValue={storageOps.aws.put_ops_per_sec}
                unit="ops/sec"
                higherIsBetter={true}
              />
            </div>
            <div>
              <h4 className="text-sm font-medium mb-3" style={{ color: 'var(--text-secondary)' }}>Read Operations (GET/sec)</h4>
              <ProviderComparison
                ddnValue={storageOps.ddn_infinia.get_ops_per_sec}
                awsValue={storageOps.aws.get_ops_per_sec}
                unit="ops/sec"
                higherIsBetter={true}
              />
            </div>
          </div>

          {/* Throughput */}
          <div className="grid grid-cols-2 gap-6">
            <div>
              <h4 className="text-sm font-medium mb-3" style={{ color: 'var(--text-secondary)' }}>Write Throughput</h4>
              <ProviderComparison
                ddnValue={storageOps.ddn_infinia.write_throughput_mbps}
                awsValue={storageOps.aws.write_throughput_mbps}
                unit="MB/s"
                higherIsBetter={true}
              />
            </div>
            <div>
              <h4 className="text-sm font-medium mb-3" style={{ color: 'var(--text-secondary)' }}>Read Throughput</h4>
              <ProviderComparison
                ddnValue={storageOps.ddn_infinia.read_throughput_mbps}
                awsValue={storageOps.aws.read_throughput_mbps}
                unit="MB/s"
                higherIsBetter={true}
              />
            </div>
          </div>
        </div>
      )}

      {/* Simulated Metrics Disclaimer */}
      {(metrics?.storage_summary?.aws_simulated || metrics?.retrieval_summary?.aws_simulated || storageOps?.aws?.simulated) && (
        <div className="alert alert-info">
          <Info className="w-4 h-4" />
          <span>
            <strong>AWS metrics are simulated.</strong> Values are estimated based on standard S3 benchmarks (35x slower than DDN INFINIA) since AWS credentials were not provided.
          </span>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard
          icon={<Activity className="w-5 h-5" />}
          label="Total Operations"
          value={totalOps}
        />
        <MetricCard
          icon={<Server className="w-5 h-5" />}
          label="DDN Wins"
          value={ddnWins}
          highlight
        />
        <MetricCard
          icon={<Zap className="w-5 h-5" />}
          label="Win Rate"
          value={winRate}
          suffix="%"
          highlight
        />
        <MetricCard
          icon={<TrendingUp className="w-5 h-5" />}
          label="TTFB Improvement"
          value={improvement}
          suffix="%"
        />
      </div>

      {/* Performance Charts Grid */}
      <div className="grid md:grid-cols-2 gap-5">
        {/* Storage Performance */}
        <div className="card-elevated p-6">
          <div className="flex items-center gap-2 mb-5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'var(--surface-secondary)' }}>
              <Server className="w-4 h-4" style={{ color: 'var(--text-secondary)' }} />
            </div>
            <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Write Performance (Upload)</h3>
          </div>
          {metrics?.storage_summary?.provider_stats ? (
            <div className="space-y-5">
              <ProviderStatBar
                label="DDN INFINIA"
                value={(metrics.storage_summary.provider_stats.ddn_infinia?.avg_time || 0) * 1000}
                maxValue={Math.max((metrics.storage_summary.provider_stats.ddn_infinia?.avg_time || 0) * 1000, (metrics.storage_summary.provider_stats.aws?.avg_time || 0) * 1000)}
                isWinner={(metrics.storage_summary.provider_stats.ddn_infinia?.avg_time || 0) < (metrics.storage_summary.provider_stats.aws?.avg_time || 0)}
                isDDN
              />
              <ProviderStatBar
                label="AWS S3"
                value={(metrics.storage_summary.provider_stats.aws?.avg_time || 0) * 1000}
                maxValue={Math.max((metrics.storage_summary.provider_stats.ddn_infinia?.avg_time || 0) * 1000, (metrics.storage_summary.provider_stats.aws?.avg_time || 0) * 1000)}
                isWinner={(metrics.storage_summary.provider_stats.aws?.avg_time || 0) < (metrics.storage_summary.provider_stats.ddn_infinia?.avg_time || 0)}
              />
            </div>
          ) : (
            <div className="card-inset p-6 text-center">
              <p className="text-neutral-400 text-sm">No storage data yet</p>
            </div>
          )}
        </div>

        {/* Retrieval Performance */}
        <div className="card-elevated p-6">
          <div className="flex items-center gap-2 mb-5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'var(--surface-secondary)' }}>
              <Zap className="w-4 h-4" style={{ color: 'var(--text-secondary)' }} />
            </div>
            <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Retrieval Performance (TTFB)</h3>
          </div>
          {metrics?.retrieval_summary ? (
            <div className="space-y-5">
              <ProviderStatBar
                label="DDN INFINIA"
                value={metrics.retrieval_summary.ddn_avg_ttfb || 0}
                maxValue={Math.max(metrics.retrieval_summary.ddn_avg_ttfb || 0, metrics.retrieval_summary.aws_avg_ttfb || 0)}
                isWinner={(metrics.retrieval_summary.ddn_avg_ttfb || 0) < (metrics.retrieval_summary.aws_avg_ttfb || 0)}
                isDDN
              />
              <ProviderStatBar
                label="AWS S3"
                value={metrics.retrieval_summary.aws_avg_ttfb || 0}
                maxValue={Math.max(metrics.retrieval_summary.ddn_avg_ttfb || 0, metrics.retrieval_summary.aws_avg_ttfb || 0)}
                isWinner={(metrics.retrieval_summary.aws_avg_ttfb || 0) < (metrics.retrieval_summary.ddn_avg_ttfb || 0)}
              />
            </div>
          ) : (
            <div className="card-inset p-6 text-center">
              <p className="text-neutral-400 text-sm">No retrieval data yet</p>
            </div>
          )}
        </div>
      </div>

      {/* Performance Advantage Banner */}
      {totalOps > 0 && (
        <div className="status-banner-ddn p-6">
          <div className="flex items-center justify-between w-full">
            <div>
              <div className="text-xs font-medium opacity-70 uppercase tracking-wide mb-2">
                DDN INFINIA Performance Advantage
              </div>
              <p className="text-sm opacity-80">
                Based on {totalOps.toLocaleString()} operations comparing DDN INFINIA vs AWS S3
              </p>
            </div>
            <div
              className="flex items-center gap-3 backdrop-blur px-5 py-3 rounded-xl shadow-sm"
              style={{ background: 'var(--surface-card)', opacity: 0.95 }}
            >
              <TrendingUp className="w-6 h-6 text-ddn-red" />
              <div>
                <span className="text-2xl font-bold text-ddn-red">{improvement}%</span>
                <span className="text-sm ml-2" style={{ color: 'var(--text-secondary)' }}>faster TTFB</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

interface MetricCardProps {
  icon: React.ReactNode
  label: string
  value: number | string
  suffix?: string
  highlight?: boolean
  benchmark?: string
  isBenchmarkMet?: boolean
}

function MetricCard({ icon, label, value, suffix, highlight, benchmark, isBenchmarkMet }: MetricCardProps) {
  return (
    <div
      className="stat-card"
      style={highlight ? { borderTop: '3px solid #E31937' } : undefined}
    >
      <div className="flex items-center gap-2 mb-2">
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center"
          style={{ background: highlight ? 'rgba(227, 25, 55, 0.1)' : 'var(--surface-secondary)' }}
        >
          <div className={highlight ? 'text-ddn-red' : 'text-neutral-500'}>{icon}</div>
        </div>
      </div>
      <div className="stat-label">{label}</div>
      <div className="stat-value" style={highlight ? { color: '#E31937' } : undefined}>
        {value}{suffix && <span className="text-sm text-neutral-400 font-normal ml-1">{suffix}</span>}
      </div>
      {benchmark && (
        <div className={`text-xs mt-1 ${isBenchmarkMet ? 'text-green-600' : 'text-orange-600'}`}>
          {isBenchmarkMet ? '✅' : '⚠️'} {benchmark}
        </div>
      )}
    </div>
  )
}

interface ProviderStatBarProps {
  label: string
  value: number
  maxValue: number
  isWinner: boolean
  isDDN?: boolean
}

function ProviderStatBar({ label, value, maxValue, isWinner, isDDN }: ProviderStatBarProps) {
  const percentage = maxValue > 0 ? (value / maxValue) * 100 : 0

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div
            className="w-2 h-2 rounded-full"
            style={{ background: isDDN ? '#E31937' : '#94a3b8' }}
          />
          <span className={`text-sm font-medium ${isDDN ? 'text-neutral-900' : 'text-neutral-600'}`}>
            {label}
          </span>
          {isWinner && (
            <span className="badge text-xs" style={{ background: 'rgba(0, 194, 128, 0.1)', color: 'var(--status-success)' }}>
              <Zap className="w-3 h-3" />
              Fastest
            </span>
          )}
        </div>
        <span className="text-sm font-mono font-semibold text-neutral-900">
          {value.toFixed(2)}ms
        </span>
      </div>
      <div className="h-3 bg-surface-secondary rounded-full overflow-hidden">
        <div
          className="h-full rounded-full"
          style={{
            width: `${Math.max(percentage, 2)}%`,
            background: isDDN ? 'linear-gradient(90deg, #E31937, #ff4d6a)' : '#cbd5e1',
            transition: 'width 500ms cubic-bezier(0.16, 1, 0.3, 1)'
          }}
        />
      </div>
      <div className="flex justify-between text-xs text-neutral-400">
        <span>0ms</span>
        <span>{maxValue.toFixed(0)}ms</span>
      </div>
    </div>
  )
}

interface ProviderComparisonProps {
  ddnValue: number
  awsValue: number
  unit: string
  higherIsBetter: boolean
}

function ProviderComparison({ ddnValue, awsValue, unit, higherIsBetter }: ProviderComparisonProps) {
  const ddnBetter = higherIsBetter
    ? (ddnValue || 0) > (awsValue || 0)
    : (ddnValue || 0) < (awsValue || 0)

  const improvement = ddnBetter && awsValue > 0
    ? (((ddnValue - awsValue) / awsValue) * 100).toFixed(1)
    : '0'

  const maxValue = Math.max(ddnValue || 0, awsValue || 0)

  return (
    <div className="space-y-3">
      <MetricBar
        label="DDN INFINIA"
        value={ddnValue}
        maxValue={maxValue}
        unit={unit}
        isWinner={ddnBetter}
        color="#E31937"
      />
      <MetricBar
        label="AWS S3"
        value={awsValue}
        maxValue={maxValue}
        unit={unit}
        isWinner={!ddnBetter}
        color="#94a3b8"
      />
      {ddnBetter && parseFloat(improvement) > 0 && (
        <div className="text-sm text-green-600 font-medium flex items-center gap-1">
          <Zap className="w-3 h-3" />
          {improvement}% faster
        </div>
      )}
    </div>
  )
}

interface MetricBarProps {
  label: string
  value: number
  maxValue: number
  unit: string
  isWinner: boolean
  color: string
}

function MetricBar({ label, value, maxValue, unit, isWinner, color }: MetricBarProps) {
  const percentage = maxValue > 0 ? (value / maxValue) * 100 : 0
  const isDDN = color === '#E31937'

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ background: color }} />
          <span className={`text-xs font-medium ${isDDN ? 'text-neutral-900' : 'text-neutral-600'}`}>
            {label}
          </span>
          {isWinner && value > 0 && (
            <span className="badge text-xs" style={{ background: 'rgba(0, 194, 128, 0.1)', color: 'var(--status-success)' }}>
              <Zap className="w-3 h-3" />
            </span>
          )}
        </div>
        <span className="text-xs font-mono font-semibold text-neutral-900">
          {value.toFixed(2)} {unit}
        </span>
      </div>
      <div className="h-2 bg-surface-secondary rounded-full overflow-hidden">
        <div
          className="h-full rounded-full"
          style={{
            width: `${Math.max(percentage, 2)}%`,
            background: isDDN ? 'linear-gradient(90deg, #E31937, #ff4d6a)' : '#cbd5e1',
            transition: 'width 300ms ease-out'
          }}
        />
      </div>
    </div>
  )
}
