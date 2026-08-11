import { pathForView, viewForPath } from './navigation.mjs'
import { analyzeContent, editorialSignal, primaryMetric } from './analytics.mjs'
import { formatClipTime } from './clips.mjs'
import { buildClipCopyText } from './openrouter.mjs'

const bootstrap = window.__ANETO_BOOTSTRAP__ || {
  mode: 'demo', viewer: null, organization: null, sources: [], contentItems: [], decisions: [], memoryEvents: [], connectors: [],
}
const isDemo = bootstrap.mode === 'demo'

const icons = {
  home:'<path d="M4 11.5 12 5l8 6.5V20H4Z"/><path d="M9 20v-6h6v6"/>',
  brain:'<path d="M9.5 4.5A3.5 3.5 0 0 0 6 8v.4A3.6 3.6 0 0 0 4 15a3.5 3.5 0 0 0 5.5 2.9M14.5 4.5A3.5 3.5 0 0 1 18 8v.4a3.6 3.6 0 0 1 2 6.6 3.5 3.5 0 0 1-5.5 2.9M12 4v16M8.5 9.5c2 0 3.5 1.2 3.5 3M15.5 9.5c-2 0-3.5 1.2-3.5 3"/>',
  clip:'<path d="m4 7 16 10M4 17 20 7"/><circle cx="4" cy="5" r="2.5"/><circle cx="4" cy="19" r="2.5"/>',
  graph:'<circle cx="12" cy="5" r="2.5"/><circle cx="5" cy="18" r="2.5"/><circle cx="19" cy="18" r="2.5"/><path d="m10.8 7.2-4.6 8.6M13.2 7.2l4.6 8.6M7.5 18h9"/>',
  memory:'<path d="M5 7a7 7 0 1 1 0 10"/><path d="M5 3v4h4M12 8v5l3 2"/>',
  radar:'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><path d="m12 12 5-5M12 3v2M21 12h-2"/>',
  search:'<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4 4"/>',
  arrow:'<path d="M5 12h14M14 7l5 5-5 5"/>',
  spark:'<path d="m12 3 1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8Z"/>',
  check:'<path d="m5 12 4 4L19 6"/>',
  close:'<path d="m6 6 12 12M18 6 6 18"/>',
  play:'<path d="m9 6 10 6-10 6Z"/>',
  up:'<path d="m6 14 6-6 6 6"/>',
  plus:'<path d="M12 5v14M5 12h14"/>',
  sync:'<path d="M20 7h-5V2"/><path d="m20 2-3.6 3.6A8 8 0 1 0 20 12"/>',
  copy:'<rect x="8" y="8" width="11" height="11" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>',
  dots:'<circle cx="5" cy="12" r="1" fill="currentColor"/><circle cx="12" cy="12" r="1" fill="currentColor"/><circle cx="19" cy="12" r="1" fill="currentColor"/>'
}
const icon = (name,size=19) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name]}</svg>`
const escapeHtml = (value) => String(value ?? '').replace(/[&<>"]/g, character => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' })[character])
const compactNumber = (value) => Number.isFinite(Number(value)) ? new Intl.NumberFormat('fr-FR', { notation:'compact', maximumFractionDigits:1 }).format(Number(value)) : '—'
const formatDuration = (seconds) => seconds ? `${Math.floor(seconds/60)} min${seconds%60 ? ` ${seconds%60}s` : ''}` : '—'
const metricLabel = (item) => item?.kind === 'video' ? 'vues' : 'écoutes'
const contentHref = (item) => item?.transcript?.status === 'available'
  ? `/transcripts/${encodeURIComponent(item.id)}`
  : item?.provider === 'youtube'
    ? `https://www.youtube.com/watch?v=${encodeURIComponent(item.externalId)}`
    : null
const analysis = analyzeContent(bootstrap.contentItems)
const transcriptCount = bootstrap.contentItems.filter(item => item.transcript?.status === 'available').length
const timedTranscriptCount = bootstrap.contentItems.filter(item => item.transcript?.timed).length
const clipCandidates = bootstrap.contentItems.flatMap(item => (item.transcript?.clips ?? []).map(clip => ({ ...clip, item })))
  .sort((a,b) => b.score - a.score || primaryMetric(b.item) - primaryMetric(a.item))
const aiClipCount = clipCandidates.filter(clip => clip.aiEnhanced).length
const clipMarketStudy = bootstrap.contentItems.map(item => item.transcript?.marketStudy).find(Boolean) ?? null

const state = { view:viewForPath(window.location.pathname), detail:null, workflow:null, prepared:false, selectedNode:'Thomas Fantini', syncing:false, syncMessage:null, syncTone:null, committingDecision:false, decisionMessage:null, currentDecision:null, enrichingClips:false, clipAiMessage:null, clipAiTone:null, copiedClipId:null }

const demoRecommendations = [
  {type:'PRIORITÉ', icon:'↗', tone:'lime', title:'Republier Thomas Fantini', note:'Une conversation de 2023 vient de redevenir pertinente.', confidence:'94 %', action:'Republication préparée', detail:'Le sujet « management de crise » progresse de 31 % cette semaine. L’épisode contient un passage jamais publié sur la décision à 160 000 €.'},
  {type:'CRÉATION', icon:'✦', tone:'blue', title:'Créer un Reel', note:'54 secondes déjà identifiées et sous-titrées.', confidence:'89 %', action:'Reel prêt à valider', detail:'L’agent Contenu a isolé le passage qui concentre le plus de réactions émotionnelles et préparé trois hooks.'},
  {type:'ALERTE', icon:'↓', tone:'red', title:'CTR YouTube en baisse', note:'−1,8 point sur les trois dernières miniatures.', confidence:'98 %', action:'3 variantes préparées', detail:'Les visages en plan large sous-performent. Media DNA recommande un cadrage serré, regard caméra, avec moins de quatre mots.'},
  {type:'SIGNAL', icon:'⌁', tone:'gold', title:'Le mot-clé « restaurant » progresse', note:'+42 % dans votre audience et la presse spécialisée.', confidence:'86 %', action:'Recherche enrichie', detail:'Le signal est confirmé sur YouTube, Google Trends et 214 commentaires récents. Trois invités sont liés à cette opportunité.'}
]

const persistedRecommendations = bootstrap.decisions.map((decision) => ({
  type: 'DÉCISION',
  icon: decision.status === 'accepted' ? '✓' : '↗',
  tone: decision.status === 'accepted' ? 'lime' : 'blue',
  title: decision.title,
  note: decision.rationale,
  confidence: decision.confidence === null ? '—' : `${Math.round(decision.confidence * 100)} %`,
  action: decision.status,
  detail: decision.rationale,
  origin: 'persisted',
}))

const derivedRecommendations = analysis.count ? [
  {
    type:'PERFORMANCE', icon:'↗', tone:'lime', title:`Capitaliser sur « ${analysis.top.title} »`,
    note:`C’est le contenu le plus performant parmi les ${analysis.count} éléments synchronisés.`, confidence:'Donnée réelle', action:`${compactNumber(primaryMetric(analysis.top))} ${metricLabel(analysis.top)}`,
    detail:`Ce contenu domine actuellement la bibliothèque avec ${new Intl.NumberFormat('fr-FR').format(primaryMetric(analysis.top))} ${metricLabel(analysis.top)}. La recommandation est calculée uniquement à partir des données synchronisées.`, origin:'derived',
  },
  ...(analysis.totalComments ? [{
    type:'CONVERSATION', icon:'⌁', tone:'blue', title:`Prolonger la conversation autour de « ${[...analysis.ranked].sort((a,b)=>(Number(b.payload?.commentCount)||0)-(Number(a.payload?.commentCount)||0))[0].title} »`,
    note:`${analysis.totalComments} commentaires mesurés sur la bibliothèque YouTube.`, confidence:'Donnée réelle', action:'Signal détecté',
    detail:'Ce contenu concentre la conversation la plus active dans les données actuellement disponibles.', origin:'derived',
  }] : []),
] : []

const recommendations = isDemo ? demoRecommendations : (persistedRecommendations.length ? persistedRecommendations : derivedRecommendations)

