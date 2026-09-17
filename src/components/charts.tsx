// Presentational chart / table components for the redesigned dashboard.
// All geometry (paths, positions, scales) is computed in lib/chartUtils.ts and
// lib/dataUtils.ts — these components only render the numbers they're given.
import { Fragment } from 'react'

const soft = (c: string, a: number) => (typeof c === 'string' && c.startsWith('oklch') ? c.replace(/\)$/, ` / ${a})`) : c)

// ── ZoomIcon (also used outside charts.tsx) ─────────────────────────────────
export const ZoomIcon = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="10" cy="10" r="7" /><path d="M21 21l-4.35-4.35" strokeLinecap="round" /><path d="M10 7v6M7 10h6" strokeLinecap="round" /></svg>

// ── LineChart ──────────────────────────────────────────────────────────────
export function LineChart({ chart, zoom = false }: any) {
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
          <line x1={chart.plotLeft} x2={chart.width} y1={gl.y} y2={gl.y} stroke="var(--border)" strokeWidth="1" strokeDasharray="2 5" />
          <foreignObject x="2" y={gl.foY} width="40" height="14" style={{ overflow: 'visible' }}>
            <div className="m" style={{ fontSize: zoom ? '11px' : '10px', color: 'var(--muted)' }}>{gl.label}</div>
          </foreignObject>
        </g>
      ))}
      {chart.series.map((s: any) => (
        <g key={s.gradId}>
          <path className="chart-area" d={s.areaPath} fill={`url(#${s.gradId})`} stroke="none" />
          <path className="chart-line" d={s.path} fill="none" stroke={s.color} strokeWidth={zoom ? '2.5' : '2.25'} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={s.dash ? '5 4' : undefined} style={{ strokeDasharray: s.dash ? undefined : s.length, strokeDashoffset: s.dash ? undefined : s.length }} />
          {s.points.map((p: any, pi: number) => (
            <g key={pi}>
              <circle className="chart-point" cx={p.cx} cy={p.cy} r="3" fill="var(--surface)" stroke={s.color} strokeWidth="2"><title>{p.tooltip}</title></circle>
              <foreignObject x={p.foX} y={p.foY} width="50" height="14" style={{ overflow: 'visible' }}>
                <div className="m tn" style={{ fontSize: zoom ? '11px' : '9.5px', fontWeight: 600, textAlign: 'center', color: s.color }}>{p.valueLabel}</div>
              </foreignObject>
            </g>
          ))}
        </g>
      ))}
      {chart.xLabels.map((xl: any, i: number) => (
        <foreignObject key={i} x={xl.foX} y={chart.xLabelTop} width="50" height="14" style={{ overflow: 'visible' }}>
          <div className="m" style={{ fontSize: zoom ? '11px' : '10px', textAlign: 'center', color: 'var(--muted)' }}>{xl.label}</div>
        </foreignObject>
      ))}
    </svg>
  )
}

