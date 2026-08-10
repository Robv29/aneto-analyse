import { getRuntimeStatus } from '@/lib/env'

export const dynamic = 'force-dynamic'

export async function GET() {
  return Response.json(getRuntimeStatus(), {
    headers: { 'Cache-Control': 'no-store' },
  })
}