const workflows = {
  'Créer un épisode': ['Définir l’angle à partir de Media DNA','Identifier 5 invités compatibles','Préparer la trame et les questions','Créer le plan de diffusion'],
  'Préparer un tournage': ['Analyser l’invité et ses prises de parole','Construire la tension narrative','Préparer 12 questions non génériques','Créer la checklist plateau'],
  'Analyser les performances': ['Réconcilier les données des plateformes','Détecter les ruptures et tendances','Comparer avec votre ADN éditorial','Proposer 3 décisions'],
  'Chercher un invité': ['Scanner les sujets en accélération','Croiser affinité et nouveauté','Évaluer le potentiel éditorial','Préparer 5 approches personnalisées'],
  'Créer 10 Shorts': ['Détecter les moments à haute émotion','Écrire 30 hooks et retenir les 10 meilleurs','Adapter le rythme par plateforme','Préparer titres et sous-titres']
}

const graphNodes = [
  {id:'Thomas Fantini',x:50,y:48,r:42,kind:'person',score:'94',desc:'Invité à fort potentiel de réactivation. 3 épisodes, 18 extraits et 1 842 commentaires reliés.'},
  {id:'Restaurant',x:27,y:22,r:29,kind:'topic',score:'+42 %',desc:'Sujet en accélération sur votre audience depuis 12 jours.'},
  {id:'Burn-out',x:69,y:19,r:24,kind:'emotion',score:'0,81',desc:'Émotion dominante : vulnérabilité. Fidélisation supérieure de 28 %.'},
  {id:'Management',x:81,y:47,r:30,kind:'topic',score:'87',desc:'Thème récurrent, fortement associé aux sauvegardes LinkedIn.'},
  {id:'160 000 €',x:68,y:76,r:25,kind:'fact',score:'pic',desc:'Moment précis jamais décliné. Pic d’attention à 42:17.'},
  {id:'MEDEF',x:34,y:78,r:22,kind:'org',score:'12',desc:'Organisation reliée à 12 invités potentiels et 7 sujets actifs.'},
  {id:'Croissance',x:14,y:51,r:24,kind:'topic',score:'+18 %',desc:'Sujet stable, performant lorsqu’il est associé à une expérience vécue.'},
  {id:'PME',x:88,y:79,r:19,kind:'audience',score:'31 %',desc:'31 % de votre audience engagée se reconnaît dans ce segment.'}
]

function shell(content) {
  const navGroups = [
    { label:'DÉCIDER', items:[['today','home','Aujourd’hui'],['intelligence','brain','Intelligence']] },
    { label:'PRODUIRE', items:[['clips','clip','Extraits']] },
    { label:'COMPRENDRE', items:[['graph','graph','Connaissances'],['memory','memory','Mémoire'],['research','radar','Signaux']] },
  ]
  const identity = bootstrap.viewer?.displayName || bootstrap.viewer?.email || 'Paramètres'
  const initials = bootstrap.viewer?.displayName?.split(/\s+/).map(part => part[0]).join('').slice(0, 2).toUpperCase() || '⚙'
  const demoBanner = isDemo ? '<div class="demo-banner"><strong>MODE DÉMO</strong><span>Les données visibles sont illustratives.</span><a href="/settings">Configurer le produit</a></div>' : ''
  const navigation = navGroups.map(group=>`<section class="rail-section"><span class="rail-section-label">${group.label}</span>${group.items.map(([view,ic,label])=>`<button class="rail-button ${state.view===view?'active':''}" data-view="${view}" aria-label="${group.label} · ${label}">${icon(ic)}<span><b>${label}</b><small>${group.label.toLowerCase()}</small></span></button>`).join('')}</section>`).join('')
  return `<div class="shell"><aside class="rail"><button class="logo" data-view="today" aria-label="Aneto">A</button><nav aria-label="Navigation principale">${navigation}</nav><div class="rail-bottom"><button class="rail-button" id="global-search" aria-label="Commander et rechercher">${icon('search')}<span><b>Commander</b><small>⌘ K</small></span></button><a class="rail-settings" href="/settings" aria-label="Réglages · ${identity}"><span class="avatar">${initials}</span><span><b>Réglages</b><small>Système</small></span></a></div></aside><main class="content">${demoBanner}${content}</main>${state.detail!==null?detailDrawer():''}${state.workflow?workflowPanel():''}</div>`
}

