import React, { useState } from 'react'
import { Radar, ArrowRightLeft, Search, UserMinus, UserPlus, Computer, Eye, Flame, X, Scale, Info, TrendingUp, TrendingDown, CheckCircle2, AlertTriangle, Sparkles } from 'lucide-react'
import marketData from '../data/market.json'
import newsData from '../data/news.json'
import speculationRadar from '../data/speculationRadar.json'
import marketBalance from '../data/marketBalance.json'
import PlayerProfileModal from '../components/PlayerProfileModal'
import { getCategoryBadgeStyle, formatNewsDate } from './Noticias'

export default function Mercado() {
  const [selectedPlayer, setSelectedPlayer] = useState(null)
  const [selectedNews, setSelectedNews] = useState(null)
  const [showBalanceModal, setShowBalanceModal] = useState(false)
  const [positionFilter, setPositionFilter] = useState('ALL') // ALL, keeper, defender, midfielder, striker
  const [searchTerm, setSearchTerm] = useState('')
  const [showAllRumors, setShowAllRumors] = useState(false)

  const filterPlayer = (p) => {
    // 1. Filtro por posición
    if (positionFilter !== 'ALL') {
      const pos = (p.position || '').toLowerCase()
      if (!pos.includes(positionFilter.toLowerCase())) return false
    }
    // 2. Buscador por nombre o club
    if (searchTerm.trim() !== '') {
      const term = searchTerm.toLowerCase().trim()
      const name = (p.name || '').toLowerCase()
      const club = (p.clubName || '').toLowerCase()
      if (!name.includes(term) && !club.includes(term)) return false
    }
    return true
  }

  const rawComputer = marketData.filter(p => p.ownerId === 1)
  const computerPlayers = rawComputer.filter(filterPlayer)
  const ourPlayers = marketData.filter(p => p.ownerId === 21163822).filter(filterPlayer)
  const otherPlayers = marketData.filter(p => p.ownerId !== 1 && p.ownerId !== 21163822).filter(filterPlayer)
  const rumorNews = (newsData || []).filter(n => (n.category || '').toLowerCase() === 'rumores')
  const displayedRumors = showAllRumors ? rumorNews : rumorNews.slice(0, 3)

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

        {/* INDICADOR COMPACTO: BALANCE DE PLUSVALÍAS / PÉRDIDAS */}
        {marketBalance && (
          <div className="flex items-center gap-3 bg-black/85 border border-forest/40 p-2.5 sm:px-4 sm:py-2.5 rounded-sm shadow-xl">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 rounded-full bg-forest-dark border border-forest/40 text-amber-400">
                <Scale size={16} />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] uppercase font-bold text-cream/60 font-mono tracking-wider">Balance Plusvalías</span>
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs sm:text-sm font-mono font-bold text-forest-light">
                    +{(marketBalance.realizedGainsEUR || 0).toLocaleString('es-ES')} €
                  </span>
                  <span className="text-[10px] text-cream/50 font-mono hidden sm:inline">
                    ({marketBalance.profitableTradesCount || 4} trades ganadores)
                  </span>
                </div>
              </div>
            </div>

            <button
              onClick={() => setShowBalanceModal(true)}
              className="p-1.5 px-2 rounded-sm bg-forest/20 hover:bg-forest text-cream-dark hover:text-white border border-forest/40 transition-all flex items-center gap-1.5 text-[11px] font-mono cursor-pointer shadow-sm group"
              title="Abrir auditoría completa de balance, plusvalías y minusvalías"
            >
              <Info size={14} className="text-amber-300 group-hover:text-white transition-colors" />
              <span className="font-bold">Info Balance</span>
            </button>
          </div>
        )}
      </div>

      {/* SECCIÓN DE RUMORES DE MERCADO (TOP 3 COMPACTO + BOTÓN AMPLIAR) */}
      {rumorNews.length > 0 && (
        <div className="bg-black border border-forest/30 p-3 rounded-sm space-y-2 shadow-md">
          <div className="flex items-center justify-between border-b border-forest/20 pb-1.5">
            <div className="flex items-center gap-2">
              <Flame className="text-purple-400" size={16} />
              <h3 className="text-xs font-display font-bold text-white uppercase tracking-wider">
                RUMORES & DIARIO DE MERCADO ({displayedRumors.length} de {rumorNews.length})
              </h3>
            </div>
            <div className="flex items-center gap-3">
              {rumorNews.length > 3 && (
                <button
                  onClick={() => setShowAllRumors(!showAllRumors)}
                  className="text-[10px] font-bold text-purple-300 hover:text-purple-200 transition-colors uppercase flex items-center gap-1 bg-purple-950/50 hover:bg-purple-900/60 px-2 py-0.5 rounded-sm border border-purple-500/40 shadow-sm cursor-pointer"
                >
                  {showAllRumors ? 'Mostrar menos ▴' : `Ver todos (${rumorNews.length}) ▾`}
                </button>
              )}
              <span className="text-[10px] text-cream/50 font-mono hidden sm:inline">
                Mateo Oslomany Radar
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
            {displayedRumors.map(rumor => {
              return (
                <div
                  key={rumor.id}
                  onClick={() => setSelectedNews(rumor)}
                  className="bg-forest-dark/20 border border-forest/20 p-2 rounded-sm hover:border-forest-light/60 transition-all flex items-center gap-2.5 group cursor-pointer"
                >
                  <img
                    src={rumor.image || '/media/crest.jpg'}
                    alt={rumor.title}
                    className="w-10 h-10 rounded-sm object-cover border border-forest/30 flex-shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className="bg-purple-500/20 text-purple-300 border border-purple-500/30 text-[8px] font-bold px-1.5 py-0.2 rounded-sm uppercase">
                        RUMOR
                      </span>
                      <span className="text-[9px] text-cream/40 font-mono truncate">
                        {formatNewsDate(rumor.date)}
                      </span>
                    </div>
                    <h4 className="text-xs font-bold text-white group-hover:text-forest-light transition-colors truncate">
                      {rumor.title.replace(/^RUMOR:\s*/i, '')}
                    </h4>
                    <p className="text-[10px] text-cream/60 truncate italic">
                      {rumor.excerpt || rumor.summary}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* BARRA DE HERRAMIENTAS: FILTRO POR POSICIÓN Y BUSCADOR */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-black border border-forest/30 p-4 rounded-sm shadow-md">
        {/* Pestañas de Filtro por Posición */}
        <div className="flex flex-wrap items-center gap-1.5 w-full sm:w-auto">
          {[
            { id: 'ALL', label: 'TODOS' },
            { id: 'keeper', label: '🧤 PORTEROS' },
            { id: 'defender', label: '🛡️ DEFENSAS' },
            { id: 'midfielder', label: '⚙️ MEDIOS' },
            { id: 'striker', label: '⚡ DELANTEROS' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setPositionFilter(tab.id)}
              className={`text-xs font-bold px-3 py-1.5 rounded-sm transition-all border uppercase tracking-wider cursor-pointer ${
                positionFilter === tab.id
                  ? 'bg-forest text-cream border-forest-light shadow-md'
                  : 'bg-forest-dark/30 text-cream/70 border-forest/30 hover:border-forest/60 hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Buscador de Jugadores en Mercado */}
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-cream/50" size={14} />
          <input
            type="text"
            placeholder="Buscar jugador o club..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full bg-forest-dark/50 border border-forest/40 rounded-sm pl-9 pr-3 py-1.5 text-xs text-white placeholder-cream/40 focus:outline-none focus:border-forest-light"
          />
        </div>
      </div>

      {/* MERCADO PRINCIPAL */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-12 items-start">
        {/* Jugadores Libres */}
        <div className="lg:col-span-2 space-y-8">
          <div className="flex items-center justify-between border-b border-forest/30 pb-4">
            <div className="flex items-center gap-3">
              <Computer className="text-forest-light" />
              <h3 className="text-2xl font-display font-bold">Jugadores Libres ({computerPlayers.length})</h3>
            </div>
            {positionFilter !== 'ALL' && (
              <span className="text-xs text-forest-light font-mono font-bold uppercase border border-forest/40 px-2 py-0.5 rounded-sm bg-forest-dark/30">
                Filtro: {positionFilter}
              </span>
            )}
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
            <div className="flex items-center justify-between border-b border-forest/30 pb-4 mb-4">
              <div className="flex items-center gap-3">
                <UserMinus className="text-amber-400" />
                <h3 className="text-xl font-display font-bold">Nuestros Transferibles</h3>
              </div>
              <span className="text-xs font-mono font-bold text-amber-400 bg-amber-950/40 px-2 py-0.5 rounded border border-amber-500/30">
                {ourPlayers.length}
              </span>
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
            <div className="flex items-center justify-between border-b border-forest/30 pb-4 mb-4">
              <div className="flex items-center gap-3">
                <UserPlus className="text-forest-light" />
                <h3 className="text-xl font-display font-bold">En Venta por Rivales</h3>
              </div>
              <span className="text-xs font-mono font-bold text-forest-light bg-forest-dark/40 px-2 py-0.5 rounded border border-forest/30">
                {otherPlayers.length}
              </span>
            </div>
            {otherPlayers.length === 0 ? (
              <p className="text-sm text-cream/50 italic bg-black/40 p-4 border border-forest/20 rounded-sm">No hay jugadores puestos en venta por rivales actualmente.</p>
            ) : (
              <div className="space-y-2 max-h-[460px] overflow-y-auto pr-1.5">
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
            )}
          </div>
        </div>
      </div>

      {/* RADAR DIARIO DE ESPECULACIÓN & TRADING (GENERADOR DE TESORERÍA) */}
      {speculationRadar?.opportunities?.length > 0 && (
        <div className="bg-charcoal/80 border border-purple-500/40 p-4 sm:p-5 rounded-sm space-y-3 shadow-xl relative overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-purple-500/20 pb-3">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-purple-400 animate-pulse" />
              <h3 className="text-sm font-display font-bold text-white uppercase tracking-wider flex items-center gap-2">
                📈 RADAR DIARIO DE ESPECULACIÓN & TRADING (GENERADOR DE TESORERÍA)
              </h3>
            </div>
            <div className="flex items-center gap-3 text-xs font-mono">
              <span className="text-purple-300 font-bold bg-purple-950/60 px-2 py-0.5 rounded border border-purple-500/30">
                {speculationRadar.freeSlots} Huecos libres en plantilla
              </span>
              <span className="text-forest-light font-bold">
                Plusvalía potencial: +{(speculationRadar.totalProjectedGainsEUR / 1000000).toFixed(1)}M €
              </span>
            </div>
          </div>

          {/* Grid de Activos de Especulación */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            {speculationRadar.opportunities.map(opp => (
              <div
                key={opp.playerId}
                className="bg-black/80 border border-purple-500/30 hover:border-purple-400 p-3.5 rounded-sm space-y-2.5 transition-all shadow-md group"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-[9px] uppercase font-bold px-1.5 py-0.5 rounded border block mb-1 truncate text-purple-300 bg-purple-950/50 border-purple-500/40">
                      {opp.tierLabel.split('/')[0]}
                    </span>
                    <h4 className="text-sm font-bold text-white group-hover:text-purple-300 transition-colors">
                      {opp.name}
                    </h4>
                    <span className="text-[10px] text-cream/50 font-mono">{opp.club} • {opp.position}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-bold font-mono text-amber-300 block">
                      {opp.price.toLocaleString('es-ES')} €
                    </span>
                    <span className="text-[10px] font-bold text-forest-light font-mono">
                      +{opp.estimatedRoiPct}% ROI
                    </span>
                  </div>
                </div>

                <div className="p-2 bg-black/60 border border-white/5 rounded-sm space-y-1 text-[11px] font-mono">
                  <div className="flex justify-between text-cream/70">
                    <span>Estado:</span>
                    <span className="text-white font-bold">{opp.returnWindow}</span>
                  </div>
                  <div className="flex justify-between text-cream/70">
                    <span>Subida diaria est:</span>
                    <span className="text-forest-light font-bold">+{opp.dailyGrowthEstEUR.toLocaleString('es-ES')} €/día</span>
                  </div>
                  <div className="flex justify-between text-cream/70">
                    <span>Riesgo caída:</span>
                    <span className="text-sky-300 font-bold">{opp.downsideRisk.split(' ')[0]}</span>
                  </div>
                </div>

                <div className="text-[10px] text-purple-200/90 font-mono bg-purple-950/30 p-1.5 rounded border border-purple-500/20 text-center">
                  {opp.actionLabel}
                </div>
              </div>
            ))}
          </div>

          {/* Recomendaciones de Mateo Oslomany */}
          <div className="pt-2 border-t border-purple-500/20 text-[11px] font-mono text-cream/70 space-y-1">
            {speculationRadar.strategyRecommendations.map((rec, i) => (
              <p key={i} className="flex items-center gap-1.5">
                <span>{rec}</span>
              </p>
            ))}
          </div>
        </div>
      )}

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
                  {(selectedNews.content || selectedNews.excerpt || '').split('\\n').join('\n')}
                </div>
              </div>
            </div>
          </div>
        )
      })()}

      {/* MARKET BALANCE & AUDITORÍA DE PLUSVALÍAS MODAL */}
      {showBalanceModal && marketBalance && (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 animate-fade-in">
          <div className="bg-clubBlack border border-forest/60 max-w-4xl w-full rounded-sm overflow-hidden relative max-h-[92vh] flex flex-col shadow-2xl">
            {/* Header del Modal */}
            <div className="flex items-center justify-between p-4 sm:p-5 border-b border-forest/30 bg-black/60">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-full bg-forest-dark border border-forest/40 text-amber-300">
                  <Scale size={20} />
                </div>
                <div>
                  <h3 className="text-lg sm:text-xl font-display font-bold text-white uppercase tracking-wider flex items-center gap-2">
                    Auditoría Financiera: Plusvalías vs Minusvalías
                  </h3>
                  <p className="text-[11px] text-cream/60 font-mono">
                    Balance histórico de compras, ventas y revalorización patrimonial del club
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowBalanceModal(false)}
                className="p-2 rounded-full hover:bg-forest-dark/80 text-cream/70 hover:text-white transition-colors border border-forest/30 cursor-pointer"
                aria-label="Cerrar auditoría"
              >
                <X size={20} />
              </button>
            </div>

            {/* Contenido Scrollable */}
            <div className="overflow-y-auto p-4 sm:p-6 space-y-6">
              
              {/* Tarjetas de Métricas Top */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {/* 1. Plusvalías Realizadas */}
                <div className="bg-black/70 border border-emerald-500/40 p-3 rounded-sm space-y-1 shadow-md">
                  <span className="text-[10px] uppercase font-bold text-emerald-400 font-mono flex items-center gap-1">
                    <TrendingUp size={12} /> Plusvalías Cobradas
                  </span>
                  <p className="text-base sm:text-lg font-bold font-mono text-emerald-300">
                    +{(marketBalance.realizedGainsEUR || 0).toLocaleString('es-ES')} €
                  </p>
                  <p className="text-[10px] text-cream/50 font-mono">
                    {marketBalance.profitableTradesCount || 4} traspasos en verde
                  </p>
                </div>

                {/* 2. Minusvalías de Saneamiento */}
                <div className="bg-black/70 border border-red-500/40 p-3 rounded-sm space-y-1 shadow-md">
                  <span className="text-[10px] uppercase font-bold text-red-400 font-mono flex items-center gap-1">
                    <TrendingDown size={12} /> Minusvalías Saneadas
                  </span>
                  <p className="text-base sm:text-lg font-bold font-mono text-red-300">
                    -{(marketBalance.realizedLossesEUR || 0).toLocaleString('es-ES')} €
                  </p>
                  <p className="text-[10px] text-cream/50 font-mono">
                    Ventas forzadas de deuda (J1-J4)
                  </p>
                </div>

                {/* 3. Plusvalías Latentes en Once */}
                <div className="bg-black/70 border border-purple-500/40 p-3 rounded-sm space-y-1 shadow-md">
                  <span className="text-[10px] uppercase font-bold text-purple-300 font-mono flex items-center gap-1">
                    <Sparkles size={12} /> Plusvalía en Once
                  </span>
                  <p className="text-base sm:text-lg font-bold font-mono text-purple-300">
                    +{(marketBalance.totalLatentGainsEUR || 0).toLocaleString('es-ES')} €
                  </p>
                  <p className="text-[10px] text-cream/50 font-mono">
                    Mariano, Cardoso, De la Fuente
                  </p>
                </div>

                {/* 4. Eficacia Especulación Actual */}
                <div className="bg-black/70 border border-amber-500/40 p-3 rounded-sm space-y-1 shadow-md">
                  <span className="text-[10px] uppercase font-bold text-amber-300 font-mono flex items-center gap-1">
                    <CheckCircle2 size={12} /> Motor Actual a VM
                  </span>
                  <p className="text-base sm:text-lg font-bold font-mono text-amber-300">
                    100% Éxito
                  </p>
                  <p className="text-[10px] text-cream/50 font-mono">
                    0% riesgo / salida en beneficio
                  </p>
                </div>
              </div>

              {/* Diagnóstico Contextual de Mateo Oslomany */}
              <div className="bg-forest-dark/40 border border-forest/30 p-4 rounded-sm space-y-2 text-xs">
                <div className="flex items-center gap-2">
                  <span className="text-amber-300 font-bold uppercase tracking-wider font-mono">
                    📋 Diagnóstico de Dirección Deportiva:
                  </span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded border border-purple-500/40 text-purple-300 bg-purple-950/40">
                    {marketBalance.healthLabel}
                  </span>
                </div>
                <p className="text-cream/90 leading-relaxed font-sans">
                  {marketBalance.healthSummary}
                </p>
              </div>

              {/* Tabla de Operaciones Cerradas */}
              <div className="space-y-3">
                <h4 className="text-xs font-display font-bold text-white uppercase tracking-wider flex items-center justify-between border-b border-forest/20 pb-2">
                  <span>Historial Completo de Traspasos Cerrados ({marketBalance.closedOperations?.length || 0})</span>
                  <span className="text-[10px] font-mono text-cream/50 font-normal">Ordenado por rendimiento económico</span>
                </h4>

                <div className="bg-black border border-forest/30 rounded-sm overflow-hidden shadow-md max-h-60 overflow-y-auto">
                  <table className="w-full text-left text-xs border-collapse font-mono">
                    <thead>
                      <tr className="bg-forest-dark/50 text-[10px] uppercase tracking-wider text-forest-light border-b border-forest/20">
                        <th className="p-2.5">Futbolista</th>
                        <th className="p-2.5">Comprado</th>
                        <th className="p-2.5">Vendido</th>
                        <th className="p-2.5 text-right">Resultado</th>
                        <th className="p-2.5 text-right">ROI</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(marketBalance.closedOperations || []).map((op, idx) => (
                        <tr key={idx} className="border-b border-white/5 hover:bg-forest-dark/20 transition-colors">
                          <td className="p-2.5 font-bold text-white font-sans">{op.playerName}</td>
                          <td className="p-2.5 text-cream/70">{op.buyPrice.toLocaleString('es-ES')} €</td>
                          <td className="p-2.5 text-cream/70">{op.sellPrice.toLocaleString('es-ES')} €</td>
                          <td className={`p-2.5 text-right font-bold ${op.isProfit ? 'text-emerald-400' : 'text-red-400'}`}>
                            {op.isProfit ? '+' : ''}{op.diff.toLocaleString('es-ES')} €
                          </td>
                          <td className={`p-2.5 text-right font-bold text-[11px] ${op.isProfit ? 'text-emerald-400' : 'text-red-400'}`}>
                            {op.isProfit ? '+' : ''}{op.roiPct}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Tabla de Plusvalías Latentes de la Plantilla Actual */}
              <div className="space-y-3">
                <h4 className="text-xs font-display font-bold text-white uppercase tracking-wider flex items-center justify-between border-b border-forest/20 pb-2">
                  <span>Revalorización de la Plantilla Actual ({marketBalance.latentTrades?.length || 0} jugadores)</span>
                  <span className="text-[10px] font-mono text-purple-300 font-normal">Valor de Mercado actual vs Coste de compra</span>
                </h4>

                <div className="bg-black border border-forest/30 rounded-sm overflow-hidden shadow-md max-h-52 overflow-y-auto">
                  <table className="w-full text-left text-xs border-collapse font-mono">
                    <thead>
                      <tr className="bg-forest-dark/50 text-[10px] uppercase tracking-wider text-forest-light border-b border-forest/20">
                        <th className="p-2.5">Jugador</th>
                        <th className="p-2.5">Coste Fichaje</th>
                        <th className="p-2.5">VM Actual</th>
                        <th className="p-2.5 text-right">Plusvalía Latente</th>
                        <th className="p-2.5 text-right">ROI</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(marketBalance.latentTrades || []).map((lat, idx) => (
                        <tr key={idx} className="border-b border-white/5 hover:bg-forest-dark/20 transition-colors">
                          <td className="p-2.5 font-bold text-white font-sans">{lat.playerName}</td>
                          <td className="p-2.5 text-cream/70">{lat.buyPrice.toLocaleString('es-ES')} €</td>
                          <td className="p-2.5 text-amber-300 font-bold">{lat.currentVM.toLocaleString('es-ES')} €</td>
                          <td className={`p-2.5 text-right font-bold ${lat.latentDiff >= 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
                            {lat.latentDiff >= 0 ? '+' : ''}{lat.latentDiff.toLocaleString('es-ES')} €
                          </td>
                          <td className={`p-2.5 text-right font-bold text-[11px] ${lat.latentDiff >= 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
                            {lat.latentDiff >= 0 ? '+' : ''}{lat.latentRoiPct}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          </div>
        </div>
      )}
    </div>
  )
}

