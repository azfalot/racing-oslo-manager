import React, { useState } from 'react'
import { TrendingUp, Shield, BarChart2, Check, X } from 'lucide-react'
import historyData from '../data/teamValueHistory.json'

export default function TeamValueChart({ onClose }) {
  const [activeTeams, setActiveTeams] = useState(
    historyData.teams.reduce((acc, t) => ({ ...acc, [t.name]: true }), {})
  )
  const [hoveredPoint, setHoveredPoint] = useState(null)

  const matchdays = historyData.matchdays
  const teams = historyData.teams

  // Dimensiones SVG
  const width = 800
  const height = 320
  const paddingLeft = 55
  const paddingRight = 30
  const paddingTop = 30
  const paddingBottom = 50

  const chartWidth = width - paddingLeft - paddingRight
  const chartHeight = height - paddingTop - paddingBottom

  // Rango Y (Valores min y max en M€)
  const allValues = teams.flatMap(t => t.values)
  const minY = 18
  const maxY = 45

  const getX = (index) => paddingLeft + (index / (matchdays.length - 1)) * chartWidth
  const getY = (val) => paddingTop + chartHeight - ((val - minY) / (maxY - minY)) * chartHeight

  const toggleTeam = (name) => {
    setActiveTeams(prev => ({ ...prev, [name]: !prev[name] }))
  }

  // Generar SVG Path suave (D3 / Bezier curve)
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

  const meTeam = teams.find(t => t.isMe)
  const meInitial = meTeam ? meTeam.values[0] : 32.5
  const meCurrent = meTeam ? meTeam.values[meTeam.values.length - 1] : 41.93
  const meGrowth = (((meCurrent - meInitial) / meInitial) * 100).toFixed(1)

  return (
    <div className="bg-black border border-forest/40 rounded-sm p-6 space-y-6 shadow-2xl relative">
      {/* Botón de cerrar si se renderiza en modal */}
      {onClose && (
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-30 bg-black/80 p-2 rounded-full hover:bg-forest text-cream transition-colors border border-forest/40 focus:outline-none cursor-pointer"
          aria-label="Cerrar gráfico"
        >
          <X size={20} />
        </button>
      )}

      {/* Cabecera */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-forest/30 pb-4 pr-8">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-forest-dark/60 border border-forest-light/40 rounded-sm text-forest-light">
            <TrendingUp size={22} />
          </div>
          <div>
            <h3 className="text-xl sm:text-2xl font-display font-bold text-white uppercase tracking-wide">
              Evolución del Valor de Plantilla vs Rivales
            </h3>
            <p className="text-xs text-cream/60 font-mono">
              Crecimiento financiero acumulado por jornadas en Comunio (M€)
            </p>
          </div>
        </div>

        {/* Crecimiento Racing de Oslo */}
        <div className="flex items-center gap-3 bg-forest-dark/30 border border-forest/40 px-4 py-2 rounded-sm">
          <div className="text-right">
            <span className="text-[10px] text-cream/50 uppercase font-mono block">Crecimiento Racing</span>
            <span className="text-sm font-bold text-forest-light font-mono">+{meGrowth}% ({meCurrent} M€)</span>
          </div>
          <span className="text-xs font-bold text-black bg-emerald-400 px-2 py-0.5 rounded-sm uppercase">
            LÍDER
          </span>
        </div>
      </div>

      {/* Leyenda Táctico-Interactiva */}
      <div className="flex flex-wrap items-center gap-2.5 pt-1">
        {teams.map(team => {
          const isActive = activeTeams[team.name]
          return (
            <button
              key={team.name}
              onClick={() => toggleTeam(team.name)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-sm border text-xs font-mono transition-all cursor-pointer ${
                isActive
                  ? 'bg-forest-dark/40 border-forest-light/50 text-white shadow-sm'
                  : 'bg-black/60 border-forest/20 text-cream/40 opacity-50 hover:opacity-80'
              }`}
            >
              <span
                className="w-2.5 h-2.5 rounded-full inline-block"
                style={{ backgroundColor: team.color }}
              />
              <span className={team.isMe ? 'font-bold text-forest-light' : ''}>
                {team.name} ({team.currentValue})
              </span>
            </button>
          )
        })}
      </div>

      {/* Gráfico SVG Vectorial */}
      <div className="relative w-full overflow-x-auto">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-auto min-w-[600px] overflow-visible select-none"
        >
          <defs>
            {/* Gradiante para Racing de Oslo (Verde Esmeralda) */}
            <linearGradient id="gradient-me" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10b981" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Líneas horizontales de red Y */}
          {[20, 25, 30, 35, 40, 45].map(val => {
            const y = getY(val)
            return (
              <g key={val}>
                <line
                  x1={paddingLeft}
                  y1={y}
                  x2={width - paddingRight}
                  y2={y}
                  stroke="#1b2820"
                  strokeDasharray="4 4"
                />
                <text
                  x={paddingLeft - 10}
                  y={y + 4}
                  textAnchor="end"
                  fill="#718096"
                  fontSize="11"
                  fontFamily="monospace"
                >
                  {val}M
                </text>
              </g>
            )
          })}

          {/* Etiquetas Eje X (Jornadas) */}
          {matchdays.map((m, idx) => {
            const x = getX(idx)
            return (
              <g key={m}>
                <line
                  x1={x}
                  y1={paddingTop + chartHeight}
                  x2={x}
                  y2={paddingTop + chartHeight + 6}
                  stroke="#2d3748"
                />
                <text
                  x={x}
                  y={paddingTop + chartHeight + 24}
                  textAnchor="middle"
                  fill="#a0aec0"
                  fontSize="11"
                  fontWeight="bold"
                  fontFamily="monospace"
                >
                  {m}
                </text>
              </g>
            )
          })}

          {/* Área sombreada para Racing de Oslo */}
          {activeTeams[meTeam.name] && (() => {
            const pathD = createSmoothPath(meTeam.values)
            const areaD = `${pathD} L ${getX(meTeam.values.length - 1)} ${paddingTop + chartHeight} L ${getX(0)} ${paddingTop + chartHeight} Z`
            return <path d={areaD} fill="url(#gradient-me)" />
          })()}

          {/* Líneas de cada equipo */}
          {teams.map(team => {
            if (!activeTeams[team.name]) return null
            const pathD = createSmoothPath(team.values)
            return (
              <g key={team.name}>
                <path
                  d={pathD}
                  fill="none"
                  stroke={team.color}
                  strokeWidth={team.isMe ? 3.5 : 2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="transition-all duration-300"
                />

                {/* Puntos en cada jornada */}
                {team.values.map((val, idx) => {
                  const cx = getX(idx)
                  const cy = getY(val)
                  return (
                    <circle
                      key={idx}
                      cx={cx}
                      cy={cy}
                      r={team.isMe ? 5 : 3.5}
                      fill={team.color}
                      stroke="#000"
                      strokeWidth={2}
                      className="cursor-pointer hover:r-7 transition-all"
                      onMouseEnter={() => setHoveredPoint({ teamName: team.name, matchday: matchdays[idx], value: val, x: cx, y: cy, color: team.color })}
                      onMouseLeave={() => setHoveredPoint(null)}
                    />
                  )
                })}
              </g>
            )
          })}
        </svg>

        {/* Tooltip Flotante */}
        {hoveredPoint && (
          <div
            className="absolute z-20 bg-black/90 border border-forest/60 p-2.5 rounded-sm shadow-xl text-xs font-mono pointer-events-none transform -translate-x-1/2 -translate-y-full mb-2"
            style={{
              left: `${(hoveredPoint.x / width) * 100}%`,
              top: `${(hoveredPoint.y / height) * 100}%`
            }}
          >
            <div className="flex items-center gap-1.5 mb-1">
              <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: hoveredPoint.color }} />
              <span className="font-bold text-white">{hoveredPoint.teamName}</span>
            </div>
            <p className="text-cream/70 text-[11px]">
              {hoveredPoint.matchday}: <span className="font-bold text-amber-300">{hoveredPoint.value} M€</span>
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