function today() {
  const firstName = bootstrap.viewer?.displayName?.split(' ')[0] || (isDemo ? 'Robin' : '')
  const connectedSources = bootstrap.sources.filter(source => source.state === 'connected')
  const latestSync = connectedSources.map(source => source.lastSyncedAt).filter(Boolean).sort().at(-1)
  const sourceLabels = connectedSources.map(source => source.provider === 'youtube' ? 'YouTube' : source.provider === 'ausha' ? 'Ausha' : source.provider)
  const syncButton = !isDemo ? `<section class="sync-command ${state.syncing?'is-syncing':''}">
    <div class="sync-command-copy"><span>MISE À JOUR GLOBALE</span><p>${sourceLabels.length ? sourceLabels.join(' + ') : 'Connecte une première source dans les paramètres.'}</p></div>
    <button id="sync-all" type="button" ${state.syncing || !connectedSources.length ? 'disabled' : ''}>
      <span class="sync-command-icon">${icon('sync',26)}</span>
      <strong>${state.syncing ? 'Synchronisation en cours…' : 'Tout synchroniser'}</strong>
      <small>${state.syncing ? 'Aneto interroge toutes tes plateformes' : connectedSources.length ? `${connectedSources.length} source${connectedSources.length>1?'s':''} en un seul clic` : 'Aucune source connectée'}</small>
      ${icon('arrow',20)}
    </button>
    <div class="sync-command-meta"><span>${latestSync ? `Dernière mise à jour · ${new Date(latestSync).toLocaleString('fr-FR')}` : 'Aucune synchronisation terminée'}</span><span>Les données restent en lecture seule</span></div>
    ${state.syncMessage ? `<p class="sync-feedback ${state.syncTone==='success'?'is-success':'is-error'}" role="status">${state.syncMessage}</p>` : ''}
  </section>` : ''
  const syncedLibrary = !isDemo && bootstrap.contentItems.length ? `<section class="synced-library">
    <div class="synced-library-head"><div><span>CONTENUS SYNCHRONISÉS</span><h2>La matière est là.</h2></div><p>${bootstrap.contentItems.length} contenu${bootstrap.contentItems.length>1?'s':''} récent${bootstrap.contentItems.length>1?'s':''}</p></div>
    <div class="synced-content-list">${bootstrap.contentItems.slice(0, 8).map((item,index) => {
      const isVideo = item.provider === 'youtube' || item.kind === 'video'
      const metric = isVideo ? item.payload?.viewCount : item.payload?.downloadsCount
      const label = isVideo ? 'vues' : 'écoutes'
      const transcriptStatus = item.transcript?.status === 'available' ? `TRANSCRIT · ${compactNumber(item.transcript.wordCount)} MOTS` : item.transcript?.status === 'authorization_required' ? 'TRANSCRIPTION À AUTORISER' : item.transcript ? 'SOUS-TITRES INDISPONIBLES' : 'TRANSCRIPTION EN ATTENTE'
      const href = item.transcript ? `/transcripts/${encodeURIComponent(item.id)}` : isVideo ? `https://www.youtube.com/watch?v=${encodeURIComponent(item.externalId)}` : null
      const row = `<span class="synced-content-index">${String(index+1).padStart(2,'0')}</span><span class="synced-content-copy"><small>${isVideo?'YOUTUBE · VIDÉO':'AUSHA · ÉPISODE'}${item.publishedAt?` · ${new Date(item.publishedAt).toLocaleDateString('fr-FR')}`:''} · ${transcriptStatus}</small><strong>${escapeHtml(item.title)}</strong></span><span class="synced-content-metric"><b>${compactNumber(metric)}</b><small>${label}</small></span>${icon(href?'arrow':'check',17)}`
      return href ? `<a href="${href}"${href.startsWith('http')?' target="_blank" rel="noreferrer"':''}>${row}</a>` : `<article>${row}</article>`
    }).join('')}</div>
  </section>` : !isDemo ? '<section class="synced-library is-empty"><div><span>CONTENUS SYNCHRONISÉS</span><h2>En attente du premier contenu.</h2></div><p>Lance la synchronisation globale juste au-dessus.</p></section>' : ''
  const goals = isDemo ? `<button class="intent-input" id="intent-input"><span>Décris ton objectif…</span><kbd>⌘ K</kbd></button><div class="goal-list">${Object.keys(workflows).map((w,i)=>`<button data-workflow="${w}"><span>0${i+1}</span>${w}${icon('arrow',15)}</button>`).join('')}</div>` : '<div class="module-empty"><strong>Les workflows arrivent avec le moteur de jobs.</strong><p>Aucune action fictive ne sera proposée dans un espace connecté.</p></div>'
  const recommendationList = recommendations.length ? recommendations.map((r,i)=>`<button class="rec" data-detail="${i}"><span class="rec-icon ${r.tone}">${r.icon}</span><span class="rec-copy"><small>${escapeHtml(r.type)}</small><strong>${escapeHtml(r.title)}</strong><em>${escapeHtml(r.note)}</em></span><span class="rec-ready">${escapeHtml(r.action)}</span>${icon('arrow',17)}</button>`).join('') : '<div class="module-empty"><strong>Aucune décision pour le moment.</strong><p>Les recommandations apparaîtront après la première synchronisation.</p></div>'
  return `<div class="today page-enter"><header class="minimal-head"><span>ANETO / AUJOURD’HUI</span><div class="brain-status"><i></i>${isDemo?'Le cerveau a appris 128 nouvelles choses cette nuit':`${bootstrap.memoryEvents.length} événements chargés depuis la mémoire`}</div></header>${syncButton}${syncedLibrary}<section class="intent"><p>Bonjour${firstName ? ` ${firstName}` : ''}.</p><h1>Que veux-tu accomplir<br><em>aujourd’hui ?</em></h1>${goals}</section><section class="daily"><div class="daily-title"><p>AUJOURD’HUI, JE RECOMMANDE</p><span>${recommendations.length} décision${recommendations.length>1?'s':''}</span></div><div class="recommendations">${recommendationList}</div></section><footer class="quiet-footer"><span>Rien ne sera publié sans ton accord.</span><button data-view="memory">Ce qu’Aneto a appris ${icon('arrow',14)}</button></footer></div>`
}

async function syncAllSources() {
  state.syncing = true
  state.syncMessage = null
  state.syncTone = null
  render()

  try {
    const response = await fetch('/api/sync/all', { method: 'POST' })
    const result = await response.json()
    if (!response.ok) throw new Error(result.error || 'La synchronisation n’a pas pu démarrer.')

    state.syncing = false
    state.syncMessage = result.message
    state.syncTone = result.status === 'succeeded' ? 'success' : 'error'
    if (result.syncedAt) bootstrap.sources.forEach(source => {
      if (source.state === 'connected') source.lastSyncedAt = result.syncedAt
    })
    render()
    window.setTimeout(() => window.location.reload(), 700)
  } catch (error) {
    state.syncing = false
    state.syncMessage = error instanceof Error ? error.message : 'La synchronisation n’a pas pu démarrer.'
    state.syncTone = 'error'
    render()
  }
}

function intelligence() {
  if (!isDemo && !analysis.count) return unavailableModule('MEDIA DNA™', 'Intelligence', 'Synchronise une première source pour calculer les performances réelles.')
  if (!isDemo) {
    const top = analysis.top
    const transcriptRatio = transcriptCount / analysis.count
    const leadDelta = analysis.averagePrimary ? Math.round(((primaryMetric(top) / analysis.averagePrimary) - 1) * 100) : 0
    const topicEvidence = editorialSignal(analysis.topics)
    const topic = topicEvidence?.label ?? null
    const topHref = contentHref(top)
    const maturity = transcriptCount === 0 ? 'bloqué' : transcriptRatio < .8 ? 'partiel' : analysis.count < 10 ? 'initial' : 'appris'
    const understanding = maturity === 'bloqué'
      ? 'Je vois ce qui marche. Je ne sais pas encore pourquoi.'
      : maturity === 'partiel'
        ? topic
          ? `Un motif se dessine autour de « ${topic} », présent dans ${topicEvidence.count} contenus. La preuve reste incomplète.`
          : 'Les textes deviennent exploitables, mais aucun sujet ne revient encore assez souvent pour constituer un signal.'
        : analysis.count < 10
          ? topic
            ? `« ${topic} » est un premier motif récurrent, observé dans ${topicEvidence.count} contenus.`
            : 'Aneto a identifié des passages forts, mais pas encore de récurrence éditoriale suffisamment démontrée.'
          : topic
            ? `Ton audience répond davantage aux contenus reliés à « ${topic} ».`
            : 'Les performances sont mesurées, mais aucun territoire éditorial récurrent ne domine encore.'
    const decision = maturity === 'bloqué'
      ? {
          label:'ÉTAPE PRIORITAIRE',
          title:'Donner à Aneto accès aux récits, émotions et passages forts.',
          rationale:`Les performances de ${analysis.count} contenus sont mesurées, mais aucune transcription n’est exploitable. Sans le texte, Aneto ne peut pas distinguer un sujet d’un hook ou d’une émotion.`,
          confidence:'COMPRÉHENSION BLOQUÉE',
          href:'/settings',
          cta:'Autoriser les transcriptions',
        }
      : clipCandidates.length ? {
          label:'DÉRUSHAGE PRIORITAIRE',
          title:`Couper les ${Math.min(3,clipCandidates.length)} passages les plus prometteurs avant de produire davantage.`,
          rationale:`Aneto a retrouvé ${clipCandidates.length} passage${clipCandidates.length>1?'s':''} minuté${clipCandidates.length>1?'s':''}. Le premier démarre à ${formatClipTime(clipCandidates[0].start)} dans « ${clipCandidates[0].item.title} » et combine ${clipCandidates[0].reasons.join(', ') || 'une formulation autonome'}.`,
          confidence:'PASSAGES VÉRIFIABLES',
          href:'/clips',
          cta:'Ouvrir la table de montage',
        } : {
          label:'DÉCISION PRIORITAIRE',
          title:`Réexaminer « ${top.title} » avant de produire un nouveau sujet.`,
          rationale:`Ce contenu dépasse la moyenne de ${Math.max(0,leadDelta)} %${topic ? ` et renforce le signal « ${topic} »` : ''}. Aneto recommande d’en extraire d’abord la mécanique éditoriale réutilisable.`,
          confidence:analysis.count < 10 ? 'SIGNAL INITIAL' : 'SIGNAL CONFIRMÉ',
          href:topHref ?? '/',
          cta:top.transcript?.status === 'available' ? 'Ouvrir la matière analysée' : 'Ouvrir le contenu source',
        }
    state.currentDecision = maturity === 'bloqué' ? null : { title:decision.title, rationale:decision.rationale, contentItemId:clipCandidates[0]?.item.id ?? top.id }
    const proofs = [
      {label:'PERFORMANCE',value:`${compactNumber(primaryMetric(top))} ${metricLabel(top)}`,detail:leadDelta > 0 ? `+${leadDelta} % par rapport à la moyenne actuelle.` : 'Meilleur résultat de la bibliothèque actuelle.'},
      {label:'RÉACTION',value:`${analysis.engagementRate.toLocaleString('fr-FR',{maximumFractionDigits:1})} %`,detail:`${compactNumber(analysis.totalLikes + analysis.totalComments)} réactions mesurées sur YouTube.`},
      {label:'DÉRUSHAGE',value:`${clipCandidates.length}`,detail:clipCandidates.length ? `passages minutés dans ${timedTranscriptCount} vidéo${timedTranscriptCount>1?'s':''}.` : transcriptCount ? 'Resynchronisation nécessaire pour récupérer les timecodes.' : 'Aucun récit, hook ou passage encore lisible.'},
    ]
    const hypotheses = [
      {label:'SUJET DOMINANT',value:topic ?? 'Non qualifié',state:topic ? `Présent dans ${topicEvidence.count} contenus · hypothèse à confirmer` : 'Aucune récurrence suffisante dans les textes'},
      {label:'FORMAT OBSERVÉ',value:formatDuration(analysis.averageDurationSeconds),state:'Durée moyenne, sans causalité démontrée'},
      {label:'ANTI-SIGNAL',value:analysis.ranked.at(-1)?.title ?? 'À apprendre',state:'À comparer après davantage de contenus'},
    ]
    const loop = [
      ['01','Comprendre',transcriptCount ? `${transcriptCount} transcription${transcriptCount>1?'s':''} exploitable${transcriptCount>1?'s':''}` : 'Autorisation requise',transcriptCount?'done':'blocked'],
      ['02','Décider','Une priorité, fondée sur les données disponibles','active'],
      ['03','Préparer',clipCandidates.length ? `${clipCandidates.length} extraits avec hooks et timecodes` : 'Hooks, extraits et textes après dérushage',clipCandidates.length?'done':'waiting'],
      ['04','Mesurer','Comparer la publication à sa référence','waiting'],
      ['05','Apprendre',`${bootstrap.memoryEvents.length} événement${bootstrap.memoryEvents.length>1?'s':''} déjà mémorisé${bootstrap.memoryEvents.length>1?'s':''}`,bootstrap.memoryEvents.length?'done':'waiting'],
    ]
    return `<div class="page intelligence intelligence-v2 page-enter">
      <header class="page-head intelligence-head"><div><span>MEDIA DNA™ / RAISONNEMENT ÉDITORIAL</span><h1>Intelligence</h1></div><div class="learning intelligence-state ${maturity}"><i></i><span>Niveau de compréhension<strong>${maturity==='bloqué'?'À débloquer':maturity==='partiel'?'Partiel':maturity==='initial'?'Signal initial':'En apprentissage'}</strong></span></div></header>
      <section class="understanding"><span>CE QU’ANETO A COMPRIS</span><h2>${escapeHtml(understanding)}</h2><p>${transcriptCount ? `${transcriptCount} transcription${transcriptCount>1?'s':''} alimente${transcriptCount>1?'nt':''} cette lecture. Aneto sépare les faits des hypothèses tant que la couverture reste incomplète.` : 'Les chiffres décrivent la performance. Les transcriptions permettront d’expliquer les sujets, les histoires, les émotions et les passages qui la provoquent.'}</p></section>
      <section class="decision-card"><div class="decision-number">01</div><div class="decision-copy"><span>${decision.label}</span><h2>${escapeHtml(decision.title)}</h2><p>${escapeHtml(decision.rationale)}</p><em>${decision.confidence}</em>${state.decisionMessage?`<div class="decision-feedback" role="status">${escapeHtml(state.decisionMessage)}</div>`:''}</div><div class="decision-actions"><a href="${decision.href}"${decision.href.startsWith('http')?' target="_blank" rel="noreferrer"':''}>${decision.cta} ${icon('arrow',16)}</a>${maturity!=='bloqué'?`<button id="commit-decision" type="button" ${state.committingDecision?'disabled':''}>${state.committingDecision?'Mémorisation…':'Retenir cette décision'}</button>`:''}</div></section>
      ${clipCandidates.length ? clipPreview(clipCandidates.slice(0,3)) : transcriptCount ? `<section class="clips-awaiting"><span>${icon('clip',19)}</span><div><small>TIMECODES À RÉCUPÉRER</small><strong>Les textes sont là. Aneto doit maintenant resynchroniser les pistes minutées.</strong></div><button id="sync-from-clips">Relancer l’analyse ${icon('sync',14)}</button></section>` : ''}
      <section class="proofs"><div class="section-label"><span>POURQUOI CETTE DÉCISION</span><em>Faits observés · aucune prédiction inventée</em></div><div class="proof-grid">${proofs.map((proof,index)=>`<article><small>0${index+1} · ${proof.label}</small><strong>${escapeHtml(proof.value)}</strong><p>${escapeHtml(proof.detail)}</p></article>`).join('')}</div></section>
      <section class="hypotheses"><div class="section-label"><span>MEDIA DNA EN APPRENTISSAGE</span><em>Ce qui peut encore changer</em></div>${hypotheses.map((item,index)=>`<article><span>0${index+1}</span><div><small>${item.label}</small><strong>${escapeHtml(item.value)}</strong></div><p>${escapeHtml(item.state)}</p></article>`).join('')}</section>
      <section class="intelligence-loop"><div class="section-label"><span>LA BOUCLE DE VALEUR</span><em>Aneto progresse seulement si le résultat revient dans la mémoire</em></div><div class="loop-grid">${loop.map(([num,title,detail,status])=>`<article class="${status}"><span>${num}</span><i></i><strong>${title}</strong><small>${detail}</small></article>`).join('')}</div></section>
    </div>`
  }
  const dna=[['SUJET','Transformation vécue','× 1,7'],['INVITÉ','Opérateur, pas expert','+ 24 %'],['ÉMOTION','Vulnérabilité','81 / 100'],['FORMAT','Conversation dense','48–62 min'],['PROMESSE','Contre-intuitive','× 2,1']]
  return `<div class="page intelligence page-enter"><header class="page-head"><div><span>MEDIA DNA™</span><h1>Intelligence</h1></div><div class="learning"><i></i><span>Confiance du modèle<strong>91 %</strong></span></div></header><section class="prediction"><div class="prediction-label">SI TU PUBLIAIS UN ÉPISODE AUJOURD’HUI</div><div class="prediction-main"><div><p>Le meilleur pari serait</p><h2>Un restaurateur qui a failli tout perdre,<br>puis a réinventé son management.</h2></div><div class="probability"><strong>78<span>%</span></strong><small>probabilité de<br>surperformance</small></div></div><div class="prediction-reason"><span>${icon('brain',17)}</span><p>Cette recommandation ne vient pas d’un prompt. Elle croise <strong>4 ans de mémoire</strong>, 286 publications, 31 400 commentaires et les signaux détectés cette nuit.</p><button id="prepare-episode">Tout préparer ${icon('arrow',15)}</button></div></section><section class="dna"><div class="section-label"><span>TON ADN ÉDITORIAL</span><em>Dernière évolution aujourd’hui, 03:42</em></div><div class="dna-grid">${dna.map(([type,value,metric],i)=>`<div class="dna-trait"><span>0${i+1} · ${type}</span><strong>${value}</strong><em>${metric}</em></div>`).join('')}</div></section><section class="because"><span>POURQUOI ANETO LE SAIT</span><div class="evidence-line"><i></i><article><small>12 JANVIER</small><strong>Miniature recadrée</strong><p>CTR +18 %. Le modèle augmente le poids du cadrage serré.</p></article><i></i><article><small>28 FÉVRIER</small><strong>Épisode “sans filtre”</strong><p>Rétention +31 %. La vulnérabilité devient un signal fort.</p></article><i class="now"></i><article><small>AUJOURD’HUI</small><strong>Signal « restaurant »</strong><p>La demande externe rejoint exactement ton Media DNA.</p></article></div></section></div>`
}

function clipPreview(candidates) {
  return `<section class="clip-preview"><div class="section-label"><span>LES CUTS À REGARDER D’ABORD</span><em>Texte exact · timecode exact · aucun extrait inventé</em></div><div class="clip-preview-grid">${candidates.map((clip,index)=>`<article><span>0${index+1} · ${clip.score}/100</span><small>${escapeHtml(clip.item.title)}</small><h3>${escapeHtml(clip.title)}</h3><p>« ${escapeHtml(clip.hook)} »</p><footer><strong>${formatClipTime(clip.start)} → ${formatClipTime(clip.end)}</strong><a href="https://www.youtube.com/watch?v=${encodeURIComponent(clip.item.externalId)}&t=${clip.start}s" target="_blank" rel="noreferrer">Voir ${icon('play',13)}</a></footer></article>`).join('')}</div><button class="clip-preview-all" data-view="clips">Voir tous les extraits ${icon('arrow',15)}</button></section>`
}

function clips() {
  const demoClips = isDemo ? [{id:'demo-1',start:2537,end:2591,duration:54,score:92,title:'La décision qui aurait pu tout arrêter',hook:'J’ai compris que continuer comme ça allait nous coûter beaucoup plus cher que de tout changer.',excerpt:'J’ai compris que continuer comme ça allait nous coûter beaucoup plus cher que de tout changer. À ce moment-là, la vraie décision n’était plus financière : elle concernait toute l’équipe.',reasons:['expérience vécue','tension narrative','durée adaptée au short'],item:{title:'Thomas Fantini — décider dans la crise',externalId:'demo',payload:{viewCount:18420}}}] : clipCandidates
  if (!demoClips.length) {
    const hasText = transcriptCount > 0
    return `<div class="page clips-page page-enter"><header class="page-head clips-head"><div><span>STUDIO / DÉRUSHAGE</span><h1>Extraits</h1></div></header><section class="clips-empty"><span>${icon('clip',28)}</span><small>${hasText?'TEXTES DISPONIBLES · TIMECODES ABSENTS':'MATIÈRE À RÉCUPÉRER'}</small><h2>${hasText?'Une dernière synchronisation pour retrouver chaque passage à la seconde près.':'Aneto doit entendre les vidéos avant de proposer des cuts.'}</h2><p>${hasText?'Les anciennes transcriptions ont été importées sans leurs repères temporels. La prochaine synchronisation les enrichira automatiquement.':'Autorise les transcriptions YouTube puis lance la synchronisation globale.'}</p><button id="sync-from-clips" ${bootstrap.sources.some(source=>source.state==='connected')?'':'disabled'}>${hasText?'Récupérer les timecodes':'Synchroniser les vidéos'} ${icon('sync',16)}</button></section></div>`
  }
  const retainedCount = demoClips.filter(clip=>clip.retention).length
  const marketStudy = clipMarketStudy ? `<section class="clip-market-study"><div class="section-label"><span>ÉTUDE DE MARCHÉ INTERNE</span><em>Signaux YouTube mesurés · recommandations à tester</em></div><div class="clip-market-grid"><article><small>OPPORTUNITÉ</small><p>${escapeHtml(clipMarketStudy.opportunity)}</p></article><article><small>AUDIENCE À VISER</small><p>${escapeHtml(clipMarketStudy.audience)}</p></article><article><small>DIFFÉRENCIATION ANETO</small><p>${escapeHtml(clipMarketStudy.differentiation)}</p></article><article><small>SIGNAL À TESTER</small><p>${escapeHtml(clipMarketStudy.marketSignal)}</p></article></div></section>` : ''
  return `<div class="page clips-page page-enter">
    <header class="page-head clips-head"><div><span>STUDIO / DÉRUSHAGE</span><h1>Extraits</h1></div><div class="clips-counter"><strong>${demoClips.length}</strong><span>cuts<br>à examiner</span></div></header>
    <section class="clips-manifesto"><span>ANETO A DÉJÀ DÉRUSHÉ</span><h2>Tu ne cherches plus dans les vidéos.<br>Tu choisis quoi publier.</h2><p>Chaque cut part d’un passage réellement prononcé. Le classement croise tension, fait concret, expérience vécue et durée adaptée${retainedCount ? ` avec les pics de rétention YouTube sur ${retainedCount} proposition${retainedCount>1?'s':''}` : ''}. Ce score aide à trier : il ne promet jamais un nombre de vues.</p></section>
    ${!isDemo ? `<section class="ai-editorial ${state.enrichingClips?'is-working':''}"><div class="ai-editorial-mark">${icon('spark',20)}</div><div><small>OPENROUTER / STRATÉGIE ÉDITORIALE</small><strong>${aiClipCount ? `${aiClipCount} kit${aiClipCount>1?'s':''} de publication prêt${aiClipCount>1?'s':''}` : 'Mets tous les passages en concurrence.'}</strong><p>Une seule requête compare jusqu’à 4 vidéos, produit l’étude interne, les hooks, textes et hashtags. Les citations et timecodes restent intouchables.</p>${state.clipAiMessage?`<em class="${state.clipAiTone==='error'?'is-error':''}" role="status">${escapeHtml(state.clipAiMessage)}</em>`:''}</div><button id="enrich-clips" ${state.enrichingClips?'disabled':''}>${state.enrichingClips?'1 requête en cours…':aiClipCount?'Analyser le lot suivant':'Lancer l’analyse complète'} ${icon(state.enrichingClips?'sync':'arrow',15)}</button></section>` : ''}
    ${marketStudy}
    <section class="clip-table"><div class="section-label"><span>SHORTS À PRÉPARER</span><em>Classés par force éditoriale du texte</em></div>${demoClips.slice(0,18).map((clip,index)=>clipCard(clip,index)).join('')}</section>
  </div>`
}

function clipCard(clip,index) {
  const watchUrl = clip.item.externalId === 'demo' ? '#' : `https://www.youtube.com/watch?v=${encodeURIComponent(clip.item.externalId)}&t=${clip.start}s`
  const hasEditorialKit = clip.aiEnhanced && clip.caption
  const editorialKit = hasEditorialKit ? `<div class="clip-market-angle"><small>ANGLE MARCHÉ · ${escapeHtml(clip.targetAudience)}</small><p>${escapeHtml(clip.marketAngle)}</p></div><div class="clip-caption"><small>TEXTE PRÊT À PUBLIER</small><p>${escapeHtml(clip.caption)}</p><div>${(clip.hashtags ?? []).map(tag=>`<span>${escapeHtml(tag)}</span>`).join('')}</div>${clip.platformFit?.length?`<em>${escapeHtml(clip.platformFit.join(' · '))}</em>`:''}</div>` : ''
  return `<article class="clip-card ${clip.aiEnhanced?'is-ai':''}"><div class="clip-rank"><span>${String(index+1).padStart(2,'0')}</span><strong>${clip.score}</strong><small>SCORE<br>DE CUT</small></div><div class="clip-source"><small>VIDÉO SOURCE</small><strong>${escapeHtml(clip.item.title)}</strong><span>${formatClipTime(clip.start)} → ${formatClipTime(clip.end)} · ${clip.duration} sec</span>${clip.retention?`<em>Rétention relative · ${Math.round(clip.retention.relativeRetentionPerformance*100)}/100</em>`:'<em>Classement sémantique · rétention à importer</em>'}</div><div class="clip-proposal"><small>${clip.aiEnhanced?'TITRE OPENROUTER':'TITRE PROPOSÉ'}</small><h2>${escapeHtml(clip.title)}</h2><div class="clip-hook"><span>${clip.aiEnhanced?'HOOK IA':'HOOK'}</span><p>${escapeHtml(clip.publicationHook ?? clip.hook)}</p></div>${clip.rationale?`<p class="clip-ai-rationale">${icon('spark',12)} ${escapeHtml(clip.rationale)}</p>`:''}${editorialKit}<blockquote><small>PASSAGE RÉELLEMENT PRONONCÉ</small>${escapeHtml(clip.excerpt)}</blockquote><div class="clip-reasons">${clip.reasons.map(reason=>`<span>${escapeHtml(reason)}</span>`).join('')}</div></div><div class="clip-actions">${hasEditorialKit?`<button class="copy-clip" data-copy-clip="${escapeHtml(clip.id)}">${state.copiedClipId===clip.id?`${icon('check',14)} Copié`:`${icon('copy',14)} Copier texte + #`}</button>`:''}${clip.item.externalId==='demo'?'<button data-workflow="Créer 10 Shorts">Préparer le short</button>':`<a href="${watchUrl}" target="_blank" rel="noreferrer">Voir au bon moment ${icon('play',14)}</a><a class="secondary-link" href="/transcripts/${encodeURIComponent(clip.item.id)}">Lire la transcription ${icon('arrow',13)}</a>`}</div></article>`
}

