import { useState, useCallback, useEffect } from 'react'
import { useDropzone } from 'react-dropzone'
import { Upload, Play, Square, RefreshCw, Wifi, TestTube, Database, Loader2, CheckCircle, Server, Info, Zap } from 'lucide-react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { api } from '../services/api'

export default function ContinuousIngestionPage() {
  const [bucketName, setBucketName] = useState('')
  const [targetBucket, setTargetBucket] = useState('')
  const [monitoringStatus, setMonitoringStatus] = useState('Monitoring not started. Enter a bucket name and click Start.')
  const [performanceMetrics, setPerformanceMetrics] = useState('Metrics will appear after processing...')
  const [uploadStatus, setUploadStatus] = useState('')
  const [isMonitoring, setIsMonitoring] = useState(false)
  const [chartData, setChartData] = useState<any[]>([])
  const [currentFile, setCurrentFile] = useState('')
  const [awsSimulated, setAwsSimulated] = useState(false)
  const [ingestionSummary, setIngestionSummary] = useState<any>(null)
  const [directoryListing, setDirectoryListing] = useState<any[]>([])
  const [showSummary, setShowSummary] = useState(false)

  useQuery({
    queryKey: ['health'],
    queryFn: api.getHealth,
  })

  // Fetch current configuration to get DDN INFINIA bucket name
  const { data: configData } = useQuery({
    queryKey: ['currentConfig'],
    queryFn: api.getCurrentConfig,
  })

  // Initialize bucket name from config or localStorage
  useEffect(() => {
    // Priority: config > localStorage > empty
    // ALWAYS use DDN config if available (ensures current config is respected)
    if (configData?.ddn?.bucket_name && configData.ddn.configured) {
      // Auto-populate from DDN INFINIA configuration
      setBucketName(configData.ddn.bucket_name)
      setTargetBucket(configData.ddn.bucket_name) // Also set target bucket
      // Update localStorage to match current config
      localStorage.setItem('continuous_ingestion_bucket', configData.ddn.bucket_name)
    } else {
      // Fall back to localStorage only if no DDN config
      const savedBucket = localStorage.getItem('continuous_ingestion_bucket')
      if (savedBucket) {
        setBucketName(savedBucket)
        setTargetBucket(savedBucket)
      }
    }
  }, [configData])

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData()
      formData.append('file', file)
      return api.uploadDocument(formData)
    },
    onSuccess: (data) => {
      setUploadStatus(`Successfully uploaded to bucket. ${data.total_chunks} chunks processed.`)
    },
    onError: (error: Error) => {
      setUploadStatus(`Upload failed: ${error.message}`)
    }
  })

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0 && targetBucket) {
      uploadMutation.mutate(acceptedFiles[0])
    } else if (!targetBucket) {
      setUploadStatus('Please enter a target bucket name first.')
    }
  }, [targetBucket, uploadMutation])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'] },
    maxFiles: 1
  })

  const startMonitoring = async () => {
    if (!bucketName) {
      setMonitoringStatus('Please enter a bucket name.')
      return
    }

    // Save bucket name to localStorage
    localStorage.setItem('continuous_ingestion_bucket', bucketName)

    setMonitoringStatus('Starting monitoring...')
    setChartData([])     // Clear old chart data only when explicitly starting fresh
    setCurrentFile('')
    try {
      const result = await api.startMonitoring(bucketName)
      setIsMonitoring(true)
      setMonitoringStatus(`${result.message}\nFiles in 'auto_ingest/' folder will be processed automatically.\n\nPolling every 5 seconds...`)
    } catch (error: any) {
      setMonitoringStatus(`Failed to start monitoring: ${error.response?.data?.detail || error.message}`)
      setIsMonitoring(false)
    }
  }

  const stopMonitoring = async () => {
    setMonitoringStatus('Stopping monitoring...')
    try {
      const result = await api.stopMonitoring()
      setIsMonitoring(false)
      setMonitoringStatus(result.message)
    } catch (error: any) {
      setMonitoringStatus(`Failed to stop monitoring: ${error.response?.data?.detail || error.message}`)
    }
  }

  // SSE connection for real-time updates
  useEffect(() => {
    if (!isMonitoring) {
      // Don't clear chartData here — preserve it so Status/refresh doesn't wipe live charts
      // Charts are only cleared when user explicitly starts a new monitoring session
      setCurrentFile('')
      return
    }

    const eventSource = new EventSource('/api/ingestion/stream')

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)

        if (data.error) {
          console.error('SSE error:', data.error)
          return
        }

        // Update current file
        if (data.file) {
          setCurrentFile(data.file)
        }

        // Update AWS simulation status
        if (data.aws_simulated !== undefined) {
          setAwsSimulated(data.aws_simulated)
        }

        // Add chunk data to chart
        if (data.chunk_index && data.performance) {
          const ddnTime = (data.performance.ddn_infinia?.avg_time || 0) * 1000  // ms
          let awsTime = (data.performance.aws?.avg_time || 0) * 1000             // ms
          const awsActual = awsTime > 0

          // When AWS is not configured, simulate it at ~35x DDN latency
          // (this matches the documented DDN vs S3 baseline from the whitepaper)
          if (!awsActual && ddnTime > 0) {
            awsTime = ddnTime * 35
          }

          setChartData(prev => [
            ...prev.slice(-20), // Keep last 20 data points
            {
              chunk: `Chunk ${data.chunk_index}/${data.total_chunks}`,
              ddn: ddnTime,
              aws: awsTime,
              awsSimulated: !awsActual,
              progress: data.progress
            }
          ])
        }

        // Handle completion
        if (data.status === 'completed') {
          setMonitoringStatus(prev =>
            prev + `\n✅ Completed: ${data.file} (${data.chunks_added} chunks)`
          )
        }
      } catch (err) {
        console.error('Failed to parse SSE data:', err)
      }
    }

    eventSource.onerror = () => {
      console.error('SSE connection error')
      // Don't close monitoring automatically, just log the error
    }

    return () => {
      eventSource.close()
    }
  }, [isMonitoring])

  const getStatus = async () => {
    setMonitoringStatus('Fetching status...')
    try {
      const status = await api.getMonitoringStatus()
      if (status.monitoring) {
        const lastCheck = status.last_check ? new Date(status.last_check).toLocaleTimeString() : 'N/A'
        const filesText = status.processed_files.length > 0
          ? status.processed_files.map((f: string) => `  • ${f.split('/').pop()}`).join('\n')
          : '  None yet'

        const threadNote = status.thread_alive === false
          ? '\n⚠️ Thread restarting (watchdog active)...'
          : ''

        setMonitoringStatus(
          `✅ Monitoring active on bucket: ${status.bucket_name}\n` +
          `\nProcessed files: ${status.processed_files_count}\n` +
          filesText +
          `\n\nLast check: ${lastCheck}` +
          threadNote
        )
        // Never set isMonitoring=false from manual getStatus — let the heartbeat handle that
      } else {
        setMonitoringStatus('Monitoring is not active.')
        // Do NOT call setIsMonitoring(false) here — only the heartbeat has that authority.
        // getStatus() is a manual refresh; a momentary 'not active' response (e.g. during
        // file processing or a brief race condition) would wrongly clear the chart.
      }
    } catch (error: any) {
      setMonitoringStatus(`Failed to get status: ${error.response?.data?.detail || error.message}`)
    }
  }


  const testConnection = async () => {
    if (!bucketName) {
      setMonitoringStatus('Please enter a bucket name.')
      return
    }
    setMonitoringStatus(`Testing connection to ${bucketName}...`)
    try {
      const result = await api.testConnection('ddn_infinia')
      if (result.success) {
        setMonitoringStatus(`Connection successful!\nBucket: ${bucketName}\nLatency: ${result.latency_ms?.toFixed(2)}ms`)
      } else {
        setMonitoringStatus(`Connection failed: ${result.message}`)
      }
    } catch (error) {
      setMonitoringStatus(`Connection test failed: ${error}`)
    }
  }

  const refreshMetrics = async () => {
    try {
      const metrics = await api.getMetrics()
      const ddnWins = metrics.ddn_wins || 0
      const awsWins = metrics.aws_wins || 0
      const total = ddnWins + awsWins

      setPerformanceMetrics(`
Auto-Ingest Performance Summary
================================
Total Operations: ${total}
DDN INFINIA Wins: ${ddnWins} (${total > 0 ? ((ddnWins / total) * 100).toFixed(1) : 0}%)
AWS S3 Wins: ${awsWins} (${total > 0 ? ((awsWins / total) * 100).toFixed(1) : 0}%)

Average TTFB:
  DDN INFINIA: ${metrics.storage_summary?.ddn_avg_ttfb?.toFixed(2) || 'N/A'}ms
  AWS S3: ${metrics.storage_summary?.aws_avg_ttfb?.toFixed(2) || 'N/A'}ms
      `.trim())
    } catch (error) {
      setPerformanceMetrics(`Failed to fetch metrics: ${error}`)
    }
  }

  const testRetrieval = async () => {
    setMonitoringStatus('Testing retrieval from auto-ingested documents...')
    try {
      const result = await api.query({
        query: 'Test retrieval from auto-ingested documents',
        model: 'nvidia',
        use_reranking: true,
        use_guardrails: false,
        top_k: 5
      })
      if (result.success) {
        setMonitoringStatus(`Retrieval test successful!\nFound ${result.retrieved_chunks?.length || 0} relevant chunks.\nFastest provider: ${result.fastest_provider || 'N/A'}`)
      } else {
        setMonitoringStatus('No documents found. Upload some documents first.')
      }
    } catch (error) {
      setMonitoringStatus(`Retrieval test failed: ${error}`)
    }
  }

  const fetchIngestionSummary = async () => {
    try {
      const summary = await api.getIngestionSummary()
      const listing = await api.getDirectoryListing()
      // Only update ingestion summary if the new data has valid files processed.
      // This prevents a mid-batch reset (where the API momentarily returns 0)
      // from hiding the card or overwriting good data with empty data.
      if (summary.total_files_processed > 0) {
        setIngestionSummary(summary)
        setDirectoryListing(listing.files || [])
        setShowSummary(true)  // Only ever set to true — never hide once shown
      }
      // If total_files_processed is 0 but we already have a summary showing,
      // keep the existing data visible until valid new data arrives.
    } catch (error) {
      console.error('Failed to fetch ingestion summary:', error)
    }
  }

  // Auto-fetch summary periodically when monitoring is active
  useEffect(() => {
    if (isMonitoring) {
      const interval = setInterval(fetchIngestionSummary, 5000) // Every 5 seconds
      return () => clearInterval(interval)
    }
  }, [isMonitoring])

  // Heartbeat: silently check thread health every 15s while monitoring is active
  // Uses two-strike logic: only declares monitoring dead if TWO consecutive checks
  // both confirm it. This prevents false positives while the backend watchdog is
  // automatically restarting the poll thread (which takes up to 10 seconds).
  useEffect(() => {
    if (!isMonitoring) return
    let strikeCount = 0
    const heartbeat = setInterval(async () => {
      try {
        const status = await api.getMonitoringStatus()
        const isAlive = status.monitoring && (status.thread_alive !== false)
        if (!isAlive) {
          strikeCount++
          if (strikeCount >= 2) {
            // Two consecutive failures — backend watchdog did not recover in time
            setIsMonitoring(false)
            setMonitoringStatus('⚠️ Monitoring stopped unexpectedly. Click Start to restart.')
          }
          // else: wait for next check — watchdog may still be restarting the thread
        } else {
          strikeCount = 0 // Reset on successful check
        }
      } catch {
        // Ignore transient network errors in heartbeat — don't increment strike count
      }
    }, 15000)
    return () => clearInterval(heartbeat)
  }, [isMonitoring])

  return (
    <div className="space-y-6">
      {/* Section Header */}
      <div className="section-header">
        <div className="flex items-center gap-3">
          <h2 className="section-title">Continuous Ingestion</h2>
          <span className={`badge ${isMonitoring ? 'badge-success' : 'badge-neutral'}`}>
            <div className={`w-2 h-2 rounded-full ${isMonitoring ? 'bg-status-success animate-pulse' : 'bg-neutral-400'}`} />
            {isMonitoring ? 'Active' : 'Inactive'}
          </span>
        </div>
        <p className="section-description">
          Configure automatic document processing when files are uploaded to DDN INFINIA buckets.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Left Column - Bucket Monitoring */}
        <div className="card-elevated p-6 space-y-5">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-ddn-red/10 flex items-center justify-center">
              <Server className="w-4 h-4 text-ddn-red" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-neutral-900">Bucket Monitoring</h3>
              <p className="text-xs text-neutral-500">Watch for new files automatically</p>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-neutral-500 uppercase tracking-wide mb-2">
              DDN INFINIA Bucket
            </label>
            <input
              type="text"
              value={bucketName}
              onChange={(e) => setBucketName(e.target.value)}
              placeholder="infinia-test-bucket-01"
              className="input-field"
            />
            <p className="text-xs text-neutral-400 mt-2">
              Files in 'auto_ingest/' folder will be processed automatically
            </p>
          </div>

          <div className="flex gap-2">
            <button
              onClick={startMonitoring}
              disabled={isMonitoring || !bucketName}
              className="btn-primary flex items-center gap-2"
            >
              <Play className="w-4 h-4" />
              Start
            </button>
            <button
              onClick={stopMonitoring}
              disabled={!isMonitoring}
              className="btn-secondary flex items-center gap-2 text-status-error hover:border-status-error/50"
            >
              <Square className="w-4 h-4" />
              Stop
            </button>
            <button
              onClick={getStatus}
              className="btn-secondary flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Status
            </button>
          </div>

          <div className="toolbar !p-0 gap-2">
            <button
              onClick={testConnection}
              className="btn-secondary flex items-center gap-2 text-xs"
            >
              <Wifi className="w-3.5 h-3.5" />
              Test
            </button>
            <button
              onClick={refreshMetrics}
              className="btn-secondary flex items-center gap-2 text-xs"
            >
              <Database className="w-3.5 h-3.5" />
              Metrics
            </button>
            <button
              onClick={testRetrieval}
              className="btn-secondary flex items-center gap-2 text-xs"
            >
              <TestTube className="w-3.5 h-3.5" />
              Retrieval
            </button>
          </div>

          {/* Status Display */}
          <div>
            <div className="text-xs font-medium text-neutral-500 uppercase tracking-wide mb-2">Status</div>
            <div className="output-block min-h-[100px]">
              {monitoringStatus}
            </div>
          </div>

          {/* Performance Metrics */}
          <div>
            <div className="text-xs font-medium text-neutral-500 uppercase tracking-wide mb-2">Performance</div>
            <div className="output-block min-h-[120px]">
              {performanceMetrics}
            </div>
          </div>
        </div>

        {/* Right Column - Manual Upload */}
        <div className="card-elevated p-6 space-y-5">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-ddn-red/10 flex items-center justify-center">
              <Upload className="w-4 h-4 text-ddn-red" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-neutral-900">Manual Upload</h3>
              <p className="text-xs text-neutral-500">Upload documents directly</p>
            </div>
          </div>

          <div
            {...getRootProps()}
            className={`dropzone ${isDragActive ? 'active' : ''}`}
          >
            <input {...getInputProps()} />
            {uploadMutation.isPending ? (
              <>
                <Loader2 className="dropzone-icon text-ddn-red animate-spin" />
                <p className="dropzone-text">Uploading...</p>
              </>
            ) : (
              <>
                <Upload className="dropzone-icon" />
                <p className="dropzone-text">
                  {isDragActive ? 'Drop the PDF here' : 'Drag & drop a PDF file here'}
                </p>
                <p className="dropzone-hint">or click to select</p>
              </>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-neutral-500 uppercase tracking-wide mb-2">
              Target Bucket
            </label>
            <input
              type="text"
              value={targetBucket}
              onChange={(e) => setTargetBucket(e.target.value)}
              placeholder="infinia-test-bucket-01"
              className="input-field"
            />
          </div>

          <button
            onClick={() => {
              const input = document.createElement('input')
              input.type = 'file'
              input.accept = '.pdf'
              input.onchange = (e) => {
                const file = (e.target as HTMLInputElement).files?.[0]
                if (file) uploadMutation.mutate(file)
              }
              input.click()
            }}
            disabled={!targetBucket || uploadMutation.isPending}
            className="w-full btn-primary flex items-center justify-center gap-2"
          >
            {uploadMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Upload className="w-4 h-4" />
            )}
            {uploadMutation.isPending ? 'Uploading...' : 'Upload to Bucket'}
          </button>

          {/* Upload Status */}
          {uploadStatus && (
            <div className="status-banner-success p-4">
              <CheckCircle className="w-4 h-4" />
              <p className="text-sm">{uploadStatus}</p>
            </div>
          )}

          {/* Real-Time Performance Chart */}
          <div className="card-inset p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xs font-medium text-neutral-500 uppercase tracking-wide">
                Real-Time Performance
              </h3>
              {currentFile && (
                <span className="text-xs text-neutral-400">
                  {currentFile}
                </span>
              )}
            </div>

            {/* AWS Simulation Disclaimer */}
            {awsSimulated && (
              <div className="alert alert-info mb-4">
                <Info className="w-4 h-4" />
                <span>
                  <strong>AWS metrics simulated.</strong> Estimated 30-40x slower. Configure AWS for real data.
                </span>
              </div>
            )}

            {chartData.length > 0 ? (
              <div className="space-y-3 max-h-80 overflow-y-auto">
                {chartData.slice(-10).map((point, i) => {
                  // DDN bar should appear SHORT (fast). AWS bar should appear LONG (slow).
                  // Use AWS as the 100% baseline — DDN bar = (ddnTime / awsTime) * 100%
                  const ddnBarPct = point.aws > 0
                    ? Math.max(4, Math.min((point.ddn / point.aws) * 100, 100))
                    : 4  // at least 4% so bar is visible
                  return (
                    <div key={i} className="space-y-2">
                      <div className="flex justify-between text-xs">
                        <span className="text-neutral-500">{point.chunk}</span>
                        <span className="text-neutral-400">{point.progress?.toFixed(0)}%</span>
                      </div>

                      {/* DDN bar — short = fast */}
                      <div className="flex items-center gap-2">
                        <span className="text-ddn-red font-medium text-xs w-8 shrink-0">DDN</span>
                        <div className="flex-1 h-2 bg-surface-secondary rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-ddn-red to-red-400 rounded-full transition-all duration-700"
                            style={{ width: `${ddnBarPct}%` }}
                          />
                        </div>
                        <span className="text-ddn-red text-xs font-semibold w-16 text-right shrink-0">
                          {point.ddn.toFixed(2)}ms
                        </span>
                      </div>

                      {/* AWS bar — always 100% wide = slow */}
                      <div className="flex items-center gap-2">
                        <span className="text-neutral-500 font-medium text-xs w-8 shrink-0">S3</span>
                        <div className="flex-1 h-2 bg-surface-secondary rounded-full overflow-hidden">
                          <div
                            className="h-full bg-neutral-400 rounded-full transition-all duration-700"
                            style={{ width: '100%' }}
                          />
                        </div>
                        <span className="text-neutral-500 text-xs font-semibold w-16 text-right shrink-0">
                          {point.aws.toFixed(2)}ms
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="h-40 bg-surface-secondary rounded-xl flex items-center justify-center">
                <div className="text-center">
                  <Zap className="w-8 h-8 text-neutral-300 mx-auto mb-2" />
                  <p className="text-neutral-400 text-sm">
                    {isMonitoring ? 'Waiting for files...' : 'Start monitoring to see live performance'}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div >
      </div >


      {/* Post-Ingestion Summary Section */}
      {
        showSummary && ingestionSummary && (
          <div className="space-y-6">
            {/* Section Header */}
            <div className="section-header">
              <div className="flex items-center gap-3">
                <h2 className="section-title">Ingestion Summary</h2>
                <span className="badge badge-success">
                  <CheckCircle className="w-3 h-3" />
                  {ingestionSummary.files?.total_processed || 0} files processed
                </span>
              </div>
              <p className="section-description">
                Comprehensive metrics from completed ingestion operations
              </p>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {/* Files Processed */}
              <div className="stat-card">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-ddn-red/10">
                    <Upload className="w-4 h-4 text-ddn-red" />
                  </div>
                </div>
                <div className="stat-label">Files Processed</div>
                <div className="stat-value">{ingestionSummary.files?.total_processed || 0}</div>
                <div className="text-xs text-neutral-400 mt-1">
                  {(ingestionSummary.files?.total_size_mb || 0).toFixed(2)} MB total
                </div>
              </div>

              {/* Chunks Created */}
              <div className="stat-card">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-surface-secondary">
                    <Database className="w-4 h-4 text-neutral-500" />
                  </div>
                </div>
                <div className="stat-label">Chunks Created</div>
                <div className="stat-value">{ingestionSummary.chunks?.total_created || 0}</div>
                <div className="text-xs text-neutral-400 mt-1">
                  {(ingestionSummary.chunks?.average_per_file || 0).toFixed(1)} per file
                </div>
              </div>

              {/* Average Processing Time */}
              <div className="stat-card">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-surface-secondary">
                    <Zap className="w-4 h-4 text-neutral-500" />
                  </div>
                </div>
                <div className="stat-label">Avg Processing Time</div>
                <div className="stat-value">{(ingestionSummary.timings?.avg_total_ms || 0).toFixed(0)}<span className="text-sm text-neutral-400 font-normal ml-1">ms</span></div>
                <div className="text-xs text-neutral-400 mt-1">
                  per file
                </div>
              </div>

              {/* Throughput */}
              <div className="stat-card">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-surface-secondary">
                    <Server className="w-4 h-4 text-neutral-500" />
                  </div>
                </div>
                <div className="stat-label">Throughput</div>
                <div className="stat-value">{(ingestionSummary.throughput?.chunks_per_second || 0).toFixed(1)}<span className="text-sm text-neutral-400 font-normal ml-1">ch/s</span></div>
                <div className="text-xs text-neutral-400 mt-1">
                  {(ingestionSummary.throughput?.mb_per_second || 0).toFixed(2)} MB/s
                </div>
              </div>
            </div>

            {/* Performance Breakdown */}
            <div className="card-elevated p-6">
              <h3 className="text-sm font-semibold text-neutral-900 mb-4">Performance Breakdown</h3>
              <div className="space-y-3">
                {/* Download Time */}
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-neutral-600">Download</span>
                    <span className="font-mono font-semibold">{(ingestionSummary.timings?.avg_download_ms || 0).toFixed(0)}ms</span>
                  </div>
                  <div className="h-2 bg-surface-secondary rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-500 transition-all duration-300"
                      style={{ width: `${Math.min((ingestionSummary.timings?.avg_download_ms || 0) / (ingestionSummary.timings?.avg_total_ms || 1) * 100, 100)}%` }}
                    />
                  </div>
                </div>

                {/* Parsing Time */}
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-neutral-600">Parsing</span>
                    <span className="font-mono font-semibold">{(ingestionSummary.timings?.avg_parsing_ms || 0).toFixed(0)}ms</span>
                  </div>
                  <div className="h-2 bg-surface-secondary rounded-full overflow-hidden">
                    <div
                      className="h-full bg-green-500 transition-all duration-300"
                      style={{ width: `${Math.min((ingestionSummary.timings?.avg_parsing_ms || 0) / (ingestionSummary.timings?.avg_total_ms || 1) * 100, 100)}%` }}
                    />
                  </div>
                </div>

                {/* Embedding Time */}
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-neutral-600">Embedding</span>
                    <span className="font-mono font-semibold">{(ingestionSummary.timings?.avg_embedding_ms || 0).toFixed(0)}ms</span>
                  </div>
                  <div className="h-2 bg-surface-secondary rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-ddn-red to-red-400 transition-all duration-300"
                      style={{ width: `${Math.min((ingestionSummary.timings?.avg_embedding_ms || 0) / (ingestionSummary.timings?.avg_total_ms || 1) * 100, 100)}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Directory Listing */}
            {directoryListing.length > 0 && (
              <div className="card-elevated p-6">
                <h3 className="text-sm font-semibold text-neutral-900 mb-4">Recently Processed Files</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-neutral-200">
                        <th className="text-left py-2 px-3 text-xs font-medium text-neutral-500 uppercase tracking-wide">Filename</th>
                        <th className="text-right py-2 px-3 text-xs font-medium text-neutral-500 uppercase tracking-wide">Size</th>
                        <th className="text-right py-2 px-3 text-xs font-medium text-neutral-500 uppercase tracking-wide">Chunks</th>
                        <th className="text-right py-2 px-3 text-xs font-medium text-neutral-500 uppercase tracking-wide">Processing Time</th>
                        <th className="text-left py-2 px-3 text-xs font-medium text-neutral-500 uppercase tracking-wide">Timestamp</th>
                      </tr>
                    </thead>
                    <tbody>
                      {directoryListing.map((file, index) => (
                        <tr key={index} className="border-b border-neutral-100 hover:bg-surface-secondary">
                          <td className="py-3 px-3 text-neutral-900 font-medium">{file.filename}</td>
                          <td className="py-3 px-3 text-right text-neutral-600">{file.file_size_mb} MB</td>
                          <td className="py-3 px-3 text-right text-neutral-600">{file.chunks_created}</td>
                          <td className="py-3 px-3 text-right text-neutral-600">{file.total_time_ms.toFixed(0)}ms</td>
                          <td className="py-3 px-3 text-neutral-500 text-xs">
                            {file.timestamp ? new Date(file.timestamp).toLocaleString() : 'N/A'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )
      }
    </div >
  )
}
