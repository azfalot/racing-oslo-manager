import React from 'react'
import { Radar, ArrowRightLeft, Search, UserMinus, UserPlus, Computer } from 'lucide-react'
import marketData from '../data/market.json'

export default function Mercado() {
  const computerPlayers = marketData.filter(p => p.ownerId === 1)
  const ourPlayers = marketData.filter(p => p.ownerId === 21163822)
  const otherPlayers = marketData.filter(p => p.ownerId !== 1 && p.ownerId !== 21163822)

  const formatPrice = (price) => price.toLocaleString('es-ES') + ' €'

  const renderPlayerRow = (p) => (
    <tr key={p.id} className="border-b border-forest/10 hover:bg-forest-dark/20 transition-colors">
      <td className="p-4 flex items-center gap-3">
        <img src={p.image} alt={p.name} className="w-8 h-8 rounded-full bg-forest-dark/50 object-cover" />
        <div>
          <p className="font-bold">{p.name}</p>
          <p className="text-[10px] uppercase text-cream/50 tracking-wider">{p.position}</p>
        </div>
      </td>
      <td className="p-4 text-cream-dark font-mono text-sm">{formatPrice(p.price)}</td>
      <td className="p-4 text-center font-bold text-forest-light">{p.points} pts</td>
      <td className="p-4 text-right font-mono text-sm text-forest-light">{formatPrice(p.tmValue)}</td>
      <td className="p-4 text-right">
        <span className="bg-black/60 text-xs px-2 py-1 rounded-sm border border-forest/20 text-cream/70">
          {p.ownerId === 1 ? 'Mercado Libre' : p.owner}
        </span>
      </td>
    </tr>
  )

  return (
    <div className="container mx-auto px-6 py-12">
      <div className="mb-12">
        <h2 className="text-4xl md:text-5xl font-display font-bold mb-2 border-l-4 border-forest pl-4">Mercado de Fichajes</h2>
        <p className="text-cream-dark ml-5 text-sm uppercase tracking-widest">Estado en Tiempo Real</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
        {/* Jugadores Libres */}
        <div className="lg:col-span-2 space-y-8">
          <div className="flex items-center gap-3 border-b border-forest/30 pb-4">
            <Computer className="text-forest-light" />
            <h3 className="text-2xl font-display font-bold">Jugadores Libres</h3>
          </div>
          
          <div className="bg-black border border-forest/30 rounded-sm overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-forest-dark/40 text-xs uppercase tracking-widest text-forest-light border-b border-forest/30">
                  <th className="p-4 font-semibold">Jugador</th>
                  <th className="p-4 font-semibold">Valor</th>
                  <th className="p-4 font-semibold text-center">Puntos</th>
                  <th className="p-4 font-semibold text-right">TM</th>
                  <th className="p-4 font-semibold text-right">Vendedor</th>
                </tr>
              </thead>
              <tbody>
                {computerPlayers.map(renderPlayerRow)}
                {computerPlayers.length === 0 && (
                  <tr><td colSpan="4" className="p-6 text-center text-cream/50">No hay jugadores libres ahora mismo.</td></tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="flex items-center gap-3 border-b border-forest/30 pb-4 mt-12">
            <ArrowRightLeft className="text-forest-light" />
            <h3 className="text-2xl font-display font-bold">En Venta por Otros Clubes</h3>
          </div>
          
          <div className="bg-black border border-forest/30 rounded-sm overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-forest-dark/40 text-xs uppercase tracking-widest text-forest-light border-b border-forest/30">
                  <th className="p-4 font-semibold">Jugador</th>
                  <th className="p-4 font-semibold">Valor</th>
                  <th className="p-4 font-semibold text-center">Puntos</th>
                  <th className="p-4 font-semibold text-right">TM</th>
                  <th className="p-4 font-semibold text-right">Vendedor</th>
                </tr>
              </thead>
              <tbody>
                {otherPlayers.map(renderPlayerRow)}
                {otherPlayers.length === 0 && (
                  <tr><td colSpan="4" className="p-6 text-center text-cream/50">Ningún equipo ha puesto jugadores a la venta.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Transferibles (Nosotros) */}
        <div className="space-y-8">
          <div className="flex items-center gap-3 border-b border-forest/30 pb-4">
            <UserMinus className="text-forest-light" />
            <h3 className="text-2xl font-display font-bold">Nuestros Transferibles</h3>
          </div>
          <div className="flex flex-col gap-4">
            {ourPlayers.map(p => (
              <div key={p.id} className="bg-forest-dark/10 border border-forest/30 p-4 rounded-sm flex items-center gap-4 hover:bg-forest-dark/30 transition-colors">
                <img src={p.image} alt={p.name} className="w-12 h-12 rounded-full object-cover bg-black" />
                <div className="flex-1">
                  <h4 className="font-bold text-lg">{p.name}</h4>
                  <p className="text-sm text-forest-light font-mono">{formatPrice(p.price)}</p>
                </div>
              </div>
            ))}
            {ourPlayers.length === 0 && (
              <div className="bg-forest-dark/10 border border-forest/30 p-6 rounded-sm text-center">
                <p className="text-cream/50 text-sm">No tenemos a ningún jugador a la venta actualmente.</p>
              </div>
            )}
          </div>
          
          {/* Rumores (Generados estáticos basados en el mercado si hay poco, o fijos como ambientación) */}
          <div className="flex items-center gap-3 border-b border-forest/30 pb-4 mt-8">
            <Radar className="text-forest-light" />
            <h3 className="text-2xl font-display font-bold">Rumores de Fichajes</h3>
          </div>
          <div className="bg-gradient-to-br from-forest-dark/40 to-black border border-forest-light/30 p-6 rounded-sm space-y-6">
            <p className="text-sm text-cream-dark italic">"La dirección deportiva rastrea opciones en el mercado. Mateo Oslomany no descarta un gran movimiento si las cifras cuadran..."</p>
            {computerPlayers.slice(0, 2).map((p, idx) => (
              <div key={p.id} className="border-l-2 border-forest pl-3">
                <h4 className="font-bold text-cream mb-1 flex justify-between">
                  {p.name}
                  <span className="text-forest-light">{100 - (idx * 25)}%</span>
                </h4>
                <p className="text-xs text-cream/60">Interés fuerte. Su precio de {formatPrice(p.price)} es un obstáculo, pero se prepara una puja.</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
