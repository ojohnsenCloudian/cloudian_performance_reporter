'use client'

import { useRef, useState, useCallback, useEffect } from 'react'
import Link from 'next/link'
import { fmtNum, toNum } from '@/lib/chartUtils'
import { useSettings } from '@/context/SettingsContext'
import { buildFullDashboard, nextColor, generateDemoData, parseGosbenchJSON, buildKpiSparkline, buildBaselineDiff, evaluateCriteria, generateRecommendation, type ReportDetails } from '@/lib/dataUtils'
import { LineChart, SlaLineChart, Legend, KpiCard, SmallMultiples, Heatmap, RankedBars, StackedBars, PairedBars, DiffTable, DataTable, ZoomIcon, FlowChart, DotPlot, RangePlot, SlopeChart, SweepPlot } from '@/components/charts'
import { ThroughputScalingChart } from '@/components/charts/ThroughputScalingChart'
import { LatencyRankChart } from '@/components/charts/LatencyRankChart'
import { MpuSweepChart } from '@/components/charts/MpuSweepChart'
import PdfReport from '@/components/PdfReport'

const ROLES = ['category', 'protocol', 'operation', 'objectSize', 'threads', 'throughput', 'latency', 'objectsPerSec', 'cpuMin', 'cpuMax', 'cpuAvg', 'state']
const ROLE_LABELS: Record<string, string> = {
  category: 'Category / Configuration', protocol: 'Protocol', operation: 'Operation (Read/Write)',
  objectSize: 'Object / Part Size', threads: 'Threads / Concurrency', throughput: 'Throughput',
  latency: 'Latency', objectsPerSec: 'Objects per Second', cpuMin: 'CPU Min', cpuMax: 'CPU Max',
  cpuAvg: 'CPU Avg', state: 'State / Scenario',
}

const CHAPTERS = [
  { key: 'overview', label: 'Overview' }, { key: 'scaling', label: 'Throughput Scaling' },
  { key: 'latency', label: 'Latency' }, { key: 'cpu', label: 'CPU Efficiency' },
  { key: 'cached', label: 'Cached Reads' }, { key: 'mpu', label: 'Multipart Upload' },
  { key: 'raw', label: 'Raw Data' },
]

function applyFilters(rows: any[], mapping: any, filters: { protocol: string; operation: string; objectSize: string }) {
  return rows.filter((r) => {
    if (filters.protocol !== 'all' && mapping.protocol && String(r[mapping.protocol] || '').toLowerCase() !== filters.protocol) return false
    if (filters.operation !== 'all' && mapping.operation && !String(r[mapping.operation] || '').toLowerCase().includes(filters.operation)) return false
    if (filters.objectSize !== 'all' && mapping.objectSize && String(r[mapping.objectSize] || '') !== filters.objectSize) return false
    return true
  })
}

// ── small reusable SVG icons ───────────────────────────────────────────────
const ChevronDown = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" /></svg>

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

// ── ZoomModal ──────────────────────────────────────────────────────────────
function ZoomModal({ zoomedChart, onClose }: any) {
  if (!zoomedChart) return null
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'oklch(0.2 0.02 40 / .5)', zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '32px' }} onClick={onClose}>
      <div className="glass" style={{ maxWidth: '1040px', width: '100%', padding: '28px', maxHeight: '88vh', overflow: 'auto', borderRadius: 'var(--radius-lg)' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div className="d" style={{ fontWeight: 600, fontSize: '18px' }}>{zoomedChart.title}</div>
          <button className="btn-outline" onClick={onClose} style={{ padding: '7px 14px', borderRadius: '8px' }}>Close</button>
        </div>
        {zoomedChart.type === 'sla-line' && <SlaLineChart chart={zoomedChart.chart} zoom />}
        {zoomedChart.type === 'stacked' && <StackedBars chart={zoomedChart.chart} />}
      </div>
    </div>
  )
}

// ── Report Details modal ────────────────────────────────────────────────
function ReportDetailsModal({ details, onChange, onGenerate, onClose }: any) {
  const field = (key: keyof ReportDetails, label: string, placeholder: string, numeric = false) => (
    <div style={{ marginBottom: '14px' }}>
      <label style={{ display: 'block', fontSize: '12.5px', color: 'var(--muted)', marginBottom: '6px', fontWeight: 500 }}>{label}</label>
      <input
        type={numeric ? 'number' : 'text'}
        value={(details[key] as any) ?? ''}
        placeholder={placeholder}
        onChange={(e) => onChange({ ...details, [key]: numeric ? (e.target.value === '' ? undefined : Number(e.target.value)) : e.target.value })}
        style={{ width: '100%' }}
      />
    </div>
  )
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'oklch(0.2 0.02 40 / .5)', zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }} onClick={onClose}>
      <div className="glass" style={{ maxWidth: '520px', width: '100%', padding: '32px', maxHeight: '88vh', overflow: 'auto', borderRadius: 'var(--radius-lg)' }} onClick={(e) => e.stopPropagation()}>
        <div className="m" style={{ fontSize: '11px', letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--primary)', marginBottom: '8px' }}>Report details</div>
        <h2 className="d" style={{ fontSize: '20px', fontWeight: 600, margin: '0 0 6px' }}>Fill in what you have — everything is optional</h2>
        <p style={{ margin: '0 0 20px', color: 'var(--muted)', fontSize: '13px' }}>Powers the Executive Summary, Test Environment, and pass/fail criteria pages. Leave blank to skip a section.</p>
        {field('clusterName', 'Cluster name', 'e.g. Acme Financial POC')}
        {field('nodeCount', 'Node count', 'e.g. 6')}
        {field('network', 'Network', 'e.g. 100GbE RDMA')}
        {field('softwareVersion', 'Software version', 'e.g. HyperStore 8.2')}
        {field('workload', 'Workload description', 'e.g. S3 object PUT/GET, mixed sizes')}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          {field('slaThroughput', 'SLA: min throughput (MiB/s)', '2000', true)}
          {field('slaLatency', 'SLA: max latency (ms)', '300', true)}
        </div>
        <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
          <button onClick={onGenerate} className="btn-primary" style={{ flex: 1, padding: '12px', borderRadius: '10px', fontWeight: 600 }}>Generate Report</button>
          <button onClick={onClose} className="btn-outline" style={{ padding: '12px 18px', borderRadius: '10px' }}>Cancel</button>
        </div>
      </div>
    </div>
  )
}

function scaleRows(rows: any[], factor: number) {
  if (factor === 1) return rows
  return rows.map(row => {
    const out: Record<string, any> = {}
    for (const [k, v] of Object.entries(row)) out[k] = k === 'label' ? v : typeof v === 'number' ? v * factor : v
    return out
  })
}

