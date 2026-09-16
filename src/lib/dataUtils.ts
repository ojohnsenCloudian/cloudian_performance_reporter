import { fmtNum, toNum, buildLineChart, buildSlaLineChart, buildHeatmap, buildStackedBarChart, buildRankedBars, buildPairedBars } from './chartUtils'

// Matches the redesign's fixed 4-color categorical palette (RED, BLUE, TEAL, GOLD).
export const SERIES_COLORS = [
  'oklch(0.55 0.2 26)', 'oklch(0.55 0.13 240)', 'oklch(0.58 0.11 175)', 'oklch(0.66 0.13 78)',
]

export function nextColor(idx: number) { return SERIES_COLORS[idx % SERIES_COLORS.length] }

function groupKey(r: any, mapping: any) {
  const parts: string[] = []
  if (mapping.category) parts.push(r[mapping.category])
  if (mapping.protocol) parts.push(r[mapping.protocol])
  return parts.filter(Boolean).join(' · ') || 'All data'
}

export function computePeakCards(file: any) {
  const { mapping, rows } = file
  const cards: any[] = []
  if (mapping.throughput) {
    const tpUnit = (mapping.throughput.match(/\(([^)]+)\)/) || [])[1] || 'MB/s'
    if (mapping.operation) {
      const byOp: Record<string, number> = {}
      rows.forEach((r: any) => {
        const op = String(r[mapping.operation] || '').toLowerCase()
        const v = toNum(r[mapping.throughput])
        if (v == null) return
        const k = op.includes('write') ? 'Write' : op.includes('read') ? 'Read' : null
        if (!k) return
        if (!byOp[k] || v > byOp[k]) byOp[k] = v
      })
      Object.keys(byOp).forEach((k, i) => cards.push({ label: `Peak ${k} Throughput`, rawValue: byOp[k], value: fmtNum(byOp[k]), unit: tpUnit, dotColor: nextColor(i), role: 'throughput', op: k.toLowerCase() }))
    } else {
      const vals = rows.map((r: any) => toNum(r[mapping.throughput])).filter((v: any) => v != null)
      if (vals.length) cards.push({ label: 'Peak Throughput', rawValue: Math.max(...vals), value: fmtNum(Math.max(...vals)), unit: tpUnit, dotColor: nextColor(0), role: 'throughput', op: null })
    }
  }
  if (mapping.objectsPerSec) {
    if (mapping.operation) {
      const byOp: Record<string, number> = {}
      rows.forEach((r: any) => {
        const op = String(r[mapping.operation] || '').toLowerCase()
        const v = toNum(r[mapping.objectsPerSec])
        if (v == null) return
        const k = op.includes('write') ? 'Write' : op.includes('read') ? 'Read' : null
        if (!k) return
        if (!byOp[k] || v > byOp[k]) byOp[k] = v
      })
      Object.keys(byOp).forEach((k, i) => cards.push({ label: `Peak ${k} Objects/s`, rawValue: byOp[k], value: fmtNum(byOp[k]), unit: '', dotColor: nextColor(i + 2), role: 'objectsPerSec', op: k.toLowerCase() }))
    } else {
      const vals = rows.map((r: any) => toNum(r[mapping.objectsPerSec])).filter((v: any) => v != null)
      if (vals.length) cards.push({ label: 'Peak Objects/s', rawValue: Math.max(...vals), value: fmtNum(Math.max(...vals)), unit: '', dotColor: nextColor(2), role: 'objectsPerSec', op: null })
    }
  }
  if (mapping.latency) {
    const vals = rows.map((r: any) => toNum(r[mapping.latency])).filter((v: any) => v != null)
    if (vals.length) cards.push({ label: 'Best Latency', rawValue: Math.min(...vals), value: fmtNum(Math.min(...vals)), unit: 'ms', dotColor: nextColor(4), role: 'latency', op: null })
  }
  return cards
}

