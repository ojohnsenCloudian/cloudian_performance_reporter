// The redesigned 7-section PDF report: Cover, Executive Summary, Test Environment,
// Throughput Scaling, Object Size & Latency, CPU/Cache/Multipart, Appendix.
// Reuses the same chart components as the on-screen dashboard so print and screen
// match, just inside plain white page panels instead of glass, and slightly
// desaturated (print doesn't need screen-level punch).
import type { ReportDetails } from '@/lib/dataUtils'
import { LineChart, SlaLineChart, Legend, SmallMultiples, Heatmap, RankedBars, StackedBars, PairedBars } from '@/components/charts'

const PAGE = { padding: '0.75in 0.8in', breakAfter: 'page' as const }
const panel: React.CSSProperties = { border: '1px solid oklch(0.9 0.004 260)', borderRadius: '16px', padding: '20px', filter: 'saturate(.85) brightness(.98)' }

function PageHeader({ title, customer, page }: { title: string; customer: string; page: number }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '22px', borderBottom: '2px solid oklch(0.14 0 0)', paddingBottom: '12px' }}>
      <h2 style={{ fontSize: '19px', fontWeight: 800, margin: 0, fontFamily: "'Space Grotesk',system-ui,sans-serif" }}>{title}</h2>
      <span style={{ fontSize: '11px', color: 'oklch(0.5 0 0)' }}>Page {page} · {customer} POC</span>
    </div>
  )
}

function reportId(name: string) {
  return 'RPT-' + name.replace(/[^A-Za-z0-9]/g, '').slice(0, 8).toUpperCase()
}

