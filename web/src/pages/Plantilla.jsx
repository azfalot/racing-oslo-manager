import React, { useState, useMemo } from 'react'
import squadData from '../data/squad.json'
import { Search, Filter, ArrowUpDown, Shield, Users, Award, TrendingUp, ChevronRight } from 'lucide-react'
import PlayerProfileModal, { getPosBadgeStyle } from '../components/PlayerProfileModal'
import TeamValueChart from '../components/TeamValueChart'

export default function Plantilla() {
  const [selectedPlayer, setSelectedPlayer] = useState(null)
  const [showChartModal, setShowChartModal] = useState(false)
  const [categoryFilter, setCategoryFilter] = useState('ALL') // ALL, STARTERS, KEEPER, DEFENDER, MIDFIELDER, STRIKER
  const [searchTerm, setSearchTerm] = useState('')
  const [sortBy, setSortBy] = useState('projected') // projected, points, price, position

  const players = squadData.players || []

  // Filtrado y Ordenación Dinámica
  const filteredAndSortedPlayers = useMemo(() => {
    return players
      .filter(p => {
        // 1. Filtro de Categoría / Puesto
        if (categoryFilter === 'STARTERS') {
          if (!p.isStarter) return false
        } else if (categoryFilter !== 'ALL') {
          const pos = (p.position || '').toLowerCase()
          if (!pos.includes(categoryFilter.toLowerCase())) return false
        }

        // 2. Filtro de Búsqueda por Nombre
        if (searchTerm.trim() !== '') {
          const term = searchTerm.toLowerCase().trim()
          const name = (p.name || '').toLowerCase()
          const club = (p.clubName || '').toLowerCase()
          if (!name.includes(term) && !club.includes(term)) return false
        }

        return true
      })
      .sort((a, b) => {
        if (sortBy === 'projected') {
          return (b.projectedPoints || 0) - (a.projectedPoints || 0)
        }
        if (sortBy === 'points') {
          return (b.lastSeasonPoints || b.stats?.points || 0) - (a.lastSeasonPoints || a.stats?.points || 0)
        }
        if (sortBy === 'price') {
          return (b.price || 0) - (a.price || 0)
        }
        if (sortBy === 'position') {
          const order = { keeper: 1, defender: 2, midfielder: 3, striker: 4 }
          return (order[a.position] || 5) - (order[b.position] || 5)
        }
        return 0
      })
  }, [players, categoryFilter, searchTerm, sortBy])

  const startersCount = players.filter(p => p.isStarter).length

  return (
    <div className="container mx-auto px-4 sm:px-6 py-8 space-y-6">
      
      {/* Cabecera & Estadísticas Resumen */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-forest/30 pb-6">
        <div>
          <div className="flex items-center gap-3">
            <Shield className="text-forest-light" size={28} />
            <h2 className="text-3xl sm:text-4xl font-display font-bold text-white tracking-wide">Primera Plantilla</h2>
          </div>
          <p className="text-cream/70 text-xs sm:text-sm font-mono mt-1">
            Temporada 2026/27 • {players.length} Jugadores en plantilla ({startersCount} Titulares)
          </p>
        </div>

        {/* Badges de Resumen y Botón de Modal para Gráfico */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setShowChartModal(true)}
            className="bg-forest-dark/80 hover:bg-forest text-cream border border-forest-light/40 text-xs font-mono font-bold px-3 py-1.5 rounded-sm transition-all flex items-center gap-1.5 cursor-pointer shadow-md uppercase"
          >
            <TrendingUp size={14} className="text-forest-light" /> EVOLUCIÓN VS RIVALES
          </button>
          <span className="bg-forest-dark/80 text-forest-light border border-forest-light/40 text-xs font-mono px-3 py-1.5 rounded-sm">
            XI Titular: <b>{startersCount}/11</b>
          </span>
          <span className="bg-black/60 text-amber-300 border border-amber-400/40 text-xs font-mono px-3 py-1.5 rounded-sm">
            Entrenador: <b>{squadData.coach || 'Mateo Oslomany'}</b>
          </span>
        </div>
      </div>

      {/* CONTROLES: FILTROS, BUSCADOR Y ORDENACIÓN */}
      <div className="bg-black/60 border border-forest/40 p-4 rounded-sm space-y-4 shadow-lg">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          
          {/* Botones de Categorías / Posición */}
          <div className="flex flex-wrap items-center gap-1.5">
            {[
              { id: 'ALL', label: 'TODOS' },
              { id: 'STARTERS', label: '⭐ ONCE TITULAR' },
              { id: 'keeper', label: '🧤 PORTEROS' },
              { id: 'defender', label: '🛡️ DEFENSAS' },
              { id: 'midfielder', label: '⚙️ MEDIOS' },
              { id: 'striker', label: '⚡ DELANTEROS' },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setCategoryFilter(tab.id)}
                className={`text-xs font-bold px-3 py-1.5 rounded-sm transition-all border uppercase tracking-wider ${
                  categoryFilter === tab.id
                    ? 'bg-forest text-cream border-forest-light shadow-md'
                    : 'bg-forest-dark/30 text-cream/70 border-forest/30 hover:border-forest/60 hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Buscador & Selector de Ordenación */}
          <div className="flex flex-col sm:flex-row items-center gap-3">
            {/* Input Buscador */}
            <div className="relative w-full sm:w-56">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-cream/50" size={14} />
              <input
                type="text"
                placeholder="Buscar jugador..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full bg-forest-dark/50 border border-forest/40 rounded-sm pl-9 pr-3 py-1.5 text-xs text-white placeholder-cream/40 focus:outline-none focus:border-forest-light"
              />
            </div>

            {/* Selector de Orden */}
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <ArrowUpDown size={14} className="text-forest-light flex-shrink-0" />
              <select
                value={sortBy}
                onChange={e => setSortBy(e.target.value)}
                className="bg-forest-dark/50 border border-forest/40 text-cream text-xs px-3 py-1.5 rounded-sm focus:outline-none focus:border-forest-light w-full sm:w-auto cursor-pointer"
              >
                <option value="projected">Ordenar por Predicción 26/27</option>
                <option value="points">Ordenar por Puntos 25/26</option>
                <option value="price">Ordenar por Valor de Mercado</option>
                <option value="position">Ordenar por Posición</option>
              </select>
            </div>
          </div>

        </div>
      </div>

      {/* CUADRÍCULA COMPACTA DE JUGADORES ("DE UN PLUMAZO") */}
      {filteredAndSortedPlayers.length === 0 ? (
        <div className="bg-black/40 border border-forest/30 p-12 text-center rounded-sm">
          <p className="text-cream/70 text-sm font-mono">No se han encontrado jugadores con los filtros seleccionados.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3.5">
          {filteredAndSortedPlayers.map(p => {
            const posBadge = getPosBadgeStyle(p.position)
            return (
              <div
                key={p.id}
                onClick={() => setSelectedPlayer(p)}
                className="bg-black border border-forest/40 rounded-sm overflow-hidden flex flex-col justify-between group hover:border-forest-light transition-all cursor-pointer shadow-lg hover:scale-[1.02] relative"
              >
                {/* Badge de Titular / Suplente */}
                <div className="absolute top-2 left-2 z-20 flex gap-1">
                  {p.isStarter ? (
                    <span className="bg-amber-500/90 text-black font-bold text-[8px] px-1.5 py-0.5 rounded-sm shadow-md">
                      XI TITULAR
                    </span>
                  ) : (
                    <span className="bg-black/80 text-cream/70 font-mono text-[8px] px-1.5 py-0.5 rounded-sm border border-forest/30">
                      SUPLENTE
                    </span>
                  )}
                </div>

                {/* Cabecera con Dorsal Gigante Translúcido Blanco y Foto del Jugador */}
                <div className="relative h-36 bg-gradient-to-b from-forest-dark/90 via-clubBlack to-black overflow-hidden flex justify-center items-end p-2 border-b border-forest/30 group-hover:from-forest/70 transition-colors">
                  {/* Dorsal Gigante Translúcido en Marca de Agua */}
                  <div className="absolute -right-2 -bottom-4 opacity-25 text-white font-display font-bold text-7xl sm:text-8xl pointer-events-none select-none tracking-tighter group-hover:opacity-40 group-hover:scale-105 transition-all duration-500">
                    {p.number}
                  </div>

                  {/* Foto del Jugador */}
                  <img
                    src={p.image || `/media/players/${p.id}.png`}
                    alt={p.name}
                    className="h-[115%] object-cover relative z-10 group-hover:scale-110 transition-transform duration-500 drop-shadow-2xl"
                    onError={(e) => { e.target.src = '/media/crest.jpg' }}
                  />
                </div>

                {/* Cuerpo de la Tarjeta Compacta */}
                <div className="p-3 space-y-2 flex-1 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded-sm border uppercase ${posBadge.color}`}>
                        {posBadge.label}
                      </span>
                      <span className="text-[9px] text-cream/60 truncate font-mono">
                        {p.clubName || 'LaLiga'}
                      </span>
                    </div>

                    <h3 className="text-xs sm:text-sm font-bold text-white group-hover:text-forest-light transition-colors truncate">
                      {p.name}
                    </h3>
                  </div>

                  {/* Resumen Métrico de Puntos & Valor */}
                  <div className="space-y-1.5 pt-1.5 border-t border-forest/20 text-[10px]">
                    <div className="flex justify-between items-center">
                      <span className="text-cream/60 font-mono">Predicción 26/27:</span>
                      <span className="font-bold text-amber-300">~{p.projectedPoints || 140} pts</span>
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="text-cream/60 font-mono">Valor Comunio:</span>
                      <span className="font-bold text-cream">
                        {p.price ? p.price.toLocaleString('es-ES') + ' €' : 'N/D'}
                      </span>
                    </div>
                  </div>

                  {/* Botón de Acción Ficha Completa */}
                  <div className="pt-1.5 text-center">
                    <span className="w-full bg-forest-dark/40 group-hover:bg-forest text-cream text-[9px] font-bold py-1 px-2 rounded-sm border border-forest/40 transition-colors uppercase block">
                      FICHA COMPLETA &rarr;
                    </span>
                  </div>
                </div>

              </div>
            )
          })}
        </div>
      )}

      {/* TEAM VALUE EVOLUTION MODAL */}
      {showChartModal && (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 sm:p-6">
          <div className="max-w-5xl w-full max-h-[92vh] overflow-y-auto rounded-sm">
            <TeamValueChart onClose={() => setShowChartModal(false)} />
          </div>
        </div>
      )}

      {/* PLAYER PROFILE MODAL */}
      <PlayerProfileModal player={selectedPlayer} onClose={() => setSelectedPlayer(null)} />
    </div>
  )
}