function buildScalingChart(file: any, opFilter: string | null, slaValue?: number) {
  const { mapping, rows } = file
  if (!mapping.threads || !mapping.throughput) return null
  const groups: Record<string, any[]> = {}
  rows.forEach((r: any) => {
    if (opFilter && mapping.operation) {
      const op = String(r[mapping.operation] || '').toLowerCase()
      if (!op.includes(opFilter)) return
    }
    const key = groupKey(r, mapping)
    const x = toNum(r[mapping.threads]), y = toNum(r[mapping.throughput])
    if (x == null || y == null) return
    ;(groups[key] = groups[key] || []).push({ x, y })
  })
  const keys = Object.keys(groups)
  if (!keys.length) return null
  keys.forEach(k => groups[k].sort((a, b) => a.x - b.x))
  const seriesList = keys.map((k, i) => ({ label: k, color: nextColor(i), points: groups[k] }))
  return buildSlaLineChart(seriesList, { slaValue, slaLabel: slaValue != null ? `SLA ${fmtNum(slaValue)} MiB/s` : undefined })
}

export function buildScalingCharts(file: any, slaValue?: number) {
  const { mapping, rows } = file
  if (!mapping.threads || !mapping.throughput) return []
  if (mapping.operation) {
    const ops = [...new Set(rows.map((r: any) => String(r[mapping.operation] || '').toLowerCase()))]
    const charts: any[] = []
    if (ops.some((o: any) => o.includes('write'))) { const c = buildScalingChart(file, 'write', slaValue); if (c) charts.push({ title: 'Write Throughput Scaling', chart: c }) }
    if (ops.some((o: any) => o.includes('read'))) { const c = buildScalingChart(file, 'read', slaValue); if (c) charts.push({ title: 'Read Throughput Scaling', chart: c }) }
    if (charts.length) return charts
  }
  const c = buildScalingChart(file, null, slaValue)
  return c ? [{ title: 'Throughput Scaling', chart: c }] : []
}

// Latency grouped bars, ranked fastest-first with an optional SLA tick — used by
// the redesigned Latency chapter (replaces the plain horizontal bar chart).
export function buildLatencyRanked(file: any, slaValue?: number) {
  const { mapping, rows } = file
  if (!mapping.latency) return null
  const groups: Record<string, any> = {}
  rows.forEach((r: any) => {
    const key = groupKey(r, mapping)
    const v = toNum(r[mapping.latency]); if (v == null) return
    const th = mapping.threads ? (toNum(r[mapping.threads]) || 0) : 0
    if (!groups[key] || th >= groups[key].th) groups[key] = { value: v, th }
  })
  const keys = Object.keys(groups)
  if (!keys.length) return null
  const bars = keys.map((k, i) => ({ label: k, value: groups[k].value, unit: 'ms', color: nextColor(i) }))
  const ranked = buildRankedBars(bars, { sortDir: 1, sla: slaValue })
  return ranked ? { title: 'Latency at Maximum Concurrency', ranked } : null
}

function formatCell(v: any) {
  if (v == null) return ''
  if (typeof v === 'number') return fmtNum(v)
  return String(v)
}

// Small-multiples: one mini line chart per configuration/category, read (solid) vs write (dashed).
export function buildSmallMultiples(file: any) {
  const { mapping, rows } = file
  if (!mapping.category || !mapping.threads || !mapping.throughput) return []
  const categories = [...new Set(rows.map((r: any) => String(r[mapping.category] || '')))].filter(Boolean)
  return categories.map((cat, i) => {
    const color = nextColor(i)
    const opsToPlot = mapping.operation ? ['write', 'read'] : [null]
    const series = opsToPlot.map((op) => {
      const pts = rows
        .filter((r: any) => String(r[mapping.category] || '') === cat && (!op || String(r[mapping.operation] || '').toLowerCase().includes(op)))
        .map((r: any) => ({ x: toNum(r[mapping.threads]), y: toNum(r[mapping.throughput]) }))
        .filter((p: any) => p.x != null && p.y != null)
        .sort((a: any, b: any) => a.x - b.x)
      if (!pts.length) return null
      return { label: op === 'read' ? 'Read' : op === 'write' ? 'Write' : cat, color, dash: op === 'write', points: pts }
    }).filter(Boolean) as any[]
    if (!series.length) return null
    const chart = buildLineChart(series, { width: 260, height: 150 })
    if (!chart) return null
    const peak = Math.max(...series.flatMap((s: any) => s.points.map((p: any) => p.y)))
    return {
      title: cat, color, peakLabel: fmtNum(peak),
      chart: { ...chart, series: chart.series.map((s: any, si: number) => ({ ...s, dash: series[si].dash })) },
    }
  }).filter(Boolean)
}