// ── SlaLineChart: LineChart + optional SLA target line + peak-values tooltip ─
export function SlaLineChart({ chart, zoom = false }: any) {
  if (!chart) return null
  return (
    <div style={{ position: 'relative' }}>
      <svg viewBox={`0 0 ${chart.width} ${chart.height}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
        <defs>
          {chart.series.map((s: any) => (
            <linearGradient key={s.gradId} id={s.gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={s.color} stopOpacity="0.2" /><stop offset="100%" stopColor={s.color} stopOpacity="0" />
            </linearGradient>
          ))}
        </defs>
        {chart.gridLines.map((gl: any, i: number) => (
          <g key={i}>
            <line x1={chart.plotLeft} x2={chart.plotRight || chart.width} y1={gl.y} y2={gl.y} stroke="var(--border)" strokeWidth="1" strokeDasharray="2 5" />
            <foreignObject x="2" y={gl.foY} width="40" height="14" style={{ overflow: 'visible' }}>
              <div className="m" style={{ fontSize: zoom ? '11px' : '10px', color: 'var(--muted)' }}>{gl.label}</div>
            </foreignObject>
          </g>
        ))}
        {chart.sla && (
          <g>
            <line x1={chart.plotLeft} x2={chart.plotRight || chart.width} y1={chart.sla.y} y2={chart.sla.y} stroke="var(--primary)" strokeWidth="1.5" strokeDasharray="8 5" />
            <text x={(chart.plotRight || chart.width) - 4} y={chart.sla.ty} textAnchor="end" className="m" style={{ fontSize: '10px', fontWeight: 500, fill: 'var(--primary)' }}>{chart.sla.label}</text>
          </g>
        )}
        {chart.series.map((s: any) => (
          <g key={s.gradId}>
            <path className="chart-area" d={s.areaPath} fill={`url(#${s.gradId})`} stroke="none" />
            <path className="chart-line" d={s.path} fill="none" stroke={s.color} strokeWidth={zoom ? '2.8' : '2.5'} strokeLinecap="round" strokeLinejoin="round" style={{ strokeDasharray: s.length, strokeDashoffset: s.length }} />
            {s.points.map((p: any, pi: number) => <circle key={pi} className="chart-point" cx={p.cx} cy={p.cy} r="3.4" fill="var(--surface)" stroke={s.color} strokeWidth="2.2"><title>{p.tooltip}</title></circle>)}
            <text x={s.points[s.points.length - 1]?.cx} y={s.points[s.points.length - 1]?.cy} dx="8" dy="-6" className="m tn" style={{ fontSize: '11px', fontWeight: 500, fill: s.color }}>{s.points[s.points.length - 1]?.valueLabel}</text>
          </g>
        ))}
        {chart.xLabels.map((xl: any, i: number) => (
          <foreignObject key={i} x={xl.foX} y={chart.xLabelTop} width="50" height="14" style={{ overflow: 'visible' }}>
            <div className="m" style={{ fontSize: zoom ? '11px' : '10px', textAlign: 'center', color: 'var(--muted)' }}>{xl.label}</div>
          </foreignObject>
        ))}
      </svg>
      {chart.tooltip && (
        <div className="glass-tooltip" style={{ position: 'absolute', top: '14px', left: chart.tooltip.left, padding: '12px 14px', borderRadius: '13px' }}>
          <div className="m" style={{ fontSize: '9.5px', letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '9px' }}>{chart.tooltip.title}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {chart.tooltip.rows.map((r: any, i: number) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '2px', flexShrink: 0, background: r.color, display: 'inline-block' }} />
                <span style={{ flex: 1, fontSize: '12px', color: 'var(--text)', whiteSpace: 'nowrap' }}>{r.label}</span>
                <span className="m tn" style={{ fontSize: '12px', fontWeight: 500 }}>{r.value}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Legend ─────────────────────────────────────────────────────────────────
export function Legend({ series }: any) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '14px', marginTop: '12px', paddingTop: '12px', borderTop: '1px solid var(--border)' }}>
      {series.map((s: any, i: number) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12.5px', color: 'var(--muted)' }}>
          <span style={{ width: s.dash ? '18px' : '9px', height: s.dash ? '2.5px' : '9px', borderRadius: s.dash ? '2px' : '3px', background: s.color, display: 'inline-block' }} />{s.label}
        </div>
      ))}
    </div>
  )
}

// ── KpiCard ────────────────────────────────────────────────────────────────
export function KpiCard({ label, value, unit, delta, deltaGood, note, color, spark }: any) {
  return (
    <div className="glass" style={{ padding: '22px 24px', borderRadius: 'var(--radius-lg)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
        <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: color, display: 'inline-block' }} />
        <span className="m" style={{ fontSize: '9.5px', letterSpacing: '.11em', textTransform: 'uppercase', color: 'var(--muted)' }}>{label}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '7px' }}>
        <span className="d tn" style={{ fontSize: '36px', fontWeight: 600, letterSpacing: '-.03em', lineHeight: .95 }}>{value}</span>
        <span className="m" style={{ fontSize: '11.5px', color: 'var(--muted)' }}>{unit}</span>
      </div>
      {(delta || note) && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '12px 0 8px' }}>
          {delta && <span className="m" style={{ fontSize: '10.5px', fontWeight: 500, padding: '2px 7px', borderRadius: '5px', background: deltaGood ? 'var(--good-soft)' : 'var(--danger-soft)', color: deltaGood ? 'var(--good)' : 'var(--danger)' }}>{delta}</span>}
          {note && <span className="m" style={{ fontSize: '10px', color: 'var(--muted)' }}>{note}</span>}
        </div>
      )}
      {spark && (
        <svg viewBox="0 0 260 38" preserveAspectRatio="none" style={{ display: 'block', width: '100%', height: '38px' }}>
          <path d={spark.areaPath} fill={soft(color, 0.16)} />
          <path d={spark.path} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </div>
  )
}