async function copyClipKit(clipId) {
  const clip = clipCandidates.find(candidate => candidate.id === clipId)
  const text = buildClipCopyText(clip)
  if (!text) return
  try {
    await navigator.clipboard.writeText(text)
    state.copiedClipId = clipId
    render()
    window.setTimeout(()=>{ if (state.copiedClipId === clipId) { state.copiedClipId = null; render() } },1800)
  } catch {
    state.clipAiMessage = 'Le navigateur a bloqué la copie. Autorise le presse-papiers puis réessaie.'
    state.clipAiTone = 'error'
    render()
  }
}

async function enrichClipsWithAi() {
  if (state.enrichingClips) return
  state.enrichingClips = true
  state.clipAiMessage = null
  state.clipAiTone = null
  render()
  try {
    const response = await fetch('/api/clips/enrich', { method:'POST' })
    const result = await response.json()
    if (!response.ok) throw new Error(result.error || 'OpenRouter n’a pas pu analyser les extraits.')
    state.enrichingClips = false
    state.clipAiMessage = result.message
    state.clipAiTone = 'success'
    render()
    window.setTimeout(()=>window.location.reload(),700)
  } catch (error) {
    state.enrichingClips = false
    state.clipAiMessage = error instanceof Error ? error.message : 'OpenRouter n’a pas pu analyser les extraits.'
    state.clipAiTone = 'error'
    render()
  }
}