// Configuration × object-size heatmap of peak (read) throughput.
export function buildConfigSizeHeatmap(file: any) {
  const { mapping, rows } = file
  if (!mapping.category || !mapping.objectSize || !mapping.throughput) return null
  const isNonEmpty = (v: string): v is string => v !== ''
  const configs: string[] = [...new Set<string>(rows.map((r: any) => String(r[mapping.category] || '')))].filter(isNonEmpty)
  const sizes: string[] = [...new Set<string>(rows.map((r: any) => String(r[mapping.objectSize] || '')))].filter(isNonEmpty)
    .sort((a, b) => (toNum(a) ?? 0) - (toNum(b) ?? 0))
  if (!configs.length || !sizes.length) return null
  const matrix = configs.map((cfg) => sizes.map((sz) => {
    const vals = rows
      .filter((r: any) => String(r[mapping.category] || '') === cfg && String(r[mapping.objectSize] || '') === sz && (!mapping.operation || String(r[mapping.operation] || '').toLowerCase().includes('read')))
      .map((r: any) => toNum(r[mapping.throughput]))
      .filter((v: any): v is number => v != null)
    return vals.length ? Math.max(...vals) : NaN
  }))
  const heat = buildHeatmap(configs, sizes, matrix)
  return heat ? { title: 'Throughput by Configuration & Object Size', note: 'Peak read throughput, MiB/s', ...heat } : null
}

// Stacked min→avg→max CPU utilization envelope, one bar per configuration.
export function buildCpuEnvelope(file: any) {
  const { mapping, rows } = file
  if (!mapping.cpuAvg) return null
  const groups: Record<string, { min: number[]; avg: number[]; max: number[] }> = {}
  rows.forEach((r: any) => {
    const avg = toNum(r[mapping.cpuAvg]); if (avg == null) return
    const min = mapping.cpuMin ? toNum(r[mapping.cpuMin]) : avg
    const max = mapping.cpuMax ? toNum(r[mapping.cpuMax]) : avg
    const key = groupKey(r, mapping)
    const g = (groups[key] = groups[key] || { min: [], avg: [], max: [] })
    g.min.push(min ?? avg); g.avg.push(avg); g.max.push(max ?? avg)
  })
  const keys = Object.keys(groups)
  if (!keys.length) return null
  const bars = keys.map((k, i) => ({
    label: k, color: nextColor(i),
    min: Math.min(...groups[k].min),
    avg: groups[k].avg.reduce((a, b) => a + b, 0) / groups[k].avg.length,
    max: Math.max(...groups[k].max),
  }))
  const chart = buildStackedBarChart(bars)
  return chart ? { title: 'CPU Utilization Envelope', chart } : null
}

