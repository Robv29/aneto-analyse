'use client'

import Link from 'next/link'
import { useState } from 'react'
import { Icon } from './icons'

export type GraphNode = {
  id: string
  label: string
  x: number
  y: number
  r: number
  kind: string
  score: string
  connections: number
  desc: string
  url: string | null
}

export function GraphStage({ nodes, workspaceLabel }: { nodes: GraphNode[]; workspaceLabel: string }) {
  const root = nodes[0]
  const [selectedId, setSelectedId] = useState(root.id)
  const selected = nodes.find((node) => node.id === selectedId) ?? root

  return (
    <section className="graph-stage">
      <svg viewBox="0 0 1000 660" role="img" aria-label="Graphe des contenus synchronisés">
        <defs>
          <filter id="glow">
            <feGaussianBlur stdDeviation="5" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>
        {nodes.slice(1).map((node, index) => (
          <g key={`link-${node.id}`}>
            <line
              x1={root.x * 10} y1={root.y * 6.6}
              x2={node.x * 10} y2={node.y * 6.6}
              className={`connection ${selectedId === node.id ? 'active' : ''}`}
            />
            <circle cx={(root.x * 10 + node.x * 10) / 2} cy={(root.y * 6.6 + node.y * 6.6) / 2} r={2} className="signal-dot">
              <animate attributeName="opacity" values=".1;1;.1" dur={`${2 + index * .2}s`} repeatCount="indefinite" />
            </circle>
          </g>
        ))}
        {nodes.map((node, index) => (
          <g
            key={node.id}
            className={`node ${node.kind} ${selected.id === node.id ? 'selected' : ''}`}
            transform={`translate(${node.x * 10} ${node.y * 6.6})`}
            tabIndex={0}
            onClick={() => setSelectedId(node.id)}
            onKeyDown={(event) => { if (event.key === 'Enter') setSelectedId(node.id) }}
          >
            <circle r={node.r} />
            <text textAnchor="middle" y={index === 0 ? -3 : 3} className="node-title">{node.label}</text>
            {index === 0 ? (
              <text textAnchor="middle" y={16} className="node-sub">ESPACE · {node.score} CONTENUS</text>
            ) : null}
          </g>
        ))}
      </svg>
      <aside className="node-inspector">
        <div className="node-kind">{selected.kind === 'content' ? 'CONTENU' : selected.kind.toUpperCase()}</div>
        <h2>{selected.label}</h2>
        <p>{selected.desc}</p>
        <div className="node-stats">
          <div><span>CONNEXIONS</span><strong>{selected.connections}</strong></div>
          <div><span>SIGNAL</span><strong>{selected.score}</strong></div>
        </div>
        {selected.url ? (
          <a href={selected.url} target="_blank" rel="noreferrer">Ouvrir le contenu <Icon name="arrow" size={15} /></a>
        ) : (
          <Link href="/">Voir les contenus <Icon name="arrow" size={15} /></Link>
        )}
      </aside>
      <div className="graph-legend">
        <span><i className="person"></i>{workspaceLabel}</span>
        <span><i className="topic"></i>Sujet</span>
        <span><i className="memory"></i>Contenu</span>
        <em>Cliquer pour explorer</em>
      </div>
    </section>
  )
}