// ── SmallMultiples ───────────────────────────────────────────────────────
export function SmallMultiples({ items }: { items: any[] }) {
  if (!items?.length) return null
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: '16px' }}>
      {items.map((it: any, i: number) => (
        <div key={i} style={{ padding: '16px', borderRadius: '15px', background: 'rgba(255,255,255,.55)', border: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '8px', marginBottom: '12px' }}>
            <span className="d" style={{ fontSize: '13px', fontWeight: 500, letterSpacing: '-.008em' }}>{it.title}</span>
            <span className="m tn" style={{ fontSize: '11px', fontWeight: 500, color: it.color }}>{it.peakLabel}</span>
          </div>
          <LineChart chart={it.chart} />
          <div style={{ display: 'flex', gap: '12px', marginTop: '11px' }}>
            {it.chart.series.map((s: any, si: number) => (
              <div key={si} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: '12px', height: '2.5px', borderRadius: '2px', background: s.color, display: 'inline-block', ...(s.dash ? { backgroundImage: `repeating-linear-gradient(90deg, ${s.color} 0 4px, transparent 4px 7px)`, background: 'none' } : {}) }} />
                <span className="m" style={{ fontSize: '9.5px', letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--muted)' }}>{s.label}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Heatmap ─────────────────────────────────────────────────────────────
export function Heatmap({ heat }: { heat: any }) {
  if (!heat) return null
  return (
    <div>
      <div style={{ display: 'grid', gap: '6px', gridTemplateColumns: heat.cols }}>
        <div></div>
        {heat.colLabels.map((x: string, i: number) => (
          <div key={i} className="m" style={{ fontSize: '10px', textAlign: 'center', color: 'var(--muted)', paddingBottom: '4px', letterSpacing: '.05em' }}>{x}</div>
        ))}
        {heat.rows.map((row: any, ri: number) => (
          <Fragment key={ri}>
            <div className="d" style={{ fontSize: '12.5px', fontWeight: 500, display: 'flex', alignItems: 'center' }}>{row.label}</div>
            {row.cells.map((cell: any, ci: number) => (
              <div key={ci} style={{ display: 'grid', placeItems: 'center', height: '52px', borderRadius: '11px', background: cell.bg, color: cell.fg, border: `1px solid ${cell.border}` }}>
                <span className="m tn" style={{ fontSize: '12px', letterSpacing: '.03em' }}>{cell.text}</span>
              </div>
            ))}
          </Fragment>
        ))}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '20px', paddingTop: '16px', borderTop: '1px solid var(--border)' }}>
        <span className="m" style={{ fontSize: '9.5px', letterSpacing: '.09em', textTransform: 'uppercase', color: 'var(--muted)' }}>{heat.lowLabel}</span>
        <div style={{ flex: 1, maxWidth: '260px', height: '8px', borderRadius: '4px', background: 'linear-gradient(90deg,oklch(0.97 0.014 28),var(--red))' }} />
        <span className="m" style={{ fontSize: '9.5px', letterSpacing: '.09em', textTransform: 'uppercase', color: 'var(--muted)' }}>{heat.highLabel}</span>
        {heat.note && <span className="m" style={{ fontSize: '10.5px', color: 'var(--muted)', marginLeft: 'auto' }}>{heat.note}</span>}
      </div>
    </div>
  )
}

// ── RankedBars ────────────────────────────────────────────────────────────
export function RankedBars({ data, footnote }: { data: any; footnote?: string }) {
  if (!data) return null
  return (
    <div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {data.rows.map((r: any, i: number) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '190px minmax(0,1fr) 108px', gap: '18px', alignItems: 'center' }}>
            <div style={{ minWidth: 0 }}>
              <div className="d" style={{ fontSize: '13.5px', fontWeight: 500, letterSpacing: '-.008em' }}>{r.label}</div>
              {r.meta && <div className="m" style={{ fontSize: '10px', color: 'var(--muted)', marginTop: '2px' }}>{r.meta}</div>}
            </div>
            <div style={{ position: 'relative', height: '30px', borderRadius: '9px', background: 'rgba(255,255,255,.62)', border: '1px solid var(--border)' }}>
              <div style={{ position: 'absolute', top: 0, bottom: 0, left: 0, borderRadius: '8px', width: r.pct, background: r.fill }} />
              {data.slaPct && <div style={{ position: 'absolute', top: '-5px', bottom: '-5px', width: '2px', background: 'var(--text)', opacity: .6, left: data.slaPct }} />}
            </div>
            <div style={{ textAlign: 'right' }}>
              <span className="d tn" style={{ fontSize: '19px', fontWeight: 600, letterSpacing: '-.02em' }}>{r.value}</span>
              <span className="m" style={{ fontSize: '10px', color: 'var(--muted)', marginLeft: '4px' }}>{r.unit}</span>
            </div>
          </div>
        ))}
      </div>
      {footnote && (
        <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '10px' }}>
          {data.slaPct && <span style={{ width: '2px', height: '14px', background: 'var(--text)', opacity: .6 }} />}
          <span className="m" style={{ fontSize: '10.5px', color: 'var(--muted)' }}>{footnote}</span>
        </div>
      )}
    </div>
  )
}