// Ranked throughput-per-CPU-point (reuses the shared ranked-bar component).
export function buildCpuEfficiencyRanked(file: any) {
  const { mapping, rows } = file
  if (!mapping.cpuAvg || !mapping.throughput) return null
  const groups: Record<string, { value: number; th: number }> = {}
  rows.forEach((r: any) => {
    const cpu = toNum(r[mapping.cpuAvg]), tp = toNum(r[mapping.throughput])
    if (cpu == null || tp == null || cpu === 0) return
    const eff = tp / cpu, th = mapping.threads ? (toNum(r[mapping.threads]) || 0) : 0
    const key = groupKey(r, mapping)
    if (!groups[key] || th >= groups[key].th) groups[key] = { value: eff, th }
  })
  const keys = Object.keys(groups)
  if (!keys.length) return null
  const bars = keys.map((k, i) => ({ label: k, value: groups[k].value, unit: 'MiB/s per %CPU', color: nextColor(i) }))
  const ranked = buildRankedBars(bars)
  return ranked ? { title: 'Throughput per CPU % Point', ranked } : null
}

// Paired initial-vs-cached read bars, one card per scenario row.
export function buildCachePairs(file: any) {
  let found: any = null
  for (const name of Object.keys(file.otherSheets || {})) {
    const t = file.otherSheets[name]; const hl = t.headers.map((h: string) => h.toLowerCase())
    if (hl.some((h: string) => h.includes('cached')) && hl.some((h: string) => h.includes('initial'))) { found = t; break }
  }
  if (!found) return null
  const headers = found.headers
  const initCol = headers.find((h: string) => /initial/i.test(h) && /through/i.test(h))
  const cachedCol = headers.find((h: string) => /cached/i.test(h) && /through/i.test(h))
  const initLatCol = headers.find((h: string) => /initial/i.test(h) && /laten/i.test(h))
  const cachedLatCol = headers.find((h: string) => /cached/i.test(h) && /laten/i.test(h))
  const labelCol = headers.find((h: string) => /scenario|config|name/i.test(h)) || headers[0]
  if (!initCol || !cachedCol) return null
  const pairs = found.rows.map((r: any, i: number) => {
    const iv = toNum(r[initCol]), cv = toNum(r[cachedCol])
    if (iv == null || cv == null) return null
    const lift = iv > 0 ? `×${(cv / iv).toFixed(1)}` : undefined
    let note: string | undefined
    if (initLatCol && cachedLatCol) {
      const il = toNum(r[initLatCol]), cl = toNum(r[cachedLatCol])
      if (il != null && cl != null && il > 0) note = `Latency ${fmtNum(il)} → ${fmtNum(cl)} ms (${Math.round((1 - cl / il) * 100)}% faster)`
    }
    return {
      label: String(r[labelCol] || `Scenario ${i + 1}`), lift, note,
      bars: [{ label: 'Initial read', value: iv, unit: 'MiB/s', color: nextColor(0) }, { label: 'Cached read', value: cv, unit: 'MiB/s', color: nextColor(1) }],
    }
  }).filter(Boolean) as any[]
  return pairs.length ? { title: 'Cached vs Initial Read Performance', pairs: buildPairedBars(pairs) } : null
}