async function commitCurrentDecision() {
  if (!state.currentDecision || state.committingDecision) return
  state.committingDecision = true
  state.decisionMessage = null
  render()
  try {
    const response = await fetch('/api/decisions', {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify(state.currentDecision),
    })
    const result = await response.json()
    if (!response.ok) throw new Error(result.error || 'La décision n’a pas pu être mémorisée.')
    state.committingDecision = false
    state.decisionMessage = result.message
    render()
    window.setTimeout(()=>window.location.reload(), 900)
  } catch (error) {
    state.committingDecision = false
    state.decisionMessage = error instanceof Error ? error.message : 'La décision n’a pas pu être mémorisée.'
    render()
  }
}

function graph() {
  if (!isDemo && !analysis.count) return unavailableModule('CONNAISSANCES', 'Tout sera relié.', 'Synchronise une première source pour créer le graphe réel.')
  const positions = [[23,22],[72,18],[84,45],[75,76],[27,78],[14,48],[49,86],[50,12]]
  const liveNodes = !isDemo ? [
    {id:'workspace',label:bootstrap.organization?.name ?? 'Média',x:50,y:48,r:42,kind:'person',score:`${analysis.count}`,connections:analysis.count+analysis.topics.length,desc:`Espace relié à ${analysis.count} contenus synchronisés et ${analysis.topics.length} sujets détectés.`},
    ...analysis.ranked.slice(0,5).map((item,index)=>({id:item.id,label:item.title.length>22?`${item.title.slice(0,20)}…`:item.title,x:positions[index][0],y:positions[index][1],r:Math.min(34,22+Math.round((primaryMetric(item)/(primaryMetric(analysis.top)||1))*12)),kind:'content',score:compactNumber(primaryMetric(item)),connections:1,desc:`${item.title} · ${compactNumber(primaryMetric(item))} ${item.kind==='video'?'vues':'écoutes'}.`,url:item.provider==='youtube'?`https://www.youtube.com/watch?v=${encodeURIComponent(item.externalId)}`:null})),
    ...analysis.topics.slice(0,3).map((topic,index)=>({id:`topic-${index}`,label:topic.label,x:positions[index+5][0],y:positions[index+5][1],r:20+topic.count*2,kind:'topic',score:`${topic.count}×`,connections:topic.count,desc:`Sujet présent dans ${topic.count} contenu${topic.count>1?'s':''} synchronisé${topic.count>1?'s':''}.`})),
  ] : graphNodes.map(node=>({...node,label:node.id,connections:node.id==='Thomas Fantini'?47:12}))
  const root=liveNodes[0]
  const selected=liveNodes.find(n=>n.id===state.selectedNode) || root
  const inspectorAction = isDemo ? `<button data-detail="0">Voir ce qu’Aneto recommande ${icon('arrow',15)}</button>` : selected.url ? `<a href="${selected.url}" target="_blank" rel="noreferrer">Ouvrir le contenu ${icon('arrow',15)}</a>` : `<button data-view="today">Voir les contenus ${icon('arrow',15)}</button>`
  const graphLabel = isDemo ? 'CONNAISSANCES / 18 420 CONNEXIONS' : `CONNAISSANCES / ${liveNodes.length-1} CONNEXIONS RÉELLES`
  return `<div class="page graph-page page-enter"><header class="page-head graph-head"><div><span>${graphLabel}</span><h1>Tout est relié.</h1></div><button class="graph-search">${icon('search',16)} Explorer une connaissance <kbd>⌘ F</kbd></button></header><section class="graph-stage"><svg viewBox="0 0 1000 660" role="img" aria-label="Graphe des contenus synchronisés"><defs><filter id="glow"><feGaussianBlur stdDeviation="5" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>${liveNodes.slice(1).map((n,i)=>`<line x1="${root.x*10}" y1="${root.y*6.6}" x2="${n.x*10}" y2="${n.y*6.6}" class="connection ${state.selectedNode===n.id?'active':''}"/><circle cx="${(root.x*10+n.x*10)/2}" cy="${(root.y*6.6+n.y*6.6)/2}" r="2" class="signal-dot"><animate attributeName="opacity" values=".1;1;.1" dur="${2+i*.2}s" repeatCount="indefinite"/></circle>`).join('')}${liveNodes.map((n,index)=>`<g class="node ${n.kind} ${selected.id===n.id?'selected':''}" data-node="${n.id}" transform="translate(${n.x*10} ${n.y*6.6})" tabindex="0"><circle r="${n.r}"/><text text-anchor="middle" y="${index===0?-3:3}" class="node-title">${escapeHtml(n.label)}</text>${index===0?`<text text-anchor="middle" y="16" class="node-sub">${isDemo?`PERSONNE · ${n.score}`:`ESPACE · ${n.score} CONTENUS`}</text>`:''}</g>`).join('')}</svg><aside class="node-inspector"><div class="node-kind">${selected.kind==='content'?'CONTENU':selected.kind.toUpperCase()}</div><h2>${escapeHtml(selected.label)}</h2><p>${escapeHtml(selected.desc)}</p><div class="node-stats"><div><span>CONNEXIONS</span><strong>${selected.connections}</strong></div><div><span>SIGNAL</span><strong>${selected.score}</strong></div></div>${inspectorAction}</aside><div class="graph-legend"><span><i class="person"></i>${isDemo?'Personne':'Espace'}</span><span><i class="topic"></i>Sujet</span><span><i class="memory"></i>${isDemo?'Mémoire':'Contenu'}</span><em>Cliquer pour explorer</em></div></section></div>`
}

