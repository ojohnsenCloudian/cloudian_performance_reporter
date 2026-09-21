'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useSettings } from '@/context/SettingsContext'

interface UpdateInfo {
  buildCommit?: string
  latestSha?: string
  latestMessage?: string
  latestDate?: string
  latestAuthor?: string
  updateAvailable?: boolean
  error?: string
}

interface UpdateStatus {
  step: number
  label: string
  progress: number
  done: boolean
  error?: boolean
  log?: string
}

const STEPS = [
  { n: 1, label: 'Pull' },
  { n: 2, label: 'Build' },
  { n: 3, label: 'Restart' },
]

function short(sha?: string) {
  return sha && sha !== 'unknown' ? sha.slice(0, 7) : sha ?? '—'
}

function relativeDate(iso?: string) {
  if (!iso) return ''
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

export default function SettingsPage() {
  const { settings, updateSetting } = useSettings()
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null)
  const [checkLoading, setCheckLoading] = useState(false)
  const [phase, setPhase] = useState<'idle' | 'running' | 'restarting' | 'done' | 'error'>('idle')
  const [status, setStatus] = useState<UpdateStatus>({ step: 0, label: '', progress: 0, done: false })
  const [elapsed, setElapsed] = useState(0)
  const startRef = useRef<number>(0)
  const logRef = useRef<HTMLPreElement>(null)

  // auto-scroll log
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight
  }, [status.log])

  // elapsed timer
  useEffect(() => {
    if (phase === 'idle' || phase === 'done' || phase === 'error') return
    setElapsed(0)
    startRef.current = Date.now()
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - startRef.current) / 1000)), 1000)
    return () => clearInterval(id)
  }, [phase])

  // status polling
  useEffect(() => {
    if (phase !== 'running') return
    const id = setInterval(async () => {
      try {
        const r = await fetch('/api/update/status', { cache: 'no-store' })
        if (!r.ok) { setPhase('restarting'); return }
        const s: UpdateStatus = await r.json()
        setStatus(s)
        if (s.error) { setPhase('error'); return }
        if (s.step >= 3) setPhase('restarting')
      } catch {
        setPhase('restarting')
      }
    }, 1500)
    return () => clearInterval(id)
  }, [phase])

  // health polling after container restarts
  useEffect(() => {
    if (phase !== 'restarting') return
    const id = setInterval(async () => {
      try {
        const r = await fetch('/api/health', { cache: 'no-store' })
        if (r.ok) { clearInterval(id); setPhase('done'); setStatus(s => ({ ...s, progress: 100 })) }
      } catch { /* still down */ }
    }, 2500)
    return () => clearInterval(id)
  }, [phase])

  async function checkForUpdates() {
    setCheckLoading(true)
    try {
      const r = await fetch('/api/update/check')
      setUpdateInfo(await r.json())
    } catch {
      setUpdateInfo({ error: 'Could not reach GitHub' })
    } finally {
      setCheckLoading(false)
    }
  }

  async function applyUpdate() {
    await fetch('/api/update/status', { method: 'DELETE' })
    setStatus({ step: 0, label: 'Starting…', progress: 2, done: false })
    setPhase('running')
    try {
      await fetch('/api/update/apply', { method: 'POST' })
    } catch { /* container may die during request */ }
  }

  const isActive = phase === 'running' || phase === 'restarting'
  const displayProgress = phase === 'restarting' ? Math.max(status.progress, 90) : status.progress
  const fmtElapsed = elapsed >= 60 ? `${Math.floor(elapsed / 60)}m ${elapsed % 60}s` : `${elapsed}s`

  return (
    <div className="warm-canvas" style={{ minHeight: '100vh' }}>

      {/* Masthead */}
      <div style={{ position: 'sticky', top: 0, zIndex: 10, padding: '20px 48px', background: 'var(--graphite-grad)', color: 'var(--graphite-text)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '18px' }}>
          <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: '7px', color: 'var(--graphite-muted)', textDecoration: 'none', fontSize: '12px', fontFamily: 'IBM Plex Mono, monospace', letterSpacing: '.05em' }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M19 12H5M5 12l7-7M5 12l7 7" strokeLinecap="round" strokeLinejoin="round" /></svg>
            BACK
          </Link>
          <div style={{ width: '1px', height: '16px', background: 'var(--graphite-border)' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '26px', height: '26px', borderRadius: '8px', background: 'var(--primary)', display: 'grid', placeItems: 'center' }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.4"><path d="M4 18V7M11 18v-8M18 18v-5" strokeLinecap="round" /></svg>
            </div>
            <div>
              <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: '13px', fontWeight: 600, letterSpacing: '-.01em' }}>Settings</div>
              <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '9px', letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--graphite-muted)' }}>Cloudian Performance Reporter</div>
            </div>
          </div>
        </div>
        {updateInfo?.buildCommit && updateInfo.buildCommit !== 'unknown' && (
          <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '10px', color: 'var(--graphite-muted)', letterSpacing: '.06em' }}>
            build <span style={{ color: 'oklch(0.78 0.08 80)' }}>{short(updateInfo.buildCommit)}</span>
          </div>
        )}
      </div>

      <div style={{ padding: '40px 48px 80px', maxWidth: '760px' }}>

        {/* ── Display preferences ── */}
        <div style={{ marginBottom: '40px' }}>
          <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '9.5px', letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--primary)', marginBottom: '10px' }}>Display</div>
          <h2 style={{ fontFamily: 'Space Grotesk, sans-serif', margin: '0 0 20px', fontSize: '22px', fontWeight: 600, letterSpacing: '-.025em' }}>Display preferences</h2>
          <div className="card" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '24px' }}>
              <div>
                <div style={{ fontWeight: 500, fontSize: '14px', marginBottom: '4px' }}>Throughput unit</div>
                <div style={{ fontSize: '12.5px', color: 'var(--muted)', lineHeight: 1.5 }}>Unit shown in charts and KPI cards. GB/s divides all throughput values by 1000.</div>
              </div>
              <div style={{ display: 'flex', gap: '3px', padding: '3px', borderRadius: '10px', background: 'var(--surface-2)', border: '1px solid var(--border)', flexShrink: 0 }}>
                {(['MB/s', 'GB/s'] as const).map(u => (
                  <button key={u} onClick={() => updateSetting('throughputUnit', u)}
                    style={{ padding: '7px 18px', borderRadius: '8px', border: 'none', fontSize: '12.5px', fontWeight: 500, fontFamily: 'IBM Plex Mono, monospace', background: settings.throughputUnit === u ? 'var(--primary)' : 'transparent', color: settings.throughputUnit === u ? '#fff' : 'var(--muted)', transition: 'all .15s ease', cursor: 'pointer' }}
                  >{u}</button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ── App update ── */}
        <div>
          <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '9.5px', letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--primary)', marginBottom: '10px' }}>System</div>
          <h2 style={{ fontFamily: 'Space Grotesk, sans-serif', margin: '0 0 20px', fontSize: '22px', fontWeight: 600, letterSpacing: '-.025em' }}>App update</h2>

          <div className="card" style={{ padding: '24px' }}>

            {/* Version info */}
            {updateInfo && !updateInfo.error && !isActive && phase !== 'done' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 24px', marginBottom: '20px', padding: '16px', borderRadius: '12px', background: 'var(--surface-2)' }}>
                <div>
                  <div style={{ fontSize: '10px', fontFamily: 'IBM Plex Mono, monospace', letterSpacing: '.07em', color: 'var(--muted)', marginBottom: '4px', textTransform: 'uppercase' }}>Current build</div>
                  <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '13px' }}>{short(updateInfo.buildCommit)}</div>
                </div>
                <div>
                  <div style={{ fontSize: '10px', fontFamily: 'IBM Plex Mono, monospace', letterSpacing: '.07em', color: 'var(--muted)', marginBottom: '4px', textTransform: 'uppercase' }}>Latest on main</div>
                  <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '13px', color: updateInfo.updateAvailable ? 'var(--good)' : 'var(--text)' }}>{short(updateInfo.latestSha)}</div>
                </div>
                {updateInfo.latestMessage && (
                  <div style={{ gridColumn: '1/-1' }}>
                    <div style={{ fontSize: '10px', fontFamily: 'IBM Plex Mono, monospace', letterSpacing: '.07em', color: 'var(--muted)', marginBottom: '4px', textTransform: 'uppercase' }}>Latest commit</div>
                    <div style={{ fontSize: '13px' }}>{updateInfo.latestMessage}</div>
                    <div style={{ fontSize: '11.5px', color: 'var(--muted)', marginTop: '3px' }}>{updateInfo.latestAuthor} · {relativeDate(updateInfo.latestDate)}</div>
                  </div>
                )}
              </div>
            )}

            {/* Error banner */}
            {updateInfo?.error && (
              <div style={{ marginBottom: '16px', padding: '12px 16px', background: 'var(--danger-soft)', color: 'var(--danger)', borderRadius: '10px', fontSize: '13px' }}>
                {updateInfo.error}
              </div>
            )}

            {/* Up to date */}
            {updateInfo && !updateInfo.updateAvailable && !updateInfo.error && !isActive && phase !== 'done' && (
              <div style={{ marginBottom: '16px', padding: '12px 16px', background: 'var(--good-soft)', color: 'var(--good)', borderRadius: '10px', fontSize: '13px' }}>
                Already up to date.
              </div>
            )}

            {/* Update available */}
            {updateInfo?.updateAvailable && phase === 'idle' && (
              <div style={{ marginBottom: '16px', padding: '14px 16px', background: 'var(--good-soft)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                <span style={{ fontSize: '13px', color: 'var(--good)', fontWeight: 500 }}>A new version is available.</span>
                <button onClick={applyUpdate} style={{ padding: '8px 18px', borderRadius: '9px', border: 'none', background: 'var(--good)', color: '#fff', fontWeight: 600, fontSize: '12.5px', cursor: 'pointer' }}>
                  Update now
                </button>
              </div>
            )}

            {/* ── Progress panel ── */}
            {(isActive || phase === 'done' || phase === 'error') && (
              <div style={{ marginBottom: '20px' }}>

                {/* Step indicators */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0', marginBottom: '18px' }}>
                  {STEPS.map((s, i) => {
                    const done = status.step > s.n || phase === 'done'
                    const active = status.step === s.n && isActive
                    const isErr = phase === 'error' && status.step === s.n
                    return (
                      <div key={s.n} style={{ display: 'flex', alignItems: 'center', flex: i < STEPS.length - 1 ? '1' : 'none' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px' }}>
                          <div style={{
                            width: '32px', height: '32px', borderRadius: '50%', display: 'grid', placeItems: 'center', fontSize: '11px', fontWeight: 700, fontFamily: 'IBM Plex Mono, monospace', flexShrink: 0,
                            background: isErr ? 'var(--danger-soft)' : done ? 'var(--good-soft)' : active ? 'var(--primary-soft)' : 'var(--surface-2)',
                            color: isErr ? 'var(--danger)' : done ? 'var(--good)' : active ? 'var(--primary)' : 'var(--muted)',
                            border: `1.5px solid ${isErr ? 'var(--danger)' : done ? 'var(--good)' : active ? 'var(--primary)' : 'var(--border)'}`,
                          }}>
                            {isErr ? '✕' : done ? '✓' : active ? <SpinDot /> : `0${s.n}`}
                          </div>
                          <div style={{ fontSize: '10px', fontFamily: 'IBM Plex Mono, monospace', letterSpacing: '.06em', color: active ? 'var(--text)' : done ? 'var(--good)' : 'var(--muted)', fontWeight: active ? 600 : 400, textTransform: 'uppercase' }}>{s.label}</div>
                        </div>
                        {i < STEPS.length - 1 && (
                          <div style={{ flex: 1, height: '1.5px', margin: '0 8px', marginBottom: '18px', background: done ? 'var(--good)' : 'var(--border)' }} />
                        )}
                      </div>
                    )
                  })}
                  {/* Restart indicator (health polling phase) */}
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <div style={{ width: '1.5px', height: '1.5px', flex: 1, margin: '0 8px', marginBottom: '18px', background: 'var(--border)' }} />
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px' }}>
                      <div style={{
                        width: '32px', height: '32px', borderRadius: '50%', display: 'grid', placeItems: 'center', fontSize: '11px', fontWeight: 700, fontFamily: 'IBM Plex Mono, monospace',
                        background: phase === 'done' ? 'var(--good-soft)' : phase === 'restarting' ? 'var(--primary-soft)' : 'var(--surface-2)',
                        color: phase === 'done' ? 'var(--good)' : phase === 'restarting' ? 'var(--primary)' : 'var(--muted)',
                        border: `1.5px solid ${phase === 'done' ? 'var(--good)' : phase === 'restarting' ? 'var(--primary)' : 'var(--border)'}`,
                      }}>
                        {phase === 'done' ? '✓' : phase === 'restarting' ? <SpinDot /> : '04'}
                      </div>
                      <div style={{ fontSize: '10px', fontFamily: 'IBM Plex Mono, monospace', letterSpacing: '.06em', color: phase === 'done' ? 'var(--good)' : phase === 'restarting' ? 'var(--text)' : 'var(--muted)', fontWeight: phase === 'restarting' ? 600 : 400, textTransform: 'uppercase' }}>Online</div>
                    </div>
                  </div>
                </div>

                {/* Progress bar */}
                <div style={{ marginBottom: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '6px' }}>
                    <div style={{ fontSize: '12.5px', color: phase === 'error' ? 'var(--danger)' : phase === 'done' ? 'var(--good)' : 'var(--text)', fontWeight: 500 }}>
                      {phase === 'done' ? 'Update complete — reloading…' : phase === 'error' ? status.label : phase === 'restarting' ? 'Waiting for container to come back online…' : status.label}
                    </div>
                    <div style={{ fontSize: '11px', fontFamily: 'IBM Plex Mono, monospace', color: 'var(--muted)' }}>{displayProgress}%{isActive ? ` · ${fmtElapsed}` : ''}</div>
                  </div>
                  <div style={{ height: '6px', borderRadius: '3px', background: 'var(--surface-2)', overflow: 'hidden' }}>
                    <div style={{
                      height: '100%', borderRadius: '3px',
                      width: `${displayProgress}%`,
                      background: phase === 'error' ? 'var(--danger)' : phase === 'done' ? 'var(--good)' : 'var(--primary)',
                      transition: 'width 0.8s ease, background 0.3s ease',
                    }} />
                  </div>
                </div>

                {/* Live log */}
                {status.log && (
                  <div style={{ borderRadius: '10px', background: 'oklch(0.14 0.01 40)', border: '1px solid oklch(0.22 0.01 40)', overflow: 'hidden' }}>
                    <div style={{ padding: '8px 12px', borderBottom: '1px solid oklch(0.22 0.01 40)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '10px', fontFamily: 'IBM Plex Mono, monospace', letterSpacing: '.08em', color: 'oklch(0.55 0.012 40)', textTransform: 'uppercase' }}>Build output</span>
                      {isActive && <PulseDot />}
                    </div>
                    <pre ref={logRef} style={{ margin: 0, padding: '12px 14px', fontSize: '11px', lineHeight: 1.65, fontFamily: 'IBM Plex Mono, monospace', color: 'oklch(0.82 0.008 70)', maxHeight: '260px', overflowY: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                      {status.log}
                    </pre>
                  </div>
                )}
              </div>
            )}

            {/* Action button */}
            {phase === 'idle' && (
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <button onClick={checkForUpdates} disabled={checkLoading} className="btn-outline"
                  style={{ padding: '9px 18px', borderRadius: '10px', fontSize: '13px', fontWeight: 500 }}>
                  {checkLoading ? 'Checking…' : 'Check for updates'}
                </button>
                {!updateInfo && (
                  <span style={{ fontSize: '11.5px', color: 'var(--muted)', fontFamily: 'IBM Plex Mono, monospace' }}>
                    Checks github.com/ojohnsenCloudian/cloudian_performance_reporter
                  </span>
                )}
              </div>
            )}

            {phase === 'error' && (
              <button onClick={() => { setPhase('idle'); setStatus({ step: 0, label: '', progress: 0, done: false }) }}
                className="btn-outline" style={{ marginTop: '4px', padding: '9px 18px', borderRadius: '10px', fontSize: '13px' }}>
                Dismiss
              </button>
            )}

          </div>
        </div>
      </div>
    </div>
  )
}

function SpinDot() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"
      style={{ animation: 'spin 0.75s linear infinite' }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round" />
    </svg>
  )
}

function PulseDot() {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '10px', fontFamily: 'IBM Plex Mono, monospace', color: 'oklch(0.68 0.15 155)', letterSpacing: '.05em' }}>
      <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'currentColor', animation: 'pulse 1.2s ease-in-out infinite' }} />
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.3}}`}</style>
      LIVE
    </span>
  )
}
