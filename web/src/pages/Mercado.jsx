import React, { useState } from 'react'
import { Radar, ArrowRightLeft, Search, UserMinus, UserPlus, Computer, Eye, Flame, X } from 'lucide-react'
import marketData from '../data/market.json'
import newsData from '../data/news.json'
import PlayerProfileModal from '../components/PlayerProfileModal'
import { getCategoryBadgeStyle, formatNewsDate } from './Noticias'

export default function Mercado() {
  const [selectedPlayer, setSelectedPlayer] = useState(null)
  const [selectedNews, setSelectedNews] = useState(null)

  const computerPlayers = marketData.filter(p => p.ownerId === 1)
  const ourPlayers = marketData.filter(p => p.ownerId === 21163822)
  const otherPlayers = marketData.filter(p => p.ownerId !== 1 && p.ownerId !== 21163822)
  const rumorNews = (newsData || []).filter(n => (n.category || '').toLowerCase() === 'rumores')

  const formatPrice = (price) => price ? price.toLocaleString('es-ES') + ' €' : 'Desconocido'

  const renderPlayerRow = (p) => (
    <tr
      key={p.id}
      onClick={() => setSelectedPlayer(p)}
      className="border-b border-forest/10 hover:bg-forest-dark/30 transition-colors cursor-pointer group"
    >
      <td className="p-4 flex items-center gap-3">
        <img src={p.image} alt={p.name} className="w-9 h-9 rounded-full bg-forest-dark/50 object-cover border border-forest/40" />
        <div>
          <p className="font-bold text-white group-hover:text-forest-light transition-colors">{p.name}</p>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="text-[9px] uppercase font-bold text-forest-light bg-forest/20 px-1.5 py-0.5 rounded-sm border border-forest/30">{p.position}</span>
            <span className="text-[10px] text-cream/50 font-mono">{p.clubName || 'LaLiga'}</span>
          </div>
        </div>
      </td>
      <td className="p-4 text-amber-300 font-mono text-sm font-bold">{formatPrice(p.price)}</td>
      <td className="p-4 text-center font-bold text-forest-light">{p.lastSeasonPoints || p.points || 0} pts</td>
      <td className="p-4 text-center font-bold text-amber-300 font-mono">~{p.projectedPoints || 120} pts</td>
      <td className="p-4 text-right font-mono text-sm text-white">{formatPrice(p.tmValue)}</td>
      <td className="p-4 text-right">
        <button className="bg-forest/40 hover:bg-forest text-cream text-[10px] font-bold px-2.5 py-1 rounded-sm border border-forest-light/40 transition-colors uppercase inline-flex items-center gap-1">
          <Eye size={12} /> Ficha &rarr;
        </button>
      </td>
    </tr>
  )

  return (
    <div className="container mx-auto px-6 py-12 space-y-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-forest/30 pb-6">
        <div>
          <h2 className="text-4xl md:text-5xl font-display font-bold mb-2 border-l-4 border-forest pl-4">Mercado de Fichajes</h2>
          <p className="text-cream-dark ml-5 text-sm uppercase tracking-widest">Estado en Tiempo Real & Diario de Rumores de Mateo Oslomany</p>
        </div>
      </div>

      {/* SECCIÓN DE RUMORES DE MERCADO & EL DIARIO DE MATEO OSLOMANY */}
      {rumorNews.length > 0 && (
        <div className="bg-purple-950/20 border border-purple-500/40 p-6 rounded-sm space-y-4 shadow-xl">
          <div className="flex items-center gap-3 border-b border-purple-500/40 pb-3">
            <Flame className="text-purple-400 animate-pulse" size={24} />
            <div>
              <h3 className="text-2xl font-display font-bold text-white uppercase tracking-wide">
                RUMORES & DIARIO DE MERCADO DE MATEO OSLOMANY
              </h3>
              <p className="text-xs text-purple-300/80 font-mono">
                Análisis táctico editorial, rumores de fichaje y seguimiento de objetivos de la Secretaría Técnica
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {rumorNews.map(rumor => {
              const badgeStyle = getCategoryBadgeStyle(rumor.category)
              return (
                <div
                  key={rumor.id}
                  onClick={() => setSelectedNews(rumor)}
                  className="bg-black/60 border border-purple-500/40 rounded-sm overflow-hidden flex flex-col justify-between group hover:border-purple-400 transition-all cursor-pointer shadow-lg hover:scale-[1.01]"
                >
                  <div className="relative h-36 overflow-hidden border-b border-purple-500/30">
                    <img
                      src={rumor.image || '/media/crest.jpg'}
                      alt={rumor.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    <div className="absolute top-2 left-2 z-10">
                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded-sm border uppercase ${badgeStyle.pill}`}>
                        RUMOR DE MERCADO
                      </span>
                    </div>
                  </div>

                  <div className="p-4 space-y-2 flex-1 flex flex-col justify-between">
                    <div>
                      <span className="text-[10px] text-cream/50 font-mono block mb-1">
                        {formatNewsDate(rumor.date)}
                      </span>
                      <h4 className="text-sm font-bold text-white group-hover:text-purple-300 transition-colors line-clamp-2 leading-tight">
                        {rumor.title}
                      </h4>
                      <p className="text-xs text-cream/70 line-clamp-3 leading-relaxed italic border-l-2 border-purple-400 pl-2 bg-purple-950/30 py-1.5 mt-2 rounded-r-sm">
                        {rumor.excerpt || rumor.summary}
                      </p>
                    </div>

                    <div className="pt-3 border-t border-purple-500/20 flex justify-between items-center text-xs">
                      <span className="text-purple-300 font-mono font-bold text-[10px]">Mateo Oslomany Editorial</span>
                      <button className="bg-purple-600/30 text-purple-200 group-hover:bg-purple-600 group-hover:text-white px-2.5 py-1 rounded-sm border border-purple-400/40 transition-colors text-[10px] font-bold uppercase">
                        LEER RUMOR &rarr;
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* MERCADO PRINCIPAL */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
        {/* Jugadores Libres */}
        <div className="lg:col-span-2 space-y-8">
          <div className="flex items-center gap-3 border-b border-forest/30 pb-4">
            <Computer className="text-forest-light" />
            <h3 className="text-2xl font-display font-bold">Jugadores Libres ({computerPlayers.length})</h3>
          </div>
          
          <div className="bg-black border border-forest/30 rounded-sm overflow-hidden shadow-xl">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-forest-dark/40 text-xs uppercase tracking-widest text-forest-light border-b border-forest/30 font-mono">
                  <th className="p-4">Jugador</th>
                  <th className="p-4">Precio Comunio</th>
                  <th className="p-4 text-center">Pts 25/26</th>
                  <th className="p-4 text-center">Predicción 26/27</th>
                  <th className="p-4 text-right">Valor TM</th>
                  <th className="p-4 text-right">Acción</th>
                </tr>
              </thead>
              <tbody>
                {computerPlayers.map(renderPlayerRow)}
              </tbody>
            </table>
          </div>
        </div>

        {/* Columna Derecha: Nuestros Jugadores & Rivales */}
        <div className="space-y-8">
          {/* Nuestros en Venta */}
          <div>
            <div className="flex items-center gap-3 border-b border-forest/30 pb-4 mb-4">
              <UserMinus className="text-amber-400" />
              <h3 className="text-xl font-display font-bold">Nuestros Transferibles</h3>
            </div>
            {ourPlayers.length === 0 ? (
              <p className="text-sm text-cream/50 italic bg-black/40 p-4 border border-forest/20 rounded-sm">No hay jugadores puestos en venta por el club actualmente.</p>
            ) : (
              <div className="space-y-2">
                {ourPlayers.map(p => (
                  <div key={p.id} onClick={() => setSelectedPlayer(p)} className="bg-black border border-forest/30 p-3 rounded-sm flex justify-between items-center cursor-pointer hover:border-forest-light transition-all">
                    <div className="flex items-center gap-3">
                      <img src={p.image} alt={p.name} className="w-8 h-8 rounded-full object-cover" />
                      <div>
                        <p className="font-bold text-xs text-white">{p.name}</p>
                        <p className="text-[10px] text-amber-300 font-mono">{formatPrice(p.price)}</p>
                      </div>
                    </div>
                    <span className="text-xs font-bold text-forest-light">~{p.projectedPoints || 130} pts</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* En Venta por Rivales */}
          <div>
            <div className="flex items-center gap-3 border-b border-forest/30 pb-4 mb-4">
              <UserPlus className="text-forest-light" />
              <h3 className="text-xl font-display font-bold">En Venta por Rivales</h3>
            </div>
            <div className="space-y-2">
              {otherPlayers.map(p => (
                <div key={p.id} onClick={() => setSelectedPlayer(p)} className="bg-black border border-forest/30 p-3 rounded-sm flex justify-between items-center cursor-pointer hover:border-forest-light transition-all">
                  <div className="flex items-center gap-3">
                    <img src={p.image} alt={p.name} className="w-8 h-8 rounded-full object-cover" />
                    <div>
                      <p className="font-bold text-xs text-white">{p.name}</p>
                      <p className="text-[10px] text-cream/50 font-mono">{p.owner}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-bold text-amber-300 font-mono">{formatPrice(p.price)}</p>
                    <p className="text-[10px] text-forest-light font-mono">~{p.projectedPoints || 120} pts esperados</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* PLAYER PROFILE MODAL */}
      <PlayerProfileModal player={selectedPlayer} onClose={() => setSelectedPlayer(null)} />

      {/* RUMOR FULL NEWS MODAL */}
      {selectedNews && (() => {
        const modalBadgeStyle = getCategoryBadgeStyle(selectedNews.category)
        return (
          <div className="fixed inset-0 z-50 bg-black/95 backdrop-blur-md flex items-center justify-center p-4 sm:p-6">
            <div className="bg-clubBlack border border-purple-500/60 max-w-3xl w-full rounded-sm overflow-hidden animate-fade-in relative max-h-[92vh] flex flex-col shadow-2xl">
              <button
                onClick={() => setSelectedNews(null)}
                className="absolute top-4 right-4 z-30 bg-black/80 p-2.5 rounded-full hover:bg-purple-700 text-cream transition-colors border border-purple-500/40 focus:outline-none"
                aria-label="Cerrar rumor"
              >
                <X size={22} />
              </button>

              <div className="overflow-y-auto p-6 sm:p-8 space-y-6">
                {selectedNews.image && (
                  <div className="w-full h-56 sm:h-72 rounded-sm overflow-hidden border border-purple-500/40 relative shadow-2xl">
                    <img
                      src={selectedNews.image}
                      alt={selectedNews.title}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute top-4 left-4 z-10">
                      <span className={`text-xs font-bold px-3 py-1 rounded-sm border uppercase ${modalBadgeStyle.pill}`}>
                        RUMOR DE MERCADO
                      </span>
                    </div>
                  </div>
                )}

                <div className="space-y-3 border-b border-purple-500/30 pb-4">
                  <div className="flex items-center gap-2 text-xs font-mono text-purple-300">
                    <span>{formatNewsDate(selectedNews.date)}</span>
                    <span>•</span>
                    <span>Mateo Oslomany Editorial</span>
                  </div>

                  <h2 className="text-2xl sm:text-3xl font-display font-bold text-white leading-tight">
                    {selectedNews.title}
                  </h2>
                </div>

                <div className="pt-2 border-t border-purple-500/30 text-cream/90 text-sm leading-relaxed whitespace-pre-wrap font-sans space-y-4">
                  {selectedNews.content || selectedNews.excerpt}
                </div>
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