// ── StackedBars ───────────────────────────────────────────────────────────
export function StackedBars({ chart }: { chart: any }) {
  if (!chart) return null
  return (
    <div>
      <svg viewBox={chart.viewBox} style={{ display: 'block', width: '100%', height: 'auto' }}>
        {chart.gridLines.map((gl: any, i: number) => (
          <g key={i}>
            <line x1={chart.plotLeft} x2={chart.plotRight} y1={gl.y} y2={gl.y} stroke="var(--border)" strokeWidth="1" strokeDasharray="2 5" />
            <text x={chart.labelX} y={gl.ty} textAnchor="end" className="m" style={{ fontSize: '10px', fill: 'var(--muted)' }}>{gl.label}</text>
          </g>
        ))}
        {chart.groups.map((g: any, i: number) => (
          <g key={i}>
            {g.segments.map((seg: any, si: number) => <rect key={si} x={g.x} y={seg.y} width={g.width} height={seg.height} fill={seg.fill} rx={seg.rx} />)}
            <text x={g.cx} y={g.valueY} textAnchor="middle" className="m tn" style={{ fontSize: '11.5px', fontWeight: 500, fill: 'var(--text)' }}>{g.valueLabel}</text>
            <text x={g.cx} y={chart.catY} textAnchor="middle" className="m" style={{ fontSize: '10px', fill: 'var(--muted)' }}>{g.label}</text>
          </g>
        ))}
      </svg>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px', marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--border)' }}>
        {chart.legend.map((l: any, i: number) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ width: '12px', height: '12px', borderRadius: '3px', background: l.fill, display: 'inline-block' }} />
            <span style={{ fontSize: '12.5px', color: 'var(--muted)' }}>{l.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── PairedBars ────────────────────────────────────────────────────────────
export function PairedBars({ pairs }: { pairs: any[] }) {
  if (!pairs?.length) return null
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: '18px' }}>
      {pairs.map((pr: any, i: number) => (
        <div key={i} style={{ padding: '20px', borderRadius: '16px', background: 'rgba(255,255,255,.55)', border: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginBottom: '18px' }}>
            <span className="d" style={{ fontSize: '14px', fontWeight: 500, letterSpacing: '-.01em' }}>{pr.label}</span>
            {pr.lift && <span className="m" style={{ fontSize: '11.5px', fontWeight: 500, padding: '4px 9px', borderRadius: '7px', background: 'var(--primary-soft)', color: 'var(--primary)' }}>{pr.lift}</span>}
          </div>
          {pr.bars.map((b: any, bi: number) => (
            <div key={bi} style={{ marginBottom: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '6px' }}>
                <span className="m" style={{ fontSize: '9.5px', letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--muted)' }}>{b.label}</span>
                <span className="m tn" style={{ fontSize: '13px', fontWeight: 500 }}>{b.value} <span style={{ fontSize: '10px', color: 'var(--muted)' }}>{b.unit}</span></span>
              </div>
              <div style={{ height: '11px', borderRadius: '6px', background: 'rgba(255,255,255,.7)', border: '1px solid var(--border)', overflow: 'hidden' }}>
                <div style={{ height: '100%', borderRadius: '5px', width: b.pct, background: b.fill }} />
              </div>
            </div>
          ))}
          {pr.note && <div className="m" style={{ fontSize: '10.5px', color: 'var(--muted)', marginTop: '16px', paddingTop: '12px', borderTop: '1px solid var(--border)' }}>{pr.note}</div>}
        </div>
      ))}
    </div>
  )
}

