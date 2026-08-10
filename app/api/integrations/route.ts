import { getConnectorConfiguration } from '@/lib/env'

export const dynamic = 'force-dynamic'

export async function GET() {
  return Response.json({
    integrations: getConnectorConfiguration().map((connector) => ({
      ...connector,
      state: connector.configured ? 'ready_to_connect' : 'hidden',
    })),
  }, { headers: { 'Cache-Control': 'no-store' } })
}
