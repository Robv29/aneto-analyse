export type NormalizedContentItem = {
  externalId: string
  title: string
  publishedAt: string | null
  observedAt: string | null
  payload: Record<string, unknown>
}

export class ConnectorError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly retryAfterSeconds: number | null = null,
  ) {
    super(message)
    this.name = 'ConnectorError'
  }
}
