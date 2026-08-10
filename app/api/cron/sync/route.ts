import { enqueueDailySyncRuns, processNextSyncRun } from '@/lib/sync/runner'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return Response.json({ error: 'unauthorized' }, { status: 401 })
  }

  const queue = await enqueueDailySyncRuns()
  const processed = []
  for (let index = 0; index < 3; index += 1) {
    const result = await processNextSyncRun()
    processed.push(result)
    if (result.status === 'idle' || result.status === 'not_configured') break
  }

  return Response.json({ ok: true, queue, processed }, {
    headers: { 'Cache-Control': 'no-store' },
  })
}
