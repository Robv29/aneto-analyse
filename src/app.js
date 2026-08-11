import { pathForView, viewForPath } from './navigation.mjs'
import { analyzeContent, primaryMetric } from './analytics.mjs'

const bootstrap = window.__ANETO_BOOTSTRAP__ || {
  mode: 'demo', viewer: null, organization: null, sources: [], contentItems: [], decisions: [], memoryEvents: [], connectors: [],
}
const isDemo = bootstrap.mode === 'demo'

const icons = {
  home:'<path d="M4 11.5 12 5l8 6.5V20H4Z"/><path d="M9 20v-6h6v6"/>',
  brain:'<path d="M9.5 4.5A3.5 3.5 0 0 0 6 8v.4A3.6 3.6 0 0 0 4 15a3.5 3.5 0 0 0 5.5 2.9M14.5 4.5A3.5 3.5 0 0 1 18 8v.4a3.6 3.6 0 0 1 2 6.6 3.5 3.5 0 0 1-5.5 2.9M12 4v16M8.5 9.5c2 0 3.5 1.2 3.5 3M15.5 9.5c-2 0-3.5 1.2-3.5 3"/>',
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
  dots:'<circle cx="5" cy="12" r="1" fill="currentColor"/><circle cx="12" cy="12" r="1" fill="currentColor"/><circle cx="19" cy="12" r="1" fill="currentColor"/>'
}
const icon = (name,size=19) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name]}</svg>`
const escapeHtml = (value) => String(value ?? '').replace(/[&<>"]/g, character => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' })[character])
const compactNumber = (value) => Number.isFinite(Number(value)) ? new Intl.NumberFormat('fr-FR', { notation:'compact', maximumFractionDigits:1 }).format(Number(value)) : '—'
const formatDuration = (seconds) => seconds ? `${Math.floor(seconds/60)} min${seconds%60 ? ` ${seconds%60}s` : ''}` : '—'
const metricLabel = (item) => item?.kind === 'video' ? 'vues' : 'écoutes'
const analysis = analyzeContent(bootstrap.contentItems)
const transcriptCount = bootstrap.contentItems.filter(item => item.transcript?.status === 'available').length

const state = { view:viewForPath(window.location.pathname), detail:null, workflow:null, prepared:false, selectedNode:'Thomas Fantini', syncing:false, syncMessage:null, syncTone:null }

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
  const nav=[['today','home','Aujourd’hui'],['intelligence','brain','Intelligence'],['graph','graph','Graph'],['memory','memory','Mémoire'],['research','radar','Research']]
  const identity = bootstrap.viewer?.displayName || bootstrap.viewer?.email || 'Paramètres'
  const initials = bootstrap.viewer?.displayName?.split(/\s+/).map(part => part[0]).join('').slice(0, 2).toUpperCase() || '⚙'
  const demoBanner = isDemo ? '<div class="demo-banner"><strong>MODE DÉMO</strong><span>Les données visibles sont illustratives.</span><a href="/settings">Configurer le produit</a></div>' : ''
  return `<div class="shell"><aside class="rail"><button class="logo" data-view="today" aria-label="Aneto">A</button><nav>${nav.map(([view,ic,label])=>`<button class="rail-button ${state.view===view?'active':''}" data-view="${view}" aria-label="${label}">${icon(ic)}<span>${label}</span></button>`).join('')}</nav><div class="rail-bottom"><button class="rail-button" id="global-search" aria-label="Rechercher">${icon('search')}<span>Rechercher</span></button><a class="avatar" href="/settings" aria-label="${identity}">${initials}</a></div></aside><main class="content">${demoBanner}${content}</main>${state.detail!==null?detailDrawer():''}${state.workflow?workflowPanel():''}</div>`
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
    const dna = [
      ['PORTÉE', `${compactNumber(analysis.totalPrimary)} vues`, `${analysis.count} contenus`],
      ['MOYENNE', `${compactNumber(analysis.averagePrimary)} vues`, 'par contenu'],
      ['ENGAGEMENT', `${analysis.engagementRate.toLocaleString('fr-FR', { maximumFractionDigits:1 })} %`, `${compactNumber(analysis.totalLikes + analysis.totalComments)} réactions`],
      ['FORMAT', formatDuration(analysis.averageDurationSeconds), 'durée moyenne'],
      ['SUJET', analysis.topics[0]?.label ?? 'À qualifier', analysis.topics[0] ? `${analysis.topics[0].count} occurrence${analysis.topics[0].count>1?'s':''}` : 'titres analysés'],
    ]
    const evidence = analysis.ranked.slice(0, 3)
    return `<div class="page intelligence page-enter"><header class="page-head"><div><span>MEDIA DNA™ / DONNÉES RÉELLES</span><h1>Intelligence</h1></div><div class="learning"><i></i><span>Transcriptions disponibles<strong>${transcriptCount} / ${analysis.count}</strong></span></div></header><section class="prediction"><div class="prediction-label">CONTENU LE PLUS PERFORMANT</div><div class="prediction-main"><div><p>Le signal le plus fort est</p><h2>${escapeHtml(top.title)}</h2></div><div class="probability answer-probability"><strong>${compactNumber(primaryMetric(top))}</strong><small>${top.kind==='video'?'vues YouTube':'écoutes Ausha'}<br>synchronisées</small></div></div><div class="prediction-reason"><span>${icon('brain',17)}</span><p>Résultat calculé sur <strong>${analysis.count} contenus réels</strong>, ${compactNumber(analysis.totalLikes)} likes et ${compactNumber(analysis.totalComments)} commentaires. Les sujets utilisent les transcriptions lorsqu’elles sont disponibles.</p><button data-view="today">Voir les contenus ${icon('arrow',15)}</button></div></section><section class="dna"><div class="section-label"><span>TON ADN MESURÉ</span><em>Mis à jour à la dernière synchronisation</em></div><div class="dna-grid">${dna.map(([type,value,metric],i)=>`<div class="dna-trait"><span>0${i+1} · ${type}</span><strong>${escapeHtml(value)}</strong><em>${escapeHtml(metric)}</em></div>`).join('')}</div></section><section class="because"><span>LES 3 PREUVES LES PLUS FORTES</span><div class="evidence-line">${evidence.map((item,index)=>`<i class="${index===0?'now':''}"></i><article><small>${item.publishedAt?new Date(item.publishedAt).toLocaleDateString('fr-FR'):'DATE INCONNUE'}</small><strong>${escapeHtml(item.title)}</strong><p>${compactNumber(primaryMetric(item))} ${item.kind==='video'?'vues':'écoutes'} · ${compactNumber(item.payload?.likeCount)} likes · ${compactNumber(item.payload?.commentCount)} commentaires</p></article>`).join('')}</div></section></div>`
  }
  const dna=[['SUJET','Transformation vécue','× 1,7'],['INVITÉ','Opérateur, pas expert','+ 24 %'],['ÉMOTION','Vulnérabilité','81 / 100'],['FORMAT','Conversation dense','48–62 min'],['PROMESSE','Contre-intuitive','× 2,1']]
  return `<div class="page intelligence page-enter"><header class="page-head"><div><span>MEDIA DNA™</span><h1>Intelligence</h1></div><div class="learning"><i></i><span>Confiance du modèle<strong>91 %</strong></span></div></header><section class="prediction"><div class="prediction-label">SI TU PUBLIAIS UN ÉPISODE AUJOURD’HUI</div><div class="prediction-main"><div><p>Le meilleur pari serait</p><h2>Un restaurateur qui a failli tout perdre,<br>puis a réinventé son management.</h2></div><div class="probability"><strong>78<span>%</span></strong><small>probabilité de<br>surperformance</small></div></div><div class="prediction-reason"><span>${icon('brain',17)}</span><p>Cette recommandation ne vient pas d’un prompt. Elle croise <strong>4 ans de mémoire</strong>, 286 publications, 31 400 commentaires et les signaux détectés cette nuit.</p><button id="prepare-episode">Tout préparer ${icon('arrow',15)}</button></div></section><section class="dna"><div class="section-label"><span>TON ADN ÉDITORIAL</span><em>Dernière évolution aujourd’hui, 03:42</em></div><div class="dna-grid">${dna.map(([type,value,metric],i)=>`<div class="dna-trait"><span>0${i+1} · ${type}</span><strong>${value}</strong><em>${metric}</em></div>`).join('')}</div></section><section class="because"><span>POURQUOI ANETO LE SAIT</span><div class="evidence-line"><i></i><article><small>12 JANVIER</small><strong>Miniature recadrée</strong><p>CTR +18 %. Le modèle augmente le poids du cadrage serré.</p></article><i></i><article><small>28 FÉVRIER</small><strong>Épisode “sans filtre”</strong><p>Rétention +31 %. La vulnérabilité devient un signal fort.</p></article><i class="now"></i><article><small>AUJOURD’HUI</small><strong>Signal « restaurant »</strong><p>La demande externe rejoint exactement ton Media DNA.</p></article></div></section></div>`
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
  const navigation = [['today','Aujourd’hui'],['intelligence','Intelligence'],['graph','Graph'],['memory','Mémoire'],['research','Research']]
  const suggestions = isDemo
    ? Object.keys(workflows).map(w=>`<button data-workflow="${w}">${w}${icon('arrow',15)}</button>`).join('')
    : navigation.map(([view,label])=>`<button data-command-view="${view}">${label}${icon('arrow',15)}</button>`).join('')
  const el=document.createElement('div'); el.className='command-wrap'; el.innerHTML=`<div class="command" role="dialog" aria-modal="true" aria-label="Recherche et commandes"><div class="command-input">${icon('spark')}<input autofocus placeholder="${isDemo?'Que veux-tu accomplir ?':'Rechercher une section'}"><kbd>ESC</kbd></div><p>SUGGESTIONS</p>${suggestions}<footer><span>${isDemo?'Aneto prépare. Tu décides.':'Navigation dans l’espace connecté.'}</span><span>↵ Ouvrir</span></footer></div>`; document.body.append(el); el.querySelector('input').focus(); el.onclick=e=>{if(e.target===el)el.remove()}; el.querySelectorAll('[data-workflow]').forEach(b=>b.onclick=()=>{state.workflow=b.dataset.workflow;el.remove();render()}); el.querySelectorAll('[data-command-view]').forEach(b=>b.onclick=()=>{el.remove();navigateToView(b.dataset.commandView)})
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
  const views={today,intelligence,graph,memory,research}
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
  document.querySelector('#prepare-episode')?.addEventListener('click',()=>{state.workflow='Créer un épisode';state.prepared=false;render()})
  document.querySelector('#prepare-workflow')?.addEventListener('click',()=>{state.prepared=true;render()})
  document.querySelector('#validate-action')?.addEventListener('click',e=>{e.currentTarget.innerHTML=`${icon('check',16)} Planifié pour mardi à 08:15`;e.currentTarget.classList.add('validated')})
}

window.addEventListener('keydown',e=>{
  if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='k'){e.preventDefault();if(!document.querySelector('.command-wrap'))commandPalette()}
  if (!e.metaKey && !e.ctrlKey && !e.altKey && !['INPUT','TEXTAREA'].includes(document.activeElement?.tagName)) {
    const routes = { r:'research', g:'graph', m:'memory', i:'intelligence' }
    if (routes[e.key.toLowerCase()]) navigateToView(routes[e.key.toLowerCase()])
    if (isDemo && e.key.toLowerCase() === 'n') { state.workflow='Créer un épisode'; state.prepared=false; render() }
  }
  if(e.key==='Escape'){document.querySelector('.command-wrap')?.remove();if(state.detail||state.workflow){state.detail=null;state.workflow=null;render()}}
})
window.addEventListener('popstate',()=>{state.view=viewForPath(window.location.pathname);state.detail=null;state.workflow=null;render()})
render()
