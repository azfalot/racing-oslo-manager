import React from 'react'
import { Trophy } from 'lucide-react'
import matchData from '../data/matches.json'

export default function Clasificacion() {
  const standings = matchData.standingsData || []

  return (
    <div className="container mx-auto px-6 py-12">
      <div className="mb-12">
        <h2 className="text-4xl md:text-5xl font-display font-bold mb-2 border-l-4 border-forest pl-4 flex items-center gap-4">
          <Trophy className="text-forest-light" size={36}/> Clasificación
        </h2>
        <p className="text-cream-dark ml-5 text-sm uppercase tracking-widest">Comunio Total</p>
      </div>

      <div className="bg-black border border-forest/30 rounded-sm overflow-hidden max-w-4xl">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-forest-dark/40 text-xs uppercase tracking-widest text-forest-light border-b border-forest/30">
              <th className="p-4 font-semibold w-16 text-center">Pos</th>
              <th className="p-4 font-semibold">Club</th>
              <th className="p-4 font-semibold text-center w-20">Pts</th>
              <th className="p-4 font-semibold text-right w-32 hidden md:table-cell">Valor (€)</th>
            </tr>
          </thead>
          <tbody>
            {standings.map(t => (
              <tr key={t.team} className={`border-b border-forest/10 hover:bg-forest-dark/20 transition-colors ${t.team === 'Racing de Oslo' ? 'bg-forest/10 font-bold' : ''}`}>
                <td className="p-4 text-center">{t.pos}</td>
                <td className="p-4 flex items-center gap-3">
                  {t.team === 'Racing de Oslo' && <img src="/media/crest.jpg" alt="Crest" className="w-6 h-6 rounded-full" />}
                  {t.team}
                </td>
                <td className="p-4 text-center text-lg">{t.pts}</td>
                <td className="p-4 text-right text-cream-dark font-mono hidden md:table-cell">
                  {t.value ? t.value.toLocaleString('es-ES') : 0}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
