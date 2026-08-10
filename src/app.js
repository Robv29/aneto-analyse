import { pathForView, viewForPath } from './navigation.mjs'

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
  dots:'<circle cx="5" cy="12" r="1" fill="currentColor"/><circle cx="12" cy="12" r="1" fill="currentColor"/><circle cx="19" cy="12" r="1" fill="currentColor"/>'
}
const icon = (name,size=19) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name]}</svg>`

const state = { view:viewForPath(window.location.pathname), detail:null, workflow:null, prepared:false, selectedNode:'Thomas Fantini' }

const demoRecommendations = [
  {type:'PRIORITÉ', icon:'↗', tone:'lime', title:'Republier Thomas Fantini', note:'Une conversation de 2023 vient de redevenir pertinente.', confidence:'94 %', action:'Republication préparée', detail:'Le sujet « management de crise » progresse de 31 % cette semaine. L’épisode contient un passage jamais publié sur la décision à 160 000 €.'},
  {type:'CRÉATION', icon:'✦', tone:'blue', title:'Créer un Reel', note:'54 secondes déjà identifiées et sous-titrées.', confidence:'89 %', action:'Reel prêt à valider', detail:'L’agent Contenu a isolé le passage qui concentre le plus de réactions émotionnelles et préparé trois hooks.'},
  {type:'ALERTE', icon:'↓', tone:'red', title:'CTR YouTube en baisse', note:'−1,8 point sur les trois dernières miniatures.', confidence:'98 %', action:'3 variantes préparées', detail:'Les visages en plan large sous-performent. Media DNA recommande un cadrage serré, regard caméra, avec moins de quatre mots.'},
  {type:'SIGNAL', icon:'⌁', tone:'gold', title:'Le mot-clé « restaurant » progresse', note:'+42 % dans votre audience et la presse spécialisée.', confidence:'86 %', action:'Recherche enrichie', detail:'Le signal est confirmé sur YouTube, Google Trends et 214 commentaires récents. Trois invités sont liés à cette opportunité.'}
]

const recommendations = isDemo ? demoRecommendations : bootstrap.decisions.map((decision) => ({
  type: 'DÉCISION',
  icon: decision.status === 'accepted' ? '✓' : '↗',
  tone: decision.status === 'accepted' ? 'lime' : 'blue',
  title: decision.title,
  note: decision.rationale,
  confidence: decision.confidence === null ? '—' : `${Math.round(decision.confidence * 100)} %`,
  action: decision.status,
  detail: decision.rationale,
}))

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
  const goals = isDemo ? `<button class="intent-input" id="intent-input"><span>Décris ton objectif…</span><kbd>⌘ K</kbd></button><div class="goal-list">${Object.keys(workflows).map((w,i)=>`<button data-workflow="${w}"><span>0${i+1}</span>${w}${icon('arrow',15)}</button>`).join('')}</div>` : '<div class="module-empty"><strong>Les workflows arrivent avec le moteur de jobs.</strong><p>Aucune action fictive ne sera proposée dans un espace connecté.</p></div>'
  const recommendationList = recommendations.length ? recommendations.map((r,i)=>`<button class="rec" data-detail="${i}"><span class="rec-icon ${r.tone}">${r.icon}</span><span class="rec-copy"><small>${r.type}</small><strong>${r.title}</strong><em>${r.note}</em></span><span class="rec-ready">${r.action}</span>${icon('arrow',17)}</button>`).join('') : '<div class="module-empty"><strong>Aucune décision pour le moment.</strong><p>Les recommandations apparaîtront après la première synchronisation.</p></div>'
  return `<div class="today page-enter"><header class="minimal-head"><span>ANETO / AUJOURD’HUI</span><div class="brain-status"><i></i>${isDemo?'Le cerveau a appris 128 nouvelles choses cette nuit':`${bootstrap.memoryEvents.length} événements chargés depuis la mémoire`}</div></header><section class="intent"><p>Bonjour${firstName ? ` ${firstName}` : ''}.</p><h1>Que veux-tu accomplir<br><em>aujourd’hui ?</em></h1>${goals}</section><section class="daily"><div class="daily-title"><p>AUJOURD’HUI, JE RECOMMANDE</p><span>${recommendations.length} décision${recommendations.length>1?'s':''}</span></div><div class="recommendations">${recommendationList}</div></section><footer class="quiet-footer"><span>Rien ne sera publié sans ton accord.</span><button data-view="memory">Ce qu’Aneto a appris ${icon('arrow',14)}</button></footer></div>`
}

function intelligence() {
  if (!isDemo) return unavailableModule('MEDIA DNA™', 'Intelligence', 'Le calcul Media DNA sera activé après la première synchronisation complète.')
  const dna=[['SUJET','Transformation vécue','× 1,7'],['INVITÉ','Opérateur, pas expert','+ 24 %'],['ÉMOTION','Vulnérabilité','81 / 100'],['FORMAT','Conversation dense','48–62 min'],['PROMESSE','Contre-intuitive','× 2,1']]
  return `<div class="page intelligence page-enter"><header class="page-head"><div><span>MEDIA DNA™</span><h1>Intelligence</h1></div><div class="learning"><i></i><span>Confiance du modèle<strong>91 %</strong></span></div></header><section class="prediction"><div class="prediction-label">SI TU PUBLIAIS UN ÉPISODE AUJOURD’HUI</div><div class="prediction-main"><div><p>Le meilleur pari serait</p><h2>Un restaurateur qui a failli tout perdre,<br>puis a réinventé son management.</h2></div><div class="probability"><strong>78<span>%</span></strong><small>probabilité de<br>surperformance</small></div></div><div class="prediction-reason"><span>${icon('brain',17)}</span><p>Cette recommandation ne vient pas d’un prompt. Elle croise <strong>4 ans de mémoire</strong>, 286 publications, 31 400 commentaires et les signaux détectés cette nuit.</p><button id="prepare-episode">Tout préparer ${icon('arrow',15)}</button></div></section><section class="dna"><div class="section-label"><span>TON ADN ÉDITORIAL</span><em>Dernière évolution aujourd’hui, 03:42</em></div><div class="dna-grid">${dna.map(([type,value,metric],i)=>`<div class="dna-trait"><span>0${i+1} · ${type}</span><strong>${value}</strong><em>${metric}</em></div>`).join('')}</div></section><section class="because"><span>POURQUOI ANETO LE SAIT</span><div class="evidence-line"><i></i><article><small>12 JANVIER</small><strong>Miniature recadrée</strong><p>CTR +18 %. Le modèle augmente le poids du cadrage serré.</p></article><i></i><article><small>28 FÉVRIER</small><strong>Épisode “sans filtre”</strong><p>Rétention +31 %. La vulnérabilité devient un signal fort.</p></article><i class="now"></i><article><small>AUJOURD’HUI</small><strong>Signal « restaurant »</strong><p>La demande externe rejoint exactement ton Media DNA.</p></article></div></section></div>`
}

function graph() {
  if (!isDemo) return unavailableModule('CONNAISSANCES', 'Tout sera relié.', 'Le graphe restera vide jusqu’à ce que de vraies entités soient extraites des contenus.')
  const selected=graphNodes.find(n=>n.id===state.selectedNode) || graphNodes[0]
  return `<div class="page graph-page page-enter"><header class="page-head graph-head"><div><span>CONNAISSANCES / 18 420 CONNEXIONS</span><h1>Tout est relié.</h1></div><button class="graph-search">${icon('search',16)} Explorer une connaissance <kbd>⌘ F</kbd></button></header><section class="graph-stage"><svg viewBox="0 0 1000 660" role="img" aria-label="Graphe de connaissances autour de Thomas Fantini"><defs><filter id="glow"><feGaussianBlur stdDeviation="5" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>${graphNodes.slice(1).map((n,i)=>{const root=graphNodes[0];return `<line x1="${root.x*10}" y1="${root.y*6.6}" x2="${n.x*10}" y2="${n.y*6.6}" class="connection ${state.selectedNode===n.id?'active':''}"/><circle cx="${(root.x*10+n.x*10)/2}" cy="${(root.y*6.6+n.y*6.6)/2}" r="2" class="signal-dot"><animate attributeName="opacity" values=".1;1;.1" dur="${2+i*.2}s" repeatCount="indefinite"/></circle>`}).join('')}${graphNodes.map(n=>`<g class="node ${n.kind} ${state.selectedNode===n.id?'selected':''}" data-node="${n.id}" transform="translate(${n.x*10} ${n.y*6.6})" tabindex="0"><circle r="${n.r}"/><text text-anchor="middle" y="${n.id==='Thomas Fantini'?-3:3}" class="node-title">${n.id}</text>${n.id==='Thomas Fantini'?`<text text-anchor="middle" y="16" class="node-sub">PERSONNE · ${n.score}</text>`:''}</g>`).join('')}</svg><aside class="node-inspector"><div class="node-kind">${selected.kind.toUpperCase()}</div><h2>${selected.id}</h2><p>${selected.desc}</p><div class="node-stats"><div><span>CONNEXIONS</span><strong>${selected.id==='Thomas Fantini'?'47':'12'}</strong></div><div><span>CONFIANCE</span><strong>${selected.id==='Thomas Fantini'?'94 %':'87 %'}</strong></div></div><button data-detail="0">Voir ce qu’Aneto recommande ${icon('arrow',15)}</button></aside><div class="graph-legend"><span><i class="person"></i>Personne</span><span><i class="topic"></i>Sujet</span><span><i class="memory"></i>Mémoire</span><em>Glisser · Cliquer pour explorer</em></div></section></div>`
}

function memory() {
  const events=isDemo ? [
    ['AUJOURD’HUI','Le signal « restaurant » accélère','YouTube + Google + Presse convergent. Poids du sujet augmenté de 12 %.','signal'],
    ['12 JANVIER','Tu as changé la miniature de Thomas Fantini','CTR passé de 4,9 % à 5,8 %. Aneto retient : cadrage serré + tension visible.','learn'],
    ['04 DÉCEMBRE','Tu as refusé un hook trop spectaculaire','La version sobre a mieux fidélisé à J+30. Ton ADN privilégie la crédibilité.','decision'],
    ['18 OCTOBRE','L’épisode “Burn-out” a surpris','Performance moyenne au départ, puis +63 % sur 90 jours. Aneto apprend à regarder au-delà du lancement.','learn']
  ] : bootstrap.memoryEvents.map(event => [new Date(event.observedAt).toLocaleDateString('fr-FR'), event.eventType, `Source : ${event.source}`, 'learn'])
  const timeline = events.length ? events.map(([date,title,desc,type],i)=>`<article class="memory-event"><div class="memory-date">${date}</div><i class="${type}"></i><div><span>${type==='learn'?'APPRENTISSAGE':type==='signal'?'SIGNAL CROISÉ':'DÉCISION HUMAINE'}</span><h3>${title}</h3><p>${desc}</p>${isDemo&&i===1?'<em>Impact mémorisé · +18 % CTR</em>':''}</div></article>`).join('') : '<div class="module-empty"><strong>La mémoire est vide.</strong><p>Le premier événement sera créé par une synchronisation ou une décision humaine.</p></div>'
  return `<div class="page memory-page page-enter"><header class="page-head"><div><span>MÉMOIRE LONGUE</span><h1>Rien n’est oublié.</h1></div><div class="memory-count"><strong>${events.length}</strong><span>événements<br>chargés</span></div></header><section class="memory-summary"><p>Aneto se souvient de chaque décision et de ce qui s’est passé ensuite.</p><div><span>Décisions mémorisées<strong>${isDemo?'286':bootstrap.decisions.length}</strong></span><span>Contenus connus<strong>${isDemo?'174':bootstrap.contentItems.length}</strong></span><span>Sources actives<strong>${isDemo?'8':bootstrap.sources.filter(source=>source.state==='connected').length}</strong></span></div></section><section class="timeline"><div class="timeline-line"></div>${timeline}</section></div>`
}

function research() {
  if (!isDemo) return unavailableModule('RESEARCH / VEILLE CONTINUE', 'Le monde bouge. Aneto regardera.', 'La veille sera activée lorsqu’un premier connecteur sera synchronisé.')
  const ops=[['01','La restauration indépendante cherche une nouvelle voix','Sujet','+42 %'],['02','Camille Étienne × économie réelle','Invité','92 / 100'],['03','Le “quiet leadership” arrive en France','Tendance','+118 %'],['04','Les coulisses d’une transmission de PME','Angle','Fort']]
  return `<div class="page research-page page-enter"><header class="page-head"><div><span>RESEARCH / VEILLE CONTINUE</span><h1>Le monde bouge.<br>Aneto regarde.</h1></div><div class="scan-orbit"><i></i><span>8 sources actives<small>Prochain scan · 02:00</small></span></div></header><section class="scan-sources"><span>YOUTUBE</span><span>SPOTIFY</span><span>TIKTOK</span><span>GOOGLE</span><span>LINKEDIN</span><span>PRESSE</span><span>PODCASTS</span><em>Analysés cette nuit</em></section><section class="opportunities"><div class="section-label"><span>OPPORTUNITÉS DÉTECTÉES</span><em>Classées selon ton Media DNA</em></div>${ops.map(([num,title,type,score])=>`<button class="opportunity"><span>${num}</span><strong>${title}</strong><em>${type}</em><b>${score}</b>${icon('arrow',16)}</button>`).join('')}</section><section class="research-note"><span>${icon('brain',18)}</span><p>Aneto n’affiche pas ce qui est populaire. Il montre ce qui devient pertinent <strong>pour toi</strong>.</p></section></div>`
}

function unavailableModule(label, title, message) {
  return `<div class="page page-enter unavailable-module"><header class="page-head"><div><span>${label}</span><h1>${title}</h1></div></header><div class="module-empty"><strong>Données réelles requises.</strong><p>${message}</p><a href="/settings">Voir les intégrations ${icon('arrow',14)}</a></div></div>`
}

function detailDrawer() {
  const r=recommendations[state.detail]
  const proof = isDemo ? `<div class="prepared-block"><div class="agent-orbs"><i>S</i><i>C</i><i>G</i></div><div><span>3 agents ont travaillé</span><strong>${r.action}</strong></div>${icon('check',18)}</div><div class="reason-list"><span>CE QUI A ÉTÉ CROISÉ</span><p><i></i>4 ans de mémoire éditoriale</p><p><i></i>Signaux externes des dernières 24 h</p><p><i></i>Performance de 286 publications</p><p><i></i>Ton Media DNA actuel</p></div><button class="validate" id="validate-action">Valider et planifier ${icon('arrow',16)}</button>` : '<div class="prepared-block"><div><span>ÉTAT PERSISTÉ</span><strong>Cette décision provient de Supabase.</strong></div></div>'
  return `<div class="scrim" data-close></div><aside class="drawer page-enter" role="dialog" aria-modal="true" aria-label="Détail de la décision"><button class="close" data-close aria-label="Fermer">${icon('close')}</button><span class="drawer-label">${r.type} · CONFIANCE ${r.confidence}</span><h2>${r.title}</h2><p>${r.detail}</p>${proof}<button class="secondary" data-close>Fermer</button></aside>`
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
