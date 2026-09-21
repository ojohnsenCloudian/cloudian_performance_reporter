import { NextResponse } from 'next/server'
import { spawn } from 'child_process'
import fs from 'fs'

const WORKSPACE = '/workspace'
const HOST_DIR = process.env.HOST_PROJECT_DIR || WORKSPACE

function writeStatus(step: number, label: string, progress: number, extra: Record<string, unknown> = {}) {
  try {
    const payload = JSON.stringify({ step, label, progress, done: false, ts: Date.now(), ...extra })
    fs.mkdirSync('/data', { recursive: true })
    fs.writeFileSync('/data/update-status.json', payload)
  } catch { /* ignore */ }
}

export async function POST() {
  try { fs.unlinkSync('/data/update-log.txt') } catch { /* ok */ }
  writeStatus(1, 'Starting updater…', 2)

  // Write the update script to the shared data volume so the helper container can read it
  const updateScript = `#!/bin/sh
set -e
STATUS=/data/update-status.json
LOG=/data/update-log.txt

ws() {
  printf '{"step":%d,"label":"%s","progress":%d,"done":false,"ts":%d}' "$1" "$2" "$3" "$(date +%s)" > "$STATUS"
}

echo "=== Installing tools ===" >> "$LOG"
apk add --no-cache git docker-cli docker-compose >> "$LOG" 2>&1

ws 1 "Pulling latest code..." 8
echo "" >> "$LOG"
echo "=== git pull ===" >> "$LOG"
git -C /workspace pull origin main >> "$LOG" 2>&1 || {
  printf '{"step":1,"label":"git pull failed","progress":8,"done":false,"error":true}' > "$STATUS"
  exit 1
}

ws 2 "Building new image..." 30
echo "" >> "$LOG"
echo "=== docker compose build ===" >> "$LOG"
export BUILD_COMMIT=$(git -C /workspace rev-parse HEAD)
docker-compose -f /workspace/docker-compose.yml -p cloudian_performance_reporter build --no-cache >> "$LOG" 2>&1 || {
  printf '{"step":2,"label":"Build failed","progress":30,"done":false,"error":true}' > "$STATUS"
  exit 1
}

ws 3 "Starting new container..." 88
echo "" >> "$LOG"
echo "=== docker compose up ===" >> "$LOG"
docker-compose -f /workspace/docker-compose.yml -p cloudian_performance_reporter up -d >> "$LOG" 2>&1
echo "=== Container replaced ===" >> "$LOG"

# Terminal status. Only written once the swap has completed, so any client that
# reads done:true is already being served by the new container.
printf '{"step":4,"label":"Update complete","progress":100,"done":true,"ts":%d}' "$(date +%s)" > "$STATUS"
`

  try { fs.mkdirSync('/data', { recursive: true }) } catch { /* ok */ }
  fs.writeFileSync('/data/update-script.sh', updateScript, { mode: 0o755 })

  // Use 'docker run -d' so the Docker daemon owns the helper container's lifecycle.
  // This means it keeps running even after the main container is replaced by the update.
  const launch = `docker rm -f cloudian-updater 2>/dev/null || true && docker run -d --rm --name cloudian-updater -v /var/run/docker.sock:/var/run/docker.sock -v ${HOST_DIR}:/workspace -v cloudian_performance_reporter_settings_data:/data alpine:3.20 sh /data/update-script.sh`

  spawn('sh', ['-c', launch], { stdio: 'ignore' }).unref()

  return NextResponse.json({ status: 'updating' })
}
