const paths: Record<string, string> = {
  home: '<path d="M4 11.5 12 5l8 6.5V20H4Z"/><path d="M9 20v-6h6v6"/>',
  brain: '<path d="M9.5 4.5A3.5 3.5 0 0 0 6 8v.4A3.6 3.6 0 0 0 4 15a3.5 3.5 0 0 0 5.5 2.9M14.5 4.5A3.5 3.5 0 0 1 18 8v.4a3.6 3.6 0 0 1 2 6.6 3.5 3.5 0 0 1-5.5 2.9M12 4v16M8.5 9.5c2 0 3.5 1.2 3.5 3M15.5 9.5c-2 0-3.5 1.2-3.5 3"/>',
  clip: '<path d="m4 7 16 10M4 17 20 7"/><circle cx="4" cy="5" r="2.5"/><circle cx="4" cy="19" r="2.5"/>',
  graph: '<circle cx="12" cy="5" r="2.5"/><circle cx="5" cy="18" r="2.5"/><circle cx="19" cy="18" r="2.5"/><path d="m10.8 7.2-4.6 8.6M13.2 7.2l4.6 8.6M7.5 18h9"/>',
  memory: '<path d="M5 7a7 7 0 1 1 0 10"/><path d="M5 3v4h4M12 8v5l3 2"/>',
  radar: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><path d="m12 12 5-5M12 3v2M21 12h-2"/>',
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4 4"/>',
  arrow: '<path d="M5 12h14M14 7l5 5-5 5"/>',
  spark: '<path d="m12 3 1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8Z"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
  play: '<path d="m9 6 10 6-10 6Z"/>',
  up: '<path d="m6 14 6-6 6 6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  sync: '<path d="M20 7h-5V2"/><path d="m20 2-3.6 3.6A8 8 0 1 0 20 12"/>',
  copy: '<rect x="8" y="8" width="11" height="11" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>',
  dots: '<circle cx="5" cy="12" r="1" fill="currentColor"/><circle cx="12" cy="12" r="1" fill="currentColor"/><circle cx="19" cy="12" r="1" fill="currentColor"/>',
}

export type IconName = keyof typeof paths

export function Icon({ name, size = 19 }: { name: string; size?: number }) {
  const content = paths[name]
  if (!content) return null
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: content }}
    />
  )
}
