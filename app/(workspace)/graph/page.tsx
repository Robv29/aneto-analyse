import { redirect } from 'next/navigation'

// Le graphe décoratif est retiré : la bibliothèque montre les mêmes données
// de façon exploitable. L'ancienne URL reste valide.
export default function GraphPage() {
  redirect('/library')
}
