import { fmtNum, toNum, buildLineChart, buildBarChart, buildHBarChart } from './chartUtils'

export const SERIES_COLORS = [
  'oklch(0.6 0.18 264)', 'oklch(0.65 0.14 195)', 'oklch(0.75 0.15 80)',
  'oklch(0.65 0.18 15)', 'oklch(0.6 0.16 310)', 'oklch(0.65 0.14 150)',
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
      Object.keys(byOp).forEach((k, i) => cards.push({ label: `Peak ${k} Throughput`, rawValue: byOp[k], value: fmtNum(byOp[k]), unit: 'MiB/s', dotColor: nextColor(i) }))
    } else {
      const vals = rows.map((r: any) => toNum(r[mapping.throughput])).filter((v: any) => v != null)
      if (vals.length) cards.push({ label: 'Peak Throughput', rawValue: Math.max(...vals), value: fmtNum(Math.max(...vals)), unit: 'MiB/s', dotColor: nextColor(0) })
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
      Object.keys(byOp).forEach((k, i) => cards.push({ label: `Peak ${k} Objects/s`, rawValue: byOp[k], value: fmtNum(byOp[k]), unit: '', dotColor: nextColor(i + 2) }))
    } else {
      const vals = rows.map((r: any) => toNum(r[mapping.objectsPerSec])).filter((v: any) => v != null)
      if (vals.length) cards.push({ label: 'Peak Objects/s', rawValue: Math.max(...vals), value: fmtNum(Math.max(...vals)), unit: '', dotColor: nextColor(2) })
    }
  }
  if (mapping.latency) {
    const vals = rows.map((r: any) => toNum(r[mapping.latency])).filter((v: any) => v != null)
    if (vals.length) cards.push({ label: 'Best Latency', rawValue: Math.min(...vals), value: fmtNum(Math.min(...vals)), unit: 'ms', dotColor: nextColor(4) })
  }
  return cards
}

function buildScalingChart(file: any, opFilter: string | null) {
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
  return buildLineChart(keys.map((k, i) => ({ label: k, color: nextColor(i), points: groups[k] })))
}

export function buildScalingCharts(file: any) {
  const { mapping, rows } = file
  if (!mapping.threads || !mapping.throughput) return []
  if (mapping.operation) {
    const ops = [...new Set(rows.map((r: any) => String(r[mapping.operation] || '').toLowerCase()))]
    const charts: any[] = []
    if (ops.some((o: any) => o.includes('write'))) { const c = buildScalingChart(file, 'write'); if (c) charts.push({ title: 'Write Throughput Scaling', chart: c }) }
    if (ops.some((o: any) => o.includes('read'))) { const c = buildScalingChart(file, 'read'); if (c) charts.push({ title: 'Read Throughput Scaling', chart: c }) }
    if (charts.length) return charts
  }
  const c = buildScalingChart(file, null)
  return c ? [{ title: 'Throughput Scaling', chart: c }] : []
}

export function buildLatencyChart(file: any) {
  const { mapping, rows } = file
  if (!mapping.latency) return null
  const groups: Record<string, any> = {}
  rows.forEach((r: any) => {
    const key = groupKey(r, mapping)
    const v = toNum(r[mapping.latency]); if (v == null) return
    const th = mapping.threads ? (toNum(r[mapping.threads]) || 0) : 0
    if (!groups[key] || th >= groups[key].th) groups[key] = { value: v, th }
  })
  const bars = Object.keys(groups).map((k, i) => ({ label: k, value: groups[k].value, color: nextColor(i) }))
  const hchart = buildHBarChart(bars)
  const chart = buildBarChart(bars)
  if (!hchart && !chart) return null
  return { title: 'Latency at Maximum Concurrency', chart: { ...chart, rows: hchart ? hchart.rows : [], width: hchart ? hchart.width : chart?.width, height: hchart ? hchart.height : chart?.height } }
}

