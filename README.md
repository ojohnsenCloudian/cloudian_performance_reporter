# Cloudian Storage Performance Dashboard

A Next.js 15 application for visualizing Cloudian benchmark results. Upload an XLSX or CSV export to explore throughput scaling, latency, CPU efficiency, cached reads, and multipart upload performance — then export a PDF report.

## Running

**Prerequisites:** Docker and Docker Compose

```bash
git clone https://github.com/ojohnsenCloudian/cloudian_performance_reporter.git
cd cloudian_performance_reporter
docker compose up --build -d
```

Open [http://localhost:8080](http://localhost:8080).

To stop:

```bash
docker compose down
```

## Input format

Upload any `.xlsx` or `.csv` benchmark export. The app auto-detects common column names (threads, throughput, latency, CPU, etc.) and lets you confirm or adjust the mapping before rendering charts.

**Supported column roles:**

| Role | Example column names |
|---|---|
| Category / Configuration | `Configuration`, `Config`, `Category` |
| Protocol | `Protocol` |
| Operation | `Operation`, `Op` (Read / Write) |
| Object Size | `Object Size (MiB)`, `Part Size` |
| Threads / Concurrency | `Threads`, `Concurrency` |
| Throughput | `Throughput (MiB/s)`, `Bandwidth` |
| Latency | `Latency (ms)`, `Response Time` |
| Objects per Second | `Objects/s`, `IOPS` |
| CPU Min / Max / Avg | `CPU Min`, `CPU Max`, `CPU Avg` |

For cached-read and multipart-upload charts, include additional sheets named (or containing) `Cached` and `MPU` / `Part Size` respectively.

## Project structure

```
src/
  app/
    layout.tsx          # HTML shell, Google Fonts
    page.tsx            # Entry point
    globals.css         # Design tokens, component styles
  components/
    StorageDashboard.tsx  # Main client component (all state + UI)
  lib/
    chartUtils.ts       # Pure SVG chart builders (line, bar, hbar)
    dataUtils.ts        # Data processing, peak cards, section builders
public/
  xlsx-lite.js          # XLSX/CSV parser (loaded dynamically)
  doc-page.js           # <doc-page> web component for PDF printing
```
