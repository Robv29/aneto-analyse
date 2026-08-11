export type ConnectorKey = 'ausha' | 'youtube' | 'instagram' | 'tiktok'

type ConnectorConfig = {
  key: ConnectorKey
  label: string
  configured: boolean
}

const has = (value: string | undefined) => Boolean(value && value.trim())

export function hasValidCredentialEncryptionKey() {
  const value = process.env.ANETO_CREDENTIAL_ENCRYPTION_KEY
  if (!has(value)) return false
  try {
    return Buffer.from(value!, 'base64').length === 32
  } catch {
    return false
  }
}

export function hasSupabaseConfig() {
  return has(process.env.NEXT_PUBLIC_SUPABASE_URL) && has(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
}

export function getConnectorConfiguration(): ConnectorConfig[] {
  return [
    { key: 'ausha', label: 'Ausha', configured: hasSupabaseConfig() && has(process.env.SUPABASE_SERVICE_ROLE_KEY) && hasValidCredentialEncryptionKey() && has(process.env.CRON_SECRET) },
    { key: 'youtube', label: 'YouTube', configured: has(process.env.YOUTUBE_CLIENT_ID) && has(process.env.YOUTUBE_CLIENT_SECRET) },
    { key: 'instagram', label: 'Instagram', configured: has(process.env.INSTAGRAM_CLIENT_ID) && has(process.env.INSTAGRAM_CLIENT_SECRET) },
    { key: 'tiktok', label: 'TikTok', configured: has(process.env.TIKTOK_CLIENT_ID) && has(process.env.TIKTOK_CLIENT_SECRET) },
  ]
}

export function getRuntimeStatus() {
  return {
    application: 'ok' as const,
    database: hasSupabaseConfig() ? 'configured' as const : 'not_configured' as const,
    vault: hasValidCredentialEncryptionKey() ? 'configured' as const : 'not_configured' as const,
    jobs: has(process.env.SUPABASE_SERVICE_ROLE_KEY) && hasValidCredentialEncryptionKey() && has(process.env.CRON_SECRET)
      ? 'configured' as const
      : 'not_configured' as const,
    intelligence: {
      provider: 'openrouter' as const,
      status: has(process.env.OPENROUTER_API_KEY) ? 'configured' as const : 'not_configured' as const,
      model: has(process.env.OPENROUTER_MODEL) ? process.env.OPENROUTER_MODEL : 'openrouter/free',
    },
    connectors: getConnectorConfiguration(),
    checkedAt: new Date().toISOString(),
  }
}