// ── DiffTable (baseline vs current, colored delta) ────────────────────────
export function DiffTable({ rows, baselineName, currentName }: { rows: any[]; baselineName: string; currentName: string }) {
  if (!rows?.length) return null
  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.5fr) repeat(3,minmax(0,1fr))', gap: '16px', padding: '0 6px 12px', borderBottom: '1px solid var(--border)' }}>
        <span className="m" style={{ fontSize: '9.5px', letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--muted)' }}>Metric</span>
        <span className="m" style={{ fontSize: '9.5px', letterSpacing: '.1em', textTransform: 'uppercase', textAlign: 'right', color: 'var(--muted)' }}>{baselineName}</span>
        <span className="m" style={{ fontSize: '9.5px', letterSpacing: '.1em', textTransform: 'uppercase', textAlign: 'right', color: 'var(--text)' }}>{currentName}</span>
        <span className="m" style={{ fontSize: '9.5px', letterSpacing: '.1em', textTransform: 'uppercase', textAlign: 'right', color: 'var(--muted)' }}>Change</span>
      </div>
      {rows.map((dr: any, i: number) => (
        <div key={i} style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.5fr) repeat(3,minmax(0,1fr))', gap: '16px', alignItems: 'center', padding: '13px 6px', borderBottom: '1px solid var(--surface-2)' }}>
          <div>
            <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text)' }}>{dr.label}</div>
            {dr.unit && <div className="m" style={{ fontSize: '9.5px', color: 'var(--muted)', marginTop: '2px' }}>{dr.unit}</div>}
          </div>
          <span className="m tn" style={{ fontSize: '14px', textAlign: 'right', color: 'var(--muted)' }}>{dr.baseline != null ? dr.baseline.toLocaleString() : '—'}</span>
          <span className="d tn" style={{ fontSize: '16px', fontWeight: 600, textAlign: 'right', letterSpacing: '-.02em' }}>{dr.current != null ? dr.current.toLocaleString() : '—'}</span>
          <span className="m tn" style={{ fontSize: '13px', fontWeight: 500, textAlign: 'right', color: dr.good == null ? 'var(--muted)' : dr.good ? 'var(--good)' : 'var(--danger)' }}>{dr.delta}</span>
        </div>
      ))}
    </div>
  )
}

// ── FlowChart: gradient lines with end-of-line pill labels ───────────────────
export function FlowChart({ chart }: { chart: any }) {
  if (!chart) return null
  return (
    <svg viewBox={chart.viewBox} style={{ display: 'block', width: '100%', height: 'auto', overflow: 'visible' }}>
      <defs>
        {chart.series.map((s: any) => (
          <linearGradient key={s.gradId} id={s.gradId} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor={s.color} stopOpacity="0.25" />
            <stop offset="55%" stopColor={s.color} stopOpacity="0.85" />
            <stop offset="100%" stopColor={s.color} stopOpacity="1" />
          </linearGradient>
        ))}
      </defs>
      {chart.sla && (
        <g>
          <rect x={chart.plotLeft} y={chart.sla.bandY} width={chart.sla.plotWidth} height={chart.sla.bandH} fill="oklch(0.55 0.2 26 / .07)" />
          <line x1={chart.plotLeft} x2={chart.plotRight} y1={chart.sla.y} y2={chart.sla.y} stroke="oklch(0.55 0.2 26 / .55)" strokeWidth="1.5" strokeDasharray="1 6" strokeLinecap="round" />
          <rect x={chart.plotLeft} y={chart.sla.chipY} width="150" height="19" rx="9.5" fill="oklch(0.55 0.2 26)" />
          <text x={chart.sla.chipTextX} y={chart.sla.chipTextY} className="m" style={{ fontSize: '10px', fontWeight: 500, letterSpacing: '.06em', fill: '#fff' }}>{chart.sla.label}</text>
        </g>
      )}
      {chart.xTicks.map((t: any, i: number) => (
        <g key={i}>
          <line x1={t.x} x2={t.x} y1={chart.plotTop} y2={chart.baseY} stroke="var(--border)" strokeWidth="1" />
          <text x={t.x} y={chart.tickTextY} textAnchor="middle" className="m" style={{ fontSize: '11px', fill: 'var(--muted)' }}>{t.label}</text>
        </g>
      ))}
      {chart.yTicks.map((t: any, i: number) => (
        <text key={i} x={chart.labelX} y={t.ty} textAnchor="end" className="m" style={{ fontSize: '11px', fill: 'var(--muted)' }}>{t.label}</text>
      ))}
      <line x1={chart.plotLeft} x2={chart.plotRight} y1={chart.baseY} y2={chart.baseY} stroke="var(--border)" strokeWidth="1.5" />
      {chart.series.map((s: any) => (
        <g key={s.gradId}>
          <path d={s.path} fill="none" stroke={s.gradStroke} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx={s.endX} cy={s.endY} r="5" fill={s.color} />
          <rect x={s.pillX} y={s.pillY} width={s.pillW} height="24" rx="12" fill={s.pillFill} />
          <text x={s.pillTextX} y={s.pillTextY} className="m" style={{ fontSize: '11px', fontWeight: 500, fill: s.color }}>{s.pillLabel}</text>
        </g>
      ))}
      <text x={chart.axisX} y={chart.axisY} textAnchor="middle" className="m" style={{ fontSize: '9.5px', letterSpacing: '.14em', fill: 'var(--muted)' }}>{chart.axisLabel}</text>
    </svg>
  )
}

