import { useState, useEffect } from 'react'
import { Settings, FileText, Upload, MessageSquare, BarChart3, DollarSign } from 'lucide-react'

interface Tab {
  id: string
  label: string
  icon: string
}

interface DemoSidebarProps {
  tabs: Tab[]
  activeTab: string
  onTabChange: (tabId: string) => void
}

const iconMap: Record<string, React.ReactNode> = {
  settings: <Settings className="w-5 h-5" />,
  file: <FileText className="w-5 h-5" />,
  upload: <Upload className="w-5 h-5" />,
  message: <MessageSquare className="w-5 h-5" />,
  chart: <BarChart3 className="w-5 h-5" />,
  dollar: <DollarSign className="w-5 h-5" />,
}

export default function DemoSidebar({ tabs, activeTab, onTabChange }: DemoSidebarProps) {
  const [backendStatus, setBackendStatus] = useState<'running' | 'offline' | 'checking'>('checking')

  useEffect(() => {
    const checkBackendHealth = async () => {
      try {
        const response = await fetch('/api/health', {
          method: 'GET',
          signal: AbortSignal.timeout(10000) // 10 second timeout (increased for CPU-based queries)
        })
        setBackendStatus(response.ok ? 'running' : 'offline')
      } catch (error) {
        setBackendStatus('offline')
      }
    }

    // Check immediately
    checkBackendHealth()

    // Check every 30 seconds
    const interval = setInterval(checkBackendHealth, 30000)

    return () => clearInterval(interval)
  }, [])

  return (
    <aside className="w-56 flex-shrink-0 hidden md:block">
      <div className="sticky top-[calc(var(--nav-height)+2rem)]">
        <nav className="space-y-1 px-4">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-all duration-200 group"
                style={{
                  background: isActive ? 'var(--surface-card)' : 'transparent',
                  border: isActive ? '1px solid var(--border-subtle)' : '1px solid transparent',
                  color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                  boxShadow: isActive ? 'var(--shadow-sm)' : 'none'
                }}
              >
                <span
                  className="transition-colors duration-200"
                  style={{ color: isActive ? 'var(--ddn-red)' : 'var(--text-muted)' }}
                >
                  {iconMap[tab.icon]}
                </span>
                <span className={`text-sm ${isActive ? 'font-semibold' : 'font-medium'}`}>
                  {tab.label}
                </span>
                {isActive && (
                  <span className="ml-auto w-1.5 h-1.5 rounded-full bg-ddn-red" />
                )}
              </button>
            )
          })}
        </nav>

        {/* Sidebar Footer - System Status */}
        <div
          className="mt-8 mx-4 p-4 rounded-lg"
          style={{
            background: 'var(--surface-secondary)',
            border: '1px solid var(--border-subtle)'
          }}
        >
          <div className="flex items-center gap-2 mb-2">
            <div className="w-2 h-2 rounded-full bg-status-success animate-pulse" />
            <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>System Status</span>
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span style={{ color: 'var(--text-muted)' }}>Backend API</span>
              {backendStatus === 'checking' ? (
                <span style={{ color: 'var(--text-muted)' }} className="font-medium">Checking...</span>
              ) : backendStatus === 'running' ? (
                <span className="text-status-success font-medium">Running</span>
              ) : (
                <span className="text-status-error font-medium">Offline</span>
              )}
            </div>
            <div className="flex items-center justify-between text-xs">
              <span style={{ color: 'var(--text-muted)' }}>DDN INFINIA</span>
              <span className="text-status-success font-medium">Connected</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span style={{ color: 'var(--text-muted)' }}>NVIDIA NeMo</span>
              <span className="text-nvidia-green font-medium">Ready</span>
            </div>
          </div>
        </div>
      </div>
    </aside>
  )
}
