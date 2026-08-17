import { redirect } from 'next/navigation'

// Les « opportunités » dupliquaient la recommandation du tableau de bord.
// L'ancienne URL reste valide.
export default function ResearchPage() {
  redirect('/')
}
