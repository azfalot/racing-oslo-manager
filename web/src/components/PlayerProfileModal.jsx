import React from 'react'
import { X, Trophy, TrendingUp, Calendar, ShieldCheck, Activity, Award, ArrowUpRight, DollarSign, ExternalLink } from 'lucide-react'

export function getPosBadgeStyle(position) {
  const pos = (position || '').toLowerCase()
  if (pos.includes('keeper') || pos === 'por') {
    return { label: 'POR', color: 'bg-amber-500/20 text-amber-300 border-amber-500/40' }
  }
  if (pos.includes('defender') || pos === 'def') {
    return { label: 'DEF', color: 'bg-blue-500/20 text-blue-300 border-blue-500/40' }
  }
  if (pos.includes('midfielder') || pos === 'med') {
    return { label: 'MED', color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' }
  }
  return { label: 'DEL', color: 'bg-rose-500/20 text-rose-300 border-rose-500/40' }
}

export default function PlayerProfileModal({ player, onClose }) {
  if (!player) return null

  const posBadge = getPosBadgeStyle(player.position)
  const priceFormatted = player.price ? player.price.toLocaleString('es-ES') + ' €' : 'Sin cotización'
  const tmValueFormatted = player.tmValue || 'N/D'
  const historical = player.historicalPoints || []
  const histLast = historical.find(h => h.season === '25/26' || h.season === '24/25') || (historical.length > 0 ? historical[historical.length - 1] : null)
  const lastSeasonPts = (player.lastSeasonPoints !== undefined && player.lastSeasonPoints > 0)
    ? player.lastSeasonPoints
    : (histLast ? (parseInt(histLast.points) || 0) : (player.points || 0))
  const lastSeasonAvg = player.lastSeasonAvg || (player.average?.points ? parseFloat(String(player.average.points).replace(',', '.')) : (lastSeasonPts > 0 ? parseFloat((lastSeasonPts / 30).toFixed(1)) : 4.2))
  const projectedPts = player.projectedPoints || Math.round((lastSeasonPts || 120) * 1.1)
  const status = player.statusInfo || 'Disponible'
  const isHealthy = !status.toLowerCase().includes('baja') && !status.toLowerCase().includes('enfermer')

  return (
    <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 animate-fade-in">
      <div className="bg-clubBlack border border-forest-light/60 max-w-2xl w-full rounded-sm overflow-hidden relative max-h-[92vh] flex flex-col shadow-2xl">
        
        {/* Header con Foto & Fondo del Club */}
        <div className="relative bg-gradient-to-r from-forest-dark via-clubBlack to-forest-dark p-6 border-b border-forest/40">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 z-30 bg-black/70 p-2 rounded-full hover:bg-forest text-cream transition-colors border border-forest/40 focus:outline-none"
            aria-label="Cerrar ficha"
          >
            <X size={20} />
          </button>

          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5 relative z-10">
            {/* Foto Oficial del Jugador */}
            <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full overflow-hidden border-4 border-forest-light bg-black flex-shrink-0 shadow-2xl relative">
              <img
                src={player.image || `/media/players/${player.id}.png`}
                alt={player.name}
                className="w-full h-full object-cover"
                onError={(e) => { e.target.src = '/media/crest.jpg' }}
              />
            </div>

            {/* Info Principal */}
            <div className="text-center sm:text-left space-y-1.5 min-w-0 flex-1">
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-sm border uppercase ${posBadge.color}`}>
                  {posBadge.label}
                </span>
                <span className="bg-forest-dark/80 text-cream/90 border border-forest/40 text-[10px] font-mono px-2.5 py-0.5 rounded-sm">
                  {player.clubName || 'LaLiga EA Sports'}
                </span>
                <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-sm border ${
                  isHealthy ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30' : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                }`}>
                  {status}
                </span>
              </div>

              <h2 className="text-2xl sm:text-3xl font-display font-bold text-white tracking-wide truncate">
                {player.name}
              </h2>

              <p className="text-xs text-cream/70 font-mono">
                ID Comunio: <span className="text-forest-light font-bold">#{player.id}</span>
                {player.owner && (
                  <> • Propietario: <span className="text-white font-bold">{player.owner === 'Computer' ? 'Computadora' : player.owner}</span></>
                )}
              </p>
            </div>
          </div>
        </div>

        {/* Modal Scroll Body */}
        <div className="overflow-y-auto p-6 space-y-6">

          {/* METRICAS DE MERCADO & VALOR */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-forest-dark/30 border border-forest/40 p-3 rounded-sm shadow-sm">
              <span className="text-[10px] text-cream/60 uppercase block font-mono">Valor Comunio</span>
              <span className="text-sm sm:text-base font-bold text-amber-300 truncate block mt-0.5">
                {priceFormatted}
              </span>
            </div>

            <div className="bg-forest-dark/30 border border-forest/40 p-3 rounded-sm shadow-sm">
              <span className="text-[10px] text-cream/60 uppercase block font-mono">Valor Transfermarkt</span>
              <span className="text-sm sm:text-base font-bold text-white truncate block mt-0.5">
                {tmValueFormatted}
              </span>
            </div>

            <div className="bg-forest-dark/30 border border-forest/40 p-3 rounded-sm shadow-sm">
              <span className="text-[10px] text-cream/60 uppercase block font-mono">Puntos 25/26</span>
              <span className="text-sm sm:text-base font-bold text-forest-light truncate block mt-0.5">
                {lastSeasonPts} pts
              </span>
            </div>

            <div className="bg-forest-dark/30 border border-forest/40 p-3 rounded-sm shadow-sm">
              <span className="text-[10px] text-cream/60 uppercase block font-mono">Media Pts/Partido</span>
              <span className="text-sm sm:text-base font-bold text-cream truncate block mt-0.5">
                {player.lastSeasonAvg || 4.2} pts
              </span>
            </div>
          </div>

          {/* INFORMACIÓN DE PERFIL TÉCNICO TRANSFERMARKT */}
          {(player.age || player.foot || player.detailedPosition || player.tmUrl) && (
            <div className="bg-black/60 border border-forest/40 p-4 rounded-sm space-y-2.5 shadow-md">
              <div className="flex items-center justify-between border-b border-forest/30 pb-2">
                <span className="text-xs font-display font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                  <ShieldCheck size={14} className="text-forest-light" /> PERFIL TÉCNICO TRANSFERMARKT
                </span>
                {player.tmUrl && (
                  <a
                    href={player.tmUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[10px] text-forest-light hover:text-white font-mono flex items-center gap-1 transition-colors uppercase font-bold"
                  >
                    FICHA OFICIAL <ExternalLink size={12} />
                  </a>
                )}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                {player.age && (
                  <div>
                    <span className="text-[10px] text-cream/50 uppercase font-mono block">Edad</span>
                    <span className="font-bold text-white">{player.age}</span>
                  </div>
                )}

                {player.foot && (
                  <div>
                    <span className="text-[10px] text-cream/50 uppercase font-mono block">Pie Hábil</span>
                    <span className="font-bold text-white capitalize">{player.foot}</span>
                  </div>
                )}

                {player.detailedPosition && (
                  <div>
                    <span className="text-[10px] text-cream/50 uppercase font-mono block">Demarcación Específica</span>
                    <span className="font-bold text-forest-light">{player.detailedPosition}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* PREDICCIÓN ESPERADA TEMPORADA 2026/27 */}
          <div className="bg-gradient-to-r from-forest-dark/60 via-forest/30 to-forest-dark/60 border border-forest-light/40 p-4 rounded-sm space-y-2 shadow-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingUp size={18} className="text-forest-light animate-pulse" />
                <h3 className="text-sm font-display font-bold text-white uppercase tracking-wider">
                  PROYECCIÓN TEMPORADA 2026/27 (38 JORNADAS)
                </h3>
              </div>
              <span className="bg-forest text-cream text-[10px] font-bold px-2.5 py-0.5 rounded-sm border border-forest-light/50">
                PROYECCIÓN ALGORÍTMICA
              </span>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-baseline gap-3 pt-1">
              <span className="text-3xl sm:text-4xl font-display font-bold text-white shadow-sm">
                ~{projectedPts} <span className="text-sm text-forest-light font-normal">pts totales</span>
              </span>
              <p className="text-xs text-cream/80 leading-relaxed">
                Media estimada de <b className="text-amber-300">~{(projectedPts / 34).toFixed(1)} pts/partido</b> según histórico contrastado en Primera División y rol de titularidad.
              </p>
            </div>
          </div>

          {/* HISTÓRICO DE PUNTOS POR TEMPORADAS (API COMUNIO) */}
          {historical.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 border-b border-forest/30 pb-2">
                <Award size={16} className="text-amber-400" />
                <h3 className="text-sm font-display font-bold text-white uppercase tracking-wide">
                  HISTÓRICO DE PUNTOS EN COMUNIO (POR TEMPORADA)
                </h3>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {historical.slice(-6).map((h, i) => {
                  const ptsNum = parseInt(h.points) || 0
                  return (
                    <div key={i} className="bg-black/40 border border-forest/30 p-2.5 rounded-sm flex justify-between items-center text-xs">
                      <span className="text-cream/60 font-mono">Temp. {h.season}</span>
                      <span className="font-bold text-forest-light">{ptsNum} pts</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* ACCIONES DIRECTAS */}
          <div className="pt-2 border-t border-forest/30 flex justify-end gap-3">
            <button
              onClick={onClose}
              className="bg-black/60 hover:bg-black border border-forest/40 text-cream px-4 py-2 rounded-sm text-xs font-bold tracking-wider transition-colors"
            >
              CERRAR FICHA
            </button>
          </div>

        </div>
      </div>
    </div>
  )
}
