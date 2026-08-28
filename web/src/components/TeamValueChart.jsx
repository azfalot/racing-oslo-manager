import React, { useState, useMemo } from 'react'
import { TrendingUp, Shield, BarChart2, Check, X, ArrowUpRight, Award, Filter, Eye } from 'lucide-react'
import historyData from '../data/teamValueHistory.json'

export default function TeamValueChart({ onClose }) {
  const [viewMode, setViewMode] = useState('chart') // 'chart' | 'ranking'
  const [activeTeams, setActiveTeams] = useState(
    historyData.teams.reduce((acc, t) => ({ ...acc, [t.name]: true }), {})
  )
  const [hoveredPoint, setHoveredPoint] = useState(null)
  const [highlightedTeam, setHighlightedTeam] = useState(null)

  const matchdays = historyData.matchdays
  const teams = historyData.teams

  const meTeam = teams.find(t => t.isMe) || teams[0]
  const meInitial = meTeam.values[0]
  const meCurrent = meTeam.values[meTeam.values.length - 1]
  const meGrowthM = (meCurrent - meInitial).toFixed(2)
  const meGrowthPct = (((meCurrent - meInitial) / meInitial) * 100).toFixed(1)

  // Presets de visualización
  const setPreset = (preset) => {
    if (preset === 'me') {
      const newMap = {}
      teams.forEach(t => { newMap[t.name] = t.isMe })
      setActiveTeams(newMap)
    } else if (preset === 'vsLeader') {
      const newMap = {}
      teams.forEach(t => { newMap[t.name] = t.isMe || t.name.includes('Fermín') })
      setActiveTeams(newMap)
    } else if (preset === 'top5') {
      const sorted = [...teams].sort((a, b) => b.squadValue - a.squadValue)
      const top5Names = new Set(sorted.slice(0, 5).map(t => t.name))
      const newMap = {}
      teams.forEach(t => { newMap[t.name] = top5Names.has(t.name) || t.isMe })
      setActiveTeams(newMap)
    } else {
      const newMap = {}
      teams.forEach(t => { newMap[t.name] = true })
      setActiveTeams(newMap)
    }
  }

  // Dimensiones SVG
  const width = 850
  const height = 360
  const paddingLeft = 60
  const paddingRight = 40
  const paddingTop = 35
  const paddingBottom = 45

  const chartWidth = width - paddingLeft - paddingRight
  const chartHeight = height - paddingTop - paddingBottom

  // Cálculo de Rango Y Dinámico
  const visibleTeams = teams.filter(t => activeTeams[t.name])
  const allVisibleValues = visibleTeams.flatMap(t => t.values)
  const rawMin = allVisibleValues.length > 0 ? Math.min(...allVisibleValues) : 20
  const rawMax = allVisibleValues.length > 0 ? Math.max(...allVisibleValues) : 70

  const minY = Math.max(0, Math.floor(rawMin / 5) * 5 - 5)
  const maxY = Math.ceil(rawMax / 5) * 5 + 5

  const getX = (index) => paddingLeft + (index / Math.max(1, matchdays.length - 1)) * chartWidth
  const getY = (val) => paddingTop + chartHeight - ((val - minY) / Math.max(1, maxY - minY)) * chartHeight

  // Generador de líneas suaves (Bezier Curve)
  const createSmoothPath = (values) => {
    const points = values.map((val, idx) => ({ x: getX(idx), y: getY(val) }))
    if (points.length === 0) return ''

    let d = `M ${points[0].x} ${points[0].y}`
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i]
      const p1 = points[i + 1]
      const cp1X = p0.x + (p1.x - p0.x) / 2
      const cp1Y = p0.y
      const cp2X = p0.x + (p1.x - p0.x) / 2
      const cp2Y = p1.y
      d += ` C ${cp1X} ${cp1Y}, ${cp2X} ${cp2Y}, ${p1.x} ${p1.y}`
    }
    return d
  }

  // Y-ticks
  const yTicks = []
  const step = Math.ceil((maxY - minY) / 5)
  for (let yVal = minY; yVal <= maxY; yVal += step) {
    yTicks.push(yVal)
  }

  // Ranking ordenado por valor de plantilla actual
  const sortedTeams = useMemo(() => {
    return [...teams].sort((a, b) => b.squadValue - a.squadValue)
  }, [teams])

  const myRank = sortedTeams.findIndex(t => t.isMe) + 1

  return (
    <div className="bg-black/95 border border-forest-light/40 rounded-sm p-6 sm:p-8 space-y-6 shadow-2xl relative text-cream max-w-5xl mx-auto">
      {/* Botón de cerrar modal */}
      {onClose && (
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-30 bg-forest-dark/80 p-2 rounded-full hover:bg-forest text-cream transition-colors border border-forest-light/30 cursor-pointer"
          aria-label="Cerrar modal"
        >
          <X size={20} />
        </button>
      )}

      {/* Cabecera Principal */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-forest/30 pb-5 pr-8">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-forest-dark border border-forest-light/40 rounded-sm text-forest-light shadow-lg">
              <TrendingUp size={24} />
            </div>
            <div>
              <h3 className="text-xl sm:text-2xl font-display font-bold text-white tracking-wide uppercase">
                Evolución del Valor de Plantilla
              </h3>
              <p className="text-xs text-cream/70 font-mono mt-0.5">
                Crecimiento patrimonial auditado por jornadas en Comunio (M€)
              </p>
            </div>
          </div>
        </div>

        {/* Métrica Resumen Racing de Oslo */}
        <div className="flex items-center gap-3 bg-forest-dark/40 border border-forest-light/30 px-4 py-2 rounded-sm shadow-inner">
          <div className="text-right">
            <span className="text-[10px] text-cream-dark uppercase font-mono block">Crecimiento Racing</span>
            <span className="text-sm font-bold text-forest-light font-mono">
              +{meGrowthPct}% (+{meGrowthM} M€)
            </span>
          </div>
          <span className="text-xs font-mono font-bold bg-amber-400/20 text-amber-300 border border-amber-400/40 px-2.5 py-1 rounded-sm">
            #{myRank} DE {teams.length} CLUBES
          </span>
        </div>
      </div>

      {/* Selector de Modo de Vista & Filtros Rápidos */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-black/60 border border-forest/30 p-3 rounded-sm">
        {/* Pestañas de Vista */}
        <div className="flex items-center gap-1.5 bg-forest-dark/40 p-1 rounded-sm border border-forest/30">
          <button
            onClick={() => setViewMode('chart')}
            className={`flex items-center gap-1.5 px-3 py-1 text-xs font-mono font-bold rounded-sm transition-all cursor-pointer ${
              viewMode === 'chart'
                ? 'bg-forest-light text-black shadow-md'
                : 'text-cream/70 hover:text-white'
            }`}
          >
            <TrendingUp size={14} /> GRÁFICA DE EVOLUCIÓN
          </button>
          <button
            onClick={() => setViewMode('ranking')}
            className={`flex items-center gap-1.5 px-3 py-1 text-xs font-mono font-bold rounded-sm transition-all cursor-pointer ${
              viewMode === 'ranking'
                ? 'bg-forest-light text-black shadow-md'
                : 'text-cream/70 hover:text-white'
            }`}
          >
            <BarChart2 size={14} /> RANKING DE MÚSCULO
          </button>
        </div>

        {/* Filtros / Presets de Líneas */}
        {viewMode === 'chart' && (
          <div className="flex flex-wrap items-center gap-1.5 text-xs font-mono">
            <span className="text-cream-dark text-[11px] mr-1 flex items-center gap-1">
              <Filter size={12} /> FILTRAR:
            </span>
            <button
              onClick={() => setPreset('me')}
              className="bg-forest-dark/60 hover:bg-forest text-cream border border-forest/40 px-2 py-1 rounded-sm transition-colors cursor-pointer text-[11px]"
            >
              ⭐ Solo Racing
            </button>
            <button
              onClick={() => setPreset('vsLeader')}
              className="bg-forest-dark/60 hover:bg-forest text-cream border border-forest/40 px-2 py-1 rounded-sm transition-colors cursor-pointer text-[11px]"
            >
              ⚔️ Vs Líder
            </button>
            <button
              onClick={() => setPreset('top5')}
              className="bg-forest-dark/60 hover:bg-forest text-cream border border-forest/40 px-2 py-1 rounded-sm transition-colors cursor-pointer text-[11px]"
            >
              🏆 Top 5
            </button>
            <button
              onClick={() => setPreset('all')}
              className="bg-forest-dark/60 hover:bg-forest text-cream border border-forest/40 px-2 py-1 rounded-sm transition-colors cursor-pointer text-[11px]"
            >
              👥 Ver Todos (10)
            </button>
          </div>
        )}
      </div>

      {/* VISTA 1: GRÁFICO SVG VECTORIAL AUTO-ESCALABLE */}
      {viewMode === 'chart' ? (
        <div className="space-y-4">
          {/* Leyenda interactiva de clubes */}
          <div className="flex flex-wrap items-center gap-2">
            {teams.map(team => {
              const isActive = activeTeams[team.name]
              const isMe = team.isMe
              return (
                <button
                  key={team.name}
                  onClick={() => setActiveTeams(prev => ({ ...prev, [team.name]: !prev[team.name] }))}
                  onMouseEnter={() => setHighlightedTeam(team.name)}
                  onMouseLeave={() => setHighlightedTeam(null)}
                  className={`flex items-center gap-2 px-2.5 py-1 rounded-sm border text-[11px] font-mono transition-all cursor-pointer ${
                    isActive
                      ? isMe 
                        ? 'bg-forest-dark border-forest-light text-white font-bold shadow-md ring-1 ring-forest-light/60'
                        : 'bg-forest-dark/40 border-forest/40 text-cream/90 hover:border-forest-light/60'
                      : 'bg-black/40 border-forest/20 text-cream/30 opacity-40 hover:opacity-70'
                  }`}
                >
                  <img
                    src={team.crest}
                    alt={team.name}
                    className="w-3.5 h-3.5 rounded-full object-cover"
                    onError={(e) => { e.currentTarget.src = '/media/crest.jpg' }}
                  />
                  <span
                    className="w-2 h-2 rounded-full inline-block"
                    style={{ backgroundColor: team.color }}
                  />
                  <span>{team.name} ({team.currentValue})</span>
                </button>
              )
            })}
          </div>

          {/* Lienzo SVG */}
          <div className="relative w-full bg-gradient-to-b from-forest-dark/20 to-black border border-forest/30 rounded-sm p-2 overflow-x-auto">
            <svg
              viewBox={`0 0 ${width} ${height}`}
              className="w-full h-auto min-w-[650px] overflow-visible select-none"
            >
              <defs>
                <linearGradient id="gradient-me-val" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity="0.30" />
                  <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
                </linearGradient>
              </defs>

              {/* Líneas horizontales de referencia Y */}
              {yTicks.map(val => {
                const y = getY(val)
                return (
                  <g key={val}>
                    <line
                      x1={paddingLeft}
                      y1={y}
                      x2={width - paddingRight}
                      y2={y}
                      stroke="rgba(16, 185, 129, 0.12)"
                      strokeDasharray="4 4"
                    />
                    <text
                      x={paddingLeft - 10}
                      y={y + 4}
                      fill="#9ca3af"
                      fontSize="11"
                      textAnchor="end"
                      fontFamily="monospace"
                    >
                      {val}M €
                    </text>
                  </g>
                )
              })}

              {/* Líneas verticales de jornadas X */}
              {matchdays.map((md, idx) => {
                const x = getX(idx)
                return (
                  <g key={md}>
                    <line
                      x1={x}
                      y1={paddingTop}
                      x2={x}
                      y2={height - paddingBottom}
                      stroke="rgba(16, 185, 129, 0.15)"
                    />
                    <text
                      x={x}
                      y={height - paddingBottom + 22}
                      fill={idx === matchdays.length - 1 ? '#10b981' : '#e5e7eb'}
                      fontSize="12"
                      fontWeight={idx === matchdays.length - 1 ? 'bold' : 'normal'}
                      textAnchor="middle"
                      fontFamily="monospace"
                    >
                      {md}
                    </text>
                  </g>
                )
              })}

              {/* Curvas de los rivales visibles */}
              {teams.map(team => {
                if (!activeTeams[team.name] || team.isMe) return null
                const isHovered = highlightedTeam === team.name
                const path = createSmoothPath(team.values)
                return (
                  <g key={team.name} className="transition-opacity duration-200">
                    <path
                      d={path}
                      fill="none"
                      stroke={team.color}
                      strokeWidth={isHovered ? 3.5 : 2}
                      strokeOpacity={highlightedTeam && !isHovered ? 0.25 : 0.75}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    {team.values.map((val, idx) => (
                      <circle
                        key={idx}
                        cx={getX(idx)}
                        cy={getY(val)}
                        r={isHovered ? 5 : 3.5}
                        fill={team.color}
                        stroke="#000"
                        strokeWidth="1.5"
                        className="cursor-pointer"
                        onMouseEnter={() => setHoveredPoint({ team, val, matchday: matchdays[idx], x: getX(idx), y: getY(val) })}
                        onMouseLeave={() => setHoveredPoint(null)}
                      />
                    ))}
                  </g>
                )
              })}

              {/* Curva destacada de Racing de Oslo */}
              {meTeam && activeTeams[meTeam.name] && (
                <g>
                  {/* Área sombreada bajo la curva */}
                  <path
                    d={`${createSmoothPath(meTeam.values)} L ${getX(meTeam.values.length - 1)} ${height - paddingBottom} L ${getX(0)} ${height - paddingBottom} Z`}
                    fill="url(#gradient-me-val)"
                  />
                  {/* Línea gruesa verde esmeralda */}
                  <path
                    d={createSmoothPath(meTeam.values)}
                    fill="none"
                    stroke="#10b981"
                    strokeWidth="4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    filter="drop-shadow(0 0 6px rgba(16,185,129,0.5))"
                  />
                  {meTeam.values.map((val, idx) => (
                    <g key={idx}>
                      <circle
                        cx={getX(idx)}
                        cy={getY(val)}
                        r="6"
                        fill="#10b981"
                        stroke="#ffffff"
                        strokeWidth="2.5"
                        className="cursor-pointer"
                        onMouseEnter={() => setHoveredPoint({ team: meTeam, val, matchday: matchdays[idx], x: getX(idx), y: getY(val) })}
                        onMouseLeave={() => setHoveredPoint(null)}
                      />
                      <text
                        x={getX(idx)}
                        y={getY(val) - 12}
                        fill="#34d399"
                        fontSize="11"
                        fontWeight="bold"
                        textAnchor="middle"
                        fontFamily="monospace"
                      >
                        {val} M€
                      </text>
                    </g>
                  ))}
                </g>
              )}

              {/* Tooltip flotante interactivo */}
              {hoveredPoint && (
                <g transform={`translate(${Math.min(hoveredPoint.x, width - 180)}, ${Math.max(hoveredPoint.y - 65, 10)})`}>
                  <rect
                    width="170"
                    height="55"
                    rx="4"
                    fill="rgba(0, 0, 0, 0.92)"
                    stroke={hoveredPoint.team.color || '#10b981'}
                    strokeWidth="1.5"
                  />
                  <text x="12" y="20" fill="#ffffff" fontSize="11" fontWeight="bold" fontFamily="sans-serif">
                    {hoveredPoint.team.name.slice(0, 18)}
                  </text>
                  <text x="12" y="36" fill="#9ca3af" fontSize="10" fontFamily="monospace">
                    {hoveredPoint.matchday}: <tspan fill="#f59e0b" fontWeight="bold">{hoveredPoint.val} M€</tspan>
                  </text>
                  <text x="12" y="48" fill="#10b981" fontSize="9" fontFamily="monospace">
                    Plantilla: {hoveredPoint.team.playerCount} futbolistas
                  </text>
                </g>
              )}
            </svg>
          </div>
        </div>
      ) : (
        /* VISTA 2: RANKING COMPARATIVO DE MÚSCULO FINANCIERO (BARRAS) */
        <div className="space-y-3">
          <div className="grid grid-cols-1 gap-2.5">
            {sortedTeams.map((team, index) => {
              const diffWithMe = ((team.squadValue - meTeam.squadValue) / 1000000).toFixed(2)
              const maxVal = sortedTeams[0].squadValue
              const barPct = Math.round((team.squadValue / maxVal) * 100)

              return (
                <div
                  key={team.name}
                  className={`p-3 rounded-sm border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                    team.isMe
                      ? 'bg-forest-dark/70 border-forest-light shadow-lg ring-1 ring-forest-light'
                      : 'bg-forest-dark/20 border-forest/20 hover:bg-forest-dark/40'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-[220px]">
                    <span className="text-xs font-mono font-bold text-amber-300 w-5">
                      #{index + 1}
                    </span>
                    <img
                      src={team.crest}
                      alt={team.name}
                      className="w-8 h-8 rounded-full object-cover border border-white/20"
                      onError={(e) => { e.currentTarget.src = '/media/crest.jpg' }}
                    />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`text-sm font-bold ${team.isMe ? 'text-forest-light' : 'text-white'}`}>
                          {team.name}
                        </span>
                        {team.isMe && (
                          <span className="bg-forest-light/20 text-forest-light text-[10px] font-mono font-bold px-1.5 py-0.2 rounded border border-forest-light/30">
                            TU CLUB
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-cream-dark font-mono">
                        {team.ownerName} • {team.playerCount} jugadores
                      </span>
                    </div>
                  </div>

                  {/* Barra de Progreso Relativa */}
                  <div className="flex-1 max-w-md hidden md:block">
                    <div className="flex justify-between text-[10px] font-mono text-cream-dark mb-1">
                      <span>Músculo Financiero</span>
                      <span>{barPct}%</span>
                    </div>
                    <div className="w-full bg-black/60 rounded-full h-2 overflow-hidden border border-forest/30">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${barPct}%`,
                          backgroundColor: team.isMe ? '#10b981' : team.color
                        }}
                      />
                    </div>
                  </div>

                  {/* Valor Total y Diferencia */}
                  <div className="text-right min-w-[140px] flex sm:flex-col items-center sm:items-end justify-between">
                    <span className="text-base font-mono font-bold text-white">
                      {(team.squadValue / 1000000).toFixed(2)} M€
                    </span>
                    <span className={`text-xs font-mono ${
                      team.isMe 
                        ? 'text-forest-light font-bold' 
                        : parseFloat(diffWithMe) > 0 
                          ? 'text-amber-400' 
                          : 'text-emerald-400'
                    }`}>
                      {team.isMe ? 'Base Oslo' : (parseFloat(diffWithMe) > 0 ? `+${diffWithMe} M€` : `${diffWithMe} M€`)}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Nota al pie */}
      <div className="bg-black/60 border border-forest/20 p-3 rounded text-xs font-mono text-cream-dark flex items-center justify-between">
        <span>💡 Datos actualizados tras el último barrido oficial de mercado.</span>
        <span className="text-forest-light font-bold">10 Clubes Monitorizados</span>
      </div>
    </div>
  )
}
