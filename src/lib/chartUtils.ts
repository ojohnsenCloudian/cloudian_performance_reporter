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

// ── New chart types from redesign ──────────────────────────────────────────

// Flow chart: axis-free curves with horizontal gradient stroke and end-of-line
// pill labels. Replaces SlaLineChart in the main dashboard.
export function buildFlowChart(seriesRaw: any[], opts: any = {}) {
  const width = 1040, height = 320, padL = 54, padR = 200, padT = 30, padB = 50
  const all = seriesRaw.flatMap((s: any) => s.points)
  if (!all.length) return null
  const xs = all.map((p: any) => p.x), ys = all.map((p: any) => p.y)
  const xMin = Math.min(...xs), xMax = Math.max(...xs)
  const yMax = Math.max(...ys) * 1.1 || 1
  const baseY = height - padB
  const plotW = width - padL - padR
  const xS = (x: number) => xMax === xMin ? padL + plotW / 2 : padL + (x - xMin) / (xMax - xMin) * plotW
  const yS = (y: number) => baseY - (y / yMax) * (height - padT - padB)
  const xTicksSet = [...new Set(xs)].sort((a, b) => a - b)
  const xTicks = xTicksSet.map(x => ({ x: xS(x).toFixed(1), label: String(x) }))
  const yTicks: any[] = []
  for (let i = 1; i <= 4; i++) { const v = yMax * i / 4; yTicks.push({ ty: (yS(v) + 4).toFixed(1), label: fmtNum(v) }) }
  const slots: number[] = []
  const series = seriesRaw.map((s: any, si: number) => {
    const pts = s.points.map((p: any) => ({ x: xS(p.x), y: yS(p.y) }))
    const path = pts.map((p: any, i: number) => `${i ? 'L' : 'M'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
    const last = pts[pts.length - 1]
    const peak = Math.max(...s.points.map((p: any) => p.y))
    const pillLabel = `${s.label}  ${fmtNum(peak)}`
    let py = last.y - 12
    while (slots.some(v => Math.abs(v - py) < 26)) py += 26
    slots.push(py)
    const pw = pillLabel.length * 6.2 + 22
    const gradId = `fg_${si}_${Math.random().toString(36).slice(2, 7)}`
    const softColor = (c: string) => c.replace(/\)$/, ' / .13)')
    return {
      label: s.label, color: s.color, gradId, gradStroke: `url(#${gradId})`, path,
      endX: last.x.toFixed(1), endY: last.y.toFixed(1),
      pillX: (last.x + 16).toFixed(1), pillY: py.toFixed(1), pillW: pw.toFixed(1),
      pillFill: softColor(s.color),
      pillTextX: (last.x + 27).toFixed(1), pillTextY: (py + 16).toFixed(1),
      pillLabel,
    }
  })
  const plotLeft = padL, plotRight = width - padR
  let sla: any = null
  if (opts.slaValue != null) {
    const y = yS(opts.slaValue)
    sla = {
      y: y.toFixed(1), bandY: padT.toFixed(1), bandH: Math.max(y - padT, 0).toFixed(1),
      plotWidth: plotW.toFixed(1),
      chipY: (y - 27).toFixed(1), chipTextX: (padL + 13).toFixed(1), chipTextY: (y - 13).toFixed(1),
      label: opts.slaLabel || `SLA ${fmtNum(opts.slaValue)}`,
    }
  }
  return {
    viewBox: `0 0 ${width} ${height}`, width, height,
    plotLeft, plotRight, baseY: baseY.toFixed(1), plotTop: padT,
    labelX: padL - 14, tickTextY: (baseY + 18).toFixed(1),
    axisX: ((padL + plotRight) / 2).toFixed(1), axisY: (baseY + 38).toFixed(1),
    axisLabel: opts.axisLabel || 'CONCURRENT THREADS',
    series, yTicks, xTicks, sla,
  }
}

// Dot plot: a horizontal track per row with a colored dot at the value position.
// Used for latency ranking (replaces ranked horizontal bars).
export function buildDotPlot(
  rows: { label: string; meta?: string; raw: number; unit?: string; color: string }[],
  opts: { sla?: number; slaLabel?: string; sortDir?: 1 | -1 } = {}
) {
  if (!rows.length) return null
  const sortDir = opts.sortDir ?? 1
  const sorted = [...rows].sort((a, b) => (a.raw - b.raw) * sortDir)
  const labelX = 210, trackX = 250, trackEnd = 980, rowH = 58
  const height = sorted.length * rowH + 20
  const max = Math.max(...sorted.map(r => r.raw)) * 1.12 || 1
  const xS = (v: number) => trackX + (v / max) * (trackEnd - trackX)
  let sla: any = null
  if (opts.sla != null) {
    const sx = xS(opts.sla)
    sla = {
      x: sx.toFixed(1), width: (trackEnd - sx + 14).toFixed(1),
      height: (height - 16).toFixed(1), lineBottom: (height - 18).toFixed(1),
      textX: (sx + 10).toFixed(1), textY: '12',
      label: opts.slaLabel || `SLA ${fmtNum(opts.sla)}`,
    }
  }
  return {
    viewBox: `0 0 1000 ${height}`,
    labelX, trackX, trackEnd, sla,
    rows: sorted.map((r, i) => {
      const cy = 22 + i * rowH, cx = xS(r.raw), valueStr = fmtNum(r.raw)
      return {
        label: r.label, meta: r.meta || '', color: r.color,
        cy: cy.toFixed(1), labelY: (cy - 2).toFixed(1), metaY: (cy + 13).toFixed(1),
        cx: cx.toFixed(1), value: valueStr, unit: r.unit || '',
        valueX: (trackEnd + 28).toFixed(1), valueY: (cy + 6).toFixed(1),
        unitX: (trackEnd + 28 + valueStr.length * 11 + 6).toFixed(1),
      }
    }),
  }
}

// Range plot: horizontal min→avg→max capsule per config. Replaces stacked CPU bars.
export function buildRangePlot(
  rows: { label: string; min: number; avg: number; max: number; color: string }[]
) {
  if (!rows.length) return null
  const labelX = 210, trackX = 250, trackEnd = 980, rowH = 62
  const height = rows.length * rowH + 34
  const max = Math.max(...rows.map(r => r.max)) * 1.18 || 1
  const xS = (v: number) => trackX + (v / max) * (trackEnd - trackX)
  const soft = (c: string, a: number) => c.replace(/\)$/, ` / ${a})`)
  const ticks = [0, 0.25, 0.5, 0.75, 1].map(f => ({
    x: xS(max * f).toFixed(1), label: (max * f).toFixed(0) + '%',
  }))
  return {
    viewBox: `0 0 1000 ${height}`, labelX, trackX, trackEnd,
    gridBottom: (height - 24).toFixed(1), tickTextY: (height - 6).toFixed(1), ticks,
    rows: rows.map((r, i) => {
      const cy = 26 + i * rowH, x1 = xS(r.min), x2 = xS(r.max)
      return {
        label: r.label, color: r.color, cy: cy.toFixed(1), labelY: (cy + 5).toFixed(1),
        capX: x1.toFixed(1), capY: (cy - 8).toFixed(1),
        capW: Math.max(x2 - x1, 16).toFixed(1), capFill: soft(r.color, 0.3),
        avgX: xS(r.avg).toFixed(1), textY: (cy + 5).toFixed(1),
        minTextX: (x1 - 14).toFixed(1), minLabel: r.min.toFixed(1) + '%',
        maxTextX: (x2 + 16).toFixed(1), maxLabel: r.max.toFixed(1) + '%',
      }
    }),
    legend: [
      { label: 'Observed min → max range', fill: soft('oklch(0.55 0.2 26)', 0.3), w: '34px', h: '12px' },
      { label: 'Average CPU at peak load', fill: 'oklch(0.55 0.2 26)', w: '12px', h: '12px' },
    ],
  }
}

