import React, { useState } from 'react'
import { Trophy, TrendingUp, DollarSign, Star, Shield, Calculator } from 'lucide-react'
import matchData from '../data/matches.json'

// Mapa oficial de escudos e insignias para todos los clubes de la liga
const CLUB_CRESTS = {
  'Racing de Oslo': '/media/crest.jpg',
  'Fermín Gadura F.C.': '/media/crests/fermin_gadura.svg',
  'Puente Avios FC': '/media/crests/puente_avios.svg',
  'Puente Avios': '/media/crests/puente_avios.svg',
  'Hache FC': '/media/crests/hache_fc.svg',
  'Ana': '/media/crests/ana.svg',
  'Amigos de NIN': '/media/crests/amigos_de_nin.svg',
  'NIN Team': '/media/crests/amigos_de_nin.svg',
  'Pachangueros F.C.': '/media/crests/pachangueros.svg',
  'M4 TEAM': '/media/crests/m4_team.svg',
  'Melano Plabloroza': '/media/crests/melano_plabloroza.svg',
  'Suances nin': '/media/crests/suances_nin.svg'
}

export default function Clasificacion() {
  const [activeTab, setActiveTab] = useState('live') // 'live' | 'predictive'
  const standings = matchData.standingsData || []

  // Proyección matemática basada estrictamente en datos numéricos (38 jornadas)
  const predictiveStandings = [...standings].map(t => {
    const livePts = t.pts || 0
    const val = t.value || 40000000
    const estimatedPtsPerMatch = (val / 1000000) * 1.05 + 4
    const remainingMatchdays = 36 // 38 - 2
    const projectedPts = livePts + Math.round(estimatedPtsPerMatch * remainingMatchdays)

    return {
      ...t,
      projectedPts
    }
  }).sort((a, b) => b.projectedPts - a.projectedPts)

  const getCrest = (teamName) => {
    return CLUB_CRESTS[teamName] || '/media/crests/hache_fc.svg'
  }

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
              <Calculator size={16} /> Proyección a Final de Temporada
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
                <DollarSign size={14} /> Puntos en Vivo + Valor Económico del Plantel
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
                            <img
                              src={getCrest(t.team)}
                              alt={t.team}
                              className="w-8 h-8 rounded-full border border-forest/40 object-cover shrink-0 bg-black"
                            />
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
                              <div className="text-xs text-cream-dark md:hidden mt-0.5">
                                💰 {t.value ? (t.value / 1000000).toFixed(1) + 'M €' : '—'}
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
                            <span className="font-bold text-emerald-400">{t.value.toLocaleString('es-ES')} €</span>
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

      {/* VISTA 2: PROYECCIÓN FINAL DE TEMPORADA */}
      {activeTab === 'predictive' && (
        <div className="space-y-6">
          <div className="bg-black/80 border border-amber-500/30 rounded-lg p-4 flex items-center gap-3">
            <Calculator className="text-yellow-400 shrink-0" size={22} />
            <p className="text-cream-dark text-xs md:text-sm">
              <b>Estimación Numérica a 38 Jornadas:</b> Modelo proyectado según la media de puntos ponderada y el valor de plantilla actual de cada club.
            </p>
          </div>

          <div className="bg-black/80 border border-amber-500/30 rounded-lg overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-amber-950/40 text-xs uppercase tracking-widest text-yellow-400 border-b border-amber-500/30">
                    <th className="p-3 md:p-4 font-semibold w-16 text-center">Pos Prob.</th>
                    <th className="p-3 md:p-4 font-semibold">Club</th>
                    <th className="p-3 md:p-4 font-semibold text-center w-24">Pts Actuales</th>
                    <th className="p-3 md:p-4 font-semibold text-center w-28 text-yellow-400">Pts Proyectados</th>
                    <th className="p-3 md:p-4 font-semibold text-right w-36">Valor Plantilla</th>
                  </tr>
                </thead>
                <tbody>
                  {predictiveStandings.map((t, index) => {
                    const isMe = t.team === 'Racing de Oslo'
                    const medal = index === 0 ? '🏆 1º' : index === 1 ? '🥈 2º' : index === 2 ? '🥉 3º' : `${index + 1}º`

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
                            <img
                              src={getCrest(t.team)}
                              alt={t.team}
                              className="w-8 h-8 rounded-full border border-amber-500/40 object-cover shrink-0 bg-black"
                            />
                            <span className={`text-sm md:text-base ${isMe ? 'text-yellow-300 font-bold' : 'text-cream'}`}>
                              {t.team}
                            </span>
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
                          {t.value ? (t.value / 1000000).toFixed(1) + 'M €' : '—'}
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
