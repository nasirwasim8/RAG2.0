import { useState, useEffect } from 'react'
import { useMutation } from '@tanstack/react-query'
import { CheckCircle, XCircle, Loader2, Server, Cloud, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { api, StorageConfig } from '../services/api'

export default function ConfigurationPage() {
  const [awsConfig, setAwsConfig] = useState<StorageConfig>({
    access_key: '',
    secret_key: '',
    bucket_name: '',
    region: 'us-east-1',
    endpoint_url: '',
  })

  const [ddnConfig, setDdnConfig] = useState<StorageConfig>({
    access_key: '',
    secret_key: '',
    bucket_name: '',
    endpoint_url: '',
    region: 'us-east-1',
  })

  const [awsStatus, setAwsStatus] = useState<{ connected: boolean; latency?: number } | null>(null)
  const [ddnStatus, setDdnStatus] = useState<{ connected: boolean; latency?: number } | null>(null)

  const saveAwsMutation = useMutation({
    mutationFn: () => api.configureAWS(awsConfig),
    onSuccess: () => {
      toast.success('AWS S3 configuration saved')
    },
    onError: () => {
      toast.error('Failed to save AWS configuration')
    },
  })

  const saveDdnMutation = useMutation({
    mutationFn: () => api.configureDDN({ ...ddnConfig, endpoint_url: ddnConfig.endpoint_url || '' }),
    onSuccess: () => {
      toast.success('DDN INFINIA configuration saved')
    },
    onError: () => {
      toast.error('Failed to save DDN configuration')
    },
  })

  const testAwsMutation = useMutation({
    mutationFn: () => api.testConnection('aws'),
    onSuccess: (data) => {
      setAwsStatus({ connected: data.success, latency: data.latency_ms })
      if (data.success) {
        toast.success('AWS S3 connection successful')
      } else {
        toast.error(data.message || 'AWS S3 connection failed')
      }
    },
  })

  const testDdnMutation = useMutation({
    mutationFn: () => api.testConnection('ddn_infinia'),
    onSuccess: (data) => {
      setDdnStatus({ connected: data.success, latency: data.latency_ms })
      if (data.success) {
        toast.success('DDN INFINIA connection successful')
      } else {
        toast.error(data.message || 'DDN INFINIA connection failed')
      }
    },
  })

  const testAllConnections = async () => {
    testAwsMutation.mutate()
    testDdnMutation.mutate()
  }

  const resetAwsMutation = useMutation({
    mutationFn: () => api.resetConfiguration('aws'),
    onSuccess: () => {
      setAwsConfig({
        access_key: '',
        secret_key: '',
        bucket_name: '',
        region: 'us-east-1',
        endpoint_url: '',
      })
      setAwsStatus(null)
      toast.success('AWS S3 configuration reset')
    },
    onError: () => {
      toast.error('Failed to reset AWS configuration')
    },
  })

  const resetDdnMutation = useMutation({
    mutationFn: () => api.resetConfiguration('ddn_infinia'),
    onSuccess: () => {
      setDdnConfig({
        access_key: '',
        secret_key: '',
        bucket_name: '',
        endpoint_url: '',
        region: 'us-east-1',
      })
      setDdnStatus(null)
      toast.success('DDN INFINIA configuration reset')
    },
    onError: () => {
      toast.error('Failed to reset DDN configuration')
    },
  })

  // Load configuration on mount
  useEffect(() => {
    const loadConfig = async () => {
      try {
        const data = await api.getCurrentConfig()

        if (data.aws.configured) {
          setAwsConfig(prev => ({
            ...prev,
            bucket_name: data.aws.bucket_name,
            region: data.aws.region,
            endpoint_url: data.aws.endpoint_url || ''
          }))
        }

        if (data.ddn.configured) {
          setDdnConfig(prev => ({
            ...prev,
            bucket_name: data.ddn.bucket_name,
            endpoint_url: data.ddn.endpoint_url || '',
            region: data.ddn.region
          }))
        }
      } catch (error) {
        console.error('Failed to load config:', error)
      }
    }

    loadConfig()
  }, [])

  return (
    <div className="space-y-8">
      {/* Section Header */}
      <div className="section-header">
        <h2 className="section-title">Storage Configuration</h2>
        <p className="section-description">
          Configure your AWS S3 and DDN INFINIA storage providers for performance comparison.
        </p>
      </div>

      {/* Connection Status Bar */}
      <div className="toolbar justify-between">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3">
            <div className={`status-dot ${awsStatus?.connected ? 'status-dot-success status-dot-pulse' : 'status-dot-error'}`} />
            <div>
              <span className="text-sm font-medium text-neutral-900">AWS S3</span>
              {awsStatus?.latency && (
                <span className="text-xs text-neutral-500 ml-2">{awsStatus.latency.toFixed(0)}ms</span>
              )}
            </div>
          </div>

          <div className="toolbar-divider" />

          <div className="flex items-center gap-3">
            <div className={`status-dot ${ddnStatus?.connected ? 'status-dot-success status-dot-pulse' : 'status-dot-error'}`} />
            <div>
              <span className="text-sm font-medium text-neutral-900">DDN INFINIA</span>
              {ddnStatus?.latency && (
                <span className="text-xs text-neutral-500 ml-2">{ddnStatus.latency.toFixed(0)}ms</span>
              )}
            </div>
          </div>
        </div>

        <button
          onClick={testAllConnections}
          className="btn-primary"
          disabled={testAwsMutation.isPending || testDdnMutation.isPending}
        >
          {(testAwsMutation.isPending || testDdnMutation.isPending) ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            'Test Connections'
          )}
        </button>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* AWS S3 Configuration */}
        <ConfigCard
          title="AWS S3"
          icon={<Cloud className="w-5 h-5" />}
          config={awsConfig}
          setConfig={setAwsConfig}
          onSave={() => saveAwsMutation.mutate()}
          onTest={() => testAwsMutation.mutate()}
          onReset={() => {
            if (confirm('Are you sure you want to reset AWS S3 configuration? This will clear all stored credentials.')) {
              resetAwsMutation.mutate()
            }
          }}
          isSaving={saveAwsMutation.isPending}
          isTesting={testAwsMutation.isPending}
          isResetting={resetAwsMutation.isPending}
          testStatus={awsStatus?.connected ? 'success' : awsStatus === null ? 'idle' : 'error'}
          latency={awsStatus?.latency}
          showEndpoint={true}
        />

        {/* DDN INFINIA Configuration */}
        <ConfigCard
          title="DDN INFINIA"
          icon={<Server className="w-5 h-5 text-ddn-red" />}
          config={ddnConfig}
          setConfig={setDdnConfig}
          onSave={() => saveDdnMutation.mutate()}
          onTest={() => testDdnMutation.mutate()}
          onReset={() => {
            if (confirm('Are you sure you want to reset DDN INFINIA configuration? This will clear all stored credentials.')) {
              resetDdnMutation.mutate()
            }
          }}
          isSaving={saveDdnMutation.isPending}
          isTesting={testDdnMutation.isPending}
          isResetting={resetDdnMutation.isPending}
          testStatus={ddnStatus?.connected ? 'success' : ddnStatus === null ? 'idle' : 'error'}
          latency={ddnStatus?.latency}
          showEndpoint={true}
        />
      </div>
    </div>
  )
}

