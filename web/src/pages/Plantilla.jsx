import React, { useState } from 'react'
import squadData from '../data/squad.json'
import { Shield, Activity, Target, AlertTriangle, TrendingUp, Award } from 'lucide-react'
import PlayerProfileModal from '../components/PlayerProfileModal'

export default function Plantilla() {
  const [selectedPlayer, setSelectedPlayer] = useState(null)

  const formatPrice = (price) => price ? price.toLocaleString('es-ES') + ' €' : 'Desconocido';
  const getPosColor = (pos) => {
    switch(pos) {
      case 'keeper': return 'bg-amber-600'
      case 'defender': return 'bg-blue-600'
      case 'midfielder': return 'bg-emerald-600'
      case 'striker': return 'bg-rose-600'
      default: return 'bg-forest'
    }
  }

  const getPosName = (pos) => {
    switch(pos) {
      case 'keeper': return 'Portero'
      case 'defender': return 'Defensa'
      case 'midfielder': return 'Centrocampista'
      case 'striker': return 'Delantero'
      default: return pos
    }
  }

  return (
    <div className="container mx-auto px-6 py-12">
      <div className="mb-12">
        <h2 className="text-4xl md:text-5xl font-display font-bold mb-2 border-l-4 border-forest pl-4">Primera Plantilla</h2>
        <p className="text-cream-dark ml-5 text-sm uppercase tracking-widest">Temporada 2026/27 • Haga clic en cualquier jugador para ver su ficha completa</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
        {squadData.players.map(p => (
          <div
            key={p.id}
            onClick={() => setSelectedPlayer(p)}
            className="bg-black border border-forest/30 rounded-sm overflow-hidden flex flex-col group hover:border-forest-light transition-all cursor-pointer shadow-xl hover:scale-[1.01]"
          >
            {/* Cabecera Tarjeta */}
            <div className="relative h-48 bg-forest-dark/40 overflow-hidden flex items-end p-4 border-b border-forest/30">
              <div className="absolute inset-0 flex justify-center items-end opacity-80 pt-4">
                {p.image ? (
                  <img src={p.image} alt={p.name} className="h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                ) : null}
              </div>
              <div className="absolute top-4 left-4 z-10 flex gap-2">
                <span className={`text-[10px] font-bold uppercase tracking-wider text-white px-2.5 py-1 rounded-sm shadow-md ${getPosColor(p.position)}`}>
                  {getPosName(p.position)}
                </span>
                <span className="bg-black/80 text-cream/90 text-[10px] font-mono px-2 py-1 rounded-sm border border-forest/40">
                  {p.clubName || 'LaLiga'}
                </span>
              </div>
              <div className="absolute -right-4 -bottom-4 opacity-30 font-display font-bold text-9xl">
                {p.number}
              </div>
              <h3 className="text-2xl font-display font-bold relative z-10 group-hover:text-forest-light transition-colors bg-black/80 px-3 py-1 rounded-sm border border-forest/30">
                {p.name}
              </h3>
            </div>

            {/* Métricas e Info Rápidas */}
            <div className="p-6 space-y-4 flex-1 flex flex-col justify-between">
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-forest-dark/20 p-2 rounded border border-forest/20">
                  <span className="text-[9px] text-cream/60 uppercase block font-mono">Puntos 25/26</span>
                  <span className="text-xs font-bold text-forest-light">{p.lastSeasonPoints || p.stats?.points || 0} pts</span>
                </div>
                <div className="bg-forest-dark/20 p-2 rounded border border-forest/20">
                  <span className="text-[9px] text-cream/60 uppercase block font-mono">Media Pts</span>
                  <span className="text-xs font-bold text-cream">{p.lastSeasonAvg || 4.2}</span>
                </div>
                <div className="bg-forest-dark/20 p-2 rounded border border-forest/20">
                  <span className="text-[9px] text-cream/60 uppercase block font-mono">Predicción 26/27</span>
                  <span className="text-xs font-bold text-amber-300">~{p.projectedPoints || 140} pts</span>
                </div>
              </div>

              {/* Valor de Mercado */}
              <div className="pt-2 border-t border-forest/30 flex justify-between items-center text-xs">
                <div>
                  <span className="text-[10px] text-cream/60 uppercase block font-mono">Valor Comunio</span>
                  <span className="font-bold text-amber-300">{formatPrice(p.price)}</span>
                </div>
                <button className="bg-forest/40 hover:bg-forest text-cream text-[10px] font-bold px-3 py-1.5 rounded-sm border border-forest-light/40 transition-colors uppercase">
                  VER FICHA COMPLETA &rarr;
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* PLAYER PROFILE MODAL */}
      <PlayerProfileModal player={selectedPlayer} onClose={() => setSelectedPlayer(null)} />
    </div>
  )
}
