import React from 'react'
import { Trophy } from 'lucide-react'
import matchData from '../data/matches.json'

export default function Clasificacion() {
  const standings = [
    { pos: 1, team: "Racing de Oslo", pts: matchData.standings.points || 0, p: 0, form: matchData.standings.form || ['-','-','-','-','-'] },
    { pos: 2, team: "CD Cayón B", pts: 0, p: 0, form: ['-','-','-','-','-'] },
    { pos: 3, team: "Vimenor B", pts: 0, p: 0, form: ['-','-','-','-','-'] },
    { pos: 4, team: "SD Torina B", pts: 0, p: 0, form: ['-','-','-','-','-'] },
    { pos: 5, team: "CD Bezana", pts: 0, p: 0, form: ['-','-','-','-','-'] },
  ]

  return (
    <div className="container mx-auto px-6 py-12">
      <div className="mb-12">
        <h2 className="text-4xl md:text-5xl font-display font-bold mb-2 border-l-4 border-forest pl-4 flex items-center gap-4">
          <Trophy className="text-forest-light" size={36}/> Clasificación
        </h2>
        <p className="text-cream-dark ml-5 text-sm uppercase tracking-widest">Segunda Regional Cántabra</p>
      </div>

      <div className="bg-black border border-forest/30 rounded-sm overflow-hidden max-w-4xl">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-forest-dark/40 text-xs uppercase tracking-widest text-forest-light border-b border-forest/30">
              <th className="p-4 font-semibold w-16 text-center">Pos</th>
              <th className="p-4 font-semibold">Club</th>
              <th className="p-4 font-semibold text-center w-20">PJ</th>
              <th className="p-4 font-semibold text-center w-20">Pts</th>
              <th className="p-4 font-semibold text-center w-40 hidden md:table-cell">Racha</th>
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
                <td className="p-4 text-center text-cream-dark font-mono">{t.p}</td>
                <td className="p-4 text-center text-lg">{t.pts}</td>
                <td className="p-4 hidden md:flex gap-1 justify-center">
                  {t.form.map((f, i) => (
                    <span key={i} className={`w-5 h-5 flex items-center justify-center rounded-sm text-[10px] font-bold ${f==='W'?'bg-green-600':f==='D'?'bg-yellow-600':f==='L'?'bg-red-600':'bg-black/50 text-cream/30 border border-forest/20'}`}>
                      {f}
                    </span>
                  ))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
