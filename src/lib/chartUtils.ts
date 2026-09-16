export function fmtNum(v: number | null | undefined): string {
  if (v == null || isNaN(v)) return '—'
  if (Math.abs(v) >= 1000) return (v / 1000).toFixed(1) + 'k'
  if (Math.abs(v) < 10 && v !== 0) return v.toFixed(2)
  return Math.round(v).toLocaleString()
}

export function toNum(v: any): number | null {
  const n = typeof v === 'number' ? v : parseFloat(v)
  return isNaN(n) ? null : n
}

export function buildLineChart(seriesRaw: any[], opts: any = {}) {
  const width = opts.width || 620, height = opts.height || 240
  const padL = 44, padR = 16, padT = 16, padB = 32
  const allPoints = seriesRaw.flatMap((s: any) => s.points)
  if (!allPoints.length) return null
  const xs = allPoints.map((p: any) => p.x), ys = allPoints.map((p: any) => p.y)
  const xMin = Math.min(...xs), xMax = Math.max(...xs), yMax = Math.max(...ys) * 1.1 || 1
  const baseY = height - padB
  const xScale = (x: number) => xMax === xMin ? padL + (width - padL - padR) / 2 : padL + (x - xMin) / (xMax - xMin) * (width - padL - padR)
  const yScale = (y: number) => baseY - (y / yMax) * (height - padT - padB)
  const series = seriesRaw.map((s: any, si: number) => {
    const pts = s.points.map((p: any) => ({ x: xScale(p.x), y: yScale(p.y), rawX: p.x, rawY: p.y }))
    let len = 0
    for (let i = 1; i < pts.length; i++) len += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y)
    const linePath = pts.map((p: any, i: number) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
    const areaPath = pts.length ? `${linePath} L${pts[pts.length - 1].x.toFixed(1)},${baseY.toFixed(1)} L${pts[0].x.toFixed(1)},${baseY.toFixed(1)} Z` : ''
    return {
      label: s.label, color: s.color, length: (len || 1).toFixed(1),
      gradId: `sgrad_${si}_${Math.random().toString(36).slice(2, 7)}`,
      path: linePath, areaPath,
      points: pts.map((p: any) => ({
        cx: p.x.toFixed(1), cy: p.y.toFixed(1),
        foX: (p.x - 25).toFixed(1), foY: (p.y - 25).toFixed(1),
        valueLabel: fmtNum(p.rawY), tooltip: `${s.label} — ${p.rawX} threads: ${fmtNum(p.rawY)} MiB/s`,
      })),
    }
  })
  const ticks = 4, gridLines: any[] = []
  for (let i = 0; i <= ticks; i++) {
    const v = yMax * i / ticks, gy = yScale(v)
    gridLines.push({ y: gy.toFixed(1), foY: (gy - 7).toFixed(1), label: fmtNum(v) })
  }
  const xTicksSet = [...new Set(xs)].sort((a, b) => a - b)
  const xLabels = xTicksSet.map(x => { const gx = xScale(x); return { x: gx.toFixed(1), foX: (gx - 25).toFixed(1), label: String(x) } })
  return { width, height, plotLeft: padL, series, gridLines, xLabels, plotBottom: height - padB, xLabelTop: (height - padB + 8).toFixed(1) }
}

// Wraps buildLineChart with an optional SLA target line and a floating
// "peak values at max concurrency" tooltip, matching the redesign's line panels.
export function buildSlaLineChart(seriesRaw: any[], opts: any = {}) {
  const base = buildLineChart(seriesRaw, opts)
  if (!base) return null
  const { width, height } = base
  const padB = 32, baseY = height - padB
  const allY = seriesRaw.flatMap((s: any) => s.points.map((p: any) => p.y))
  const yMax = (Math.max(...allY) * 1.1) || 1
  const yScale = (y: number) => baseY - (y / yMax) * (height - 16 - padB)
  let sla: any = null
  if (opts.slaValue != null) {
    const y = yScale(opts.slaValue)
    sla = { y: y.toFixed(1), ty: (y - 6).toFixed(1), label: opts.slaLabel || `SLA ${fmtNum(opts.slaValue)}` }
  }
  const maxX = Math.max(...seriesRaw.flatMap((s: any) => s.points.map((p: any) => p.x)))
  const tooltipRows = base.series.map((s: any, i: number) => {
    const raw = seriesRaw[i]
    const pt = raw.points.find((p: any) => p.x === maxX) || raw.points[raw.points.length - 1]
    return { color: s.color, label: s.label, value: fmtNum(pt?.y) }
  })
  const tooltip = { title: `At ${maxX} threads`, rows: tooltipRows, left: `${((base.plotLeft / width) * 100).toFixed(1)}%` }
  return { ...base, sla, tooltip, plotRight: width - 16 }
}

