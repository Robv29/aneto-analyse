import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import '../src/styles.css'
import '../src/living.css'
import '../src/dashboard.css'

export const metadata: Metadata = {
  title: 'Aneto — Media Intelligence',
  description: 'L’intelligence éditoriale qui observe, apprend et prend des initiatives.',
}

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  )
}