export function buildCpuChart(file: any) {
  const { mapping, rows } = file
  if (!mapping.cpuAvg || !mapping.throughput) return null
  const groups: Record<string, any> = {}
  rows.forEach((r: any) => {
    const key = groupKey(r, mapping)
    const cpu = toNum(r[mapping.cpuAvg]), tp = toNum(r[mapping.throughput])
    if (cpu == null || tp == null || cpu === 0) return
    const eff = tp / cpu, th = mapping.threads ? (toNum(r[mapping.threads]) || 0) : 0
    if (!groups[key] || th >= groups[key].th) groups[key] = { value: eff, th }
  })
  const bars = Object.keys(groups).map((k, i) => ({ label: k, value: groups[k].value, color: nextColor(i) }))
  const chart = buildBarChart(bars)
  return chart ? { title: 'Throughput per CPU % Point', chart } : null
}

export function buildCachedSection(file: any) {
  let found: any = null
  for (const name of Object.keys(file.otherSheets || {})) {
    const t = file.otherSheets[name]; const hl = t.headers.map((h: string) => h.toLowerCase())
    if (hl.some((h: string) => h.includes('cached')) && hl.some((h: string) => h.includes('initial'))) { found = { name, table: t }; break }
  }
  if (!found) return null
  const table = found.table, headers = table.headers
  const initCol = headers.find((h: string) => /initial/i.test(h) && /through/i.test(h))
  const cachedCol = headers.find((h: string) => /cached/i.test(h) && /through/i.test(h))
  const labelCol = headers.find((h: string) => /scenario|config|name/i.test(h)) || headers[0]
  if (!initCol || !cachedCol) return { title: 'Cached vs Initial Read Performance', chart: null, table: tableToRender(table) }
  const bars: any[] = []
  table.rows.forEach((r: any, i: number) => {
    const iv = toNum(r[initCol]), cv = toNum(r[cachedCol])
    if (iv == null || cv == null) return
    const label = String(r[labelCol] || `Row ${i + 1}`)
    bars.push({ label: label + ' · Initial', value: iv, color: nextColor(0) })
    bars.push({ label: label + ' · Cached', value: cv, color: nextColor(1) })
  })
  return { title: 'Cached vs Initial Read Performance', chart: buildBarChart(bars), table: tableToRender(table) }
}

export function buildMpuSection(file: any) {
  let found: any = null
  for (const name of Object.keys(file.otherSheets || {})) {
    const t = file.otherSheets[name]
    if (t.headers.some((h: string) => h.toLowerCase().includes('part size'))) { found = { name, table: t }; break }
  }
  if (!found) return null
  const table = found.table, headers = table.headers
  const sizeCol = headers.find((h: string) => h.toLowerCase().includes('part size'))
  const tpCol = headers.find((h: string) => h.toLowerCase().includes('throughput'))
  let chart = null
  if (sizeCol && tpCol) {
    const bars = table.rows.map((r: any, i: number) => ({ label: String(r[sizeCol]), value: toNum(r[tpCol]) || 0, color: nextColor(i) })).filter((b: any) => b.value)
    chart = buildBarChart(bars)
  }
  return { title: 'Multipart Upload (MPU) Performance', chart, table: tableToRender(table) }
}

function formatCell(v: any) {
  if (v == null) return ''
  if (typeof v === 'number') return fmtNum(v)
  return String(v)
}

function tableToRender(table: any) {
  return {
    headers: table.headers.map((h: string) => ({ label: h })),
    rows: table.rows.map((r: any) => ({ cells: table.headers.map((h: string) => ({ value: formatCell(r[h]) })) })),
  }
}

export function buildFullDashboard(file: any) {
  const cached = buildCachedSection(file)
  const mpu = buildMpuSection(file)
  return {
    name: file.name, mainSheetName: file.mainSheetName, rowCount: file.rows.length,
    peakCards: computePeakCards(file),
    scalingCharts: buildScalingCharts(file),
    latencyChart: buildLatencyChart(file),
    cpuChart: buildCpuChart(file),
    cachedSectionFull: cached,
    mpuSectionFull: mpu,
    allHeaders: file.headers.map((h: string) => ({ label: h })),
    allRows: file.rows.map((r: any) => ({ cells: file.headers.map((h: string) => ({ value: formatCell(r[h]) })) })),
  }
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
