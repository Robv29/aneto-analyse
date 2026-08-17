import { drainSyncQueue, enqueueDailySyncRuns, purgeFinishedSyncRuns, releaseStaleSyncRuns } from '@/lib/sync/runner'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return Response.json({ error: 'unauthorized' }, { status: 401 })
  }

  const released = await releaseStaleSyncRuns()
  const queue = await enqueueDailySyncRuns()
  const drain = await drainSyncQueue({ budgetMs: 45_000 })
  const purge = await purgeFinishedSyncRuns()

  return Response.json({
    ok: true,
    released: released.released,
    enqueued: queue.enqueued,
    processed: drain.processed,
    succeeded: drain.succeeded,
    failed: drain.failed,
    retries: drain.retries,
    drained: drain.drained,
    purged: purge.purged,
  }, {
    headers: { 'Cache-Control': 'no-store' },
  })
}
