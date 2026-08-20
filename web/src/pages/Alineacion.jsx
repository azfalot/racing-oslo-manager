import React from 'react'
import squadData from '../data/squad.json'

export default function Alineacion() {
  const starters = squadData.players.filter(p => p.isStarter)
  
  const keepers = starters.filter(p => p.position === 'keeper')
  const defenders = starters.filter(p => p.position === 'defender')
  const midfielders = starters.filter(p => p.position === 'midfielder')
  const strikers = starters.filter(p => p.position === 'striker')

  const renderPlayer = (p) => (
    <div key={p.id} className="flex flex-col items-center animate-fade-in group">
      <div className="relative">
        <img src={p.image} alt={p.name} className="w-16 h-16 md:w-20 md:h-20 rounded-full border-4 border-white/20 object-cover shadow-xl group-hover:border-cream transition-colors bg-forest-dark/50" />
        <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-black text-white text-[10px] font-bold px-2 py-0.5 rounded-sm border border-white/20">
          {p.number}
        </span>
      </div>
      <div className="mt-3 bg-black/80 px-2 py-1 rounded-sm text-center min-w-[80px]">
        <p className="text-xs md:text-sm font-bold text-white whitespace-nowrap">{p.name}</p>
      </div>
    </div>
  )

  return (
    <div className="container mx-auto px-6 py-12">
      <div className="mb-12 text-center">
        <h2 className="text-4xl md:text-5xl font-display font-bold mb-4">El Once Titular</h2>
        <p className="text-cream-dark">La alineación elegida por Mateo Oslomany para el próximo encuentro.</p>
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
          <div className="flex justify-center gap-4 md:gap-12">
            {midfielders.map(renderPlayer)}
          </div>

          {/* Defensas */}
          <div className="flex justify-center gap-4 md:gap-12">
            {defenders.map(renderPlayer)}
          </div>

          {/* Portero */}
          <div className="flex justify-center">
            {keepers.map(renderPlayer)}
          </div>
        </div>
      </div>
    </div>
  )
}
