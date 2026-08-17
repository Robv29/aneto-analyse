import 'server-only'

type Fields = Record<string, unknown>

// Journalisation structurée : une ligne JSON par événement, lisible telle
// quelle dans les logs Vercel et filtrable par `event`. Aucun service externe,
// donc rien à configurer — et surtout, plus d'échec silencieux.
function emit(level: 'info' | 'warn' | 'error', event: string, fields: Fields) {
  const line = JSON.stringify({
    level,
    event,
    at: new Date().toISOString(),
    ...fields,
  })
  if (level === 'error') console.error(line)
  else if (level === 'warn') console.warn(line)
  else console.log(line)
}

export const logInfo = (event: string, fields: Fields = {}) => emit('info', event, fields)
export const logWarn = (event: string, fields: Fields = {}) => emit('warn', event, fields)

export function logError(event: string, error: unknown, fields: Fields = {}) {
  emit('error', event, {
    ...fields,
    error: error instanceof Error ? error.message.slice(0, 300) : String(error).slice(0, 300),
    errorType: error instanceof Error ? error.name : typeof error,
  })
}