// MPU throughput-by-part-size, ranked with the fastest size highlighted, plus a
// dual-series (throughput + scaled latency) line so the trade-off is visible.
export function buildMpuAnalysis(file: any) {
  let found: any = null
  for (const name of Object.keys(file.otherSheets || {})) {
    const t = file.otherSheets[name]
    if (t.headers.some((h: string) => h.toLowerCase().includes('part size'))) { found = t; break }
  }
  if (!found) return null
  const headers = found.headers
  const sizeCol = headers.find((h: string) => h.toLowerCase().includes('part size'))
  const tpCol = headers.find((h: string) => h.toLowerCase().includes('throughput'))
  const latCol = headers.find((h: string) => h.toLowerCase().includes('latency'))
  if (!sizeCol || !tpCol) return null
  const rowsData = found.rows
    .map((r: any) => ({ size: String(r[sizeCol]), tp: toNum(r[tpCol]), lat: latCol ? toNum(r[latCol]) : null }))
    .filter((d: any) => d.tp != null)
  if (!rowsData.length) return null
  const bestIdx = rowsData.reduce((bi: number, d: any, i: number) => (d.tp > rowsData[bi].tp ? i : bi), 0)
  const ranked = buildRankedBars(rowsData.map((d: any, i: number) => ({
    label: d.size, value: d.tp, unit: 'MiB/s', color: i === bestIdx ? nextColor(0) : nextColor(1),
    meta: d.lat != null ? `${fmtNum(d.lat)} ms latency${i === bestIdx ? ' · recommended' : ''}` : (i === bestIdx ? 'recommended' : undefined),
  })))
  let lineChart: any = null
  if (latCol && rowsData.some((d: any) => d.lat != null)) {
    const maxLat = Math.max(...rowsData.map((d: any) => d.lat || 0))
    const maxTp = Math.max(...rowsData.map((d: any) => d.tp))
    const scale = maxLat > 0 ? (maxTp / maxLat) * 0.9 : 1
    const tpSeries = { label: 'Throughput (MiB/s)', color: nextColor(0), points: rowsData.map((d: any, i: number) => ({ x: i, y: d.tp })) }
    const latSeries = { label: 'Latency (scaled)', color: nextColor(1), points: rowsData.map((d: any, i: number) => ({ x: i, y: (d.lat || 0) * scale })) }
    lineChart = buildLineChart([tpSeries, latSeries])
    if (lineChart) lineChart.xLabels = lineChart.xLabels.map((xl: any) => ({ ...xl, label: rowsData[Number(xl.label)]?.size ?? xl.label }))
  }
  return { title: 'Multipart Upload (MPU) Performance', ranked, lineChart, recommended: rowsData[bestIdx]?.size }
}

// Mini sparkline (throughput/latency/etc vs threads) for a KPI card.
export function buildKpiSparkline(file: any, role: string, opFilter: string | null) {
  const { mapping, rows } = file
  if (!mapping[role] || !mapping.threads) return null
  let filtered = rows
  if (opFilter && mapping.operation) filtered = rows.filter((r: any) => String(r[mapping.operation] || '').toLowerCase().includes(opFilter))
  // Peak value per thread-count, so the trend reflects the same "peak across
  // configurations" the KPI number itself shows, rather than an interleaved
  // zigzag across configurations sharing the same x.
  const byX: Record<number, number> = {}
  filtered.forEach((r: any) => {
    const x = toNum(r[mapping.threads]), y = toNum(r[mapping[role]])
    if (x == null || y == null) return
    if (byX[x] == null || y > byX[x]) byX[x] = y
  })
  const pts = Object.keys(byX).map((x) => ({ x: Number(x), y: byX[Number(x)] })).sort((a, b) => a.x - b.x)
  if (pts.length < 2) return null
  const chart = buildLineChart([{ label: '', color: 'currentColor', points: pts }], { width: 260, height: 38 })
  return chart ? chart.series[0] : null
}

export type ReportDetails = {
  clusterName?: string
  nodeCount?: string
  network?: string
  softwareVersion?: string
  workload?: string
  slaThroughput?: number
  slaLatency?: number
}

export function evaluateCriteria(dash: any, details: ReportDetails) {
  const rows: { criterion: string; target: string; measured: string; pass: boolean }[] = []
  if (details.slaThroughput != null) {
    const peak = Math.max(0, ...dash.peakCards.filter((c: any) => (c.unit || '').toLowerCase().includes('b/s') && !c.label.includes('Objects')).map((c: any) => c.rawValue || 0))
    rows.push({ criterion: 'Peak throughput', target: `≥ ${fmtNum(details.slaThroughput)} MiB/s`, measured: `${fmtNum(peak)} MiB/s`, pass: peak >= details.slaThroughput })
  }
  if (details.slaLatency != null) {
    const latCard = dash.peakCards.find((c: any) => /latency/i.test(c.label))
    if (latCard?.rawValue != null) rows.push({ criterion: 'Best latency', target: `≤ ${fmtNum(details.slaLatency)} ms`, measured: `${fmtNum(latCard.rawValue)} ms`, pass: latCard.rawValue <= details.slaLatency })
  }
  return rows
}

