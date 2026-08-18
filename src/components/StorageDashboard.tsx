'use client'

import { useRef, useState, useCallback, useEffect } from 'react'
import { fmtNum, toNum, buildBarChart } from '@/lib/chartUtils'
import { buildFullDashboard, buildScalingCharts, nextColor, generateDemoData } from '@/lib/dataUtils'

const ROLES = ['category', 'protocol', 'operation', 'objectSize', 'threads', 'throughput', 'latency', 'objectsPerSec', 'cpuMin', 'cpuMax', 'cpuAvg', 'state']
const ROLE_LABELS: Record<string, string> = {
  category: 'Category / Configuration', protocol: 'Protocol', operation: 'Operation (Read/Write)',
  objectSize: 'Object / Part Size', threads: 'Threads / Concurrency', throughput: 'Throughput',
  latency: 'Latency', objectsPerSec: 'Objects per Second', cpuMin: 'CPU Min', cpuMax: 'CPU Max',
  cpuAvg: 'CPU Avg', state: 'State / Scenario',
}
const ICONS: Record<string, string> = {
  overview: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7" rx="1.5"></rect><rect x="14" y="3" width="7" height="7" rx="1.5"></rect><rect x="3" y="14" width="7" height="7" rx="1.5"></rect><rect x="14" y="14" width="7" height="7" rx="1.5"></rect></svg>',
  scaling: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 18V6M12 18V9M20 18v-4" stroke-linecap="round"></path></svg>',
  latency: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"></circle><path d="M12 7v5l3 3" stroke-linecap="round"></path></svg>',
  cpu: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="6" y="6" width="12" height="12" rx="2"></rect><path d="M9 3v3M15 3v3M9 18v3M15 18v3M3 9h3M3 15h3M18 9h3M18 15h3" stroke-linecap="round"></path></svg>',
  cached: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12a9 9 0 0115-6.7M21 12a9 9 0 01-15 6.7" stroke-linecap="round"></path><path d="M18 3v4h-4M6 21v-4h4" stroke-linecap="round" stroke-linejoin="round"></path></svg>',
  mpu: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 7l8-4 8 4-8 4-8-4z"></path><path d="M4 7v10l8 4 8-4V7M12 11v10"></path></svg>',
  raw: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 5h16M4 12h16M4 19h16" stroke-linecap="round"></path></svg>',
  compare: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 3v18M15 3v18M4 3h5M4 21h5M15 3h5M15 21h5"></path></svg>',
}

// ── small reusable SVG icons ───────────────────────────────────────────────
const ChevronDown = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" /></svg>
const ZoomIcon = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="10" cy="10" r="7" /><path d="M21 21l-4.35-4.35" strokeLinecap="round" /><path d="M10 7v6M7 10h6" strokeLinecap="round" /></svg>
const SunIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="4.5" /><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" strokeLinecap="round" /></svg>
const MoonIcon = () => <svg width="16" height="16" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" fill="currentColor" /><circle cx="16.5" cy="9" r="8" fill="var(--bg)" /></svg>

// ── Dropdown component ─────────────────────────────────────────────────────
function Dropdown({ label, open, onToggle, onClose, options }: any) {
  return (
    <div style={{ position: 'relative' }}>
      <button type="button" className="select-btn" onClick={onToggle}>{label}<ChevronDown /></button>
      {open && <>
        <div className="select-backdrop" onClick={onClose} />
        <div className="select-menu">
          {options.map((opt: any, i: number) => (
            <div key={i} className="select-item"
              style={{ background: opt.activeBg, color: opt.activeColor, fontWeight: opt.activeWeight }}
              onClick={opt.onClick}>{opt.label}</div>
          ))}
        </div>
      </>}
    </div>
  )
}

// ── LineChart ──────────────────────────────────────────────────────────────
function LineChart({ chart, zoom = false }: any) {
  if (!chart) return null
  return (
    <svg viewBox={`0 0 ${chart.width} ${chart.height}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
      <defs>
        {chart.series.map((s: any) => (
          <linearGradient key={s.gradId} id={s.gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={s.color} stopOpacity="0.28" />
            <stop offset="100%" stopColor={s.color} stopOpacity="0" />
          </linearGradient>
        ))}
      </defs>
      {chart.gridLines.map((gl: any, i: number) => (
        <g key={i}>
          <line x1={chart.plotLeft} x2={chart.width} y1={gl.y} y2={gl.y} stroke="var(--border)" strokeWidth="1" />
          <foreignObject x="2" y={gl.foY} width="40" height="14" style={{ overflow: 'visible' }}>
            <div style={{ fontSize: zoom ? '11px' : '10px', color: 'var(--muted)' }}>{gl.label}</div>
          </foreignObject>
        </g>
      ))}
      {chart.series.map((s: any) => (
        <g key={s.gradId}>
          <path className="chart-area" d={s.areaPath} fill={`url(#${s.gradId})`} stroke="none" />
          <path className="chart-line" d={s.path} fill="none" stroke={s.color} strokeWidth={zoom ? '2.5' : '2.25'} strokeLinecap="round" strokeLinejoin="round" style={{ strokeDasharray: s.length, strokeDashoffset: s.length }} />
          {s.points.map((p: any, pi: number) => (
            <g key={pi}>
              <circle className="chart-point" cx={p.cx} cy={p.cy} r="3" fill="var(--surface)" stroke={s.color} strokeWidth="2"><title>{p.tooltip}</title></circle>
              <foreignObject x={p.foX} y={p.foY} width="50" height="14" style={{ overflow: 'visible' }}>
                <div style={{ fontSize: zoom ? '11px' : '9.5px', fontWeight: 600, textAlign: 'center', color: s.color }}>{p.valueLabel}</div>
              </foreignObject>
            </g>
          ))}
        </g>
      ))}
      {chart.xLabels.map((xl: any, i: number) => (
        <foreignObject key={i} x={xl.foX} y={chart.xLabelTop} width="50" height="14" style={{ overflow: 'visible' }}>
          <div style={{ fontSize: zoom ? '11px' : '10px', textAlign: 'center', color: 'var(--muted)' }}>{xl.label}</div>
        </foreignObject>
      ))}
    </svg>
  )
}

