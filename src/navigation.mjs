const routes = Object.freeze({
  today: '/',
  intelligence: '/intelligence',
  clips: '/clips',
  graph: '/graph',
  memory: '/memory',
  research: '/research',
})

export function pathForView(view) {
  return routes[view] || routes.today
}

export function viewForPath(pathname) {
  const normalized = pathname === '/' ? '/' : pathname.replace(/\/$/, '')
  return Object.entries(routes).find(([, path]) => path === normalized)?.[0] || 'today'
}
