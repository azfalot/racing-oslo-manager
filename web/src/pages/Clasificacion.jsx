import React, { useState } from 'react'
import { Trophy, TrendingUp, DollarSign, Star, Sparkles, Shield, AlertCircle } from 'lucide-react'
import matchData from '../data/matches.json'

export default function Clasificacion() {
  const [activeTab, setActiveTab] = useState('live') // 'live' | 'predictive'
  const standings = matchData.standingsData || []

  // Calcular tabla predictiva a final de temporada (38 jornadas)
  const predictiveStandings = [...standings].map(t => {
    const livePts = t.pts || 0
    const val = t.value || 40000000
    // Factor de potencia: Valor de plantilla + liquidez estimada
    // Racing de Oslo tiene 19.7M extra en liquidez para fichajes clave
    const effectiveValue = t.team === 'Racing de Oslo' ? (val + 19700000) : val
    const estimatedPtsPerMatch = (effectiveValue / 1000000) * 1.05 + 4
    const remainingMatchdays = 36 // 38 - 2
    const projectedPts = livePts + Math.round(estimatedPtsPerMatch * remainingMatchdays)

    return {
      ...t,
      effectiveValue,
      projectedPts
    }
  }).sort((a, b) => b.projectedPts - a.projectedPts)

  return (
    <div className="container mx-auto px-4 md:px-6 py-10">
      {/* Header */}
      <div className="mb-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-forest/30 pb-6">
          <div>
            <h2 className="text-3xl md:text-5xl font-display font-bold text-cream mb-2 flex items-center gap-3">
              <Trophy className="text-yellow-500 shrink-0" size={38} /> Clasificación Comunio
            </h2>
            <p className="text-cream-dark text-xs uppercase tracking-widest flex items-center gap-2">
              <Shield size={14} className="text-forest-light" /> Comunio Liga Total · Temporada 2026/27
            </p>
          </div>

          {/* Selector de Pestañas */}
          <div className="flex bg-black/60 p-1 border border-forest/30 rounded-lg self-start md:self-auto">
            <button
              onClick={() => setActiveTab('live')}
              className={`flex items-center gap-2 px-4 py-2 text-xs md:text-sm font-semibold rounded-md transition-all ${
                activeTab === 'live'
                  ? 'bg-forest text-cream shadow-md shadow-forest/20'
                  : 'text-cream-dark hover:text-cream hover:bg-forest-dark/30'
              }`}
            >
              <Trophy size={16} /> Clasificación & Economía
            </button>
            <button
              onClick={() => setActiveTab('predictive')}
              className={`flex items-center gap-2 px-4 py-2 text-xs md:text-sm font-semibold rounded-md transition-all ${
                activeTab === 'predictive'
                  ? 'bg-gradient-to-r from-amber-600 to-yellow-600 text-cream shadow-md shadow-yellow-600/20'
                  : 'text-cream-dark hover:text-cream hover:bg-forest-dark/30'
              }`}
            >
              <Sparkles size={16} /> Proyección IA (Final de Temporada)
            </button>
          </div>
        </div>
      </div>

      {/* VISTA 1: CLASIFICACIÓN EN VIVO + ECONOMÍA */}
      {activeTab === 'live' && (
        <div className="space-y-6">
          <div className="bg-black/80 border border-forest/30 rounded-lg overflow-hidden shadow-xl">
            <div className="p-4 bg-forest-dark/40 border-b border-forest/30 flex items-center justify-between">
              <span className="text-xs uppercase tracking-wider text-forest-light font-semibold flex items-center gap-2">
                <DollarSign size={14} /> Puntos en Vivo (Live Scoring) + Valor de Mercado de Plantillas
              </span>
              <span className="text-xs text-cream-dark">10 Equipos</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-black/90 text-xs uppercase tracking-widest text-cream-dark border-b border-forest/30">
                    <th className="p-3 md:p-4 font-semibold w-12 text-center">Pos</th>
                    <th className="p-3 md:p-4 font-semibold">Club / Dirección Deportiva</th>
                    <th className="p-3 md:p-4 font-semibold text-center w-20">Pts Live</th>
                    <th className="p-3 md:p-4 font-semibold text-right w-36">Valor Plantilla (€)</th>
                    <th className="p-3 md:p-4 font-semibold hidden lg:table-cell">Estrellas Principales</th>
                  </tr>
                </thead>
                <tbody>
                  {standings.map((t, index) => {
                    const isMe = t.team === 'Racing de Oslo'
                    const stars = t.stars || []
                    const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}º`

                    return (
                      <tr
                        key={t.team}
                        className={`border-b border-forest/10 hover:bg-forest-dark/20 transition-colors ${
                          isMe ? 'bg-forest/20 font-semibold border-l-4 border-l-yellow-500' : ''
                        }`}
                      >
                        <td className="p-3 md:p-4 text-center font-bold text-sm md:text-base">
                          {medal}
                        </td>
                        <td className="p-3 md:p-4">
                          <div className="flex items-center gap-3">
                            {isMe ? (
                              <img src="/media/crest.jpg" alt="Crest" className="w-7 h-7 rounded-full border border-yellow-500 shrink-0" />
                            ) : (
                              <div className="w-7 h-7 rounded-full bg-forest-dark/60 border border-forest/30 flex items-center justify-center text-xs font-bold text-forest-light shrink-0">
                                {t.team.charAt(0)}
                              </div>
                            )}
                            <div>
                              <div className="flex items-center gap-2">
                                <span className={`text-sm md:text-base ${isMe ? 'text-yellow-400 font-bold' : 'text-cream'}`}>
                                  {t.team}
                                </span>
                                {isMe && (
                                  <span className="text-[10px] bg-yellow-500/20 text-yellow-400 px-2 py-0.5 rounded border border-yellow-500/30 uppercase font-bold">
                                    Tu Club
                                  </span>
                                )}
                              </div>
                              {/* Valor visible en dispositivos móviles */}
                              <div className="text-xs text-cream-dark md:hidden mt-0.5 flex items-center gap-2">
                                <span>💰 {t.value ? (t.value / 1000000).toFixed(1) + 'M €' : '—'}</span>
                                {isMe && <span className="text-green-400 font-semibold">(+19,7M € Liquidez)</span>}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="p-3 md:p-4 text-center">
                          <span className={`inline-block px-3 py-1 rounded-full text-sm font-bold ${
                            t.pts > 0 ? 'bg-green-600/30 text-green-400 border border-green-500/40' : 'bg-gray-800 text-gray-400'
                          }`}>
                            {t.pts || 0}
                          </span>
                        </td>
                        <td className="p-3 md:p-4 text-right font-mono text-sm md:text-base text-cream">
                          {t.value ? (
                            <div>
                              <div className="font-bold text-emerald-400">{t.value.toLocaleString('es-ES')} €</div>
                              {isMe && <div className="text-[10px] text-yellow-400 font-sans">+19,7M € Liquidez Extra</div>}
                            </div>
                          ) : (
                            <span className="text-cream-dark">—</span>
                          )}
                        </td>
                        <td className="p-3 md:p-4 hidden lg:table-cell">
                          {stars.length > 0 ? (
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {stars.map((s, idx) => (
                                <span key={idx} className="text-[11px] bg-black/60 border border-forest/30 text-cream-dark px-2 py-0.5 rounded-full flex items-center gap-1">
                                  <Star size={10} className="text-yellow-500" /> {s.name} <span className="text-forest-light">({(s.price / 1000000).toFixed(1)}M)</span>
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-xs text-cream-dark">—</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* VISTA 2: PROYECCIÓN FINAL DE TEMPORADA (IA) */}
      {activeTab === 'predictive' && (
        <div className="space-y-6">
          <div className="bg-gradient-to-br from-amber-950/30 via-black to-black border border-amber-500/30 rounded-lg p-5">
            <div className="flex items-start gap-3">
              <Sparkles className="text-yellow-400 shrink-0 mt-1" size={24} />
              <div>
                <h3 className="text-lg font-bold text-yellow-400 mb-1">Modelo de Proyección Algorítmica (38 Jornadas)</h3>
                <p className="text-cream-dark text-xs md:text-sm leading-relaxed">
                  Esta tabla simula la posición proyectada al cierre de la temporada basándose en el **Valor Eficiente del Plantel**, el potencial económico no gastado y la tasa media de puntos de Comunio.
                  El <b>Racing de Oslo</b> escala posiciones debido a su reserva estratégica de <b>19,7M € en liquidez</b> lista para fichajes de alto impacto (+30 a +50 pts).
                </p>
              </div>
            </div>
          </div>

          <div className="bg-black/80 border border-amber-500/30 rounded-lg overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-amber-950/40 text-xs uppercase tracking-widest text-yellow-400 border-b border-amber-500/30">
                    <th className="p-3 md:p-4 font-semibold w-12 text-center">Pos IA</th>
                    <th className="p-3 md:p-4 font-semibold">Club</th>
                    <th className="p-3 md:p-4 font-semibold text-center w-24">Pts Actuales</th>
                    <th className="p-3 md:p-4 font-semibold text-center w-28 text-yellow-400">Pts Proyectados</th>
                    <th className="p-3 md:p-4 font-semibold text-right w-36">Capacidad (€)</th>
                  </tr>
                </thead>
                <tbody>
                  {predictiveStandings.map((t, index) => {
                    const isMe = t.team === 'Racing de Oslo'
                    const medal = index === 0 ? '🏆 1º' : index === 1 ? '🥈 2º' : index === 3 ? '🥉 3º' : `${index + 1}º`

                    return (
                      <tr
                        key={t.team}
                        className={`border-b border-amber-500/10 hover:bg-amber-950/20 transition-colors ${
                          isMe ? 'bg-amber-500/10 font-bold border-l-4 border-l-yellow-400' : ''
                        }`}
                      >
                        <td className="p-3 md:p-4 text-center font-bold text-sm md:text-base text-yellow-400">
                          {medal}
                        </td>
                        <td className="p-3 md:p-4">
                          <div className="flex items-center gap-3">
                            {isMe ? (
                              <img src="/media/crest.jpg" alt="Crest" className="w-7 h-7 rounded-full border border-yellow-400 shrink-0" />
                            ) : (
                              <div className="w-7 h-7 rounded-full bg-amber-950/60 border border-amber-500/30 flex items-center justify-center text-xs font-bold text-yellow-400 shrink-0">
                                {t.team.charAt(0)}
                              </div>
                            )}
                            <div>
                              <span className={`text-sm md:text-base ${isMe ? 'text-yellow-300 font-bold' : 'text-cream'}`}>
                                {t.team}
                              </span>
                              {isMe && (
                                <div className="text-[10px] text-emerald-400 font-normal">
                                  ▲ Alta proyección por margen de fichaje estrella (+19,7M €)
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="p-3 md:p-4 text-center text-sm text-cream-dark">
                          {t.pts || 0} pts
                        </td>
                        <td className="p-3 md:p-4 text-center">
                          <span className="inline-block px-3 py-1 rounded-full text-sm font-extrabold bg-amber-500/20 text-yellow-300 border border-yellow-500/40">
                            ~{t.projectedPts} pts
                          </span>
                        </td>
                        <td className="p-3 md:p-4 text-right font-mono text-xs md:text-sm text-cream-dark">
                          {(t.effectiveValue / 1000000).toFixed(1)}M €
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