// ── BarChart ───────────────────────────────────────────────────────────────
function BarChart({ chart, zoom = false }: any) {
  if (!chart) return null
  return (
    <svg viewBox={`0 0 ${chart.width} ${chart.height}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
      {chart.gridLines.map((gl: any, i: number) => (
        <g key={i}>
          <line x1="44" x2={chart.width} y1={gl.y} y2={gl.y} stroke="var(--border)" strokeWidth="1" />
          <foreignObject x="2" y={gl.foY} width="40" height="14" style={{ overflow: 'visible' }}>
            <div style={{ fontSize: zoom ? '11px' : '10px', color: 'var(--muted)' }}>{gl.label}</div>
          </foreignObject>
        </g>
      ))}
      {chart.items.map((b: any, i: number) => (
        <g key={i}>
          <g className="chart-bar-g" style={{ animationDelay: `calc(${i} * 70ms)` }}>
            <rect className="chart-bar-rect" x={b.x} y={b.y} width={b.width} height={b.height} fill={b.color} rx="6"><title>{b.tooltip}</title></rect>
          </g>
          <foreignObject x={b.foX} y={b.foY} width="60" height="16" style={{ overflow: 'visible' }}>
            <div className="num" style={{ fontSize: zoom ? '12px' : '11px', fontWeight: 600, textAlign: 'center', color: 'var(--text)' }}>{b.valueLabel}</div>
          </foreignObject>
          <foreignObject x={b.catFoX} y={chart.categoryTop} width="80" height="20" style={{ overflow: 'visible' }}>
            <div style={{ fontSize: zoom ? '10.5px' : '9px', textAlign: 'center', color: 'var(--muted)' }}>{b.label}</div>
          </foreignObject>
        </g>
      ))}
    </svg>
  )
}

// ── HBarChart ──────────────────────────────────────────────────────────────
function HBarChart({ chart, zoom = false }: any) {
  if (!chart || !chart.rows) return null
  return (
    <svg viewBox={`0 0 ${chart.width} ${chart.height}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
      {chart.rows.map((r: any, i: number) => (
        <g key={i}>
          <foreignObject x="0" y={r.y} width={r.labelBoxW} height={r.barHeight} style={{ overflow: 'visible' }}>
            <div style={{ height: '100%', display: 'flex', alignItems: 'center', fontSize: zoom ? '13.5px' : '12px', color: 'var(--text)' }}>{r.label}</div>
          </foreignObject>
          <rect className="hbar-g" style={{ animationDelay: `calc(${i} * 60ms)` }} x={r.trackX} y={r.y} width={r.trackWidth} height={r.barHeight} fill="var(--surface-2)" rx="6" />
          <g className="hbar-g" style={{ animationDelay: `calc(${i} * 60ms)` }}>
            <rect className="chart-bar-rect" x={r.trackX} y={r.y} width={r.width} height={r.barHeight} fill={r.color} rx="6"><title>{r.tooltip}</title></rect>
          </g>
          <foreignObject x={r.valueX} y={r.y} width="70" height={r.barHeight} style={{ overflow: 'visible' }}>
            <div className="num" style={{ height: '100%', display: 'flex', alignItems: 'center', fontSize: zoom ? '13.5px' : '12px', fontWeight: 600, color: 'var(--text)' }}>{r.valueLabel}</div>
          </foreignObject>
        </g>
      ))}
    </svg>
  )
}

// ── Legend ─────────────────────────────────────────────────────────────────
function Legend({ series }: any) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '14px', marginTop: '12px', paddingTop: '12px', borderTop: '1px solid var(--border)' }}>
      {series.map((s: any, i: number) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--muted)' }}>
          <span style={{ width: '9px', height: '9px', borderRadius: '3px', background: s.color, display: 'inline-block' }} />{s.label}
        </div>
      ))}
    </div>
  )
}