export function generateRecommendation(dash: any, criteria: { pass: boolean }[]): string {
  const allPass = criteria.length ? criteria.every((c) => c.pass) : null
  const bestThroughput = dash.peakCards.find((c: any) => /throughput/i.test(c.label))
  const bestLatency = dash.peakCards.find((c: any) => /latency/i.test(c.label))
  const parts: string[] = []
  if (bestThroughput) parts.push(`Peak throughput of ${bestThroughput.value} ${bestThroughput.unit} was observed for ${dash.name}.`)
  if (bestLatency) parts.push(`Best-case latency reached ${bestLatency.value} ${bestLatency.unit}.`)
  if (allPass === true) parts.push('All defined acceptance criteria were met — the configuration tested is recommended for deployment as-is.')
  else if (allPass === false) parts.push('One or more acceptance criteria were not met — review the criteria table before proceeding to deployment.')
  else parts.push('No acceptance criteria were defined for this run; results are presented for reference only.')
  return parts.join(' ')
}

export type DiffRow = { label: string; unit: string; baseline: number | null; current: number | null; delta: string; good: boolean | null }

// Baseline-vs-current metric diff for the Compare screen.
export function buildBaselineDiff(baseline: any, current: any): DiffRow[] {
  const bMap: Record<string, any> = {}; computePeakCards(baseline).forEach((c) => (bMap[c.label] = c))
  const cMap: Record<string, any> = {}; computePeakCards(current).forEach((c) => (cMap[c.label] = c))
  const labels = [...new Set([...Object.keys(bMap), ...Object.keys(cMap)])]
  return labels.map((label) => {
    const b = bMap[label], c = cMap[label]
    const unit = (b || c)?.unit || ''
    const bv = b?.rawValue ?? null, cv = c?.rawValue ?? null
    const lowerIsBetter = /latency/i.test(label)
    let delta = '—', good: boolean | null = null
    if (bv != null && cv != null && bv !== 0) {
      const pct = ((cv - bv) / Math.abs(bv)) * 100
      good = lowerIsBetter ? pct < 0 : pct > 0
      delta = `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%`
    }
    return { label, unit, baseline: bv, current: cv, delta, good }
  })
}

export function buildFullDashboard(file: any, sla: { slaThroughput?: number; slaLatency?: number } = {}) {
  return {
    name: file.name, mainSheetName: file.mainSheetName, rowCount: file.rows.length,
    peakCards: computePeakCards(file),
    scalingCharts: buildScalingCharts(file, sla.slaThroughput),
    latencyRanked: buildLatencyRanked(file, sla.slaLatency),
    smallMultiples: buildSmallMultiples(file),
    heatmap: buildConfigSizeHeatmap(file),
    cpuEnvelope: buildCpuEnvelope(file),
    cpuEfficiencyRanked: buildCpuEfficiencyRanked(file),
    cachePairs: buildCachePairs(file),
    mpuAnalysis: buildMpuAnalysis(file),
    allHeaders: file.headers.map((h: string) => ({ label: h })),
    allRows: file.rows.map((r: any) => ({ cells: file.headers.map((h: string) => ({ value: formatCell(r[h]) })) })),
  }
}

function sizeLabel(testName: string): string {
  const m = testName.match(/-(\d+[kmgKMG])-/i)
  if (!m) return '?'
  const raw = m[1].toLowerCase()
  if (raw.endsWith('k')) return raw.slice(0, -1) + ' KiB'
  if (raw.endsWith('m')) return raw.slice(0, -1) + ' MiB'
  if (raw.endsWith('g')) return raw.slice(0, -1) + ' GiB'
  return raw
}