// ── DotPlot: horizontal dot-on-track, one row per config ──────────────────────
export function DotPlot({ data, footnote }: { data: any; footnote?: string }) {
  if (!data) return null
  return (
    <div>
      <svg viewBox={data.viewBox} style={{ display: 'block', width: '100%', height: 'auto', overflow: 'visible' }}>
        {data.sla && (
          <g>
            <rect x={data.sla.x} y="0" width={data.sla.width} height={data.sla.height} fill="oklch(0.55 0.2 26 / .06)" rx="8" />
            <line x1={data.sla.x} x2={data.sla.x} y1="6" y2={data.sla.lineBottom} stroke="oklch(0.55 0.2 26 / .7)" strokeWidth="1.5" strokeDasharray="4 4" />
            <text x={data.sla.textX} y={data.sla.textY} className="m" style={{ fontSize: '10px', fontWeight: 500, letterSpacing: '.06em', fill: 'oklch(0.5 0.19 26)' }}>{data.sla.label}</text>
          </g>
        )}
        {data.rows.map((r: any, i: number) => (
          <g key={i}>
            <text x={data.labelX} y={r.labelY} textAnchor="end" className="d" style={{ fontSize: '13.5px', fontWeight: 500, letterSpacing: '-.01em', fill: 'oklch(0.24 0.012 40)' }}>{r.label}</text>
            {r.meta && <text x={data.labelX} y={r.metaY} textAnchor="end" className="m" style={{ fontSize: '10px', fill: 'var(--muted)' }}>{r.meta}</text>}
            <line x1={data.trackX} x2={data.trackEnd} y1={r.cy} y2={r.cy} stroke="var(--border)" strokeWidth="2" strokeLinecap="round" />
            <line x1={data.trackX} x2={r.cx} y1={r.cy} y2={r.cy} stroke={r.color} strokeWidth="3" strokeLinecap="round" opacity="0.32" />
            <circle cx={r.cx} cy={r.cy} r="9" fill={r.color} />
            <circle cx={r.cx} cy={r.cy} r="3.2" fill="oklch(0.985 0.005 70)" />
            <text x={r.valueX} y={r.valueY} className="d" style={{ fontSize: '19px', fontWeight: 600, letterSpacing: '-.02em', fill: 'oklch(0.22 0.012 40)' }}>{r.value}</text>
            <text x={r.unitX} y={r.valueY} className="m" style={{ fontSize: '10px', fill: 'var(--muted)' }}>{r.unit}</text>
          </g>
        ))}
      </svg>
      {footnote && (
        <div style={{ marginTop: '18px', paddingTop: '14px', borderTop: '1px solid var(--border)' }}>
          <span className="m" style={{ fontSize: '10.5px', color: 'var(--muted)' }}>{footnote}</span>
        </div>
      )}
    </div>
  )
}

