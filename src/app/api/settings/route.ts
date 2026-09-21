import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import type { AppSettings } from '@/lib/settings'
import { DEFAULT_SETTINGS } from '@/lib/settings'

const SETTINGS_FILE = '/data/settings.json'

function readSettings(): AppSettings {
  try {
    return { ...DEFAULT_SETTINGS, ...JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8')) }
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

function writeSettings(s: AppSettings) {
  const dir = path.dirname(SETTINGS_FILE)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(s, null, 2))
}

export async function GET() {
  return NextResponse.json(readSettings())
}

export async function PATCH(request: Request) {
  const body = await request.json()
  const updated = { ...readSettings(), ...body }
  writeSettings(updated)
  return NextResponse.json(updated)
}
