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

export function buildBarChart(bars: any[], opts: any = {}) {
  if (!bars.length) return null
  const width = opts.width || 620, height = opts.height || 230
  const padL = 44, padR = 16, padT = 26, padB = 56
  const max = Math.max(...bars.map((b: any) => b.value), 0) * 1.15 || 1
  const plotW = width - padL - padR, plotH = height - padT - padB
  const gap = plotW / bars.length, bw = gap * 0.6
  const items = bars.map((b: any, i: number) => {
    const h = (b.value / max) * plotH, x = padL + gap * i + (gap - bw) / 2, y = height - padB - h, cx = x + bw / 2
    return {
      x: x.toFixed(1), y: y.toFixed(1), width: bw.toFixed(1), height: h.toFixed(1),
      foX: (cx - 30).toFixed(1), foY: (y - 24).toFixed(1), catFoX: (cx - 40).toFixed(1),
      color: b.color, label: b.label, valueLabel: fmtNum(b.value), tooltip: `${b.label}: ${fmtNum(b.value)}`,
    }
  })
  const ticks = 4, gridLines: any[] = []
  for (let i = 0; i <= ticks; i++) {
    const v = max * i / ticks, gy = height - padB - (v / max) * plotH
    gridLines.push({ y: gy.toFixed(1), foY: (gy - 7).toFixed(1), label: fmtNum(v) })
  }
  return { width, height, items, gridLines, plotBottom: height - padB, categoryTop: (height - padB + 6).toFixed(1) }
}

export function buildHBarChart(bars: any[]) {
  if (!bars.length) return null
  const width = 620, rowH = 42, padTop = 8, labelW = 130, trackRightPad = 70
  const height = padTop * 2 + bars.length * rowH
  const max = Math.max(...bars.map((b: any) => b.value), 0) * 1.12 || 1
  const trackWidth = width - labelW - trackRightPad
  const rows = bars.map((b: any, i: number) => {
    const y = padTop + i * rowH + rowH * 0.22, barHeight = rowH * 0.56, w = (b.value / max) * trackWidth
    return {
      label: b.label, y: y.toFixed(1), barHeight: barHeight.toFixed(1),
      trackX: labelW, trackWidth: trackWidth.toFixed(1),
      width: Math.max(w, 3).toFixed(1), color: b.color, labelBoxW: (labelW - 10).toFixed(1),
      valueX: (labelW + w + 10).toFixed(1), valueLabel: fmtNum(b.value), tooltip: `${b.label}: ${fmtNum(b.value)}`,
    }
  })
  return { width, height, rows }
}