interface ConfigCardProps {
  title: string
  icon: React.ReactNode
  config: StorageConfig
  setConfig: (config: StorageConfig) => void
  onSave: () => void
  onTest: () => void
  onReset: () => void
  isSaving: boolean
  isTesting: boolean
  isResetting: boolean
  testStatus: 'idle' | 'success' | 'error'
  latency?: number
  showEndpoint: boolean
}

function ConfigCard({
  title,
  icon,
  config,
  setConfig,
  onSave,
  onTest,
  onReset,
  isSaving,
  isTesting,
  isResetting,
  testStatus,
  latency,
  showEndpoint,
}: ConfigCardProps) {
  const isDDN = title === 'DDN INFINIA'

  return (
    <div className={`card-elevated p-6 ${isDDN ? 'card-accent-ddn' : ''}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isDDN ? 'bg-ddn-red/10' : 'bg-neutral-100'
            }`}>
            {icon}
          </div>
          <div>
            <h3 className="font-semibold text-neutral-900">{title}</h3>
            <p className="text-xs text-neutral-500">
              {isDDN ? 'High-performance storage' : 'S3-Compatible (AWS, OCI, MinIO)'}
            </p>
          </div>
        </div>
        {testStatus === 'success' && (
          <div className="badge badge-success">
            <CheckCircle className="w-3.5 h-3.5" />
            Connected
          </div>
        )}
        {testStatus === 'error' && (
          <div className="badge badge-error">
            <XCircle className="w-3.5 h-3.5" />
            Failed
          </div>
        )}
      </div>

      {/* Form Fields */}
      <div className="space-y-4">
        <FormField
          label="Access Key"
          type="password"
          value={config.access_key}
          onChange={(v) => setConfig({ ...config, access_key: v })}
          placeholder="Enter access key"
        />
        <FormField
          label="Secret Key"
          type="password"
          value={config.secret_key}
          onChange={(v) => setConfig({ ...config, secret_key: v })}
          placeholder="Enter secret key"
        />
        <FormField
          label="Bucket Name"
          value={config.bucket_name}
          onChange={(v) => setConfig({ ...config, bucket_name: v })}
          placeholder="my-bucket"
        />
        {showEndpoint && (
          <FormField
            label={isDDN ? 'Endpoint URL' : 'Endpoint URL (leave blank for AWS)'}
            value={config.endpoint_url || ''}
            onChange={(v) => setConfig({ ...config, endpoint_url: v })}
            placeholder={isDDN ? 'https://your-ddn-endpoint' : 'https://<ns>.compat.objectstorage.<region>.oraclecloud.com'}
          />
        )}
        <FormField
          label="Region"
          value={config.region}
          onChange={(v) => setConfig({ ...config, region: v })}
          placeholder="us-east-1"
        />
      </div>

      {/* Actions */}
      <div className="flex gap-3 mt-6 pt-6 border-t border-neutral-100">
        <button
          onClick={onSave}
          disabled={isSaving}
          className={`flex-1 ${isDDN ? 'btn-primary' : 'btn-secondary'}`}
        >
          {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save Configuration'}
        </button>
        <button
          onClick={onTest}
          disabled={isTesting}
          className="btn-secondary"
        >
          {isTesting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Test'}
        </button>
        <button
          onClick={onReset}
          disabled={isResetting}
          className="btn-secondary hover:bg-red-50 hover:text-red-600 hover:border-red-200"
          title="Reset configuration"
        >
          {isResetting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
        </button>
      </div>

      {/* Status Message */}
      {testStatus !== 'idle' && (
        <div className={`mt-4 flex items-center gap-2 p-3 rounded-lg text-sm font-medium ${testStatus === 'success'
          ? 'status-banner-success'
          : 'bg-status-error-subtle text-status-error border border-status-error/20'
          }`}>
          {testStatus === 'success' ? (
            <>
              <CheckCircle className="w-4 h-4" />
              Connection verified
              {latency && <span className="ml-auto text-xs opacity-70">{latency.toFixed(1)}ms latency</span>}
            </>
          ) : (
            <>
              <XCircle className="w-4 h-4" />
              Connection failed — check credentials
            </>
          )}
        </div>
      )}
    </div>
  )
}

interface FormFieldProps {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  type?: string
}

function FormField({ label, value, onChange, placeholder, type = 'text' }: FormFieldProps) {
  return (
    <div>
      <label className="block text-xs font-medium text-neutral-500 uppercase tracking-wide mb-2">
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="input-field"
      />
    </div>
  )
}
