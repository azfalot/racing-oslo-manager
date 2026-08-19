import React from 'react'
import { Radar, ArrowRightLeft, TrendingDown, TrendingUp, Search } from 'lucide-react'

export default function Mercado() {
  const rumors = [
    { id: 1, player: "David Soria", club: "Getafe", prob: 95, desc: "Fichaje inminente. Mateo Oslomany ha lanzado una oferta de 4.82M€ al Getafe y la operación está casi cerrada." },
    { id: 2, player: "Oriol Rey", club: "Levante", prob: 60, desc: "El centro del campo necesita refuerzos. Se ha puesto encima de la mesa una puja de 440.000€, pero hay otros equipos interesados." },
    { id: 3, player: "Álvaro Valles", club: "Las Palmas", prob: 15, desc: "Tras el posible fichaje de Soria, Valles se aleja definitivamente del Oslo Arena." }
  ]

  const targets = [
    { id: 1, player: "Oriol Rey", price: "440.000 €", status: "En Negociación", trend: "up" },
    { id: 2, player: "Bryan Zaragoza", price: "2.100.000 €", status: "Observado", trend: "down" },
    { id: 3, player: "Blind", price: "3.500.000 €", status: "Descartado", trend: "up" }
  ]

  return (
    <div className="container mx-auto px-6 py-12">
      <div className="mb-12">
        <h2 className="text-4xl md:text-5xl font-display font-bold mb-2 border-l-4 border-forest pl-4">Mercado de Fichajes</h2>
        <p className="text-cream-dark ml-5 text-sm uppercase tracking-widest">Secretaría Técnica</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
        {/* Objetivos Reales */}
        <div className="lg:col-span-2 space-y-8">
          <div className="flex items-center gap-3 border-b border-forest/30 pb-4">
            <Search className="text-forest-light" />
            <h3 className="text-2xl font-display font-bold">En el Radar</h3>
          </div>
          
          <div className="bg-black border border-forest/30 rounded-sm overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-forest-dark/40 text-xs uppercase tracking-widest text-forest-light border-b border-forest/30">
                  <th className="p-4 font-semibold">Jugador</th>
                  <th className="p-4 font-semibold">Valor</th>
                  <th className="p-4 font-semibold text-center">Tendencia</th>
                  <th className="p-4 font-semibold text-right">Estado</th>
                </tr>
              </thead>
              <tbody>
                {targets.map(t => (
                  <tr key={t.id} className="border-b border-forest/10 hover:bg-forest-dark/20 transition-colors">
                    <td className="p-4 font-bold">{t.player}</td>
                    <td className="p-4 text-cream-dark font-mono text-sm">{t.price}</td>
                    <td className="p-4 text-center">
                      {t.trend === 'up' ? (
                        <TrendingUp size={16} className="text-green-500 mx-auto" />
                      ) : (
                        <TrendingDown size={16} className="text-red-500 mx-auto" />
                      )}
                    </td>
                    <td className="p-4 text-right">
                      <span className={`text-[10px] uppercase tracking-wider px-2 py-1 rounded-sm font-bold ${
                        t.status === 'En Negociación' ? 'bg-yellow-600/20 text-yellow-500' :
                        t.status === 'Observado' ? 'bg-blue-600/20 text-blue-500' :
                        'bg-red-600/20 text-red-500'
                      }`}>
                        {t.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Rumores (Fake) */}
        <div>
          <div className="flex items-center gap-3 border-b border-forest/30 pb-4 mb-6">
            <Radar className="text-forest-light animate-pulse" />
            <h3 className="text-2xl font-display font-bold">Rumores</h3>
          </div>

          <div className="space-y-6">
            {rumors.map(r => (
              <div key={r.id} className="bg-forest-dark/10 p-5 rounded-sm border border-forest/20 hover:border-forest transition-colors">
                <div className="flex justify-between items-start mb-3">
                  <h4 className="font-bold text-lg">{r.player}</h4>
                  <div className="flex flex-col items-end">
                    <span className="text-[10px] uppercase tracking-widest text-cream/50 mb-1">Probabilidad</span>
                    <div className="w-16 h-1.5 bg-black rounded-full overflow-hidden">
                      <div className="h-full bg-forest-light" style={{ width: `${r.prob}%` }}></div>
                    </div>
                  </div>
                </div>
                <p className="text-xs text-cream-dark leading-relaxed">
                  {r.desc}
                </p>
                <div className="mt-4 flex items-center gap-2 text-xs font-semibold text-forest-light uppercase tracking-wider">
                  <ArrowRightLeft size={12} />
                  Desde: {r.club}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
