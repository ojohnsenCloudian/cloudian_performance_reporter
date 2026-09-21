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
  // clear previous logs
  try { fs.unlinkSync('/data/update-log.txt') } catch { /* ok */ }
  writeStatus(1, 'Pulling latest code…', 8)

  const script = `
STATUS=/data/update-status.json
LOG=/data/update-log.txt
WORKSPACE=${WORKSPACE}
HOST_DIR=${HOST_DIR}

ws() {
  printf '{"step":%d,"label":"%s","progress":%d,"done":false,"ts":%d}' "$1" "$2" "$3" "$(date +%s)" > "$STATUS"
}
log() { echo "$1" >> "$LOG"; }

ws 1 "Pulling latest code..." 8
log "=== git pull ==="
git -C ${WORKSPACE} pull origin main >> "$LOG" 2>&1
RC=$?
if [ $RC -ne 0 ]; then
  printf '{"step":1,"label":"git pull failed","progress":8,"done":false,"error":true}' > "$STATUS"
  exit 1
fi
log ""

ws 2 "Building new image..." 30
log "=== docker compose build ==="
BUILD_COMMIT=$(git -C ${WORKSPACE} rev-parse HEAD)
export BUILD_COMMIT
docker-compose -f ${WORKSPACE}/docker-compose.yml --project-directory ${HOST_DIR} build --no-cache >> "$LOG" 2>&1
RC=$?
if [ $RC -ne 0 ]; then
  printf '{"step":2,"label":"Build failed","progress":30,"done":false,"error":true}' > "$STATUS"
  exit 1
fi
log ""

ws 3 "Starting new container..." 88
log "=== docker compose up ==="
docker-compose -f ${WORKSPACE}/docker-compose.yml --project-directory ${HOST_DIR} up -d >> "$LOG" 2>&1
log ""
log "=== Container replaced — waiting for restart ==="
`

  const child = spawn('sh', ['-c', script], {
    detached: true,
    stdio: 'ignore',
    env: {
      ...process.env,
      PATH: '/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin',
      HOME: '/root',
    },
  })
  child.unref()

  return NextResponse.json({ status: 'updating' })
}
