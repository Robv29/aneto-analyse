export type ConnectorKey = 'ausha' | 'youtube' | 'instagram' | 'tiktok'

type ConnectorConfig = {
  key: ConnectorKey
  label: string
  configured: boolean
}

const has = (value: string | undefined) => Boolean(value && value.trim())

export function hasSupabaseConfig() {
  return has(process.env.NEXT_PUBLIC_SUPABASE_URL) && has(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
}

export function getConnectorConfiguration(): ConnectorConfig[] {
  return [
    { key: 'ausha', label: 'Ausha', configured: has(process.env.AUSHA_CLIENT_ID) && has(process.env.AUSHA_CLIENT_SECRET) },
    { key: 'youtube', label: 'YouTube', configured: has(process.env.YOUTUBE_CLIENT_ID) && has(process.env.YOUTUBE_CLIENT_SECRET) },
    { key: 'instagram', label: 'Instagram', configured: has(process.env.INSTAGRAM_CLIENT_ID) && has(process.env.INSTAGRAM_CLIENT_SECRET) },
    { key: 'tiktok', label: 'TikTok', configured: has(process.env.TIKTOK_CLIENT_ID) && has(process.env.TIKTOK_CLIENT_SECRET) },
  ]
}

export function getRuntimeStatus() {
  return {
    application: 'ok' as const,
    database: hasSupabaseConfig() ? 'configured' as const : 'not_configured' as const,
    connectors: getConnectorConfiguration(),
    checkedAt: new Date().toISOString(),
  }
}
