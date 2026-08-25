import React, { useState } from 'react'
import squadData from '../data/squad.json'
import PlayerProfileModal from '../components/PlayerProfileModal'

export default function Alineacion() {
  const [selectedPlayer, setSelectedPlayer] = useState(null)
  const starters = squadData.players.filter(p => p.isStarter)
  const bench = squadData.players.filter(p => !p.isStarter)
  const formation = squadData.formation || '4-3-3'
  
  const keepers = starters.filter(p => p.position === 'keeper')
  const defenders = starters.filter(p => p.position === 'defender')
  const midfielders = starters.filter(p => p.position === 'midfielder')
  const strikers = starters.filter(p => p.position === 'striker')

  const renderPlayer = (p) => (
    <div
      key={p.id}
      onClick={() => setSelectedPlayer(p)}
      className="flex flex-col items-center animate-fade-in group cursor-pointer hover:scale-105 transition-transform"
    >
      <div className="relative">
        <img src={p.image} alt={p.name} className="w-16 h-16 md:w-20 md:h-20 rounded-full border-4 border-white/20 object-cover shadow-xl group-hover:border-forest-light transition-colors bg-forest-dark/50" />
        <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-black text-white text-[10px] font-bold px-2 py-0.5 rounded-sm border border-white/20">
          {p.number}
        </span>
      </div>
      <div className="mt-3 bg-black/80 px-2 py-1 rounded-sm text-center min-w-[80px] border border-forest/30 group-hover:border-forest-light transition-colors">
        <p className="text-xs md:text-sm font-bold text-white whitespace-nowrap">{p.name}</p>
        <p className="text-[10px] text-amber-300 font-mono">~{p.projectedPoints || 140} pts</p>
      </div>
    </div>
  )

  return (
    <div className="container mx-auto px-6 py-12">
      <div className="mb-8 text-center space-y-2">
        <div className="inline-flex items-center gap-2 bg-forest-dark border border-forest-light/40 px-3 py-1 rounded-full text-xs font-bold text-cream">
          <span>📐 Esquema Oficial:</span>
          <span className="text-amber-300 font-mono">{formation}</span>
        </div>
        <h2 className="text-4xl md:text-5xl font-display font-bold text-white">El Once Titular</h2>
        <p className="text-cream-dark">La alineación oficial sincronizada en Comunio. Pulse en cualquier jugador para ver su ficha y proyección anual.</p>
      </div>

      <div className="max-w-4xl mx-auto bg-green-800 rounded-lg p-4 md:p-8 relative shadow-2xl overflow-hidden border-4 border-white/10" style={{
        backgroundImage: "linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px)",
        backgroundSize: "100% 10%"
      }}>
        {/* Campo de fútbol básico en CSS */}
        <div className="absolute inset-4 border-2 border-white/30 pointer-events-none rounded-sm"></div>
        <div className="absolute top-1/2 left-4 right-4 h-0.5 bg-white/30 pointer-events-none"></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 border-2 border-white/30 rounded-full pointer-events-none"></div>
        
        {/* Áreas */}
        <div className="absolute top-4 left-1/2 -translate-x-1/2 w-64 h-32 border-2 border-t-0 border-white/30 pointer-events-none"></div>
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 w-64 h-32 border-2 border-b-0 border-white/30 pointer-events-none"></div>

        {/* Jugadores */}
        <div className="relative z-10 flex flex-col justify-between h-[700px] py-8">
          
          {/* Delanteros */}
          <div className="flex justify-center gap-4 md:gap-12">
            {strikers.map(renderPlayer)}
          </div>

          {/* Centrocampistas */}
          <div className="flex justify-around">
            {midfielders.map(renderPlayer)}
          </div>

          {/* Defensas */}
          <div className="flex justify-around">
            {defenders.map(renderPlayer)}
          </div>

          {/* Portero */}
          <div className="flex justify-center">
            {keepers.map(renderPlayer)}
          </div>

        </div>
      </div>

      {/* BANQUILLO */}
      {bench.length > 0 && (
        <div className="max-w-4xl mx-auto mt-8 bg-black/60 border border-forest/40 p-5 rounded-sm shadow-xl">
          <h3 className="text-sm font-display font-bold text-cream uppercase tracking-wider mb-4 border-b border-forest/30 pb-2">
            🛡️ Banquillo de Suplentes ({bench.length})
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {bench.map(p => (
              <div
                key={p.id}
                onClick={() => setSelectedPlayer(p)}
                className="flex items-center gap-3 bg-forest-dark/40 border border-forest/30 p-2.5 rounded-sm cursor-pointer hover:border-forest-light hover:bg-forest-dark transition-all"
              >
                <img src={p.image} alt={p.name} className="w-10 h-10 rounded-full border border-white/20 object-cover flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-white truncate">{p.name}</p>
                  <p className="text-[10px] text-amber-300 font-mono">~{p.projectedPoints || 80} pts</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* PLAYER PROFILE MODAL */}
      <PlayerProfileModal player={selectedPlayer} onClose={() => setSelectedPlayer(null)} />
    </div>
  )
}
