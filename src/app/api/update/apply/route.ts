import { NextResponse } from 'next/server'
import { spawn } from 'child_process'

const WORKSPACE = '/workspace'
const HOST_DIR = process.env.HOST_PROJECT_DIR || WORKSPACE

export async function POST() {
  const script = [
    `git -C ${WORKSPACE} pull origin main`,
    `BUILD_COMMIT=$(git -C ${WORKSPACE} rev-parse HEAD) docker compose -f ${HOST_DIR}/docker-compose.yml --project-directory ${HOST_DIR} build --no-cache`,
    `docker compose -f ${HOST_DIR}/docker-compose.yml --project-directory ${HOST_DIR} up -d`,
  ].join(' && ')

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

  return NextResponse.json({ status: 'updating', message: 'Update started — the app will restart in a few minutes.' })
}