function memory() {
  const demoEvents = [
    ['AUJOURD’HUI','Le signal « restaurant » accélère','YouTube + Google + Presse convergent. Poids du sujet augmenté de 12 %.','signal'],
    ['12 JANVIER','Tu as changé la miniature de Thomas Fantini','CTR passé de 4,9 % à 5,8 %. Aneto retient : cadrage serré + tension visible.','learn'],
    ['04 DÉCEMBRE','Tu as refusé un hook trop spectaculaire','La version sobre a mieux fidélisé à J+30. Ton ADN privilégie la crédibilité.','decision'],
    ['18 OCTOBRE','L’épisode “Burn-out” a surpris','Performance moyenne au départ, puis +63 % sur 90 jours. Aneto apprend à regarder au-delà du lancement.','learn']
  ]
  const persistedEvents = bootstrap.memoryEvents.map(event => ({date:event.observedAt,title:event.eventType,desc:`Source : ${event.source}`,type:'learn',label:'ÉVÉNEMENT MÉMORISÉ'}))
  const syncEvents = bootstrap.sources.filter(source=>source.lastSyncedAt).map(source=>({date:source.lastSyncedAt,title:`${source.provider==='youtube'?'YouTube':'Ausha'} synchronisé`,desc:`${bootstrap.contentItems.filter(item=>item.provider===source.provider).length} contenus connus après cette synchronisation.`,type:'signal',label:'SYNCHRONISATION'}))
  const contentEvents = bootstrap.contentItems.slice(0,8).map(item=>({date:item.publishedAt,title:item.title,desc:`${compactNumber(primaryMetric(item))} ${item.kind==='video'?'vues':'écoutes'} · importé depuis ${item.provider==='youtube'?'YouTube':'Ausha'}${item.transcript?.status==='available'?` · transcription de ${item.transcript.wordCount} mots`:''}.`,type:'learn',label:item.transcript?.status==='available'?'CONTENU TRANSCRIT':'CONTENU IMPORTÉ'}))
  const liveEvents = [...persistedEvents,...syncEvents,...contentEvents].filter(event=>event.date).sort((a,b)=>new Date(b.date)-new Date(a.date)).slice(0,12)
  const events = isDemo ? demoEvents.map(([date,title,desc,type])=>({date,title,desc,type,label:type==='learn'?'APPRENTISSAGE':type==='signal'?'SIGNAL CROISÉ':'DÉCISION HUMAINE'})) : liveEvents
  const timeline = events.length ? events.map((event,i)=>`<article class="memory-event"><div class="memory-date">${isDemo?event.date:new Date(event.date).toLocaleDateString('fr-FR')}</div><i class="${event.type}"></i><div><span>${event.label}</span><h3>${escapeHtml(event.title)}</h3><p>${escapeHtml(event.desc)}</p>${isDemo&&i===1?'<em>Impact mémorisé · +18 % CTR</em>':''}</div></article>`).join('') : '<div class="module-empty"><strong>La mémoire est vide.</strong><p>Le premier événement sera créé par une synchronisation ou une décision humaine.</p></div>'
  return `<div class="page memory-page page-enter"><header class="page-head"><div><span>MÉMOIRE LONGUE</span><h1>Rien n’est oublié.</h1></div><div class="memory-count"><strong>${events.length}</strong><span>événements<br>chargés</span></div></header><section class="memory-summary"><p>Aneto se souvient de chaque décision et de ce qui s’est passé ensuite.</p><div><span>Décisions mémorisées<strong>${isDemo?'286':bootstrap.decisions.length}</strong></span><span>Contenus connus<strong>${isDemo?'174':bootstrap.contentItems.length}</strong></span><span>Sources actives<strong>${isDemo?'8':bootstrap.sources.filter(source=>source.state==='connected').length}</strong></span></div></section><section class="timeline"><div class="timeline-line"></div>${timeline}</section></div>`
}

