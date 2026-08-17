import { redirect } from 'next/navigation'

// Le raisonnement éditorial vit désormais dans la carte « Action recommandée »
// du tableau de bord. L'ancienne URL reste valide.
export default function IntelligencePage() {
  redirect('/')
}
