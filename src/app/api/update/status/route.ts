import { NextResponse } from 'next/server'
import fs from 'fs'

export async function GET() {
  let status: Record<string, unknown> = { step: 0, label: '', progress: 0, done: false, error: false }
  let log = ''

  try {
    status = { ...status, ...JSON.parse(fs.readFileSync('/data/update-status.json', 'utf8').trim()) }
  } catch { /* no status file yet */ }

  try {
    const lines = fs.readFileSync('/data/update-log.txt', 'utf8').split('\n')
    log = lines.slice(-60).join('\n')
  } catch { /* no log file yet */ }

  return NextResponse.json({ ...status, log })
}

export async function DELETE() {
  try { fs.unlinkSync('/data/update-status.json') } catch { /* ok */ }
  try { fs.unlinkSync('/data/update-log.txt') } catch { /* ok */ }
  return NextResponse.json({ ok: true })
}