function research() {
  if (!isDemo && !analysis.count) return unavailableModule('RESEARCH / SIGNAUX', 'Les contenus parleront.', 'Synchronise une première source pour faire émerger des opportunités réelles.')
  if (!isDemo) {
    const rankedComments = [...analysis.ranked].sort((a,b)=>(Number(b.payload?.commentCount)||0)-(Number(a.payload?.commentCount)||0))
    const ops = [
      ['01',`Capitaliser sur « ${analysis.top.title} »`,'Performance',`${compactNumber(primaryMetric(analysis.top))} ${metricLabel(analysis.top)}`],
      ...(analysis.totalComments ? [['02',`Prolonger la conversation sur « ${rankedComments[0].title} »`,'Conversation',`${compactNumber(rankedComments[0].payload?.commentCount)} commentaires`]] : []),
      ...(analysis.topics[0] ? [['03',`Explorer davantage le sujet « ${analysis.topics[0].label} »`,'Sujet',`${analysis.topics[0].count} contenus`]] : []),
      ...analysis.ranked.slice(1,3).map((item,index)=>[String(index+4).padStart(2,'0'),`Comparer le potentiel de « ${item.title} »`,'Bibliothèque',`${compactNumber(primaryMetric(item))} ${metricLabel(item)}`]),
    ].slice(0,5)
    const activeProviders = [...new Set(bootstrap.sources.filter(source=>source.state==='connected').map(source=>source.provider.toUpperCase()))]
    return `<div class="page research-page page-enter"><header class="page-head"><div><span>RESEARCH / SIGNAUX INTERNES</span><h1>Tes contenus parlent.<br>Aneto compare.</h1></div><div class="scan-orbit"><i></i><span>${bootstrap.sources.filter(source=>source.state==='connected').length} source${bootstrap.sources.filter(source=>source.state==='connected').length>1?'s':''} active${bootstrap.sources.filter(source=>source.state==='connected').length>1?'s':''}<small>${analysis.count} contenus analysés</small></span></div></header><section class="scan-sources">${activeProviders.map(provider=>`<span>${provider}</span>`).join('')}<em>Données issues de la dernière synchronisation</em></section><section class="opportunities"><div class="section-label"><span>OPPORTUNITÉS DÉTECTÉES</span><em>Classées par signal mesuré</em></div>${ops.map(([num,title,type,score])=>`<button class="opportunity signal-arrival" data-view="today"><span>${num}</span><strong>${escapeHtml(title)}</strong><em>${type}</em><b>${escapeHtml(score)}</b>${icon('arrow',16)}</button>`).join('')}</section><section class="research-note"><span>${icon('brain',18)}</span><p>Ces signaux utilisent uniquement les performances synchronisées. <strong>La veille externe n’est pas encore activée.</strong></p></section></div>`
  }
  const ops=[['01','La restauration indépendante cherche une nouvelle voix','Sujet','+42 %'],['02','Camille Étienne × économie réelle','Invité','92 / 100'],['03','Le “quiet leadership” arrive en France','Tendance','+118 %'],['04','Les coulisses d’une transmission de PME','Angle','Fort']]
  return `<div class="page research-page page-enter"><header class="page-head"><div><span>RESEARCH / VEILLE CONTINUE</span><h1>Le monde bouge.<br>Aneto regarde.</h1></div><div class="scan-orbit"><i></i><span>8 sources actives<small>Prochain scan · 02:00</small></span></div></header><section class="scan-sources"><span>YOUTUBE</span><span>SPOTIFY</span><span>TIKTOK</span><span>GOOGLE</span><span>LINKEDIN</span><span>PRESSE</span><span>PODCASTS</span><em>Analysés cette nuit</em></section><section class="opportunities"><div class="section-label"><span>OPPORTUNITÉS DÉTECTÉES</span><em>Classées selon ton Media DNA</em></div>${ops.map(([num,title,type,score])=>`<button class="opportunity"><span>${num}</span><strong>${title}</strong><em>${type}</em><b>${score}</b>${icon('arrow',16)}</button>`).join('')}</section><section class="research-note"><span>${icon('brain',18)}</span><p>Aneto n’affiche pas ce qui est populaire. Il montre ce qui devient pertinent <strong>pour toi</strong>.</p></section></div>`
}

function unavailableModule(label, title, message) {
  return `<div class="page page-enter unavailable-module"><header class="page-head"><div><span>${label}</span><h1>${title}</h1></div></header><div class="module-empty"><strong>Données réelles requises.</strong><p>${message}</p><a href="/settings">Voir les intégrations ${icon('arrow',14)}</a></div></div>`
}

function detailDrawer() {
  const r=recommendations[state.detail]
  const proof = isDemo ? `<div class="prepared-block"><div class="agent-orbs"><i>S</i><i>C</i><i>G</i></div><div><span>3 agents ont travaillé</span><strong>${r.action}</strong></div>${icon('check',18)}</div><div class="reason-list"><span>CE QUI A ÉTÉ CROISÉ</span><p><i></i>4 ans de mémoire éditoriale</p><p><i></i>Signaux externes des dernières 24 h</p><p><i></i>Performance de 286 publications</p><p><i></i>Ton Media DNA actuel</p></div><button class="validate" id="validate-action">Valider et planifier ${icon('arrow',16)}</button>` : r.origin==='persisted' ? '<div class="prepared-block"><div><span>ÉTAT PERSISTÉ</span><strong>Cette décision provient de Supabase.</strong></div></div>' : `<div class="prepared-block"><div><span>CALCUL SUR DONNÉES RÉELLES</span><strong>${escapeHtml(r.action)}</strong></div>${icon('check',18)}</div><div class="reason-list"><span>CE QUI A ÉTÉ CROISÉ</span><p><i></i>${analysis.count} contenus synchronisés</p><p><i></i>${compactNumber(analysis.totalViews)} vues</p><p><i></i>${compactNumber(analysis.totalLikes)} likes</p><p><i></i>${compactNumber(analysis.totalComments)} commentaires</p></div>`
  return `<div class="scrim" data-close></div><aside class="drawer page-enter" role="dialog" aria-modal="true" aria-label="Détail de la décision"><button class="close" data-close aria-label="Fermer">${icon('close')}</button><span class="drawer-label">${escapeHtml(r.type)} · ${escapeHtml(r.confidence)}</span><h2>${escapeHtml(r.title)}</h2><p>${escapeHtml(r.detail)}</p>${proof}<button class="secondary" data-close>Fermer</button></aside>`
}

function workflowPanel() {
  const steps=workflows[state.workflow]
  return `<div class="scrim" data-close></div><section class="workflow-panel page-enter"><header><div><span>WORKFLOW IA</span><h2>${state.workflow}</h2></div><button class="close" data-close>${icon('close')}</button></header><div class="workflow-prompt"><span>${icon('spark',17)}</span><p>L’objectif est compris. Aneto peut préparer l’ensemble du travail avant ta validation.</p></div><div class="workflow-steps">${steps.map((s,i)=>`<div class="workflow-step ${state.prepared?'done':i===0?'working':''}"><span>${state.prepared?icon('check',15):`0${i+1}`}</span><div><strong>${s}</strong><small>${state.prepared?'Prêt à valider':i===0?'Analyse en cours…':'En attente'}</small></div><i></i></div>`).join('')}</div><div class="workflow-footer"><p>${state.prepared?'Tout est prêt. Tu gardes le dernier mot.':'Temps estimé économisé · 2 h 40'}</p><button id="prepare-workflow">${state.prepared?'Ouvrir le résultat':'Tout préparer'} ${icon('arrow',15)}</button></div></section>`
}