// Config × object-size heatmap (e.g. peak throughput per configuration per object size).
export function buildHeatmap(rowLabels: string[], colLabels: string[], matrix: number[][]) {
  const flat = matrix.flat().filter((v) => v != null && !isNaN(v))
  if (!flat.length) return null
  const min = Math.min(...flat), max = Math.max(...flat)
  const span = max - min || 1
  const rows = rowLabels.map((label, ri) => ({
    label,
    cells: colLabels.map((_, ci) => {
      const v = matrix[ri]?.[ci]
      if (v == null || isNaN(v)) return { text: '—', bg: 'var(--surface-2)', fg: 'var(--muted)', border: 'var(--border)' }
      const t = (v - min) / span
      const pct = Math.round(t * 100)
      return {
        text: fmtNum(v),
        bg: `color-mix(in oklab, var(--red) ${pct}%, oklch(0.97 0.014 28))`,
        fg: t > 0.52 ? '#fff' : 'var(--text)',
        border: t > 0.55 ? 'transparent' : 'var(--border)',
      }
    }),
  }))
  return { cols: `140px repeat(${colLabels.length}, 1fr)`, colLabels, rows, lowLabel: fmtNum(min), highLabel: fmtNum(max) }
}

// Stacked min→avg→max "CPU envelope" bar chart.
export function buildStackedBarChart(bars: { label: string; min: number; avg: number; max: number; color: string }[]) {
  if (!bars.length) return null
  const width = 620, height = 230, padL = 44, padR = 16, padT = 26, padB = 56
  const overallMax = Math.max(...bars.map((b) => b.max), 0) * 1.15 || 1
  const plotW = width - padL - padR, plotH = height - padT - padB
  const gap = plotW / bars.length, bw = gap * 0.5
  const soft = (c: string, a: number) => c.replace(/\)$/, ` / ${a})`)
  const groups = bars.map((b, i) => {
    const x = padL + gap * i + (gap - bw) / 2, cx = x + bw / 2
    const yFor = (v: number) => height - padB - (v / overallMax) * plotH
    const yMin = yFor(b.min), yAvg = yFor(b.avg), yMax = yFor(b.max)
    const segments = [
      { y: yMin.toFixed(1), height: (height - padB - yMin).toFixed(1), fill: soft(b.color, 0.35), rx: 6 },
      { y: yAvg.toFixed(1), height: (yMin - yAvg).toFixed(1), fill: soft(b.color, 0.65), rx: 3 },
      { y: yMax.toFixed(1), height: (yAvg - yMax).toFixed(1), fill: b.color, rx: 3 },
    ]
    return { x: x.toFixed(1), width: bw.toFixed(1), cx: cx.toFixed(1), segments, valueY: (yMax - 10).toFixed(1), valueLabel: fmtNum(b.max), label: b.label }
  })
  const ticks = 4, gridLines: any[] = []
  for (let i = 0; i <= ticks; i++) {
    const v = overallMax * i / ticks, gy = height - padB - (v / overallMax) * plotH
    gridLines.push({ y: gy.toFixed(1), ty: (gy - 4).toFixed(1), label: fmtNum(v) })
  }
  return { viewBox: `0 0 ${width} ${height}`, width, height, plotLeft: padL, plotRight: width - padR, labelX: padL - 6, catY: height - padB + 18, gridLines, groups, legend: [{ label: 'Min', fill: 'rgba(0,0,0,.2)' }, { label: 'Avg', fill: 'rgba(0,0,0,.45)' }, { label: 'Max', fill: 'rgba(0,0,0,.85)' }] }
}

// Ranked horizontal bars with an optional shared SLA tick mark.
export function buildRankedBars(bars: { label: string; value: number; meta?: string; unit?: string; color: string }[], opts: { sla?: number; sortDir?: 1 | -1 } = {}) {
  if (!bars.length) return null
  const sortDir = opts.sortDir ?? -1
  const sorted = [...bars].sort((a, b) => (a.value - b.value) * sortDir)
  const max = Math.max(...sorted.map((b) => b.value), 0) * 1.1 || 1
  const soft = (c: string, a: number) => c.replace(/\)$/, ` / ${a})`)
  const rows = sorted.map((b, i) => ({
    label: b.label, meta: b.meta || '', unit: b.unit || '',
    value: fmtNum(b.value), pct: `${Math.min(100, (b.value / max) * 100).toFixed(1)}%`,
    fill: i === 0 ? b.color : soft(b.color, 0.45),
  }))
  const slaPct = opts.sla != null ? `${Math.min(100, (opts.sla / max) * 100).toFixed(1)}%` : null
  return { rows, slaPct }
}

// Paired before/after bars sharing one scale per pair (e.g. cached vs initial reads).
export function buildPairedBars(pairs: { label: string; lift?: string; note?: string; bars: { label: string; value: number; unit?: string; color: string }[] }[]) {
  return pairs.map((pr) => {
    const max = Math.max(...pr.bars.map((b) => b.value), 0) * 1.1 || 1
    return {
      label: pr.label, lift: pr.lift, note: pr.note,
      bars: pr.bars.map((b) => ({ label: b.label, value: fmtNum(b.value), unit: b.unit || '', pct: `${Math.min(100, (b.value / max) * 100).toFixed(1)}%`, fill: b.color })),
    }
  })
}