// Slope chart: two-column before/after with diagonal connecting lines.
// Used for cached reads (replaces paired bars).
export function buildSlopeChart(
  pairs: { label: string; init: number; cached: number; il?: number; cl?: number; color: string }[]
) {
  if (!pairs.length) return null
  const width = 1040, height = 320, x1 = 320, x2 = 780, top = 54, bottom = 280
  const max = Math.max(...pairs.flatMap(p => [p.init, p.cached])) * 1.12 || 1
  const yS = (v: number) => bottom - (v / max) * (bottom - top)
  const slots1: number[] = [], slots2: number[] = []
  return {
    viewBox: `0 0 ${width} ${height}`, top, bottom, headY: '24',
    cols: [{ x: x1, label: 'Initial read' }, { x: x2, label: 'Cached read' }],
    lines: pairs.map((p, i) => {
      const y1 = yS(p.init), y2 = yS(p.cached)
      let py1 = y1; while (slots1.some(v => Math.abs(v - py1) < 24)) py1 += 24; slots1.push(py1)
      let py2 = y2; while (slots2.some(v => Math.abs(v - py2) < 24)) py2 += 24; slots2.push(py2)
      const lift = p.init > 0 ? `×${(p.cached / p.init).toFixed(1)} faster` : ''
      return {
        color: p.color, path: `M${x1},${y1.toFixed(1)} L${x2},${y2.toFixed(1)}`,
        x1, y1: y1.toFixed(1), x2, y2: y2.toFixed(1),
        value1: `${fmtNum(p.init)} MiB/s`, label1X: (x1 - 18).toFixed(1), label1Y: (py1 + 5).toFixed(1),
        value2: `${fmtNum(p.cached)} MiB/s`, label2X: (x2 + 20).toFixed(1), label2Y: (py2 + 6).toFixed(1),
        name: p.label, nameX: (x2 + 20).toFixed(1), nameY: (py2 + 24).toFixed(1),
        lift, chipFill: p.color,
        chipX: ((x1 + x2) / 2 - 43).toFixed(1), chipY: ((y1 + y2) / 2 - 26).toFixed(1),
        chipTextX: ((x1 + x2) / 2).toFixed(1), chipTextY: ((y1 + y2) / 2 - 12).toFixed(1),
      }
    }),
    notes: pairs.map((p) => ({
      color: p.color,
      text: p.il != null && p.cl != null
        ? `${p.label} · latency ${fmtNum(p.il)} → ${fmtNum(p.cl)} ms (−${Math.round((1 - p.cl / p.il) * 100)}% faster)`
        : p.label,
    })),
  }
}

