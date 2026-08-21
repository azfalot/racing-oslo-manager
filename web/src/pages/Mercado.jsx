import React, { useState } from 'react'
import { Radar, ArrowRightLeft, Search, UserMinus, UserPlus, Computer, Eye } from 'lucide-react'
import marketData from '../data/market.json'
import PlayerProfileModal from '../components/PlayerProfileModal'

export default function Mercado() {
  const [selectedPlayer, setSelectedPlayer] = useState(null)

  const computerPlayers = marketData.filter(p => p.ownerId === 1)
  const ourPlayers = marketData.filter(p => p.ownerId === 21163822)
  const otherPlayers = marketData.filter(p => p.ownerId !== 1 && p.ownerId !== 21163822)

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
    <div className="container mx-auto px-6 py-12">
      <div className="mb-12">
        <h2 className="text-4xl md:text-5xl font-display font-bold mb-2 border-l-4 border-forest pl-4">Mercado de Fichajes</h2>
        <p className="text-cream-dark ml-5 text-sm uppercase tracking-widest">Estado en Tiempo Real • Haga clic en cualquier jugador para abrir su ficha oficial</p>
      </div>

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
    </div>
  )
}