function scaledCard(card: any, factor: number, targetUnit: string) {
  if (card.role !== 'throughput' || factor === 1) return card
  const raw = card.rawValue * factor
  return { ...card, rawValue: raw, value: raw < 10 ? raw.toFixed(2) : raw.toFixed(1), unit: targetUnit }
}

// ── Main component ─────────────────────────────────────────────────────────
export default function StorageDashboard() {
  const { settings } = useSettings()
  const tpFactor = settings.throughputUnit === 'GB/s' ? 0.001 : 1
  const tpUnit = settings.throughputUnit

  const [stage, setStage] = useState<'upload' | 'mapping' | 'dashboard'>('upload')
  const [files, setFiles] = useState<any[]>([])
  const [mappingQueue, setMappingQueue] = useState<string[]>([])
  const [focusFileId, setFocusFileId] = useState<string | null>(null)
  const [compareMode, setCompareMode] = useState(false)
  const [baselineFileId, setBaselineFileId] = useState<string | null>(null)
  const [activeSection, setActiveSection] = useState('overview')
  const [reportOpen, setReportOpen] = useState(false)
  const [reportDetailsOpen, setReportDetailsOpen] = useState(false)
  const [reportDetails, setReportDetails] = useState<ReportDetails>({})
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
  const [filters, setFilters] = useState({ protocol: 'all', operation: 'all', objectSize: 'all' })
  const [slaOn, setSlaOn] = useState(true)

  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!document.querySelector('script[src="/doc-page.js"]')) {
      const s = document.createElement('script')
      s.src = '/doc-page.js'
      document.head.appendChild(s)
    }
  }, [])

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
    const newQueueIds: string[] = []
    try {
      const mod: any = await loadXlsxMod()
      for (const f of arr) {
        const ext = f.name.split('.').pop()?.toLowerCase()
        const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
        const color = nextColor(files.length + newFiles.length)

        if (ext === 'json') {
          const text = await f.text()
          let jsonData: any
          try { jsonData = JSON.parse(text) } catch { throw new Error(`"${f.name}" is not valid JSON.`) }
          if (!Array.isArray(jsonData.PerformanceData)) throw new Error(`"${f.name}" doesn't look like a Gosbench JSON export (missing PerformanceData array).`)
          const { table, name, mapping } = parseGosbenchJSON(jsonData)
          if (!table.rows.length) throw new Error(`No performance data found in "${f.name}".`)
          newFiles.push({ id, name, sheets: { 'Performance Data': table }, sheetNames: ['Performance Data'], mainSheetName: 'Performance Data', headers: table.headers, rows: table.rows, mapping, otherSheets: {}, color })
        } else {
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
          newFiles.push({ id, name: f.name, sheets, sheetNames, mainSheetName, headers: table.headers, rows: table.rows, mapping, otherSheets, color })
          newQueueIds.push(id)
        }
      }
    } catch (e: any) {
      setLoading(false); setError(e.message || 'Could not read that file.'); return
    }
    const nextAllFiles = [...files, ...newFiles]
    const nextQueue = [...mappingQueue, ...newQueueIds]
    setFiles(() => nextAllFiles)
    setMappingQueue(() => nextQueue)
    setLoading(false)
    advanceQueue(nextAllFiles, nextQueue)
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
  const isUpload = stage === 'upload'
  const isMapping = stage === 'mapping' && mappingQueue.length > 0
  const isDashboard = stage === 'dashboard'
  const focusFileObj = files.find(f => f.id === focusFileId) || files[0] || null
  const showCompareView = isDashboard && compareMode && files.length > 1
  const activeSection2 = showCompareView ? 'compare' : (activeSection === 'compare' ? 'overview' : activeSection)

  // Row-level filters applied before any chart/section is built.
  const filteredFocusFile = focusFileObj ? { ...focusFileObj, rows: applyFilters(focusFileObj.rows, focusFileObj.mapping, filters) } : null
  const slaThroughput = slaOn ? reportDetails.slaThroughput : undefined
  const slaLatency = slaOn ? reportDetails.slaLatency : undefined

  let dash: any = null, peakCards: any[] = []
  let tableHeaders: any[] = [], pageRows: any[] = [], rowCountLabel = '', pageLabel = '', prevDisabled = true, nextDisabled = true, sheetTabs: any[] = []

  const formatCell = (v: any) => { if (v == null) return ''; if (typeof v === 'number') return fmtNum(v); return String(v) }

  if (!showCompareView && filteredFocusFile) {
    dash = buildFullDashboard(filteredFocusFile, { slaThroughput, slaLatency })
    peakCards = dash.peakCards.map((c: any) => ({ ...c, spark: buildKpiSparkline(filteredFocusFile, c.role, c.op) }))

    const currentSheetName = activeSheetTab || focusFileObj.mainSheetName
    sheetTabs = focusFileObj.sheetNames.map((name: string) => {
      const active = name === currentSheetName
      return { name, label: name, active, onClick: () => { setActiveSheetTab(name); setPage(0); setSortCol(null); setFilterText('') }, bg: active ? 'var(--primary-soft)' : 'rgba(255,255,255,.6)', borderColor: active ? 'var(--primary)' : 'var(--border)', color: active ? 'var(--primary)' : 'var(--muted)' }
    })
    const sheetTable = currentSheetName === focusFileObj.mainSheetName ? { headers: focusFileObj.headers, rows: filteredFocusFile.rows } : (focusFileObj.otherSheets[currentSheetName] || { headers: [], rows: [] })
    let rows = [...sheetTable.rows]
    if (filterText) { const ft = filterText.toLowerCase(); rows = rows.filter((r: any) => sheetTable.headers.some((h: string) => String(r[h] ?? '').toLowerCase().includes(ft))) }
    if (sortCol) { rows.sort((a: any, b: any) => { const av = a[sortCol], bv = b[sortCol]; const an = toNum(av), bn = toNum(bv); const cmp = (an != null && bn != null) ? an - bn : String(av ?? '').localeCompare(String(bv ?? '')); return cmp * sortDir }) }
    const pageSize = 15, totalPages = Math.max(1, Math.ceil(rows.length / pageSize))
    const pg = Math.min(page, totalPages - 1)
    tableHeaders = sheetTable.headers.map((h: string) => ({ label: h, onSort: () => { setSortCol(h); setSortDir(s => sortCol === h ? -s : 1); setPage(0) }, sortIndicator: sortCol === h ? (sortDir === 1 ? ' ▲' : ' ▼') : '' }))
    pageRows = rows.slice(pg * pageSize, (pg + 1) * pageSize).map((r: any) => ({ cells: sheetTable.headers.map((h: string) => ({ value: formatCell(r[h]) })) }))
    rowCountLabel = `${rows.length} of ${focusFileObj.rows.length} rows in "${currentSheetName}"`
    pageLabel = `Page ${pg + 1} of ${totalPages}`
    prevDisabled = pg <= 0; nextDisabled = pg >= totalPages - 1
  }

  const zoomedChart: any = null

  const compareDashboards = showCompareView ? files.map(f => { const d = buildFullDashboard({ ...f, rows: applyFilters(f.rows, f.mapping, filters) }); return { id: f.id, name: f.name, color: f.color, peakCards: d.peakCards.slice(0, 3), scalingCharts: d.scalingChartsLegacy.slice(0, 1) } }) : []

  const baselineFile = files.find(f => f.id === baselineFileId) || (files.length > 1 ? files[0] : null)
  const compareCurrentFile = focusFileObj && focusFileObj.id !== baselineFile?.id ? focusFileObj : files.find(f => f.id !== baselineFile?.id) || null
  const diffRows = (baselineFile && compareCurrentFile) ? buildBaselineDiff(baselineFile, compareCurrentFile) : []

  const reportFileObjs = compareMode ? files : (focusFileObj ? [focusFileObj] : [])
  const reportTargets = reportOpen ? reportFileObjs.map(f => {
    const filtered = { ...f, rows: applyFilters(f.rows, f.mapping, filters) }
    const d = buildFullDashboard(filtered, { slaThroughput: reportDetails.slaThroughput, slaLatency: reportDetails.slaLatency })
    const criteria = evaluateCriteria(d, reportDetails)
    return { ...d, criteria, recommendation: generateRecommendation(d, criteria) }
  }) : []

  const generatedDate = new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })
  const mappingFileObj = isMapping ? files.find(f => f.id === mappingQueue[0]) : null

  // Filter pill option lists, only for mapped roles with more than one distinct value.
  const filterOptions = focusFileObj ? {
    protocol: focusFileObj.mapping.protocol ? [...new Set(focusFileObj.rows.map((r: any) => String(r[focusFileObj.mapping.protocol] || '').toLowerCase()))].filter(Boolean) : [],
    operation: focusFileObj.mapping.operation ? ['write', 'read'] : [],
    objectSize: focusFileObj.mapping.objectSize ? [...new Set(focusFileObj.rows.map((r: any) => String(r[focusFileObj.mapping.objectSize] || '')))].filter(Boolean) : [],
  } : { protocol: [], operation: [], objectSize: [] }

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <div className="warm-canvas" style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)' }}>

      {/* ── Upload ── */}
      {isUpload && (
        <div style={{ minHeight: '100vh', display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 380px' }}>
          <div style={{ padding: '64px 56px', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '11px', marginBottom: '56px' }}>
              <div style={{ width: '32px', height: '32px', borderRadius: '9px', background: 'var(--primary)', display: 'grid', placeItems: 'center' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.4"><path d="M4 18V7M11 18v-8M18 18v-5" strokeLinecap="round" /></svg>
              </div>
              <div>
                <div className="d" style={{ fontSize: '14px', fontWeight: 600, letterSpacing: '-.01em' }}>Cloudian</div>
                <div className="m" style={{ fontSize: '9.5px', letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--muted)' }}>Performance Reporter</div>
              </div>
            </div>
            <div style={{ marginBottom: 'auto', maxWidth: '640px' }}>
              <div className="m" style={{ fontSize: '10.5px', letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--primary)', marginBottom: '18px' }}>Step 1 of 2</div>
              <h1 className="d" style={{ margin: '0 0 16px', fontSize: '42px', fontWeight: 600, letterSpacing: '-.035em', lineHeight: 1.06, maxWidth: '13em' }}>Turn a benchmark run into a report you can send.</h1>
              <p style={{ margin: 0, maxWidth: '34em', fontSize: '15.5px', lineHeight: 1.6, color: 'var(--muted)' }}>Upload a benchmark export to explore throughput, latency, and CPU efficiency, then export a polished PDF report.</p>
            </div>
            <div style={{ marginTop: '44px' }}>
              <div className="dropzone glass" onClick={() => fileInputRef.current?.click()} onDrop={onDrop} onDragOver={onDragOver} onDragLeave={onDragLeave}
                style={{ padding: '52px 40px', border: `1.5px dashed ${dragOver ? 'var(--primary)' : 'oklch(0.76 0.035 40)'}`, display: 'flex', alignItems: 'center', gap: '26px', cursor: 'pointer', borderRadius: 'var(--radius-lg)' }}>
                <div style={{ width: '54px', height: '54px', borderRadius: '16px', flexShrink: 0, display: 'grid', placeItems: 'center', background: 'var(--primary-soft)', border: '1px solid oklch(0.88 0.05 30)' }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2"><path d="M12 16V4M12 4L7 9M12 4l5 5" strokeLinecap="round" strokeLinejoin="round" /><path d="M4 16v3a2 2 0 002 2h12a2 2 0 002-2v-3" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="d" style={{ fontSize: '18px', fontWeight: 600, letterSpacing: '-.015em', marginBottom: '6px' }}>Drop a benchmark export</div>
                  <div style={{ fontSize: '13.5px', color: 'var(--muted)' }}>XLSX, CSV or Gosbench JSON · several files to compare runs</div>
                </div>
                <div style={{ display: 'flex', gap: '7px', flexShrink: 0 }}>
                  <span className="m" style={{ fontSize: '10.5px', padding: '5px 10px', borderRadius: '6px', background: 'rgba(255,255,255,.8)', border: '1px solid var(--border)', color: 'var(--muted)' }}>.XLSX</span>
                  <span className="m" style={{ fontSize: '10.5px', padding: '5px 10px', borderRadius: '6px', background: 'rgba(255,255,255,.8)', border: '1px solid var(--border)', color: 'var(--muted)' }}>.CSV</span>
                  <span className="m" style={{ fontSize: '10.5px', padding: '5px 10px', borderRadius: '6px', background: 'rgba(255,255,255,.8)', border: '1px solid var(--border)', color: 'var(--muted)' }}>.JSON</span>
                </div>
                <input ref={fileInputRef} type="file" accept=".xlsx,.csv,.json" multiple onChange={onFileInputChange} style={{ display: 'none' }} />
              </div>
              {error && <div style={{ marginTop: '14px', padding: '12px 16px', background: 'var(--danger-soft)', color: 'var(--danger)', borderRadius: '10px', fontSize: '13px' }}>{error}</div>}
              {loading && <div style={{ marginTop: '14px', color: 'var(--muted)', fontSize: '13px' }}>Reading file…</div>}
              <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
                <button onClick={onDemoClick} className="btn-primary" style={{ padding: '14px 26px', borderRadius: '12px', fontWeight: 600, fontSize: '14px' }}>Load demo dataset</button>
                {files.length > 0 && <button onClick={() => setStage('dashboard')} className="btn-outline" style={{ padding: '14px 22px', borderRadius: '12px', fontWeight: 500, fontSize: '14px' }}>← Back to dashboard</button>}
              </div>
            </div>
          </div>
          <div style={{ position: 'relative', padding: '40px 36px', background: 'var(--graphite-grad-2)', color: 'var(--graphite-text)', display: 'flex', flexDirection: 'column' }}>
            <div className="m" style={{ fontSize: '9.5px', letterSpacing: '.14em', textTransform: 'uppercase', color: 'oklch(0.7 0.05 30)', marginBottom: '20px' }}>This session</div>
            {files.length === 0 && <div style={{ fontSize: '13.5px', color: 'var(--graphite-muted)', lineHeight: 1.6 }}>No files loaded yet. Drop a benchmark export or load the demo dataset to get started.</div>}
            {files.map((f) => (
              <div key={f.id} style={{ padding: '15px 0', borderBottom: '1px solid var(--graphite-border)', display: 'grid', gridTemplateColumns: '1fr auto', gap: '4px 12px', alignItems: 'baseline' }}>
                <div className="d" style={{ fontSize: '13.5px', fontWeight: 500, letterSpacing: '-.005em' }}>{f.name}</div>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: f.color, display: 'inline-block' }} />
                <div className="m" style={{ fontSize: '10.5px', color: 'var(--graphite-muted)' }}>{f.mainSheetName}</div>
                <div className="m" style={{ fontSize: '10px', color: 'oklch(0.68 0.012 40)' }}>{f.rows.length} rows</div>
              </div>
            ))}
            <div style={{ marginTop: 'auto', paddingTop: '28px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
              <div>
                <div className="d tn" style={{ fontSize: '30px', fontWeight: 600, letterSpacing: '-.03em', lineHeight: 1 }}>{files.length}</div>
                <div className="m" style={{ fontSize: '9.5px', letterSpacing: '.09em', textTransform: 'uppercase', color: 'var(--graphite-muted)', marginTop: '5px' }}>files loaded</div>
              </div>
              <div>
                <div className="d tn" style={{ fontSize: '30px', fontWeight: 600, letterSpacing: '-.03em', lineHeight: 1 }}>{files.reduce((s, f) => s + f.rows.length, 0)}</div>
                <div className="m" style={{ fontSize: '9.5px', letterSpacing: '.09em', textTransform: 'uppercase', color: 'var(--graphite-muted)', marginTop: '5px' }}>rows analyzed</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Mapping ── */}
      {isMapping && mappingFileObj && (
        <div style={{ minHeight: '100vh', display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 340px' }}>
          <div style={{ padding: '64px 56px', display: 'flex', flexDirection: 'column' }}>
            <div className="m" style={{ fontSize: '10.5px', letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--primary)', marginBottom: '18px' }}>Step 2 of 2 · file 1 of {mappingQueue.length}</div>
            <h2 className="d" style={{ fontSize: '30px', fontWeight: 600, margin: '0 0 8px', letterSpacing: '-.028em' }}>{mappingFileObj.name}</h2>
            <p style={{ margin: '0 0 28px', color: 'var(--muted)', fontSize: '14px', maxWidth: '46em' }}>Matched automatically where possible — check and adjust below.</p>
            {mappingFileObj.sheetNames.length > 1 && (
              <div style={{ marginBottom: '20px', maxWidth: '420px' }}>
                <label style={{ display: 'block', fontSize: '12.5px', color: 'var(--muted)', marginBottom: '6px', fontWeight: 500 }}>Sheet</label>
                <Dropdown label={mappingFileObj.mainSheetName} open={openDropdown === 'sheet'} onToggle={toggleDropdown('sheet')} onClose={closeDropdown}
                  options={mappingFileObj.sheetNames.map((n: string) => ({ label: n, activeBg: n === mappingFileObj.mainSheetName ? 'var(--primary-soft)' : 'transparent', activeColor: n === mappingFileObj.mainSheetName ? 'var(--primary)' : 'var(--text)', activeWeight: n === mappingFileObj.mainSheetName ? '600' : '400', onClick: () => onSheetChangeValue(n) }))} />
              </div>
            )}
            <div style={{ display: 'grid', gap: '6px', padding: '8px', borderRadius: 'var(--radius-lg)' }} className="glass">
              {ROLES.map(role => {
                const value = mappingFileObj.mapping[role] || ''
                const opts = [{ value: '', label: '— none —' }, ...mappingFileObj.headers.map((h: string) => ({ value: h, label: h }))]
                const selected = opts.find((o: any) => o.value === value)
                const ddId = 'role:' + role
                return (
                  <div key={role} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '13px 14px', borderRadius: '14px', background: value ? 'rgba(255,255,255,.6)' : 'transparent' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text)' }}>{ROLE_LABELS[role]}</div>
                      <Dropdown label={selected ? selected.label : '— none —'} open={openDropdown === ddId} onToggle={toggleDropdown(ddId)} onClose={closeDropdown}
                        options={opts.map((o: any) => ({ label: o.label, activeBg: o.value === value ? 'var(--primary-soft)' : 'transparent', activeColor: o.value === value ? 'var(--primary)' : 'var(--text)', activeWeight: o.value === value ? '600' : '400', onClick: () => setMappingField(role, o.value) }))} />
                    </div>
                    <span className="m" style={{ flexShrink: 0, fontSize: '9.5px', letterSpacing: '.07em', padding: '3px 7px', borderRadius: '5px', background: value ? 'var(--good-soft)' : 'var(--surface-2)', color: value ? 'var(--good)' : 'var(--muted)' }}>{value ? 'AUTO' : 'UNSET'}</span>
                  </div>
                )
              })}
            </div>
            <div style={{ display: 'flex', gap: '10px', marginTop: '24px' }}>
              <button onClick={onConfirmMapping} className="btn-primary" style={{ flex: 1, padding: '13px 24px', borderRadius: '12px', fontWeight: 600 }}>Build dashboard</button>
              <button onClick={onSkipFile} className="btn-outline" style={{ padding: '13px 20px', borderRadius: '12px' }}>Remove file</button>
            </div>
          </div>
          <div style={{ position: 'relative', padding: '40px 36px', background: 'var(--graphite-grad)', color: 'var(--graphite-text)', display: 'flex', flexDirection: 'column' }}>
            <div className="m" style={{ fontSize: '9.5px', letterSpacing: '.14em', textTransform: 'uppercase', color: 'oklch(0.7 0.05 30)', marginBottom: '20px' }}>Sheets in this workbook</div>
            {mappingFileObj.sheetNames.map((n: string) => {
              const table = n === mappingFileObj.mainSheetName ? { headers: mappingFileObj.headers, rows: mappingFileObj.rows } : mappingFileObj.sheets[n]
              const selected = n === mappingFileObj.mainSheetName
              return (
                <div key={n} style={{ padding: '15px 0', borderBottom: '1px solid var(--graphite-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '12px' }}>
                  <div>
                    <div className="d" style={{ fontSize: '13.5px', fontWeight: 500 }}>{n}</div>
                    <div className="m" style={{ fontSize: '10.5px', color: 'var(--graphite-muted)', marginTop: '3px' }}>{table?.headers.length ?? 0} columns · {table?.rows.length ?? 0} rows</div>
                  </div>
                  <span className="m" style={{ fontSize: '9.5px', letterSpacing: '.07em', textTransform: 'uppercase', color: selected ? 'oklch(0.78 0.13 40)' : 'var(--graphite-muted)' }}>{selected ? 'SELECTED' : 'OTHER'}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Dashboard ── */}
      {isDashboard && (
        <div style={{ minHeight: '100vh' }}>

          {/* Masthead */}
          <div style={{ position: 'sticky', top: 0, zIndex: 10, padding: '22px 48px 0', background: 'var(--graphite-grad)', color: 'var(--graphite-text)' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '40px', paddingBottom: '22px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '13px', minWidth: 0 }}>
                <div style={{ width: '30px', height: '30px', borderRadius: '9px', background: 'var(--primary)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.4"><path d="M4 18V7M11 18v-8M18 18v-5" strokeLinecap="round" /></svg>
                </div>
                <div style={{ minWidth: 0 }}>
                  <div className="m" style={{ fontSize: '9.5px', letterSpacing: '.13em', textTransform: 'uppercase', color: 'oklch(0.68 0.05 30)', marginBottom: '4px' }}>Benchmark run</div>
                  <Dropdown label={focusFileObj ? focusFileObj.name : 'Select file'} open={openDropdown === 'file'} onToggle={toggleDropdown('file')} onClose={closeDropdown}
                    options={files.map((f: any) => ({ label: f.name, activeBg: focusFileObj?.id === f.id ? 'var(--primary-soft)' : 'transparent', activeColor: focusFileObj?.id === f.id ? 'var(--primary)' : 'var(--text)', activeWeight: focusFileObj?.id === f.id ? '600' : '400', onClick: () => { setFocusFileId(f.id); setActiveSheetTab(null); setPage(0); closeDropdown() } }))} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: '30px', flexShrink: 0, alignItems: 'flex-start' }}>
                {[{ label: 'Sheet', value: focusFileObj?.mainSheetName }, { label: 'Rows', value: dash?.rowCount }, { label: 'Files', value: files.length }].map((m, i) => (
                  <div key={i}>
                    <div className="m" style={{ fontSize: '9px', letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--graphite-muted)', marginBottom: '5px' }}>{m.label}</div>
                    <div className="m tn" style={{ fontSize: '12.5px', color: 'oklch(0.93 0.008 70)' }}>{m.value ?? '—'}</div>
                  </div>
                ))}
                <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                  <button onClick={() => setStage('upload')} className="btn-graphite m" style={{ fontSize: '11px', fontWeight: 500, letterSpacing: '.05em', padding: '8px 12px', borderRadius: '9px' }}>+ ADD FILE</button>
                  {files.length > 1 && (
                    <button onClick={() => { setCompareMode(v => !v); setActiveSection(compareMode ? 'overview' : 'compare') }} className="btn-graphite m" style={{ fontSize: '11px', fontWeight: 500, letterSpacing: '.05em', padding: '8px 12px', borderRadius: '9px', background: compareMode ? 'var(--primary)' : undefined, color: compareMode ? '#fff' : undefined }}>COMPARE</button>
                  )}
                  <button onClick={() => setReportDetailsOpen(true)} className="m" style={{ fontSize: '11px', fontWeight: 500, letterSpacing: '.05em', padding: '8px 14px', borderRadius: '9px', background: 'var(--primary)', color: '#fff', border: 'none' }}>EXPORT PDF</button>
                  <Link href="/settings" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px', borderRadius: '9px', background: 'rgba(255,255,255,.07)', border: '1px solid var(--graphite-border)', color: 'var(--graphite-muted)' }} title="Settings">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </Link>
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '2px', flexWrap: 'wrap' }}>
              {CHAPTERS.map((ch, i) => (
                <button key={ch.key} onClick={() => { setActiveSection(ch.key); setCompareMode(false) }} className={`chapter-tab ${activeSection2 === ch.key ? 'active' : ''}`}>
                  <span style={{ fontSize: '9px', opacity: .65 }}>{String(i + 1).padStart(2, '0')}</span>{ch.label}
                </button>
              ))}
              {files.length > 1 && (
                <button onClick={() => { setCompareMode(true); setActiveSection('compare') }} className={`chapter-tab ${activeSection2 === 'compare' ? 'active' : ''}`}>
                  <span style={{ fontSize: '9px', opacity: .65 }}>{String(CHAPTERS.length + 1).padStart(2, '0')}</span>Compare
                </button>
              )}
            </div>
          </div>

          {/* Filter bar */}
          {!showCompareView && focusFileObj && (
            <div style={{ padding: '16px 48px', display: 'flex', alignItems: 'center', gap: '10px', background: 'rgba(255,255,255,.62)', backdropFilter: 'blur(24px) saturate(1.4)', WebkitBackdropFilter: 'blur(24px) saturate(1.4)', borderBottom: '1px solid rgba(255,255,255,.9)', flexWrap: 'wrap', position: 'relative', zIndex: 1 }}>
              {filterOptions.protocol.length > 1 && (
                <div className="filter-group">
                  <span className="m" style={{ fontSize: '9px', letterSpacing: '.09em', textTransform: 'uppercase', color: 'var(--muted)', padding: '0 7px' }}>Protocol</span>
                  <button className={`filter-pill ${filters.protocol === 'all' ? 'active' : ''}`} onClick={() => setFilters(f => ({ ...f, protocol: 'all' }))}>All</button>
                  {filterOptions.protocol.map((p: string) => <button key={p} className={`filter-pill ${filters.protocol === p ? 'active' : ''}`} onClick={() => setFilters(f => ({ ...f, protocol: p }))}>{p.toUpperCase()}</button>)}
                </div>
              )}
              {filterOptions.operation.length > 0 && (
                <div className="filter-group">
                  <span className="m" style={{ fontSize: '9px', letterSpacing: '.09em', textTransform: 'uppercase', color: 'var(--muted)', padding: '0 7px' }}>Operation</span>
                  <button className={`filter-pill ${filters.operation === 'all' ? 'active' : ''}`} onClick={() => setFilters(f => ({ ...f, operation: 'all' }))}>All</button>
                  {filterOptions.operation.map((p: string) => <button key={p} className={`filter-pill ${filters.operation === p ? 'active' : ''}`} onClick={() => setFilters(f => ({ ...f, operation: p }))}>{p[0].toUpperCase() + p.slice(1)}</button>)}
                </div>
              )}
              {filterOptions.objectSize.length > 1 && (
                <div className="filter-group">
                  <span className="m" style={{ fontSize: '9px', letterSpacing: '.09em', textTransform: 'uppercase', color: 'var(--muted)', padding: '0 7px' }}>Object size</span>
                  <button className={`filter-pill ${filters.objectSize === 'all' ? 'active' : ''}`} onClick={() => setFilters(f => ({ ...f, objectSize: 'all' }))}>All</button>
                  {filterOptions.objectSize.map((p: string) => <button key={p} className={`filter-pill ${filters.objectSize === p ? 'active' : ''}`} onClick={() => setFilters(f => ({ ...f, objectSize: p }))}>{p}</button>)}
                </div>
              )}
              <div style={{ flex: 1 }} />
              <button onClick={() => setSlaOn(v => !v)} className="m" style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '7px 12px', borderRadius: '11px', fontSize: '11px', letterSpacing: '.05em', textTransform: 'uppercase', background: slaOn ? 'var(--primary-soft)' : 'var(--surface-2)', border: `1px solid ${slaOn ? 'oklch(0.88 0.05 28)' : 'var(--border)'}`, color: slaOn ? 'oklch(0.48 0.18 26)' : 'var(--muted)' }}>
                <span style={{ width: '15px', height: '2px', borderRadius: '2px', background: 'currentColor' }} />SLA marker {slaOn ? 'on' : 'off'}
              </button>
            </div>
          )}

          {/* Main content */}
          <div style={{ position: 'relative', zIndex: 1, padding: '34px 48px 80px', maxWidth: '1280px' }} key={activeSection2}>

            {/* Overview */}
            {activeSection2 === 'overview' && dash && (
              <div className="stage-in">
                <div className="m" style={{ fontSize: '10px', letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--primary)', marginBottom: '9px' }}>Chapter 01</div>
                <h2 className="d" style={{ margin: '0 0 8px', fontSize: '30px', fontWeight: 600, letterSpacing: '-.028em' }}>Overview</h2>
                <p style={{ margin: '0 0 24px', maxWidth: '62em', fontSize: '14px', lineHeight: 1.6, color: 'var(--muted)' }}>{dash.name} · {dash.mainSheetName} · {dash.rowCount} rows</p>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: '16px', marginBottom: '34px' }}>
                  {peakCards.map((card: any, i: number) => {
                    const c = scaledCard(card, tpFactor, tpUnit)
                    return <KpiCard key={i} label={c.label} value={c.value} unit={c.unit} color={c.dotColor} spark={c.spark} />
                  })}
                </div>

                {dash.grScalingCharts[0] && (
                  <div>
                    <div style={{ paddingBottom: '12px', borderBottom: '1px solid var(--border)', marginBottom: '20px' }}>
                      <h3 className="d" style={{ margin: '0 0 5px', fontSize: '18px', fontWeight: 600, letterSpacing: '-.018em' }}>{dash.grScalingCharts[0].title}</h3>
                      <p style={{ margin: 0, fontSize: '13px', color: 'var(--muted)' }}>Throughput vs. concurrent threads, at the current filters</p>
                    </div>
                    <ThroughputScalingChart
                      data={scaleRows(dash.grScalingCharts[0].rows, tpFactor)}
                      seriesKeys={dash.grScalingCharts[0].seriesKeys}
                      title={dash.grScalingCharts[0].title}
                      unit={tpUnit}
                    />
                  </div>
                )}
              </div>
            )}

            {/* Throughput Scaling */}
            {activeSection2 === 'scaling' && dash && (
              <div className="stage-in">
                <div className="m" style={{ fontSize: '10px', letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--primary)', marginBottom: '9px' }}>Chapter 02</div>
                <h2 className="d" style={{ margin: '0 0 8px', fontSize: '30px', fontWeight: 600, letterSpacing: '-.028em' }}>Throughput Scaling</h2>
                <p style={{ margin: '0 0 24px', fontSize: '14px', color: 'var(--muted)' }}>Per-configuration scaling curves and peak throughput by object size</p>

                {dash.grScalingCharts.map((item: any, i: number) => (
                  <div key={i} style={{ marginBottom: '24px' }}>
                    <ThroughputScalingChart
                      data={scaleRows(item.rows, tpFactor)}
                      seriesKeys={item.seriesKeys}
                      title={item.title}
                      unit={tpUnit}
                    />
                  </div>
                ))}
                {dash.smallMultiples?.length > 0 && (
                  <div className="glass" style={{ padding: '24px', borderRadius: 'var(--radius-lg)', marginBottom: '24px' }}>
                    <div style={{ marginBottom: '18px' }}>
                      <h3 className="d" style={{ margin: '0 0 4px', fontSize: '16px', fontWeight: 600 }}>Scaling by configuration</h3>
                      <p style={{ margin: 0, fontSize: '12.5px', color: 'var(--muted)' }}>Solid = read, dashed = write</p>
                    </div>
                    <SmallMultiples items={dash.smallMultiples} />
                  </div>
                )}
                {dash.heatmap && (
                  <div className="glass" style={{ padding: '24px', borderRadius: 'var(--radius-lg)' }}>
                    <h3 className="d" style={{ margin: '0 0 4px', fontSize: '16px', fontWeight: 600 }}>{dash.heatmap.title}</h3>
                    <p style={{ margin: '0 0 18px', fontSize: '12.5px', color: 'var(--muted)' }}>{dash.heatmap.note}</p>
                    <Heatmap heat={dash.heatmap} />
                  </div>
                )}
              </div>
            )}

            {/* Latency */}
            {activeSection2 === 'latency' && dash && (
              <div className="stage-in">
                <div className="m" style={{ fontSize: '10px', letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--primary)', marginBottom: '9px' }}>Chapter 03</div>
                <h2 className="d" style={{ margin: '0 0 8px', fontSize: '30px', fontWeight: 600, letterSpacing: '-.028em' }}>Latency</h2>
                <p style={{ margin: '0 0 24px', fontSize: '14px', color: 'var(--muted)' }}>Response time at maximum tested concurrency, ranked fastest first</p>
                {dash.grLatencyData && (
                  <LatencyRankChart
                    data={dash.grLatencyData}
                    title="Latency at Maximum Concurrency"
                    unit="ms"
                  />
                )}
                {!dash.grLatencyData && dash.latencyRanked && (
                  <div className="glass" style={{ padding: '24px', borderRadius: 'var(--radius-lg)' }}>
                    <RankedBars data={dash.latencyRanked.ranked} footnote={slaLatency != null ? `SLA marker at ${slaLatency} ms` : 'Sorted fastest to slowest'} />
                  </div>
                )}
              </div>
            )}

            {/* CPU Efficiency */}
            {activeSection2 === 'cpu' && dash && (
              <div className="stage-in">
                <div className="m" style={{ fontSize: '10px', letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--primary)', marginBottom: '9px' }}>Chapter 04</div>
                <h2 className="d" style={{ margin: '0 0 8px', fontSize: '30px', fontWeight: 600, letterSpacing: '-.028em' }}>CPU Efficiency</h2>
                <p style={{ margin: '0 0 24px', fontSize: '14px', color: 'var(--muted)' }}>Utilization envelope and throughput delivered per CPU percentage point</p>
                {dash.cpuRangePlot && (
                  <div className="glass" style={{ padding: '24px', borderRadius: 'var(--radius-lg)', marginBottom: '24px' }}>
                    <div style={{ marginBottom: '20px' }}>
                      <h3 className="d" style={{ margin: '0 0 4px', fontSize: '16px', fontWeight: 600 }}>CPU Utilization Range</h3>
                      <p style={{ margin: 0, fontSize: '12.5px', color: 'var(--muted)' }}>Capsule spans min→max · dot marks average across all concurrency levels</p>
                    </div>
                    <RangePlot data={dash.cpuRangePlot} />
                  </div>
                )}
                {!dash.cpuRangePlot && dash.cpuEnvelope && (
                  <div className="glass" style={{ padding: '24px', borderRadius: 'var(--radius-lg)', marginBottom: '24px' }}>
                    <div style={{ fontWeight: 600, fontSize: '14px', marginBottom: '16px' }}>{dash.cpuEnvelope.title}</div>
                    <StackedBars chart={dash.cpuEnvelope.chart} />
                  </div>
                )}
                {dash.cpuEfficiencyRanked && (
                  <div className="glass" style={{ padding: '24px', borderRadius: 'var(--radius-lg)' }}>
                    <div style={{ fontWeight: 600, fontSize: '14px', marginBottom: '16px' }}>{dash.cpuEfficiencyRanked.title}</div>
                    <RankedBars data={dash.cpuEfficiencyRanked.ranked} footnote="Higher is better — throughput delivered per CPU percentage point used." />
                  </div>
                )}
              </div>
            )}

            {/* Cached Reads */}
            {activeSection2 === 'cached' && dash && (
              <div className="stage-in">
                <div className="m" style={{ fontSize: '10px', letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--primary)', marginBottom: '9px' }}>Chapter 05</div>
                <h2 className="d" style={{ margin: '0 0 8px', fontSize: '30px', fontWeight: 600, letterSpacing: '-.028em' }}>Cached Reads</h2>
                <p style={{ margin: '0 0 24px', fontSize: '14px', color: 'var(--muted)' }}>Read throughput before and after cache warm-up</p>
                {dash.cachedSlopeChart ? (
                  <div className="glass" style={{ padding: '24px', borderRadius: 'var(--radius-lg)' }}>
                    <div style={{ marginBottom: '20px' }}>
                      <h3 className="d" style={{ margin: '0 0 4px', fontSize: '16px', fontWeight: 600 }}>Cache Warm-Up Effect</h3>
                      <p style={{ margin: 0, fontSize: '12.5px', color: 'var(--muted)' }}>Open circle = initial read · filled = after cache warm-up · chip shows throughput multiplier</p>
                    </div>
                    <SlopeChart data={dash.cachedSlopeChart} />
                  </div>
                ) : dash.cachePairs ? (
                  <PairedBars pairs={dash.cachePairs.pairs} />
                ) : (
                  <div style={{ color: 'var(--muted)', fontSize: '13.5px' }}>No cached-vs-initial sheet found in this workbook.</div>
                )}
              </div>
            )}

            {/* Multipart Upload */}
            {activeSection2 === 'mpu' && dash && (
              <div className="stage-in">
                <div className="m" style={{ fontSize: '10px', letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--primary)', marginBottom: '9px' }}>Chapter 06</div>
                <h2 className="d" style={{ margin: '0 0 8px', fontSize: '30px', fontWeight: 600, letterSpacing: '-.028em' }}>Multipart Upload</h2>
                <p style={{ margin: '0 0 24px', fontSize: '14px', color: 'var(--muted)' }}>MPU throughput and latency by part size, recommended size highlighted</p>
                {dash.grMpuData ? (
                  <MpuSweepChart
                    data={tpFactor === 1 ? dash.grMpuData : dash.grMpuData.map((d: any) => ({ ...d, throughput: d.throughput * tpFactor }))}
                    title="Throughput by Part Size"
                    unit={tpUnit}
                  />
                ) : dash.mpuAnalysis ? (
                  <>
                    {dash.mpuAnalysis.lineChart && (
                      <div className="glass" style={{ padding: '24px', borderRadius: 'var(--radius-lg)', marginBottom: '24px' }}>
                        <LineChart chart={dash.mpuAnalysis.lineChart} />
                        <Legend series={dash.mpuAnalysis.lineChart.series} />
                      </div>
                    )}
                    <div className="glass" style={{ padding: '24px', borderRadius: 'var(--radius-lg)' }}>
                      <RankedBars data={dash.mpuAnalysis.ranked} footnote={`Recommended part size: ${dash.mpuAnalysis.recommended}`} />
                    </div>
                  </>
                ) : <div style={{ color: 'var(--muted)', fontSize: '13.5px' }}>No MPU sheet found in this workbook.</div>}
              </div>
            )}

            {/* Raw Data */}
            {activeSection2 === 'raw' && (
              <div className="stage-in">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
                  <div>
                    <div className="m" style={{ fontSize: '10px', letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--primary)', marginBottom: '9px' }}>Chapter 07</div>
                    <h2 className="d" style={{ margin: 0, fontSize: '30px', fontWeight: 600, letterSpacing: '-.028em' }}>Raw Data</h2>
                  </div>
                  <input type="text" placeholder="Filter rows…" value={filterText} onChange={e => { setFilterText(e.target.value); setPage(0) }} style={{ minWidth: '220px' }} />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '14px', flexWrap: 'wrap' }}>
                  {sheetTabs.map((tab: any) => (
                    <span key={tab.name} onClick={tab.onClick} className="m" style={{ padding: '7px 13px', borderRadius: '9px', fontSize: '11px', letterSpacing: '.05em', background: tab.bg, border: `1px solid ${tab.borderColor}`, color: tab.color, cursor: 'pointer' }}>{tab.label}</span>
                  ))}
                </div>
                <DataTable headers={tableHeaders} rows={pageRows} rowCountLabel={rowCountLabel} pageLabel={pageLabel} prevDisabled={prevDisabled} nextDisabled={nextDisabled}
                  onPrev={() => setPage(p => Math.max(0, p - 1))} onNext={() => setPage(p => p + 1)} />
              </div>
            )}

            {/* Compare */}
            {activeSection2 === 'compare' && (
              <div className="stage-in">
                <div className="m" style={{ fontSize: '10px', letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--primary)', marginBottom: '9px' }}>Chapter 08</div>
                <h2 className="d" style={{ margin: '0 0 8px', fontSize: '30px', fontWeight: 600, letterSpacing: '-.028em' }}>Compare</h2>
                <p style={{ margin: '0 0 24px', fontSize: '14px', color: 'var(--muted)' }}>Pick a baseline to see the metric-by-metric change, plus every file side by side</p>

                {files.length < 2 && <div style={{ color: 'var(--muted)', fontSize: '13.5px' }}>Load at least 2 files to compare.</div>}

                {files.length >= 2 && baselineFile && compareCurrentFile && (
                  <div className="glass" style={{ padding: '24px', borderRadius: 'var(--radius-lg)', marginBottom: '28px' }}>
                    <div style={{ display: 'flex', gap: '18px', alignItems: 'flex-end', marginBottom: '20px', flexWrap: 'wrap' }}>
                      <div style={{ minWidth: '220px' }}>
                        <label style={{ display: 'block', fontSize: '12px', color: 'var(--muted)', marginBottom: '6px', fontWeight: 500 }}>Baseline</label>
                        <Dropdown label={baselineFile.name} open={openDropdown === 'baseline'} onToggle={toggleDropdown('baseline')} onClose={closeDropdown}
                          options={files.map((f: any) => ({ label: f.name, activeBg: baselineFile.id === f.id ? 'var(--primary-soft)' : 'transparent', activeColor: baselineFile.id === f.id ? 'var(--primary)' : 'var(--text)', activeWeight: baselineFile.id === f.id ? '600' : '400', onClick: () => { setBaselineFileId(f.id); closeDropdown() } }))} />
                      </div>
                      <div style={{ minWidth: '220px' }}>
                        <label style={{ display: 'block', fontSize: '12px', color: 'var(--muted)', marginBottom: '6px', fontWeight: 500 }}>This run</label>
                        <Dropdown label={compareCurrentFile.name} open={openDropdown === 'current'} onToggle={toggleDropdown('current')} onClose={closeDropdown}
                          options={files.filter((f: any) => f.id !== baselineFile.id).map((f: any) => ({ label: f.name, activeBg: compareCurrentFile.id === f.id ? 'var(--primary-soft)' : 'transparent', activeColor: compareCurrentFile.id === f.id ? 'var(--primary)' : 'var(--text)', activeWeight: compareCurrentFile.id === f.id ? '600' : '400', onClick: () => { setFocusFileId(f.id); closeDropdown() } }))} />
                      </div>
                    </div>
                    <DiffTable rows={diffRows} baselineName={baselineFile.name} currentName={compareCurrentFile.name} />
                  </div>
                )}

                {files.length > 0 && (
                  <div style={{ display: 'flex', gap: '16px', overflowX: 'auto', paddingBottom: '8px' }}>
                    {compareDashboards.map((cd: any) => (
                      <div key={cd.id} className="glass card-in" style={{ minWidth: '340px', maxWidth: '400px', flex: 1, padding: '22px', borderRadius: 'var(--radius-lg)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: cd.color, display: 'inline-block' }} />
                          <div className="d" style={{ fontWeight: 600, fontSize: '14px' }}>{cd.name}</div>
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '18px' }}>
                          {cd.peakCards.map((card: any, i: number) => (
                            <div key={i} style={{ background: 'var(--surface-2)', borderRadius: '10px', padding: '10px 12px', minWidth: '112px' }}>
                              <div className="m" style={{ fontSize: '9.5px', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: '4px' }}>{card.label}</div>
                              <div className="d tn" style={{ fontSize: '17px', fontWeight: 600 }}>{card.value} <span className="m" style={{ fontSize: '10.5px', fontWeight: 500, color: 'var(--muted)' }}>{card.unit}</span></div>
                            </div>
                          ))}
                        </div>
                        {cd.scalingCharts.map((item: any, i: number) => (
                          <div key={i}>
                            <div className="m" style={{ fontSize: '11px', fontWeight: 600, marginBottom: '8px', color: 'var(--muted)' }}>{item.title}</div>
                            <LineChart chart={item.chart} />
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

          </div>
        </div>
      )}

      {/* ── Zoom Modal ── */}
      {zoomedChart && <ZoomModal zoomedChart={zoomedChart} onClose={() => setZoomedChartKey(null)} />}

      {/* ── Report Details ── */}
      {reportDetailsOpen && (
        <ReportDetailsModal details={reportDetails} onChange={setReportDetails}
          onGenerate={() => { setReportDetailsOpen(false); setReportOpen(true) }}
          onClose={() => setReportDetailsOpen(false)} />
      )}

      {/* ── PDF Report ── */}
      {reportOpen && (
        <PdfReport reportTargets={reportTargets} reportDetails={reportDetails} generatedDate={generatedDate}
          onPrint={onPrint} onClose={() => setReportOpen(false)} />
      )}

    </div>
  )
}