// Sweep plot: throughput (+ optional scaled latency) vs discrete object sizes.
// Used for MPU part-size sweep.
export function buildSweepPlot(
  data: { label: string; tp: number; lat?: number | null }[],
  opts: { highlightIdx?: number } = {}
) {
  if (data.length < 2) return null
  const width = 1040, height = 300, padL = 54, padR = 40, padT = 40, padB = 50
  const plotLeft = padL, plotRight = width - padR
  const plotW = plotRight - plotLeft
  const baseY = height - padB
  const maxTp = Math.max(...data.map(d => d.tp)) * 1.15 || 1
  const xS = (i: number) => plotLeft + (i / (data.length - 1)) * plotW
  const yS = (y: number) => baseY - (y / maxTp) * (height - padT - padB)
  const bestIdx = opts.highlightIdx ?? data.reduce((bi, d, i) => d.tp > data[bi].tp ? i : bi, 0)
  const tpPoints = data.map((d, i) => ({ x: xS(i), y: yS(d.tp) }))
  const tpPath = tpPoints.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
  const areaPath = `${tpPath} L${tpPoints[tpPoints.length - 1].x.toFixed(1)},${baseY.toFixed(1)} L${tpPoints[0].x.toFixed(1)},${baseY.toFixed(1)} Z`
  const hasLat = data.some(d => d.lat != null)
  let latPath: string | null = null
  if (hasLat) {
    const maxLat = Math.max(...data.map(d => d.lat || 0))
    const latScale = maxLat > 0 ? maxTp * 0.7 / maxLat : 1
    const latPts = data.map((d, i) => ({ x: xS(i), y: yS((d.lat || 0) * latScale) }))
    latPath = latPts.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
  }
  const recX = xS(bestIdx), recW = plotW / data.length * 0.88
  const gradId = `sweep_${Math.random().toString(36).slice(2, 7)}`
  const xTicks = data.map((d, i) => ({ x: xS(i).toFixed(1), label: d.label }))
  return {
    viewBox: `0 0 ${width} ${height}`, width, height,
    plotLeft, plotRight: plotRight.toFixed(1), plotTop: padT, baseY: baseY.toFixed(1),
    plotHeight: (height - padT - padB).toFixed(1),
    gradId, areaFill: `url(#${gradId})`,
    tpPath, latPath, areaPath,
    recX: (recX - recW / 2).toFixed(1), recW: recW.toFixed(1),
    recTextX: recX.toFixed(1), recTextY: (padT - 12).toFixed(1),
    xTicks, tickTextY: (baseY + 18).toFixed(1),
    pts: data.map((d, i) => ({
      x: xS(i).toFixed(1),
      tpY: tpPoints[i].y.toFixed(1), tpTextY: (tpPoints[i].y - 14).toFixed(1),
      tpLabel: fmtNum(d.tp), r: i === bestIdx ? '7' : '4.5',
    })),
    legend: [
      { label: 'Throughput (MiB/s)', fill: 'oklch(0.55 0.2 26)' },
      ...(hasLat ? [{ label: 'Latency (scaled)', fill: 'oklch(0.55 0.13 240)' }] : []),
    ],
    note: `Recommended: ${data[bestIdx]?.label || '?'}`,
  }
}

