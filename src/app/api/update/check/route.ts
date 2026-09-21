import { NextResponse } from 'next/server'
import fs from 'fs'

const REPO = 'ojohnsenCloudian/cloudian_performance_reporter'

function getBuildCommit(): string {
  try {
    return fs.readFileSync('/app/public/build-commit.txt', 'utf8').trim()
  } catch {
    return 'unknown'
  }
}

export async function GET() {
  const buildCommit = getBuildCommit()

  try {
    const res = await fetch(`https://api.github.com/repos/${REPO}/commits/main`, {
      headers: { 'User-Agent': 'cloudian-performance-reporter', Accept: 'application/vnd.github.v3+json' },
      next: { revalidate: 60 },
    })
    if (!res.ok) throw new Error(`GitHub API responded ${res.status}`)
    const data = await res.json()
    const latestSha: string = data.sha
    const latestMessage: string = (data.commit?.message || '').split('\n')[0]
    const latestDate: string = data.commit?.committer?.date || ''
    const latestAuthor: string = data.commit?.author?.name || ''
    const updateAvailable = buildCommit !== 'unknown' && buildCommit !== latestSha

    return NextResponse.json({ buildCommit, latestSha, latestMessage, latestDate, latestAuthor, updateAvailable })
  } catch (e: any) {
    return NextResponse.json({ buildCommit, error: String(e.message) })
  }
}