export default function PdfReport({ reportTargets, reportDetails, generatedDate, onPrint, onClose }: {
  reportTargets: any[]; reportDetails: ReportDetails; generatedDate: string; onPrint: () => void; onClose: () => void
}) {
  const customer = reportDetails.clusterName || 'Evaluation'
  return (
    <div style={{ position: 'fixed', inset: 0, background: '#fff', zIndex: 50, overflow: 'auto', color: 'oklch(0.17 0.006 260)', fontFamily: "'IBM Plex Sans',system-ui,sans-serif" }}>
      <div className="no-print" style={{ position: 'sticky', top: 0, background: '#fff', borderBottom: '1px solid oklch(0.9 0.004 260)', padding: '14px 28px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 2 }}>
        <div style={{ fontWeight: 700, fontSize: '14px' }}>PDF Report Preview</div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={onPrint} style={{ padding: '9px 18px', borderRadius: '9px', border: 'none', background: 'oklch(0.5 0.19 26)', color: '#fff', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>Print / Save as PDF</button>
          <button onClick={onClose} style={{ padding: '9px 18px', borderRadius: '9px', border: '1px solid oklch(0.9 0.004 260)', background: '#fff', color: 'inherit', fontSize: '13px', cursor: 'pointer' }}>Close</button>
        </div>
      </div>
      {/* @ts-ignore */}
      <doc-page margin="0in">
        {reportTargets.map((rt: any, rti: number) => (
          <div key={rti}>

            {/* 1. Cover */}
            <div style={{ ...PAGE, minHeight: '9.5in', background: 'linear-gradient(168deg, oklch(0.235 0.016 35), oklch(0.17 0.012 35) 62%, oklch(0.19 0.03 30) 100%)', color: 'oklch(0.96 0.008 70)', display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'auto' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ width: '26px', height: '26px', borderRadius: '8px', background: 'oklch(0.5 0.19 26)' }} />
                  <span style={{ fontSize: '13px', fontWeight: 600, letterSpacing: '.04em', textTransform: 'uppercase', color: 'oklch(0.75 0.02 40)' }}>Cloudian Performance Report</span>
                </div>
                <div style={{ textAlign: 'right', fontSize: '11px', color: 'oklch(0.65 0.02 40)' }}>Confidential<br />Prepared for {customer}</div>
              </div>
              <div>
                <div style={{ fontSize: '12px', color: 'oklch(0.65 0.02 40)', marginBottom: '14px' }}>{generatedDate}</div>
                <h1 style={{ fontSize: '40px', margin: '0 0 10px', fontWeight: 600, letterSpacing: '-.03em', lineHeight: 1.1, fontFamily: "'Space Grotesk',system-ui,sans-serif" }}>Storage Performance Report</h1>
                <div style={{ fontSize: '17px', color: 'oklch(0.78 0.02 40)', marginBottom: '32px' }}>{rt.name}</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: '14px', maxWidth: '620px' }}>
                  {rt.peakCards.slice(0, 4).map((rcard: any, i: number) => (
                    <div key={i} style={{ border: '1px solid rgba(255,255,255,.15)', borderRadius: '12px', padding: '16px 18px', background: 'rgba(255,255,255,.05)' }}>
                      <div style={{ fontSize: '10px', color: 'oklch(0.68 0.02 40)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: '6px' }}>{rcard.label}</div>
                      <div style={{ fontSize: '24px', fontWeight: 700 }}>{rcard.value} <span style={{ fontSize: '12px', fontWeight: 500, color: 'oklch(0.68 0.02 40)' }}>{rcard.unit}</span></div>
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ marginTop: 'auto', display: 'flex', gap: '28px', flexWrap: 'wrap', fontSize: '11px', color: 'oklch(0.68 0.02 40)', borderTop: '1px solid rgba(255,255,255,.15)', paddingTop: '14px' }}>
                <span>Cluster: {reportDetails.clusterName || '—'}</span>
                <span>Nodes: {reportDetails.nodeCount || '—'}</span>
                <span>Software: {reportDetails.softwareVersion || '—'}</span>
                <span>Captured: {generatedDate}</span>
                <span>Report ID: {reportId(rt.name)}</span>
              </div>
            </div>

            {/* 2. Executive Summary */}
            <div style={PAGE}>
              <PageHeader title="Executive Summary" customer={customer} page={2} />
              <p style={{ fontSize: '13.5px', lineHeight: 1.7, color: 'oklch(0.3 0.006 260)', maxWidth: '52em' }}>
                This report summarizes {rt.rowCount} measurements from {rt.name} ({rt.mainSheetName}). It covers throughput scaling, latency, CPU efficiency, cached-read behavior, and multipart upload performance across the configurations tested.
              </p>
              <div style={{ display: 'flex', gap: '24px', marginTop: '20px', flexWrap: 'wrap' }}>
                <div style={{ ...panel, flex: '2 1 320px', background: 'oklch(0.97 0.004 260)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                    <span style={{ width: '22px', height: '22px', borderRadius: '50%', background: 'oklch(0.5 0.19 26)', color: '#fff', fontSize: '11px', fontWeight: 700, display: 'grid', placeItems: 'center', flexShrink: 0 }}>1</span>
                    <div style={{ fontWeight: 700, fontSize: '13px' }}>Recommendation</div>
                  </div>
                  <p style={{ margin: 0, fontSize: '12.5px', lineHeight: 1.6, color: 'oklch(0.32 0.006 260)' }}>{rt.recommendation}</p>
                </div>
              </div>
              {rt.criteria?.length > 0 && (
                <div style={{ marginTop: '24px' }}>
                  <div style={{ fontWeight: 700, fontSize: '13px', marginBottom: '10px' }}>Acceptance Criteria</div>
                  <table style={{ width: '100%', fontSize: '11.5px' }}>
                    <thead><tr>
                      <th style={{ textAlign: 'left', padding: '8px 10px', borderBottom: '1px solid #ccc', background: '#fafafa' }}>Criterion</th>
                      <th style={{ textAlign: 'left', padding: '8px 10px', borderBottom: '1px solid #ccc', background: '#fafafa' }}>Target</th>
                      <th style={{ textAlign: 'left', padding: '8px 10px', borderBottom: '1px solid #ccc', background: '#fafafa' }}>Measured</th>
                      <th style={{ textAlign: 'left', padding: '8px 10px', borderBottom: '1px solid #ccc', background: '#fafafa' }}>Result</th>
                    </tr></thead>
                    <tbody>
                      {rt.criteria.map((c: any, i: number) => (
                        <tr key={i}>
                          <td style={{ padding: '8px 10px', borderBottom: '1px solid #eee' }}>{c.criterion}</td>
                          <td style={{ padding: '8px 10px', borderBottom: '1px solid #eee' }}>{c.target}</td>
                          <td style={{ padding: '8px 10px', borderBottom: '1px solid #eee' }}>{c.measured}</td>
                          <td style={{ padding: '8px 10px', borderBottom: '1px solid #eee' }}>
                            <span style={{ padding: '3px 9px', borderRadius: '5px', fontSize: '10.5px', fontWeight: 700, letterSpacing: '.04em', background: c.pass ? 'oklch(0.94 0.05 155)' : 'oklch(0.95 0.04 25)', color: c.pass ? 'oklch(0.4 0.1 155)' : 'oklch(0.5 0.19 26)' }}>{c.pass ? 'PASS' : 'FAIL'}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* 3. Test Environment */}
            <div style={PAGE}>
              <PageHeader title="Test Environment" customer={customer} page={3} />
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: '18px', marginBottom: '22px' }}>
                {[
                  { label: 'Cluster', value: reportDetails.clusterName },
                  { label: 'Network', value: reportDetails.network },
                  { label: 'Software', value: reportDetails.softwareVersion },
                  { label: 'Workload', value: reportDetails.workload },
                ].map((blk, i) => (
                  <div key={i} style={panel}>
                    <div style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '.05em', color: 'oklch(0.5 0 0)', marginBottom: '6px' }}>{blk.label}</div>
                    <div style={{ fontSize: '13px', fontWeight: 500 }}>{blk.value || 'Not specified'}</div>
                  </div>
                ))}
              </div>
              <p style={{ fontSize: '12.5px', lineHeight: 1.6, color: 'oklch(0.35 0.006 260)', marginBottom: '20px' }}>
                Method: benchmark rows were mapped from &quot;{rt.mainSheetName}&quot; and grouped by configuration/protocol; throughput, latency, and CPU metrics were taken at the highest tested concurrency per group unless otherwise noted.
              </p>
              <div style={{ fontWeight: 700, fontSize: '13px', marginBottom: '10px' }}>Test Matrix</div>
              <table style={{ width: '100%', fontSize: '11.5px' }}>
                <thead><tr>{rt.allHeaders.slice(0, 6).map((h: any, i: number) => <th key={i} style={{ textAlign: 'left', padding: '8px 10px', borderBottom: '1px solid #ccc', background: '#fafafa' }}>{h.label}</th>)}</tr></thead>
                <tbody>{rt.allRows.slice(0, 6).map((row: any, ri: number) => <tr key={ri}>{row.cells.slice(0, 6).map((c: any, ci: number) => <td key={ci} style={{ padding: '8px 10px', borderBottom: '1px solid #eee' }}>{c.value}</td>)}</tr>)}</tbody>
              </table>
            </div>

            {/* 4. Throughput Scaling */}
            <div style={PAGE}>
              <PageHeader title="Throughput Scaling" customer={customer} page={4} />
              {rt.smallMultiples?.length > 0 && (
                <div style={{ ...panel, marginBottom: '20px' }}><SmallMultiples items={rt.smallMultiples} /></div>
              )}
              {rt.scalingCharts.map((item: any, i: number) => (
                <div key={i} style={{ ...panel, marginBottom: '16px', breakInside: 'avoid' }}>
                  <div style={{ fontWeight: 700, fontSize: '13px', marginBottom: '10px' }}>{item.title}</div>
                  <SlaLineChart chart={item.chart} />
                </div>
              ))}
            </div>

            {/* 5. Object Size & Latency */}
            <div style={PAGE}>
              <PageHeader title="Object Size & Latency" customer={customer} page={5} />
              {rt.heatmap && (
                <div style={{ ...panel, marginBottom: '22px' }}>
                  <div style={{ fontWeight: 700, fontSize: '13px', marginBottom: '4px' }}>{rt.heatmap.title}</div>
                  <div style={{ fontSize: '11.5px', color: 'oklch(0.5 0 0)', marginBottom: '14px' }}>{rt.heatmap.note}</div>
                  <Heatmap heat={rt.heatmap} />
                </div>
              )}
              {rt.latencyRanked && (
                <div style={{ ...panel, breakInside: 'avoid' }}>
                  <div style={{ fontWeight: 700, fontSize: '13px', marginBottom: '14px' }}>{rt.latencyRanked.title}</div>
                  <RankedBars data={rt.latencyRanked.ranked} footnote="Sorted fastest to slowest" />
                </div>
              )}
            </div>

            {/* 6. CPU / Cache / Multipart */}
            <div style={PAGE}>
              <PageHeader title="CPU, Cache &amp; Multipart" customer={customer} page={6} />
              {rt.cpuEnvelope && (
                <div style={{ ...panel, marginBottom: '18px', breakInside: 'avoid' }}>
                  <div style={{ fontWeight: 700, fontSize: '13px', marginBottom: '12px' }}>{rt.cpuEnvelope.title}</div>
                  <StackedBars chart={rt.cpuEnvelope.chart} />
                </div>
              )}
              {rt.cachePairs && (
                <div style={{ marginBottom: '18px', breakInside: 'avoid' }}>
                  <div style={{ fontWeight: 700, fontSize: '13px', marginBottom: '12px' }}>{rt.cachePairs.title}</div>
                  <PairedBars pairs={rt.cachePairs.pairs} />
                </div>
              )}
              {rt.mpuAnalysis && (
                <div style={{ ...panel, breakInside: 'avoid' }}>
                  <div style={{ fontWeight: 700, fontSize: '13px', marginBottom: '12px' }}>{rt.mpuAnalysis.title}</div>
                  {rt.mpuAnalysis.lineChart && <><LineChart chart={rt.mpuAnalysis.lineChart} /><Legend series={rt.mpuAnalysis.lineChart.series} /></>}
                  <div style={{ marginTop: '14px' }}><RankedBars data={rt.mpuAnalysis.ranked} footnote={`Recommended part size: ${rt.mpuAnalysis.recommended}`} /></div>
                </div>
              )}
            </div>

            {/* 7. Appendix — raw data */}
            <div style={{ padding: '0.7in 0.75in' }}>
              <PageHeader title="Appendix: Raw Data" customer={customer} page={7} />
              <div style={{ fontSize: '11px', color: 'oklch(0.5 0 0)', marginBottom: '12px' }}>{rt.mainSheetName} · {rt.rowCount} rows</div>
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
  )
}