function commandPalette() {
  const navigation = [
    ['today','Aujourd’hui','DÉCIDER'],
    ['intelligence','Intelligence','DÉCIDER'],
    ['clips','Extraits','PRODUIRE'],
    ['graph','Connaissances','COMPRENDRE'],
    ['memory','Mémoire','COMPRENDRE'],
    ['research','Signaux','COMPRENDRE'],
  ]
  const suggestions = isDemo
    ? Object.keys(workflows).map(w=>`<button data-workflow="${w}">${w}${icon('arrow',15)}</button>`).join('')
    : navigation.map(([view,label,group])=>`<button data-command-view="${view}"><span><small>${group}</small>${label}</span>${icon('arrow',15)}</button>`).join('')
  const el=document.createElement('div'); el.className='command-wrap'; el.innerHTML=`<div class="command" role="dialog" aria-modal="true" aria-label="Recherche et commandes"><div class="command-input">${icon('spark')}<input autofocus placeholder="${isDemo?'Que veux-tu accomplir ?':'Décider, comprendre ou retrouver…'}"><kbd>ESC</kbd></div><p>${isDemo?'SUGGESTIONS':'NAVIGATION CLASSÉE'}</p>${suggestions}<footer><span>${isDemo?'Aneto prépare. Tu décides.':'Décider · Comprendre · Administrer'}</span><span>↵ Ouvrir</span></footer></div>`; document.body.append(el); el.querySelector('input').focus(); el.onclick=e=>{if(e.target===el)el.remove()}; el.querySelectorAll('[data-workflow]').forEach(b=>b.onclick=()=>{state.workflow=b.dataset.workflow;el.remove();render()}); el.querySelectorAll('[data-command-view]').forEach(b=>b.onclick=()=>{el.remove();navigateToView(b.dataset.commandView)})
}

function activateLivingLayer() {
  if (isDemo && state.view === 'today') {
    const status = document.querySelector('.brain-status')
    if (status) status.innerHTML = '<i></i>Analyse terminée à 05:42 · 18 423 nouveaux signaux'

    const intro = document.querySelector('.intent > p')
    if (intro) intro.textContent = 'Pendant que tu dormais, j’ai compris quelque chose.'

    const title = document.querySelector('.intent h1')
    if (title) title.innerHTML = 'Un sujet est devenu assez fort<br>pour mériter <em>un épisode.</em>'

    const input = document.querySelector('.intent-input span')
    if (input) input.textContent = 'Demander autre chose à Aneto…'

    const insight = document.createElement('div')
    insight.className = 'overnight-insight'
    insight.innerHTML = `<span>CE QUE J’AI VU</span><p>Le signal « restaurant » rejoint ton Media DNA pour la première fois depuis Thomas Fantini.</p><button data-detail="3">Comprendre ${icon('arrow', 14)}</button>`
    document.querySelector('.intent-input')?.before(insight)
  }

  if (isDemo && state.view === 'intelligence') {
    const prediction = document.querySelector('.prediction')
    const probability = document.querySelector('.probability')
    const label = document.querySelector('.prediction-label')
    if (prediction && probability && label) {
      probability.classList.add('answer-probability')
      label.after(probability)
    }
    const reason = document.querySelector('.prediction-reason p')
    if (reason) reason.innerHTML = 'Croisement de <strong>4 ans de mémoire</strong>, 286 publications et des signaux de cette nuit.'
  }

  if (isDemo && state.view === 'graph') {
    const svg = document.querySelector('.graph-stage svg')
    if (svg) {
      document.querySelectorAll('.connection').forEach((line, index) => {
        const x1 = line.getAttribute('x1'), y1 = line.getAttribute('y1')
        const x2 = line.getAttribute('x2'), y2 = line.getAttribute('y2')
        const particle = document.createElementNS('http://www.w3.org/2000/svg', 'circle')
        particle.setAttribute('r', index % 2 ? '1.8' : '2.3')
        particle.setAttribute('class', 'knowledge-particle')
        particle.innerHTML = `<animateMotion dur="${8 + index * 1.7}s" begin="-${index * 1.1}s" repeatCount="indefinite" path="M${x1},${y1} L${x2},${y2}" />`
        svg.insertBefore(particle, svg.querySelector('.node'))
      })
    }
  }

  if (isDemo && state.view === 'research') {
    document.querySelectorAll('.opportunity').forEach((item, index) => {
      item.style.animationDelay = `${120 + index * 90}ms`
      item.classList.add('signal-arrival')
    })
  }

  document.querySelectorAll('.memory-count strong, .learning strong, .probability strong, .dna-trait em').forEach(number => number.classList.add('story-number'))
}

function render() {
  const views={today,intelligence,clips,graph,memory,research}
  document.querySelector('#root').innerHTML=shell(views[state.view]())
  activateLivingLayer()
  bind()
}

function navigateToView(view, { replace = false } = {}) {
  state.view = view
  state.detail = null
  state.workflow = null
  const path = pathForView(view)
  if (window.location.pathname !== path) {
    window.history[replace ? 'replaceState' : 'pushState']({ view }, '', path)
  }
  render()
}

function bind() {
  document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>navigateToView(b.dataset.view))
  document.querySelectorAll('[data-detail]').forEach(b=>b.onclick=()=>{state.detail=Number(b.dataset.detail);render()})
  document.querySelectorAll('[data-workflow]').forEach(b=>b.onclick=()=>{state.workflow=b.dataset.workflow;state.prepared=false;render()})
  document.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>{state.detail=null;state.workflow=null;render()})
  document.querySelectorAll('[data-node]').forEach(n=>{n.onclick=()=>{state.selectedNode=n.dataset.node;render()};n.onkeydown=e=>{if(e.key==='Enter'){state.selectedNode=n.dataset.node;render()}}})
  document.querySelector('#intent-input')?.addEventListener('click',commandPalette)
  document.querySelector('#global-search')?.addEventListener('click',commandPalette)
  document.querySelector('#sync-all')?.addEventListener('click',syncAllSources)
  document.querySelector('#sync-from-clips')?.addEventListener('click',syncAllSources)
  document.querySelector('#enrich-clips')?.addEventListener('click',enrichClipsWithAi)
  document.querySelectorAll('[data-copy-clip]').forEach(button=>button.addEventListener('click',()=>copyClipKit(button.dataset.copyClip)))
  document.querySelector('#commit-decision')?.addEventListener('click',commitCurrentDecision)
  document.querySelector('#prepare-episode')?.addEventListener('click',()=>{state.workflow='Créer un épisode';state.prepared=false;render()})
  document.querySelector('#prepare-workflow')?.addEventListener('click',()=>{state.prepared=true;render()})
  document.querySelector('#validate-action')?.addEventListener('click',e=>{e.currentTarget.innerHTML=`${icon('check',16)} Planifié pour mardi à 08:15`;e.currentTarget.classList.add('validated')})
}

window.addEventListener('keydown',e=>{
  if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='k'){e.preventDefault();if(!document.querySelector('.command-wrap'))commandPalette()}
  if (!e.metaKey && !e.ctrlKey && !e.altKey && !['INPUT','TEXTAREA'].includes(document.activeElement?.tagName)) {
    const routes = { r:'research', g:'graph', m:'memory', i:'intelligence', e:'clips' }
    if (routes[e.key.toLowerCase()]) navigateToView(routes[e.key.toLowerCase()])
    if (isDemo && e.key.toLowerCase() === 'n') { state.workflow='Créer un épisode'; state.prepared=false; render() }
  }
  if(e.key==='Escape'){document.querySelector('.command-wrap')?.remove();if(state.detail||state.workflow){state.detail=null;state.workflow=null;render()}}
})
window.addEventListener('popstate',()=>{state.view=viewForPath(window.location.pathname);state.detail=null;state.workflow=null;render()})
render()
