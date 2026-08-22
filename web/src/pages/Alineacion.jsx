import React, { useState } from 'react'
import squadData from '../data/squad.json'
import PlayerProfileModal from '../components/PlayerProfileModal'

export default function Alineacion() {
  const [selectedPlayer, setSelectedPlayer] = useState(null)
  const starters = squadData.players.filter(p => p.isStarter)
  
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
      <div className="mb-12 text-center">
        <h2 className="text-4xl md:text-5xl font-display font-bold mb-4">El Once Titular</h2>
        <p className="text-cream-dark">La alineación elegida por Mateo Oslomany para el próximo encuentro. Pulse en cualquier jugador para ver su ficha oficial.</p>
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

      {/* JUSTIFICACIÓN TÁCTICA DE MATEO OSLOMANY */}
      <div className="max-w-4xl mx-auto mt-10 bg-black border border-forest/30 p-6 rounded-sm space-y-4 shadow-xl">
        <div className="flex items-center gap-3 border-b border-forest/30 pb-3">
          <div className="p-2 bg-forest-dark/60 text-forest-light rounded-sm border border-forest-light/30">
            🧠
          </div>
          <div>
            <h3 className="text-xl font-display font-bold text-white uppercase tracking-wide">
              ¿Por qué estos 11 titulares sobre otros jugadores de mayor valor o puntos?
            </h3>
            <p className="text-xs text-cream/60 font-mono">
              Criterios matemáticos y reglas tácticas aplicadas por la Secretaría Técnica
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div className="bg-forest-dark/20 border border-forest/20 p-3 rounded-sm space-y-1.5">
            <span className="text-forest-light font-bold font-mono uppercase block text-[11px]">
              1. Restricción de Posición & Formación
            </span>
            <p className="text-cream/80 leading-relaxed">
              Un sistema como el 4-4-2 sólo admite 4 centrocampistas. Si dispones de un 5º o 6º medio con muchos puntos, no puede alinear en el medio; es obligatorio alinear defensas para no sufrir la penalización de -4 ptos por hueco libre.
            </p>
          </div>

          <div className="bg-forest-dark/20 border border-forest/20 p-3 rounded-sm space-y-1.5">
            <span className="text-amber-300 font-bold font-mono uppercase block text-[11px]">
              2. Salud & Estado Físico Preventivo
            </span>
            <p className="text-cream/80 leading-relaxed">
              Si una estrella de 9M € arrastra molestias, sanción o duda médica, el motor aplica una penalización del 60% para evitar un 0. Un suplente modesto de 1.5M € 100% Fit titular asegura puntuar.
            </p>
          </div>

          <div className="bg-forest-dark/20 border border-forest/20 p-3 rounded-sm space-y-1.5">
            <span className="text-blue-300 font-bold font-mono uppercase block text-[11px]">
              3. Racha Dinámica vs Promedio Anual
            </span>
            <p className="text-cream/80 leading-relaxed">
              El motor pondera al 50% las últimas 3-5 jornadas. Si un parche económico viene de encadenar dos 8s y un 10 consecutivo, su nota dinámica del momento supera a un titular frío o en baja forma.
            </p>
          </div>
        </div>
      </div>

      {/* PLAYER PROFILE MODAL */}
      <PlayerProfileModal player={selectedPlayer} onClose={() => setSelectedPlayer(null)} />
    </div>
  )
}