// ── ZoomModal ──────────────────────────────────────────────────────────────
function ZoomModal({ zoomedChart, onClose }: any) {
  if (!zoomedChart) return null
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'oklch(0.15 0.01 260 / .55)', zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '32px' }} onClick={onClose}>
      <div className="card" style={{ maxWidth: '1040px', width: '100%', padding: '28px', background: 'var(--surface)', maxHeight: '88vh', overflow: 'auto' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div style={{ fontWeight: 700, fontSize: '18px' }}>{zoomedChart.title}</div>
          <button className="btn-outline" onClick={onClose} style={{ padding: '7px 14px', borderRadius: '8px' }}>Close</button>
        </div>
        {zoomedChart.type === 'bar' && <BarChart chart={zoomedChart.chart} zoom />}
        {zoomedChart.type === 'hbar' && <HBarChart chart={zoomedChart.chart} zoom />}
        {zoomedChart.type === 'line' && <>
          <LineChart chart={zoomedChart.chart} zoom />
          <Legend series={zoomedChart.chart.series} />
        </>}
      </div>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────
export default function StorageDashboard() {
  const [theme, setTheme] = useState<'light' | 'dark'>('light')
  const [stage, setStage] = useState<'upload' | 'mapping' | 'dashboard'>('upload')
  const [files, setFiles] = useState<any[]>([])
  const [mappingQueue, setMappingQueue] = useState<string[]>([])
  const [focusFileId, setFocusFileId] = useState<string | null>(null)
  const [compareMode, setCompareMode] = useState(false)
  const [activeSection, setActiveSection] = useState('overview')
  const [reportOpen, setReportOpen] = useState(false)
  const [sortCol, setSortCol] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState(1)
  const [filterText, setFilterText] = useState('')
  const [page, setPage] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [activeSheetTab, setActiveSheetTab] = useState<string | null>(null)
  const [openDropdown, setOpenDropdown] = useState<string | null>(null)
  const [zoomedChartKey, setZoomedChartKey] = useState<string | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)

  // Load doc-page.js once on client
  useEffect(() => {
    if (!document.querySelector('script[src="/doc-page.js"]')) {
      const s = document.createElement('script')
      s.src = '/doc-page.js'
      document.head.appendChild(s)
    }
  }, [])

  const toggleTheme = () => setTheme(t => t === 'light' ? 'dark' : 'light')
  const toggleDropdown = (id: string) => () => setOpenDropdown(o => o === id ? null : id)
  const closeDropdown = () => setOpenDropdown(null)

  const advanceQueue = useCallback((nextFiles: any[], nextQueue: string[]) => {
    if (nextQueue.length > 0) {
      setStage('mapping')
    } else {
      setStage('dashboard')
      setFocusFileId(id => id || (nextFiles[0]?.id ?? null))
    }
  }, [])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const loadXlsxMod = (): Promise<any> => (window as any).__xlsxMod ? Promise.resolve((window as any).__xlsxMod) : import(/* webpackIgnore: true */ '/xlsx-lite.js' as any).then((m: any) => { (window as any).__xlsxMod = m; return m })

  const onFilesSelected = async (fileList: FileList) => {
    setLoading(true); setError(null)
    const arr = Array.from(fileList)
    const newFiles: any[] = []
    try {
      const mod: any = await loadXlsxMod()
      for (const f of arr) {
        const ext = f.name.split('.').pop()?.toLowerCase()
        let sheets: any, sheetNames: string[], mainSheetName: string
        if (ext === 'csv') {
          const text = await f.text()
          const table = mod.parseCSV(text)
          sheets = { [f.name]: table }; sheetNames = [f.name]; mainSheetName = f.name
        } else {
          const buf = await f.arrayBuffer()
          const wb = await mod.parseXlsx(buf)
          sheets = wb.sheets; sheetNames = wb.sheetNames
          mainSheetName = mod.pickMainSheet(sheets, sheetNames)
        }
        const table = sheets[mainSheetName]
        if (!table || table.headers.length === 0) throw new Error(`Couldn't find a data table in "${f.name}".`)
        const mapping = mod.autoDetectMapping(table.headers)
        const otherSheets: any = {}
        sheetNames.forEach((n: string) => { if (n !== mainSheetName) otherSheets[n] = sheets[n] })
        const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
        newFiles.push({ id, name: f.name, sheets, sheetNames, mainSheetName, headers: table.headers, rows: table.rows, mapping, otherSheets, color: nextColor(files.length + newFiles.length) })
      }
    } catch (e: any) {
      setLoading(false); setError(e.message || 'Could not read that file.'); return
    }
    const nextQueue = newFiles.map(f => f.id)
    setFiles(prev => { const all = [...prev, ...newFiles]; return all })
    setMappingQueue(prev => { const all = [...prev, ...nextQueue]; return all })
    setLoading(false)
    advanceQueue([...files, ...newFiles], [...mappingQueue, ...nextQueue])
  }

  const onDrop = (e: React.DragEvent) => { e.preventDefault(); setDragOver(false); if (e.dataTransfer.files.length) onFilesSelected(e.dataTransfer.files) }
  const onDragOver = (e: React.DragEvent) => { e.preventDefault(); setDragOver(true) }
  const onDragLeave = () => setDragOver(false)
  const onFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => { if (e.target.files) onFilesSelected(e.target.files); e.target.value = '' }

  const onDemoClick = () => {
    const { mainTable, otherSheets } = generateDemoData()
    const mapping = { category: 'Configuration', protocol: 'Protocol', operation: 'Operation', objectSize: 'Object Size (MiB)', threads: 'Threads', throughput: 'Throughput (MiB/s)', latency: 'Latency (ms)', objectsPerSec: 'Objects/s', cpuMin: 'CPU Min', cpuMax: 'CPU Max', cpuAvg: 'CPU Avg' }
    const id = `demo-${Date.now()}`
    const file = { id, name: 'Demo Benchmark.xlsx', sheets: { 'Benchmark Data': mainTable, ...otherSheets }, sheetNames: ['Benchmark Data', 'Cached Reads', 'MPU Data'], mainSheetName: 'Benchmark Data', headers: mainTable.headers, rows: mainTable.rows, mapping, otherSheets, color: nextColor(files.length) }
    setFiles(prev => [...prev, file])
    setFocusFileId(file.id)
    setStage('dashboard')
    setError(null)
  }

  const setMappingField = (role: string, header: string) => {
    const fileId = mappingQueue[0]
    setFiles(prev => prev.map(f => f.id === fileId ? { ...f, mapping: { ...f.mapping, [role]: header || undefined } } : f))
    setOpenDropdown(null)
  }

  const onSheetChangeValue = async (sheetName: string) => {
    const fileId = mappingQueue[0]
    const mod: any = await loadXlsxMod()
    setFiles(prev => prev.map(f => {
      if (f.id !== fileId) return f
      const table = f.sheets[sheetName]
      const otherSheets: any = {}; f.sheetNames.forEach((n: string) => { if (n !== sheetName) otherSheets[n] = f.sheets[n] })
      return { ...f, mainSheetName: sheetName, headers: table.headers, rows: table.rows, mapping: mod.autoDetectMapping(table.headers), otherSheets }
    }))
    closeDropdown()
  }

  const onConfirmMapping = () => {
    const nextQueue = mappingQueue.slice(1)
    setMappingQueue(nextQueue)
    advanceQueue(files, nextQueue)
  }

  const onSkipFile = () => {
    const fileId = mappingQueue[0]
    const nextFiles = files.filter(f => f.id !== fileId)
    const nextQueue = mappingQueue.slice(1)
    setFiles(nextFiles)
    setMappingQueue(nextQueue)
    advanceQueue(nextFiles, nextQueue)
  }

  const onPrint = () => window.print()

  // ── Derived state ──────────────────────────────────────────────────────
  const isDark = theme === 'dark'
  const isUpload = stage === 'upload'
  const isMapping = stage === 'mapping' && mappingQueue.length > 0
  const isDashboard = stage === 'dashboard'
  const focusFileObj = files.find(f => f.id === focusFileId) || files[0] || null
  const showCompareView = isDashboard && compareMode && files.length > 1
  const activeSection2 = showCompareView ? 'compare' : (activeSection === 'compare' ? 'overview' : activeSection)

  let dash: any = null, peakCards: any[] = [], scalingCharts: any[] = [], latencyChart: any = null
  let cpuChart: any = null, cachedSection: any = null, mpuSection: any = null
  let overviewChart: any = null, overviewMini: any[] = []
  let tableHeaders: any[] = [], pageRows: any[] = [], rowCountLabel = '', pageLabel = '', prevDisabled = true, nextDisabled = true, sheetTabs: any[] = []

  const formatCell = (v: any) => { if (v == null) return ''; if (typeof v === 'number') return fmtNum(v); return String(v) }

  if (!showCompareView && focusFileObj) {
    dash = buildFullDashboard(focusFileObj)
    peakCards = dash.peakCards
    scalingCharts = dash.scalingCharts.map((item: any, i: number) => ({ ...item, onZoom: () => setZoomedChartKey('scaling-' + i) }))
    latencyChart = dash.latencyChart
    cpuChart = dash.cpuChart
    cachedSection = dash.cachedSectionFull?.chart ? dash.cachedSectionFull : null
    mpuSection = dash.mpuSectionFull?.chart ? dash.mpuSectionFull : null

    const throughputCards = peakCards.filter((c: any) => c.unit === 'MiB/s')
    if (throughputCards.length) {
      const oc = buildBarChart(throughputCards.map((c: any) => ({ label: c.label.replace('Peak ', '').replace(' Throughput', ''), value: c.rawValue || 0, color: c.dotColor })))
      if (oc) overviewChart = { ...oc, items: oc.items.map((it: any, i: number) => ({ ...it, tooltip: `${throughputCards[i].label}: ${throughputCards[i].value} ${throughputCards[i].unit}` })) }
    }
    overviewMini = dash.scalingCharts.slice(0, 2).map((sc: any) => ({ title: sc.title, chart: sc.chart, onClick: () => setActiveSection('scaling') }))

    const currentSheetName = activeSheetTab || focusFileObj.mainSheetName
    sheetTabs = focusFileObj.sheetNames.map((name: string) => {
      const active = name === currentSheetName
      return { name, label: name, active, onClick: () => { setActiveSheetTab(name); setPage(0); setSortCol(null); setFilterText('') }, bg: active ? 'var(--primary-soft)' : 'var(--surface)', borderColor: active ? 'var(--primary)' : 'var(--border)', color: active ? 'var(--primary)' : 'var(--muted)' }
    })
    const sheetTable = currentSheetName === focusFileObj.mainSheetName ? { headers: focusFileObj.headers, rows: focusFileObj.rows } : (focusFileObj.otherSheets[currentSheetName] || { headers: [], rows: [] })
    let rows = [...sheetTable.rows]
    if (filterText) { const ft = filterText.toLowerCase(); rows = rows.filter((r: any) => sheetTable.headers.some((h: string) => String(r[h] ?? '').toLowerCase().includes(ft))) }
    if (sortCol) { rows.sort((a: any, b: any) => { const av = a[sortCol], bv = b[sortCol]; const an = toNum(av), bn = toNum(bv); const cmp = (an != null && bn != null) ? an - bn : String(av ?? '').localeCompare(String(bv ?? '')); return cmp * sortDir }) }
    const pageSize = 15, totalPages = Math.max(1, Math.ceil(rows.length / pageSize))
    const pg = Math.min(page, totalPages - 1)
    tableHeaders = sheetTable.headers.map((h: string) => ({ label: h, onSort: () => { setSortCol(h); setSortDir(s => sortCol === h ? -s : 1); setPage(0) }, sortIndicator: sortCol === h ? (sortDir === 1 ? ' ▲' : ' ▼') : '' }))
    pageRows = rows.slice(pg * pageSize, (pg + 1) * pageSize).map((r: any) => ({ cells: sheetTable.headers.map((h: string) => ({ value: formatCell(r[h]) })) }))
    rowCountLabel = `${rows.length} rows in "${currentSheetName}"`
    pageLabel = `Page ${pg + 1} of ${totalPages}`
    prevDisabled = pg <= 0; nextDisabled = pg >= totalPages - 1
  }

  let zoomedChart: any = null
  if (zoomedChartKey && !showCompareView) {
    if (zoomedChartKey === 'overview' && overviewChart) zoomedChart = { type: 'bar', title: 'Throughput Summary', chart: overviewChart }
    else if (zoomedChartKey.startsWith('scaling-')) { const idx = parseInt(zoomedChartKey.split('-')[1]); const sc = scalingCharts[idx]; if (sc) zoomedChart = { type: 'line', title: sc.title, chart: sc.chart } }
    else if (zoomedChartKey === 'latency' && latencyChart) zoomedChart = { type: 'hbar', title: latencyChart.title, chart: latencyChart.chart }
    else if (zoomedChartKey === 'cpu' && cpuChart) zoomedChart = { type: 'bar', title: cpuChart.title, chart: cpuChart.chart }
    else if (zoomedChartKey === 'cached' && cachedSection) zoomedChart = { type: 'bar', title: cachedSection.title, chart: cachedSection.chart }
    else if (zoomedChartKey === 'mpu' && mpuSection) zoomedChart = { type: 'bar', title: mpuSection.title, chart: mpuSection.chart }
  }

  const compareDashboards = showCompareView ? files.map(f => { const d = buildFullDashboard(f); return { id: f.id, name: f.name, color: f.color, peakCards: d.peakCards.slice(0, 3), scalingCharts: d.scalingCharts.slice(0, 1), latencyChart: d.latencyChart } }) : []

  const reportFileObjs = compareMode ? files : (focusFileObj ? [focusFileObj] : [])
  const reportTargets = reportOpen ? reportFileObjs.map(f => {
    const d = buildFullDashboard(f)
    return { name: d.name, mainSheetName: d.mainSheetName, rowCount: d.rowCount, peakCards: d.peakCards, scalingCharts: d.scalingCharts, latencyChart: d.latencyChart, cpuChart: d.cpuChart, hasSecondPage: !!(d.latencyChart || d.cpuChart), cachedTable: d.cachedSectionFull ? d.cachedSectionFull.table : null, mpuTable: d.mpuSectionFull ? d.mpuSectionFull.table : null, allHeaders: d.allHeaders, allRows: d.allRows }
  }) : []

  const generatedDate = new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })

  const navDefs = [
    { key: 'overview', label: 'Overview', icon: 'overview' }, { key: 'scaling', label: 'Throughput Scaling', icon: 'scaling' },
    { key: 'latency', label: 'Latency', icon: 'latency' }, { key: 'cpu', label: 'CPU Efficiency', icon: 'cpu' },
    { key: 'cached', label: 'Cached Reads', icon: 'cached' }, { key: 'mpu', label: 'Multipart Upload', icon: 'mpu' },
    { key: 'raw', label: 'Raw Data', icon: 'raw' },
  ]

  const mappingFileObj = isMapping ? files.find(f => f.id === mappingQueue[0]) : null

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <div data-theme={theme} className="stage-in" style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)' }}>

      {/* ── Upload ── */}
      {isUpload && (
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
          <button onClick={toggleTheme} className="btn-ghost" style={{ position: 'absolute', top: '24px', right: '28px', padding: '8px', borderRadius: '999px', display: 'flex' }}>
            {isDark ? <SunIcon /> : <MoonIcon />}
          </button>
          <div style={{ maxWidth: '520px', width: '100%', padding: '0 24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '18px' }}>
              <div style={{ width: '28px', height: '28px', borderRadius: '9px', background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--primary-fg)" strokeWidth="2.2"><path d="M4 18V6M12 18V9M20 18v-4" strokeLinecap="round" /></svg>
              </div>
              <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--muted)' }}>Cloudian Performance</span>
            </div>
            <h1 style={{ fontSize: '30px', fontWeight: 800, textAlign: 'center', margin: '0 0 10px', letterSpacing: '-.02em' }}>Storage Performance Dashboard</h1>
            <p style={{ margin: '0 0 32px', color: 'var(--muted)', fontSize: '15px', lineHeight: 1.6, textAlign: 'center' }}>Upload a benchmark export to explore throughput, latency, and CPU efficiency, then export a polished PDF report.</p>
            <div className="dropzone card" onClick={() => fileInputRef.current?.click()} onDrop={onDrop} onDragOver={onDragOver} onDragLeave={onDragLeave}
              style={{ borderColor: dragOver ? 'var(--primary)' : 'var(--border)', padding: '44px 24px', textAlign: 'center', cursor: 'pointer', background: dragOver ? 'var(--primary-soft)' : 'var(--surface)' }}>
              <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: 'var(--primary-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2"><path d="M12 16V4M12 4L7 9M12 4l5 5" strokeLinecap="round" strokeLinejoin="round" /><path d="M4 16v3a2 2 0 002 2h12a2 2 0 002-2v-3" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </div>
              <div style={{ fontWeight: 600, marginBottom: '5px', fontSize: '15px' }}>Drop your file here, or click to browse</div>
              <div style={{ fontSize: '13px', color: 'var(--muted)' }}>.xlsx or .csv — upload several to compare</div>
              <input ref={fileInputRef} type="file" accept=".xlsx,.csv" multiple onChange={onFileInputChange} style={{ display: 'none' }} />
            </div>
            {error && <div style={{ marginTop: '14px', padding: '12px 16px', background: 'var(--danger-soft)', color: 'var(--danger)', borderRadius: '10px', fontSize: '13px' }}>{error}</div>}
            {loading && <div style={{ marginTop: '14px', textAlign: 'center', color: 'var(--muted)', fontSize: '13px' }}>Reading file…</div>}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: '24px 0' }}>
              <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} /><span style={{ fontSize: '12px', color: 'var(--muted)' }}>or</span><div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
            </div>
            <button onClick={onDemoClick} className="btn-outline" style={{ width: '100%', padding: '12px', borderRadius: '10px', fontWeight: 500 }}>Load a demo dataset</button>
            {files.length > 0 && <button onClick={() => setStage('dashboard')} className="btn-ghost" style={{ width: '100%', marginTop: '8px', padding: '11px', borderRadius: '10px', fontWeight: 500 }}>← Back to dashboard</button>}
          </div>
        </div>
      )}

      {/* ── Mapping ── */}
      {isMapping && mappingFileObj && (
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '60px 24px' }}>
          <div className="card" style={{ maxWidth: '620px', width: '100%', padding: '32px' }}>
            <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: '8px' }}>Map columns — 1 of {mappingQueue.length}</div>
            <h2 style={{ fontSize: '21px', fontWeight: 700, margin: '0 0 6px' }}>{mappingFileObj.name}</h2>
            <p style={{ margin: '0 0 22px', color: 'var(--muted)', fontSize: '13.5px' }}>Matched automatically where possible — check and adjust below.</p>
            {mappingFileObj.sheetNames.length > 1 && (
              <div style={{ marginBottom: '18px', position: 'relative' }}>
                <label style={{ display: 'block', fontSize: '12.5px', color: 'var(--muted)', marginBottom: '6px', fontWeight: 500 }}>Sheet</label>
                <Dropdown label={mappingFileObj.mainSheetName} open={openDropdown === 'sheet'} onToggle={toggleDropdown('sheet')} onClose={closeDropdown}
                  options={mappingFileObj.sheetNames.map((n: string) => ({ label: n, activeBg: n === mappingFileObj.mainSheetName ? 'var(--primary-soft)' : 'transparent', activeColor: n === mappingFileObj.mainSheetName ? 'var(--primary)' : 'var(--text)', activeWeight: n === mappingFileObj.mainSheetName ? '600' : '400', onClick: () => onSheetChangeValue(n) }))} />
              </div>
            )}
            <div>
              {ROLES.map(role => {
                const value = mappingFileObj.mapping[role] || ''
                const opts = [{ value: '', label: '— none —' }, ...mappingFileObj.headers.map((h: string) => ({ value: h, label: h }))]
                const selected = opts.find((o: any) => o.value === value)
                const ddId = 'role:' + role
                return (
                  <div key={role} style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: '14px', alignItems: 'center', padding: '9px 0', borderBottom: '1px solid var(--border)' }}>
                    <label style={{ fontSize: '13.5px' }}>{ROLE_LABELS[role]}</label>
                    <Dropdown label={selected ? selected.label : '— none —'} open={openDropdown === ddId} onToggle={toggleDropdown(ddId)} onClose={closeDropdown}
                      options={opts.map((o: any) => ({ label: o.label, activeBg: o.value === value ? 'var(--primary-soft)' : 'transparent', activeColor: o.value === value ? 'var(--primary)' : 'var(--text)', activeWeight: o.value === value ? '600' : '400', onClick: () => setMappingField(role, o.value) }))} />
                  </div>
                )
              })}
            </div>
            <div style={{ display: 'flex', gap: '10px', marginTop: '24px' }}>
              <button onClick={onConfirmMapping} className="btn-primary" style={{ flex: 1, padding: '12px', borderRadius: '10px', fontWeight: 600 }}>Confirm &amp; Continue</button>
              <button onClick={onSkipFile} className="btn-outline" style={{ padding: '12px 18px', borderRadius: '10px' }}>Remove file</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Dashboard ── */}
      {isDashboard && (
        <div style={{ display: 'grid', gridTemplateColumns: '230px 1fr', minHeight: '100vh' }}>

          {/* Sidebar */}
          <div style={{ borderRight: '1px solid var(--border)', background: 'var(--surface)', padding: '20px 14px', display: 'flex', flexDirection: 'column', gap: '18px', position: 'sticky', top: 0, height: '100vh', overflow: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '0 8px' }}>
              <div style={{ width: '24px', height: '24px', borderRadius: '7px', background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--primary-fg)" strokeWidth="2.4"><path d="M4 18V6M12 18V9M20 18v-4" strokeLinecap="round" /></svg>
              </div>
              <span style={{ fontWeight: 700, fontSize: '14px' }}>Performance</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <div style={{ fontSize: '10.5px', fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.05em', padding: '0 10px', marginBottom: '2px' }}>Dataset</div>
              <Dropdown label={focusFileObj ? focusFileObj.name : 'Select file'} open={openDropdown === 'file'} onToggle={toggleDropdown('file')} onClose={closeDropdown}
                options={(files).map((f: any) => ({ label: f.name, activeBg: focusFileObj?.id === f.id ? 'var(--primary-soft)' : 'transparent', activeColor: focusFileObj?.id === f.id ? 'var(--primary)' : 'var(--text)', activeWeight: focusFileObj?.id === f.id ? '600' : '400', onClick: () => { setFocusFileId(f.id); setActiveSheetTab(null); setPage(0); closeDropdown() } }))} />
              <button onClick={() => { setStage('upload'); setError(null) }} className="btn-ghost" style={{ textAlign: 'left', padding: '7px 10px', borderRadius: '8px', fontSize: '12.5px' }}>+ Add file</button>
              {files.length > 1 && (
                <label style={{ display: 'flex', alignItems: 'center', gap: '7px', fontSize: '12.5px', color: 'var(--muted)', cursor: 'pointer', padding: '7px 10px' }}>
                  <input type="checkbox" checked={compareMode} onChange={e => { setCompareMode(e.target.checked); setActiveSection(e.target.checked ? 'compare' : 'overview') }} /> Compare all files
                </label>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <div style={{ fontSize: '10.5px', fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.05em', padding: '0 10px', marginBottom: '4px' }}>Sections</div>
              {navDefs.map(n => {
                const active = activeSection2 === n.key
                return (
                  <button key={n.key} className="nav-item" onClick={() => setActiveSection(n.key)}
                    style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 10px', borderRadius: '9px', border: 'none', background: active ? 'var(--primary-soft)' : 'transparent', color: active ? 'var(--primary)' : 'var(--text)', fontSize: '13.5px', fontWeight: active ? 600 : 500, textAlign: 'left' }}>
                    <span style={{ width: '16px', height: '16px', flexShrink: 0 }} dangerouslySetInnerHTML={{ __html: ICONS[n.icon] }} />{n.label}
                  </button>
                )
              })}
            </div>

            <div style={{ flex: 1 }} />
            <button onClick={() => setReportOpen(true)} className="btn-primary" style={{ padding: '10px', borderRadius: '10px', fontWeight: 600, fontSize: '13px' }}>Export PDF Report</button>
            <button onClick={toggleTheme} className="btn-outline" style={{ padding: '8px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontSize: '12.5px' }}>
              {isDark ? <><SunIcon /> Light mode</> : <><MoonIcon /> Dark mode</>}
            </button>
          </div>

          {/* Main content */}
          <div style={{ padding: '28px 32px', maxWidth: '1180px' }} key={activeSection2}>

            {/* Overview */}
            {activeSection2 === 'overview' && dash && (
              <div className="stage-in">
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px', marginBottom: '20px' }}>
                  <div>
                    <div style={{ fontSize: '21px', fontWeight: 800 }}>Overview</div>
                    <div className="num" style={{ fontSize: '13px', color: 'var(--muted)', marginTop: '3px' }}>{dash.name} · {dash.mainSheetName} · {dash.rowCount} rows</div>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))', gap: '14px', marginBottom: '20px' }}>
                  {peakCards.map((card: any, i: number) => (
                    <div key={i} className="card" style={{ padding: '18px 20px', animation: 'fadeInUp .4s ease both', animationDelay: `calc(${i} * 55ms)` }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                        <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: card.dotColor, display: 'inline-block' }} />
                        <div style={{ fontSize: '12px', color: 'var(--muted)' }}>{card.label}</div>
                      </div>
                      <div className="num" style={{ fontSize: '26px', fontWeight: 700 }}>{card.value} <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--muted)' }}>{card.unit}</span></div>
                    </div>
                  ))}
                </div>
                {overviewChart && (
                  <div className="card card-in" style={{ padding: '24px', marginBottom: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px' }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '15px', marginBottom: '4px' }}>Throughput Summary</div>
                        <div style={{ fontSize: '12.5px', color: 'var(--muted)', marginBottom: '18px' }}>Peak throughput per configuration, at maximum concurrency tested</div>
                      </div>
                      <button className="zoom-btn" onClick={() => setZoomedChartKey('overview')}><ZoomIcon /></button>
                    </div>
                    <BarChart chart={overviewChart} />
                  </div>
                )}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: '16px' }}>
                  {overviewMini.map((mini: any, i: number) => (
                    <div key={i} className="card card-in" style={{ padding: '20px', cursor: 'pointer' }} onClick={mini.onClick}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                        <div style={{ fontWeight: 600, fontSize: '13px' }}>{mini.title}</div>
                        <span style={{ fontSize: '11px', color: 'var(--primary)', fontWeight: 600 }}>View →</span>
                      </div>
                      <svg viewBox={`0 0 ${mini.chart.width} ${mini.chart.height}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
                        {mini.chart.series.map((s: any, si: number) => <path key={si} d={s.path} fill="none" stroke={s.color} strokeWidth="2" />)}
                      </svg>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Throughput Scaling */}
            {activeSection2 === 'scaling' && (
              <div className="stage-in">
                <div style={{ fontSize: '21px', fontWeight: 800, marginBottom: '4px' }}>Throughput Scaling</div>
                <div style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '20px' }}>Throughput vs. concurrency, per configuration</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(430px,1fr))', gap: '16px' }}>
                  {scalingCharts.map((item: any, i: number) => (
                    <div key={i} className="card card-in" style={{ padding: '22px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                        <div style={{ fontWeight: 600, fontSize: '14px' }}>{item.title}</div>
                        <button className="zoom-btn" onClick={item.onZoom}><ZoomIcon /></button>
                      </div>
                      <LineChart chart={item.chart} />
                      <Legend series={item.chart.series} />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Latency */}
            {activeSection2 === 'latency' && (
              <div className="stage-in">
                <div style={{ fontSize: '21px', fontWeight: 800, marginBottom: '4px' }}>Latency</div>
                <div style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '20px' }}>Response time at maximum tested concurrency, lower is better</div>
                {latencyChart && (
                  <div className="card card-in" style={{ padding: '22px' }}>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '8px' }}>
                      <button className="zoom-btn" onClick={() => setZoomedChartKey('latency')}><ZoomIcon /></button>
                    </div>
                    <HBarChart chart={latencyChart.chart} />
                  </div>
                )}
              </div>
            )}

            {/* CPU Efficiency */}
            {activeSection2 === 'cpu' && (
              <div className="stage-in">
                <div style={{ fontSize: '21px', fontWeight: 800, marginBottom: '4px' }}>CPU Efficiency</div>
                <div style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '20px' }}>Throughput delivered per CPU percentage point, higher is better</div>
                {cpuChart && (
                  <div className="card card-in" style={{ padding: '22px' }}>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '8px' }}>
                      <button className="zoom-btn" onClick={() => setZoomedChartKey('cpu')}><ZoomIcon /></button>
                    </div>
                    <BarChart chart={cpuChart.chart} />
                  </div>
                )}
              </div>
            )}

            {/* Cached Reads */}
            {activeSection2 === 'cached' && (
              <div className="stage-in">
                <div style={{ fontSize: '21px', fontWeight: 800, marginBottom: '4px' }}>Cached vs Initial Reads</div>
                <div style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '20px' }}>Read throughput before and after cache warm-up</div>
                {cachedSection && (
                  <div className="card card-in" style={{ padding: '22px' }}>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '8px' }}>
                      <button className="zoom-btn" onClick={() => setZoomedChartKey('cached')}><ZoomIcon /></button>
                    </div>
                    <BarChart chart={cachedSection.chart} />
                  </div>
                )}
              </div>
            )}

            {/* Multipart Upload */}
            {activeSection2 === 'mpu' && (
              <div className="stage-in">
                <div style={{ fontSize: '21px', fontWeight: 800, marginBottom: '4px' }}>Multipart Upload</div>
                <div style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '20px' }}>MPU throughput by part size</div>
                {mpuSection && (
                  <div className="card card-in" style={{ padding: '22px' }}>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '8px' }}>
                      <button className="zoom-btn" onClick={() => setZoomedChartKey('mpu')}><ZoomIcon /></button>
                    </div>
                    <BarChart chart={mpuSection.chart} />
                  </div>
                )}
              </div>
            )}

            {/* Raw Data */}
            {activeSection2 === 'raw' && (
              <div className="stage-in">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
                  <div>
                    <div style={{ fontSize: '21px', fontWeight: 800 }}>Raw Data</div>
                    <div style={{ fontSize: '13px', color: 'var(--muted)', marginTop: '3px' }}>Every sheet in the workbook, sortable and filterable</div>
                  </div>
                  <input type="text" placeholder="Filter rows…" value={filterText} onChange={e => { setFilterText(e.target.value); setPage(0) }} style={{ minWidth: '220px' }} />
                </div>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '16px' }}>
                  {sheetTabs.map((tab: any) => (
                    <button key={tab.name} onClick={tab.onClick} style={{ padding: '7px 13px', borderRadius: '8px', border: `1px solid ${tab.borderColor}`, background: tab.bg, color: tab.color, fontSize: '12.5px', fontWeight: 500 }}>{tab.label}</button>
                  ))}
                </div>
                <div className="card card-in" style={{ padding: 0, overflow: 'hidden' }}>
                  <div style={{ overflow: 'auto', maxHeight: '560px' }}>
                    <table style={{ width: '100%', fontSize: '13px' }}>
                      <thead style={{ position: 'sticky', top: 0, background: 'var(--surface-2)' }}>
                        <tr>{tableHeaders.map((h: any, i: number) => <th key={i} onClick={h.onSort} style={{ textAlign: 'left', padding: '11px 14px', borderBottom: '1px solid var(--border)', cursor: 'pointer', whiteSpace: 'nowrap', fontSize: '10.5px', textTransform: 'uppercase', letterSpacing: '.04em', color: 'var(--muted)' }}>{h.label}{h.sortIndicator}</th>)}</tr>
                      </thead>
                      <tbody>
                        {pageRows.map((row: any, ri: number) => (
                          <tr key={ri} className="data-row" style={{ borderBottom: '1px solid var(--border)' }}>
                            {row.cells.map((cell: any, ci: number) => <td key={ci} className="num" style={{ padding: '8px 14px', whiteSpace: 'nowrap', fontSize: '12.5px' }}>{cell.value}</td>)}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', fontSize: '12px', color: 'var(--muted)', borderTop: '1px solid var(--border)' }}>
                    <span>{rowCountLabel}</span>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={prevDisabled} className="btn-outline" style={{ padding: '5px 11px', borderRadius: '7px' }}>Prev</button>
                      <span>{pageLabel}</span>
                      <button onClick={() => setPage(p => p + 1)} disabled={nextDisabled} className="btn-outline" style={{ padding: '5px 11px', borderRadius: '7px' }}>Next</button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Compare */}
            {activeSection2 === 'compare' && (
              <div className="stage-in">
                <div style={{ fontSize: '21px', fontWeight: 800, marginBottom: '4px' }}>Compare Datasets</div>
                <div style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '20px' }}>All uploaded files side by side</div>
                <div style={{ display: 'flex', gap: '16px', overflowX: 'auto', paddingBottom: '8px' }}>
                  {compareDashboards.map((cd: any) => (
                    <div key={cd.id} className="card card-in" style={{ minWidth: '390px', maxWidth: '430px', flex: 1, padding: '22px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                        <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: cd.color, display: 'inline-block' }} />
                        <div style={{ fontWeight: 700, fontSize: '14px' }}>{cd.name}</div>
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '18px' }}>
                        {cd.peakCards.map((card: any, i: number) => (
                          <div key={i} style={{ background: 'var(--surface-2)', borderRadius: '10px', padding: '10px 12px', minWidth: '112px' }}>
                            <div style={{ fontSize: '10px', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: '4px' }}>{card.label}</div>
                            <div className="num" style={{ fontSize: '17px', fontWeight: 700 }}>{card.value} <span style={{ fontSize: '10.5px', fontWeight: 500, color: 'var(--muted)' }}>{card.unit}</span></div>
                          </div>
                        ))}
                      </div>
                      {cd.scalingCharts.map((item: any, i: number) => (
                        <div key={i}>
                          <div style={{ fontSize: '12px', fontWeight: 600, marginBottom: '8px', color: 'var(--muted)' }}>{item.title}</div>
                          <svg viewBox={`0 0 ${item.chart.width} ${item.chart.height}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
                            {item.chart.gridLines.map((gl: any, gi: number) => <line key={gi} x1={item.chart.plotLeft} x2={item.chart.width} y1={gl.y} y2={gl.y} stroke="var(--border)" strokeWidth="1" />)}
                            {item.chart.series.map((s: any, si: number) => <path key={si} className="chart-line" d={s.path} fill="none" stroke={s.color} strokeWidth="2" style={{ strokeDasharray: s.length, strokeDashoffset: s.length }} />)}
                          </svg>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>
        </div>
      )}

      {/* ── Zoom Modal ── */}
      {zoomedChart && <ZoomModal zoomedChart={zoomedChart} onClose={() => setZoomedChartKey(null)} />}

      {/* ── PDF Report ── */}
      {reportOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'oklch(0.94 0.002 260)', zIndex: 50, overflow: 'auto', color: 'oklch(0.17 0.006 260)' }}>
          <div className="no-print" style={{ position: 'sticky', top: 0, background: '#fff', borderBottom: '1px solid oklch(0.9 0.004 260)', padding: '14px 28px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 2 }}>
            <div style={{ fontWeight: 700, fontSize: '14px' }}>PDF Report Preview</div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={onPrint} style={{ padding: '9px 18px', borderRadius: '9px', border: 'none', background: 'oklch(0.52 0.17 264)', color: '#fff', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>Print / Save as PDF</button>
              <button onClick={() => setReportOpen(false)} style={{ padding: '9px 18px', borderRadius: '9px', border: '1px solid oklch(0.9 0.004 260)', background: '#fff', color: 'inherit', fontSize: '13px', cursor: 'pointer' }}>Close</button>
            </div>
          </div>
          {/* @ts-ignore */}
          <doc-page margin="0in">
            {reportTargets.map((rt: any, rti: number) => (
              <div key={rti}>
                {/* Cover page */}
                <div style={{ breakAfter: 'page', minHeight: '9.5in', padding: '0.9in 0.8in', display: 'flex', flexDirection: 'column' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: 'auto' }}>
                    <div style={{ width: '26px', height: '26px', borderRadius: '8px', background: 'oklch(0.52 0.17 264)' }} />
                    <span style={{ fontSize: '13px', fontWeight: 600, letterSpacing: '.04em', textTransform: 'uppercase', color: 'oklch(0.5 0 0)' }}>Cloudian Performance Report</span>
                  </div>
                  <div>
                    <div style={{ fontSize: '12px', color: 'oklch(0.5 0 0)', marginBottom: '14px' }}>{generatedDate}</div>
                    <h1 style={{ fontSize: '38px', margin: '0 0 10px', fontWeight: 800, letterSpacing: '-.02em', lineHeight: 1.15 }}>Storage Performance Report</h1>
                    <div style={{ fontSize: '17px', color: 'oklch(0.4 0 0)', marginBottom: '36px' }}>{rt.name}</div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: '14px' }}>
                      {rt.peakCards.map((rcard: any, i: number) => (
                        <div key={i} style={{ border: '1px solid oklch(0.9 0.004 260)', borderRadius: '12px', padding: '16px 18px' }}>
                          <div style={{ fontSize: '10px', color: 'oklch(0.5 0 0)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: '6px' }}>{rcard.label}</div>
                          <div style={{ fontSize: '24px', fontWeight: 800 }}>{rcard.value} <span style={{ fontSize: '12px', fontWeight: 500, color: 'oklch(0.5 0 0)' }}>{rcard.unit}</span></div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div style={{ marginTop: 'auto', fontSize: '11px', color: 'oklch(0.55 0 0)', borderTop: '1px solid oklch(0.9 0.004 260)', paddingTop: '14px' }}>{rt.rowCount} rows analyzed · sheet: {rt.mainSheetName}</div>
                </div>
                {/* Scaling page */}
                <div style={{ breakAfter: 'page', padding: '0.7in 0.75in' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '20px', borderBottom: '2px solid oklch(0.14 0 0)', paddingBottom: '12px' }}>
                    <h2 style={{ fontSize: '19px', fontWeight: 800, margin: 0 }}>Throughput Scaling</h2>
                    <span style={{ fontSize: '11px', color: 'oklch(0.5 0 0)' }}>{rt.name}</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
                    {rt.scalingCharts.map((ritem: any, i: number) => (
                      <div key={i} style={{ breakInside: 'avoid' }}>
                        <div style={{ fontWeight: 700, fontSize: '13px', marginBottom: '10px' }}>{ritem.title}</div>
                        <svg viewBox={`0 0 ${ritem.chart.width} ${ritem.chart.height}`} style={{ width: '100%', maxWidth: '560px', height: 'auto', display: 'block' }}>
                          {ritem.chart.gridLines.map((rgl: any, gi: number) => (
                            <g key={gi}><line x1={ritem.chart.plotLeft} x2={ritem.chart.width} y1={rgl.y} y2={rgl.y} stroke="#eee" strokeWidth="1" /><foreignObject x="4" y={rgl.foY} width="40" height="14" style={{ overflow: 'visible' }}><div style={{ fontSize: '9px', color: '#888' }}>{rgl.label}</div></foreignObject></g>
                          ))}
                          {ritem.chart.series.map((rs: any, si: number) => <path key={si} d={rs.path} fill="none" stroke={rs.color} strokeWidth="2" />)}
                          {ritem.chart.xLabels.map((rxl: any, xi: number) => <foreignObject key={xi} x={rxl.foX} y={ritem.chart.xLabelTop} width="50" height="14" style={{ overflow: 'visible' }}><div style={{ fontSize: '9px', textAlign: 'center', color: '#888' }}>{rxl.label}</div></foreignObject>)}
                        </svg>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginTop: '8px' }}>
                          {ritem.chart.series.map((rs2: any, si: number) => <div key={si} style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '10.5px', color: '#666' }}><span style={{ width: '8px', height: '8px', borderRadius: '2px', background: rs2.color, display: 'inline-block' }} />{rs2.label}</div>)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                {/* Latency & CPU page */}
                {rt.hasSecondPage && (
                  <div style={{ breakAfter: 'page', padding: '0.7in 0.75in' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '20px', borderBottom: '2px solid oklch(0.14 0 0)', paddingBottom: '12px' }}>
                      <h2 style={{ fontSize: '19px', fontWeight: 800, margin: 0 }}>Latency &amp; CPU Efficiency</h2>
                      <span style={{ fontSize: '11px', color: 'oklch(0.5 0 0)' }}>{rt.name}</span>
                    </div>
                    {rt.latencyChart && (
                      <div style={{ breakInside: 'avoid', marginBottom: '22px' }}>
                        <div style={{ fontWeight: 700, fontSize: '13px', marginBottom: '10px' }}>{rt.latencyChart.title}</div>
                        <svg viewBox={`0 0 ${rt.latencyChart.chart.width} ${rt.latencyChart.chart.height}`} style={{ width: '100%', maxWidth: '560px', height: 'auto', display: 'block' }}>
                          {(rt.latencyChart.chart.items || []).map((rb: any, i: number) => <rect key={i} x={rb.x} y={rb.y} width={rb.width} height={rb.height} fill={rb.color} rx="4" />)}
                        </svg>
                      </div>
                    )}
                    {rt.cpuChart && (
                      <div style={{ breakInside: 'avoid' }}>
                        <div style={{ fontWeight: 700, fontSize: '13px', marginBottom: '10px' }}>{rt.cpuChart.title}</div>
                        <svg viewBox={`0 0 ${rt.cpuChart.chart.width} ${rt.cpuChart.chart.height}`} style={{ width: '100%', maxWidth: '560px', height: 'auto', display: 'block' }}>
                          {(rt.cpuChart.chart.items || []).map((rb2: any, i: number) => <rect key={i} x={rb2.x} y={rb2.y} width={rb2.width} height={rb2.height} fill={rb2.color} rx="4" />)}
                        </svg>
                      </div>
                    )}
                  </div>
                )}
                {/* Cached & MPU page */}
                {rt.cachedTable && (
                  <div style={{ breakAfter: 'page', padding: '0.7in 0.75in' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '20px', borderBottom: '2px solid oklch(0.14 0 0)', paddingBottom: '12px' }}>
                      <h2 style={{ fontSize: '19px', fontWeight: 800, margin: 0 }}>Cached Reads &amp; MPU</h2>
                      <span style={{ fontSize: '11px', color: 'oklch(0.5 0 0)' }}>{rt.name}</span>
                    </div>
                    <div style={{ fontWeight: 700, fontSize: '13px', marginBottom: '10px' }}>Cached vs Initial Read Performance</div>
                    <table style={{ width: '100%', fontSize: '11px', marginBottom: '24px' }}>
                      <thead><tr>{rt.cachedTable.headers.map((ch: any, i: number) => <th key={i} style={{ textAlign: 'left', padding: '7px 9px', borderBottom: '1px solid #ccc', background: '#fafafa' }}>{ch.label}</th>)}</tr></thead>
                      <tbody>{rt.cachedTable.rows.map((crow: any, ri: number) => <tr key={ri}>{crow.cells.map((ccell: any, ci: number) => <td key={ci} style={{ padding: '7px 9px', borderBottom: '1px solid #eee' }}>{ccell.value}</td>)}</tr>)}</tbody>
                    </table>
                    {rt.mpuTable && <>
                      <div style={{ fontWeight: 700, fontSize: '13px', marginBottom: '10px' }}>Multipart Upload (MPU) Performance</div>
                      <table style={{ width: '100%', fontSize: '11px' }}>
                        <thead><tr>{rt.mpuTable.headers.map((mh: any, i: number) => <th key={i} style={{ textAlign: 'left', padding: '7px 9px', borderBottom: '1px solid #ccc', background: '#fafafa' }}>{mh.label}</th>)}</tr></thead>
                        <tbody>{rt.mpuTable.rows.map((mrow: any, ri: number) => <tr key={ri}>{mrow.cells.map((mcell: any, ci: number) => <td key={ci} style={{ padding: '7px 9px', borderBottom: '1px solid #eee' }}>{mcell.value}</td>)}</tr>)}</tbody>
                      </table>
                    </>}
                  </div>
                )}
                {/* Raw data page */}
                <div style={{ padding: '0.7in 0.75in' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '16px', borderBottom: '2px solid oklch(0.14 0 0)', paddingBottom: '12px' }}>
                    <h2 style={{ fontSize: '19px', fontWeight: 800, margin: 0 }}>Raw Data</h2>
                    <span style={{ fontSize: '11px', color: 'oklch(0.5 0 0)' }}>{rt.mainSheetName} · {rt.rowCount} rows</span>
                  </div>
                  <table style={{ width: '100%', fontSize: '10px' }}>
                    <thead><tr>{rt.allHeaders.map((ah: any, i: number) => <th key={i} style={{ textAlign: 'left', padding: '6px 7px', borderBottom: '1px solid #ccc', background: '#fafafa' }}>{ah.label}</th>)}</tr></thead>
                    <tbody>{rt.allRows.map((arow: any, ri: number) => <tr key={ri}>{arow.cells.map((acell: any, ci: number) => <td key={ci} style={{ padding: '6px 7px', borderBottom: '1px solid #eee' }}>{acell.value}</td>)}</tr>)}</tbody>
                  </table>
                </div>
              </div>
            ))}
          {/* @ts-ignore */}
          </doc-page>
        </div>
      )}

    </div>
  )
}
