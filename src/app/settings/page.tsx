'use client'

import { useState, useEffect } from 'react'
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

function short(sha: string | undefined) {
  return sha && sha !== 'unknown' ? sha.slice(0, 7) : sha ?? '—'
}

function relativeDate(iso: string | undefined) {
  if (!iso) return ''
  const d = new Date(iso)
  const diff = Math.floor((Date.now() - d.getTime()) / 1000)
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

export default function SettingsPage() {
  const { settings, updateSetting } = useSettings()
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null)
  const [checkLoading, setCheckLoading] = useState(false)
  const [applyState, setApplyState] = useState<'idle' | 'applying' | 'polling' | 'done'>('idle')

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
    setApplyState('applying')
    try {
      await fetch('/api/update/apply', { method: 'POST' })
    } catch { /* container may die mid-request */ }
    setApplyState('polling')
    pollUntilBack()
  }

  function pollUntilBack() {
    const start = Date.now()
    const interval = setInterval(async () => {
      if (Date.now() - start > 5 * 60 * 1000) { clearInterval(interval); setApplyState('idle'); return }
      try {
        const r = await fetch('/api/health', { cache: 'no-store' })
        if (r.ok) { clearInterval(interval); setApplyState('done'); setTimeout(() => window.location.reload(), 800) }
      } catch { /* still restarting */ }
    }, 3000)
  }

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

      {/* Content */}
      <div style={{ padding: '40px 48px 80px', maxWidth: '760px' }}>

        {/* Display preferences */}
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
                  <button
                    key={u}
                    onClick={() => updateSetting('throughputUnit', u)}
                    style={{
                      padding: '7px 18px',
                      borderRadius: '8px',
                      border: 'none',
                      fontSize: '12.5px',
                      fontWeight: 500,
                      fontFamily: 'IBM Plex Mono, monospace',
                      background: settings.throughputUnit === u ? 'var(--primary)' : 'transparent',
                      color: settings.throughputUnit === u ? '#fff' : 'var(--muted)',
                      transition: 'all .15s ease',
                    }}
                  >{u}</button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* App update */}
        <div>
          <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '9.5px', letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--primary)', marginBottom: '10px' }}>System</div>
          <h2 style={{ fontFamily: 'Space Grotesk, sans-serif', margin: '0 0 20px', fontSize: '22px', fontWeight: 600, letterSpacing: '-.025em' }}>App update</h2>

          <div className="card" style={{ padding: '24px' }}>

            {/* Current build info */}
            {updateInfo && !updateInfo.error && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 24px', marginBottom: '20px', padding: '16px', borderRadius: '12px', background: 'var(--surface-2)' }}>
                <div>
                  <div style={{ fontSize: '10.5px', fontFamily: 'IBM Plex Mono, monospace', letterSpacing: '.06em', color: 'var(--muted)', marginBottom: '4px', textTransform: 'uppercase' }}>Current build</div>
                  <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '13px', color: 'var(--text)' }}>{short(updateInfo.buildCommit)}</div>
                </div>
                <div>
                  <div style={{ fontSize: '10.5px', fontFamily: 'IBM Plex Mono, monospace', letterSpacing: '.06em', color: 'var(--muted)', marginBottom: '4px', textTransform: 'uppercase' }}>Latest on main</div>
                  <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '13px', color: updateInfo.updateAvailable ? 'var(--good)' : 'var(--text)' }}>{short(updateInfo.latestSha)}</div>
                </div>
                {updateInfo.latestMessage && (
                  <div style={{ gridColumn: '1/-1' }}>
                    <div style={{ fontSize: '10.5px', fontFamily: 'IBM Plex Mono, monospace', letterSpacing: '.06em', color: 'var(--muted)', marginBottom: '4px', textTransform: 'uppercase' }}>Latest commit</div>
                    <div style={{ fontSize: '13px', color: 'var(--text)' }}>{updateInfo.latestMessage}</div>
                    <div style={{ fontSize: '11.5px', color: 'var(--muted)', marginTop: '3px' }}>{updateInfo.latestAuthor} · {relativeDate(updateInfo.latestDate)}</div>
                  </div>
                )}
              </div>
            )}

            {updateInfo?.error && (
              <div style={{ marginBottom: '16px', padding: '12px 16px', background: 'var(--danger-soft)', color: 'var(--danger)', borderRadius: '10px', fontSize: '13px' }}>
                {updateInfo.error}
              </div>
            )}

            {/* Update available banner */}
            {updateInfo?.updateAvailable && applyState === 'idle' && (
              <div style={{ marginBottom: '16px', padding: '14px 16px', background: 'var(--good-soft)', color: 'var(--good)', borderRadius: '10px', fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                <span>A new version is available.</span>
                <button
                  onClick={applyUpdate}
                  style={{ padding: '8px 18px', borderRadius: '9px', border: 'none', background: 'var(--good)', color: '#fff', fontWeight: 600, fontSize: '12.5px', cursor: 'pointer' }}
                >Update now</button>
              </div>
            )}

            {/* Up to date */}
            {updateInfo && !updateInfo.updateAvailable && !updateInfo.error && applyState === 'idle' && (
              <div style={{ marginBottom: '16px', padding: '12px 16px', background: 'var(--good-soft)', color: 'var(--good)', borderRadius: '10px', fontSize: '13px' }}>
                Already up to date.
              </div>
            )}

            {/* Applying */}
            {(applyState === 'applying' || applyState === 'polling') && (
              <div style={{ marginBottom: '16px', padding: '14px 16px', borderRadius: '10px', background: 'var(--surface-2)', border: '1px solid var(--border)', fontSize: '13px', color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Spinner />
                {applyState === 'applying' ? 'Pulling latest code and starting rebuild…' : 'Waiting for the app to come back online…'}
              </div>
            )}

            {applyState === 'done' && (
              <div style={{ marginBottom: '16px', padding: '12px 16px', background: 'var(--good-soft)', color: 'var(--good)', borderRadius: '10px', fontSize: '13px' }}>
                Update complete — reloading…
              </div>
            )}

            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <button
                onClick={checkForUpdates}
                disabled={checkLoading || applyState !== 'idle'}
                className="btn-outline"
                style={{ padding: '9px 18px', borderRadius: '10px', fontSize: '13px', fontWeight: 500 }}
              >
                {checkLoading ? 'Checking…' : 'Check for updates'}
              </button>
              <span style={{ fontSize: '11.5px', color: 'var(--muted)', fontFamily: 'IBM Plex Mono, monospace' }}>
                {updateInfo ? '' : 'Checks github.com/ojohnsenCloudian/cloudian_performance_reporter'}
              </span>
            </div>

          </div>
        </div>

      </div>
    </div>
  )
}

function Spinner() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ animation: 'spin 0.8s linear infinite', flexShrink: 0 }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round" />
    </svg>
  )
}
