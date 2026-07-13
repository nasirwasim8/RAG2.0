import { useEffect, useState } from 'react'
import { Moon, Sun, Cpu, Zap } from 'lucide-react'
import { useTheme } from '../contexts/ThemeContext'
import { useQuery } from '@tanstack/react-query'
import { getHealth } from '../services/api'

interface Tab {
  id: string
  label: string
}

interface HeaderProps {
  tabs: Tab[]
  activeTab: string
  onTabChange: (tabId: string) => void
}

export default function Header({ tabs, activeTab, onTabChange }: HeaderProps) {
  const [scrolled, setScrolled] = useState(false)
  const { theme, toggleTheme } = useTheme()

  // Fetch GPU status from health endpoint
  const { data: health } = useQuery({
    queryKey: ['health'],
    queryFn: () => getHealth().then((res) => res.data),
    refetchInterval: 10000, // Refresh every 10 seconds
  })

  useEffect(() => {
    let ticking = false
    const handleScroll = () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          setScrolled(window.scrollY > 10)
          ticking = false
        })
        ticking = true
      }
    }
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <header
      className={`nav-bar fixed top-0 left-0 right-0 z-50 transition-all duration-200 ${scrolled ? 'scrolled' : ''
        }`}
    >
      <div className="max-w-[1280px] mx-auto px-6 h-full">
        <div className="flex items-center justify-between h-full">
          {/* Left: Logo + BUILD:RAG */}
          <div className="flex items-center">
            <img
              src="/logo-ddn.svg"
              alt="DDN"
              className="h-7 w-auto"
              style={{ filter: theme === 'dark' ? 'invert(1)' : 'none' }}
            />
            <div
              className="flex items-baseline ml-2 pl-2"
              style={{
                borderLeft: `1px solid ${theme === 'dark' ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.15)'}`,
                height: '20px',
                alignSelf: 'center'
              }}
            >
              <span
                className="text-[13px] tracking-wide"
                style={{
                  fontWeight: 300,
                  color: theme === 'dark' ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.4)',
                  letterSpacing: '0.05em'
                }}
              >
                BUILD.DDN:
              </span>
              <span
                className="text-[13px] tracking-wide"
                style={{
                  fontWeight: 700,
                  color: theme === 'dark' ? 'rgba(255,255,255,0.9)' : 'var(--ddn-red)',
                  letterSpacing: '0.05em'
                }}
              >
                RAG
              </span>
            </div>
          </div>

          {/* Center: Navigation Tabs */}
          <nav className="hidden md:flex items-center">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={`tab-item ${activeTab === tab.id ? 'active' : ''}`}
              >
                {tab.label}
              </button>
            ))}
          </nav>

          {/* Right: GPU/CPU Indicator + NVIDIA Badge + Theme Toggle */}
          <div className="hidden sm:flex items-center gap-3">
            {/* GPU/CPU Indicator */}
            {health && (
              <div
                className="flex items-center gap-2 px-4 py-2.5 rounded-full"
                style={{
                  background: health.gpu_available
                    ? (theme === 'dark'
                      ? 'linear-gradient(135deg, rgba(0, 150, 0, 0.2) 0%, rgba(50, 200, 50, 0.15) 100%)'
                      : 'linear-gradient(135deg, rgba(0, 150, 0, 0.12) 0%, rgba(50, 200, 50, 0.08) 100%)')
                    : (theme === 'dark'
                      ? 'linear-gradient(135deg, rgba(100, 100, 100, 0.2) 0%, rgba(150, 150, 150, 0.15) 100%)'
                      : 'linear-gradient(135deg, rgba(100, 100, 100, 0.12) 0%, rgba(150, 150, 150, 0.08) 100%)'),
                  border: health.gpu_available
                    ? (theme === 'dark' ? '2px solid rgba(0, 200, 0, 0.4)' : '2px solid rgba(0, 180, 0, 0.35)')
                    : (theme === 'dark' ? '2px solid rgba(150, 150, 150, 0.3)' : '2px solid rgba(120, 120, 120, 0.25)'),
                  boxShadow: theme === 'dark'
                    ? '0 4px 12px rgba(0, 0, 0, 0.3)'
                    : '0 4px 12px rgba(0, 0, 0, 0.1)',
                }}
                title={health.gpu_available
                  ? `GPU: ${health.gpu_names[0] || 'Unknown'} (CUDA ${health.cuda_version})`
                  : 'Running on CPU'}
              >
                {health.gpu_available ? (
                  <Zap className="w-5 h-5" style={{ color: 'rgb(0, 180, 0)' }} />
                ) : (
                  <Cpu className="w-5 h-5" style={{ color: theme === 'dark' ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.7)' }} />
                )}
                <span
                  className="text-sm md:text-base font-bold uppercase tracking-wide"
                  style={{
                    color: health.gpu_available
                      ? 'rgb(0, 160, 0)'
                      : (theme === 'dark' ? 'rgba(255,255,255,0.8)' : 'rgba(0,0,0,0.8)')
                  }}
                >
                  {health.gpu_available ? 'GPU' : 'CPU'}
                </span>
              </div>
            )}
            {/* NVIDIA Badge */}
            <div
              className="flex items-center gap-2 px-3 py-1.5 rounded-full"
              style={{
                background: theme === 'dark'
                  ? 'linear-gradient(135deg, rgba(0, 0, 0, 0.5) 0%, rgba(30, 30, 30, 0.6) 100%)'
                  : 'linear-gradient(135deg, rgba(255, 255, 255, 0.95) 0%, rgba(248, 248, 248, 0.95) 100%)',
                border: theme === 'dark'
                  ? '1px solid rgba(118, 185, 0, 0.4)'
                  : '1px solid rgba(118, 185, 0, 0.3)',
                boxShadow: theme === 'dark'
                  ? '0 2px 8px rgba(0, 0, 0, 0.3)'
                  : '0 2px 8px rgba(0, 0, 0, 0.08)',
              }}
            >
              <span
                className="text-[10px] font-medium uppercase tracking-wide"
                style={{ color: theme === 'dark' ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.5)' }}
              >
                Powered by
              </span>
              <img
                src="/nvidia-icon.svg"
                alt="NVIDIA"
                className="h-5 w-auto"
              />
              <span
                className="text-xs font-semibold"
                style={{ color: 'var(--nvidia-green)' }}
              >
                NVIDIA
              </span>
            </div>

            {/* Theme Toggle */}
            <button
              onClick={toggleTheme}
              className="theme-toggle"
              aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`}
            >
              {theme === 'light' ? (
                <Moon className="w-3.5 h-3.5" />
              ) : (
                <Sun className="w-3.5 h-3.5" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Navigation */}
      <div className="md:hidden border-t border-[var(--border-subtle)] overflow-x-auto scrollbar-hide">
        <nav className="flex px-4 items-center justify-between">
          <div className="flex">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={`tab-item text-[12px] ${activeTab === tab.id ? 'active' : ''}`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <button
            onClick={toggleTheme}
            className="theme-toggle p-2"
            aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`}
          >
            {theme === 'light' ? (
              <Moon className="w-3.5 h-3.5" />
            ) : (
              <Sun className="w-3.5 h-3.5" />
            )}
          </button>
        </nav>
      </div>
    </header>
  )
}