// ── RangePlot: horizontal min→avg→max capsule per config ──────────────────────
export function RangePlot({ data }: { data: any }) {
  if (!data) return null
  return (
    <div>
      <svg viewBox={data.viewBox} style={{ display: 'block', width: '100%', height: 'auto', overflow: 'visible' }}>
        {data.ticks.map((t: any, i: number) => (
          <g key={i}>
            <line x1={t.x} x2={t.x} y1="0" y2={data.gridBottom} stroke="var(--border)" strokeWidth="1" />
            <text x={t.x} y={data.tickTextY} textAnchor="middle" className="m" style={{ fontSize: '10.5px', fill: 'var(--muted)' }}>{t.label}</text>
          </g>
        ))}
        {data.rows.map((r: any, i: number) => (
          <g key={i}>
            <text x={data.labelX} y={r.labelY} textAnchor="end" className="d" style={{ fontSize: '13.5px', fontWeight: 500, letterSpacing: '-.01em', fill: 'oklch(0.24 0.012 40)' }}>{r.label}</text>
            <rect x={r.capX} y={r.capY} width={r.capW} height="16" rx="8" fill={r.capFill} />
            <circle cx={r.avgX} cy={r.cy} r="7.5" fill={r.color} />
            <circle cx={r.avgX} cy={r.cy} r="2.6" fill="oklch(0.985 0.005 70)" />
            <text x={r.minTextX} y={r.textY} textAnchor="end" className="m" style={{ fontSize: '10px', fill: 'var(--muted)' }}>{r.minLabel}</text>
            <text x={r.maxTextX} y={r.textY} className="d" style={{ fontSize: '15px', fontWeight: 600, letterSpacing: '-.02em', fill: 'oklch(0.22 0.012 40)' }}>{r.maxLabel}</text>
          </g>
        ))}
      </svg>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px', marginTop: '18px', paddingTop: '16px', borderTop: '1px solid var(--border)' }}>
        {data.legend.map((l: any, i: number) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ width: l.w, height: l.h, borderRadius: '99px', background: l.fill, display: 'inline-block' }} />
            <span style={{ fontSize: '12.5px', color: 'var(--muted)' }}>{l.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── SlopeChart: two-column before/after with connecting diagonal lines ─────────
export function SlopeChart({ data }: { data: any }) {
  if (!data) return null
  return (
    <div>
      <svg viewBox={data.viewBox} style={{ display: 'block', width: '100%', height: 'auto', overflow: 'visible' }}>
        {data.cols.map((c: any, i: number) => (
          <g key={i}>
            <line x1={c.x} x2={c.x} y1={data.top} y2={data.bottom} stroke="var(--border)" strokeWidth="1.5" />
            <text x={c.x} y={data.headY} textAnchor="middle" className="m" style={{ fontSize: '10px', letterSpacing: '.11em', textTransform: 'uppercase', fill: 'var(--muted)' }}>{c.label}</text>
          </g>
        ))}
        {data.lines.map((l: any, i: number) => (
          <g key={i}>
            <path d={l.path} fill="none" stroke={l.color} strokeWidth="3.5" strokeLinecap="round" />
            <circle cx={l.x1} cy={l.y1} r="7" fill="oklch(0.985 0.005 70)" stroke={l.color} strokeWidth="3" />
            <circle cx={l.x2} cy={l.y2} r="8.5" fill={l.color} />
            <text x={l.label1X} y={l.label1Y} textAnchor="end" className="m" style={{ fontSize: '12px', fill: 'var(--muted)' }}>{l.value1}</text>
            <text x={l.label2X} y={l.label2Y} className="d" style={{ fontSize: '18px', fontWeight: 600, letterSpacing: '-.02em', fill: l.color }}>{l.value2}</text>
            <text x={l.nameX} y={l.nameY} className="m" style={{ fontSize: '11px', fill: 'var(--muted)' }}>{l.name}</text>
            {l.lift && (
              <>
                <rect x={l.chipX} y={l.chipY} width="86" height="20" rx="10" fill={l.chipFill} />
                <text x={l.chipTextX} y={l.chipTextY} textAnchor="middle" className="m" style={{ fontSize: '10.5px', fontWeight: 500, fill: '#fff' }}>{l.lift}</text>
              </>
            )}
          </g>
        ))}
      </svg>
      {data.notes.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: '14px', marginTop: '20px', paddingTop: '16px', borderTop: '1px solid var(--border)' }}>
          {data.notes.map((n: any, i: number) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', flexShrink: 0, background: n.color, display: 'inline-block' }} />
              <span className="m" style={{ fontSize: '10.5px', color: 'var(--muted)' }}>{n.text}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── SweepPlot: throughput + latency vs discrete sizes (MPU sweep) ──────────────
export function SweepPlot({ data }: { data: any }) {
  if (!data) return null
  return (
    <div>
      <svg viewBox={data.viewBox} style={{ display: 'block', width: '100%', height: 'auto', overflow: 'visible' }}>
        <defs>
          <linearGradient id={data.gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="oklch(0.55 0.2 26)" stopOpacity="0.22" />
            <stop offset="100%" stopColor="oklch(0.55 0.2 26)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <rect x={data.recX} y={data.plotTop} width={data.recW} height={data.plotHeight} fill="oklch(0.55 0.2 26 / .07)" rx="10" />
        <text x={data.recTextX} y={data.recTextY} textAnchor="middle" className="m" style={{ fontSize: '10px', fontWeight: 500, letterSpacing: '.08em', fill: 'oklch(0.5 0.19 26)' }}>RECOMMENDED</text>
        {data.xTicks.map((t: any, i: number) => (
          <g key={i}>
            <line x1={t.x} x2={t.x} y1={data.plotTop} y2={data.baseY} stroke="var(--border)" strokeWidth="1" />
            <text x={t.x} y={data.tickTextY} textAnchor="middle" className="m" style={{ fontSize: '11px', fill: 'var(--muted)' }}>{t.label}</text>
          </g>
        ))}
        <line x1={data.plotLeft} x2={data.plotRight} y1={data.baseY} y2={data.baseY} stroke="var(--border)" strokeWidth="1.5" />
        <path d={data.areaPath} fill={data.areaFill} />
        <path d={data.tpPath} fill="none" stroke="oklch(0.55 0.2 26)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
        {data.latPath && <path d={data.latPath} fill="none" stroke="oklch(0.55 0.13 240)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="7 5" />}
        {data.pts.map((pt: any, i: number) => (
          <g key={i}>
            <circle cx={pt.x} cy={pt.tpY} r={pt.r} fill="oklch(0.55 0.2 26)" />
            <text x={pt.x} y={pt.tpTextY} textAnchor="middle" className="d" style={{ fontSize: '13px', fontWeight: 600, letterSpacing: '-.02em', fill: 'oklch(0.22 0.012 40)' }}>{pt.tpLabel}</text>
          </g>
        ))}
      </svg>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px', marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--border)' }}>
        {data.legend.map((l: any, i: number) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ width: '18px', height: '3.5px', borderRadius: '2px', background: l.fill, display: 'inline-block' }} />
            <span style={{ fontSize: '12.5px', color: 'var(--muted)' }}>{l.label}</span>
          </div>
        ))}
        {data.note && <span className="m" style={{ fontSize: '10.5px', color: 'var(--muted)', marginLeft: 'auto' }}>{data.note}</span>}
      </div>
    </div>
  )
}

// ── DataTable (raw data / any sheet) ──────────────────────────────────────
export function DataTable({ headers, rows, rowCountLabel, pageLabel, prevDisabled, nextDisabled, onPrev, onNext }: any) {
  return (
    <div>
      <div style={{ borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', overflow: 'hidden', background: 'rgba(255,255,255,.5)' }}>
        <div style={{ overflow: 'auto', maxHeight: '560px' }}>
          <table style={{ width: '100%', fontSize: '12px' }}>
            <thead>
              <tr>{headers.map((h: any, i: number) => (
                <th key={i} onClick={h.onSort} className="m" style={{ textAlign: 'left', padding: '11px 16px', fontSize: '9.5px', fontWeight: 500, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--muted)', whiteSpace: 'nowrap', background: 'rgba(252,250,247,.9)', borderBottom: '1px solid var(--border)', cursor: 'pointer', position: 'sticky', top: 0 }}>{h.label}{h.sortIndicator}</th>
              ))}</tr>
            </thead>
            <tbody>
              {rows.map((row: any, ri: number) => (
                <tr key={ri} className="data-row" style={{ background: ri % 2 ? 'rgba(255,255,255,.35)' : 'transparent' }}>
                  {row.cells.map((cell: any, ci: number) => <td key={ci} className="m tn" style={{ padding: '9px 16px', whiteSpace: 'nowrap', fontSize: '11.5px', color: 'var(--text)', borderBottom: '1px solid var(--surface-2)' }}>{cell.value}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', padding: '12px 16px', borderTop: '1px solid var(--border)' }}>
          <span className="m" style={{ fontSize: '10.5px', color: 'var(--muted)' }}>{rowCountLabel}</span>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button onClick={onPrev} disabled={prevDisabled} className="btn-outline m" style={{ padding: '6px 13px', borderRadius: '9px', fontSize: '11px' }}>PREV</button>
            <span className="m" style={{ fontSize: '10.5px', color: 'var(--muted)' }}>{pageLabel}</span>
            <button onClick={onNext} disabled={nextDisabled} className="btn-outline m" style={{ padding: '6px 13px', borderRadius: '9px', fontSize: '11px' }}>NEXT</button>
          </div>
        </div>
      </div>
    </div>
  )
}