export function parseGosbenchJSON(jsonData: any): { table: { headers: string[], rows: any[] }, name: string, mapping: any } {
  const pd: any[] = jsonData.PerformanceData || []
  const headers = ['Operation', 'Object Size', 'Workers', 'Throughput (MB/s)', 'Latency (ms)', 'Objects/s']
  const rows = pd.map((r: any) => ({
    'Operation': r.OpName === 'write' ? 'Write' : 'Read',
    'Object Size': sizeLabel(r.TestName),
    'Workers': r.Workers,
    'Throughput (MB/s)': +(r.BandwidthBps / 1e6).toFixed(2),
    'Latency (ms)': +r.AvgLatencyms.toFixed(3),
    'Objects/s': +r.OpsPerSec.toFixed(3),
  }))
  const mapping = {
    category: 'Object Size',
    operation: 'Operation',
    threads: 'Workers',
    throughput: 'Throughput (MB/s)',
    latency: 'Latency (ms)',
    objectsPerSec: 'Objects/s',
  }
  const name = jsonData.ClusterName || jsonData.RunDescription || 'Benchmark'
  return { table: { headers, rows }, name, mapping }
}

export function generateDemoData() {
  const configs = [
    { name: 'RDMA EC 4+2', base: 3200, cpu: 4 }, { name: 'TCP EC 4+2', base: 2400, cpu: 9 },
    { name: 'RDMA RF3', base: 2800, cpu: 5 }, { name: 'TCP RF3', base: 2100, cpu: 10 },
  ]
  const threadsList = [16, 32, 64, 128, 256]
  const headers = ['Configuration', 'Protocol', 'Operation', 'Object Size (MiB)', 'Threads', 'Throughput (MiB/s)', 'Latency (ms)', 'Objects/s', 'CPU Min', 'CPU Max', 'CPU Avg']
  const rows: any[] = []
  configs.forEach(cfg => {
    const protocol = cfg.name.startsWith('RDMA') ? 'RDMA' : 'TCP'
    ;['Write', 'Read'].forEach(op => {
      threadsList.forEach((th, i) => {
        const scale = 1 - Math.exp(-th / 90)
        const opMult = op === 'Read' ? 1.35 : 1
        const throughput = Math.round(cfg.base * opMult * scale)
        const latency = Math.round((th * 3.1) * (op === 'Write' ? 1.15 : 1))
        const objectsPerSec = Math.round(throughput / 8 * 1024 / 8)
        const cpuAvg = +(cfg.cpu * (0.6 + i * 0.18)).toFixed(1)
        rows.push({ 'Configuration': cfg.name, 'Protocol': protocol, 'Operation': op, 'Object Size (MiB)': 8, 'Threads': th, 'Throughput (MiB/s)': throughput, 'Latency (ms)': latency, 'Objects/s': objectsPerSec, 'CPU Min': +(cpuAvg * 0.7).toFixed(1), 'CPU Max': +(cpuAvg * 1.3).toFixed(1), 'CPU Avg': cpuAvg })
      })
    })
  })
  const cachedHeaders = ['Scenario', 'Initial Throughput', 'Cached Throughput', 'Initial Latency', 'Cached Latency']
  const cachedRows = [
    { 'Scenario': 'TCP RF3 — 8MiB/128T', 'Initial Throughput': 2050, 'Cached Throughput': 6400, 'Initial Latency': 310, 'Cached Latency': 42 },
    { 'Scenario': 'RDMA RF3 — 8MiB/128T', 'Initial Throughput': 2650, 'Cached Throughput': 7100, 'Initial Latency': 260, 'Cached Latency': 35 },
  ]
  const mpuHeaders = ['Part Size', 'Throughput', 'Latency']
  const mpuRows = [
    { 'Part Size': '2 MiB', 'Throughput': 1450, 'Latency': 48 },
    { 'Part Size': '4 MiB', 'Throughput': 2100, 'Latency': 61 },
    { 'Part Size': '8 MiB', 'Throughput': 2780, 'Latency': 79 },
  ]
  return {
    mainTable: { headers, rows },
    otherSheets: { 'Cached Reads': { headers: cachedHeaders, rows: cachedRows }, 'MPU Data': { headers: mpuHeaders, rows: mpuRows } },
  }
}
