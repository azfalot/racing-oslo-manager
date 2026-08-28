import React from 'react';
import financesData from '../data/finances.json';
import { DollarSign, TrendingUp, ShieldCheck, Trophy, PieChart, ArrowUpRight, CheckCircle2 } from 'lucide-react';

const CLUB_CRESTS = {
  'Racing de Oslo': '/media/crest.jpg',
  'Fermín Gadura F.C.': '/media/crests/fermin_gadura.svg',
  'Puente Avios FC': '/media/crests/puente_avios.svg',
  'Puente Avios': '/media/crests/puente_avios.svg',
  'Hache FC': '/media/crests/hache_fc.svg',
  'Ana': '/media/crests/ana.svg',
  'NIN Team': '/media/crests/nin_team.svg',
  'Pachangueros F.C.': '/media/crests/pachangueros.svg',
  'M4 TEAM': '/media/crests/m4_team.svg',
  'Melano Plabloroza': '/media/crests/melano_plabloroza.svg',
  'Suances nin': '/media/crests/suances_nin.svg'
};

export default function Finanzas() {
  const { club, history, totals, projections, rivals } = financesData;

  return (
    <div className="min-h-screen bg-clubBlack text-cream font-sans py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-10">
        
        {/* Cabecera Principal */}
        <div className="border-b border-forest-light/30 pb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <span className="text-xs font-mono font-bold tracking-widest text-forest-light uppercase bg-forest/20 px-3 py-1 rounded border border-forest/30">
              AUDITORÍA ECONÓMICA · COMUNIO 2026/27
            </span>
            <h1 className="text-3xl sm:text-4xl font-display font-bold tracking-wide mt-2 text-white flex items-center gap-3">
              <DollarSign className="text-gold" size={36} />
              ÁREA FINANCIERA & TESORERÍA
            </h1>
            <p className="text-sm text-cream-dark mt-1 font-mono">
              Control de balance, histórico oficial de cobros por jornada y proyecciones estratégicas.
            </p>
          </div>

          <div className="flex items-center gap-3 bg-forest-dark/40 border border-forest/40 px-4 py-2.5 rounded-sm">
            <ShieldCheck className="text-forest-light" size={24} />
            <div>
              <p className="text-[11px] text-cream-dark uppercase font-mono">ESTADO DEL CLUB</p>
              <p className="text-sm font-bold text-forest-light">100% SANEADO (0 € DEUDA)</p>
            </div>
          </div>
        </div>

        {/* Tarjetas KPI Superiores */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-charcoal/80 border border-forest-light/20 p-5 rounded-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-gold/5 rounded-full -mr-8 -mt-8 pointer-events-none" />
            <span className="text-[11px] text-cream-dark uppercase font-mono tracking-wider">SALDO EN CAJA</span>
            <p className="text-2xl sm:text-3xl font-display font-bold text-gold mt-1">
              {club.balance.toLocaleString()} €
            </p>
            <div className="mt-2 text-xs text-cream-dark flex items-center justify-between border-t border-white/5 pt-2 font-mono">
              <span>Pujas activas:</span>
              <span className="text-white font-bold">{club.committedBids.toLocaleString()} €</span>
            </div>
          </div>

          <div className="bg-charcoal/80 border border-forest-light/20 p-5 rounded-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-forest-light/5 rounded-full -mr-8 -mt-8 pointer-events-none" />
            <span className="text-[11px] text-cream-dark uppercase font-mono tracking-wider">SALDO EFECTIVO LIBRE</span>
            <p className="text-2xl sm:text-3xl font-display font-bold text-forest-light mt-1">
              {club.effectiveBalance.toLocaleString()} €
            </p>
            <div className="mt-2 text-xs text-cream-dark flex items-center justify-between border-t border-white/5 pt-2 font-mono">
              <span>Capacidad de puja inmediata</span>
            </div>
          </div>

          <div className="bg-charcoal/80 border border-forest-light/20 p-5 rounded-sm relative overflow-hidden">
            <span className="text-[11px] text-cream-dark uppercase font-mono tracking-wider">VALOR DE PLANTILLA</span>
            <p className="text-2xl sm:text-3xl font-display font-bold text-white mt-1">
              {(club.teamValue / 1000000).toFixed(2)}M €
            </p>
            <div className="mt-2 text-xs text-cream-dark flex items-center justify-between border-t border-white/5 pt-2 font-mono">
              <span>{club.squadSize} futbolistas en nómina</span>
            </div>
          </div>

          <div className="bg-charcoal/80 border border-forest-light/20 p-5 rounded-sm relative overflow-hidden">
            <span className="text-[11px] text-cream-dark uppercase font-mono tracking-wider">PATRIMONIO NETO TOTAL</span>
            <p className="text-2xl sm:text-3xl font-display font-bold text-gold mt-1">
              {(club.netWorth / 1000000).toFixed(2)}M €
            </p>
            <div className="mt-2 text-xs text-cream-dark flex items-center justify-between border-t border-white/5 pt-2 font-mono">
              <span>#2 Mayor patrimonio de la liga</span>
            </div>
          </div>
        </div>

        {/* Sección: Histórico de Cobros & Proyección Próxima Jornada */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* Histórico Oficial de Jornadas */}
          <div className="bg-charcoal/60 border border-forest-light/30 p-6 rounded-sm space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h2 className="text-lg font-display font-bold text-white flex items-center gap-2">
                <Trophy className="text-gold" size={20} />
                HISTÓRICO OFICIAL DE INGRESOS (10k € / PTO)
              </h2>
              <span className="text-xs font-mono text-forest-light bg-forest/20 px-2.5 py-0.5 rounded border border-forest/30">
                TOTAL: +{totals.totalPrizeEarned.toLocaleString()} €
              </span>
            </div>

            <p className="text-xs text-cream-dark leading-relaxed font-mono">
              Comunio abona automáticamente <b>10.000 € por cada punto</b> sumado por el Once titular, siempre que el saldo sea positivo al inicio de la fecha.
            </p>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead>
                  <tr className="border-b border-white/10 text-cream-dark uppercase">
                    <th className="py-2.5 px-3">Fecha / Jornada</th>
                    <th className="py-2.5 px-3 text-center">Puntos XI</th>
                    <th className="py-2.5 px-3 text-right">Prima Ingresada</th>
                    <th className="py-2.5 px-3 text-center">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {history.map((item, idx) => (
                    <tr key={idx} className="hover:bg-white/[0.02] transition-colors">
                      <td className="py-3 px-3 font-bold text-white">
                        {item.matchday} <span className="text-[10px] text-cream-dark block font-normal">{item.date}</span>
                      </td>
                      <td className="py-3 px-3 text-center text-forest-light font-bold text-sm">
                        {item.points} pts
                      </td>
                      <td className="py-3 px-3 text-right text-gold font-bold text-sm">
                        +{item.prize.toLocaleString()} €
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span className="inline-flex items-center gap-1 text-[10px] bg-forest/30 text-forest-light px-2 py-0.5 rounded-full font-bold">
                          <CheckCircle2 size={12} /> {item.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="bg-forest-dark/30 border border-forest/30 p-3 rounded text-xs font-mono flex items-center justify-between text-cream">
              <span>Promedio de recaudación por fecha:</span>
              <span className="text-gold font-bold">~{totals.avgPrizePerMatchday.toLocaleString()} € / jornada</span>
            </div>
          </div>

          {/* Proyección y Estrategia de Liquidez */}
          <div className="bg-charcoal/60 border border-forest-light/30 p-6 rounded-sm space-y-4 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <h2 className="text-lg font-display font-bold text-white flex items-center gap-2">
                  <TrendingUp className="text-forest-light" size={20} />
                  PROYECCIÓN DE TESORERÍA (JORNADA 3)
                </h2>
                <span className="text-xs font-mono text-gold bg-gold/10 px-2.5 py-0.5 rounded border border-gold/20">
                  ~{projections.nextMatchday.expectedPoints} pts proyectados
                </span>
              </div>

              <div className="mt-4 space-y-3 font-mono text-xs">
                <div className="flex justify-between items-center py-2 border-b border-white/5">
                  <span className="text-cream-dark">Ingreso estimado por puntos Once:</span>
                  <span className="text-white font-bold">+{projections.nextMatchday.expectedPrize.toLocaleString()} €</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-white/5">
                  <span className="text-cream-dark">Saldo en caja tras liquidar Jornada 3:</span>
                  <span className="text-forest-light font-bold text-sm">~{projections.nextMatchday.projectedCashAfter.toLocaleString()} €</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-white/5">
                  <span className="text-cream-dark">Proyección mensual (4 jornadas de primas):</span>
                  <span className="text-gold font-bold">+{projections.monthlyOutlook.projectedPrize.toLocaleString()} €</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-white/5">
                  <span className="text-cream-dark">Liquidez potencial total con descartes:</span>
                  <span className="text-white font-bold">~{projections.monthlyOutlook.totalProjectedLiquidity.toLocaleString()} €</span>
                </div>
              </div>
            </div>

            <div className="bg-black/60 border border-gold/30 p-4 rounded-sm space-y-2 mt-4">
              <span className="text-[10px] font-mono uppercase text-gold font-bold tracking-wider flex items-center gap-1.5">
                <ArrowUpRight size={14} /> HOJA DE RUTA PARA FICHAJES GALÁCTICOS
              </span>
              <p className="text-xs text-cream leading-relaxed font-sans">
                Para acometer el fichaje de un objetivo TOP como <b>{projections.galacticoTarget.targetName}</b> ({ (projections.galacticoTarget.targetPrice / 1000000).toFixed(2) }M €), el club necesita <b>1 sola jornada</b> utilizando una operación palanca (puja + venta compensatoria) o <b>4 jornadas</b> mediante ahorro neto de primas.
              </p>
            </div>
          </div>

        </div>

        {/* Sección: Comparativa Financiera vs Rivales */}
        <div className="bg-charcoal/60 border border-forest-light/30 p-6 rounded-sm space-y-4">
          <div className="border-b border-white/10 pb-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <h2 className="text-xl font-display font-bold text-white flex items-center gap-2">
                <PieChart className="text-gold" size={22} />
                COMPARATIVA ECONÓMICA & MÚSCULO FINANCIERO DE LA LIGA
              </h2>
              <p className="text-xs text-cream-dark font-mono mt-0.5">
                Estimación de masa patrimonial, valor de plantilla y primas acumuladas de todos los clubes.
              </p>
            </div>
            <span className="text-xs font-mono text-cream-dark">
              8 CLUBES AUDITADOS
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead>
                <tr className="border-b border-white/10 text-cream-dark uppercase">
                  <th className="py-3 px-3">#</th>
                  <th className="py-3 px-3">Club / Mánager</th>
                  <th className="py-3 px-3 text-center">Puntos</th>
                  <th className="py-3 px-3 text-right">Primas Cobradas</th>
                  <th className="py-3 px-3 text-right">Valor Plantilla</th>
                  <th className="py-3 px-3 text-right">Caja Estimada</th>
                  <th className="py-3 px-3 text-right">Patrimonio Total</th>
                  <th className="py-3 px-3 text-center">Poder de Fichaje</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {rivals.map((r, idx) => {
                  const crest = CLUB_CRESTS[r.teamName] || '/media/crest.jpg';
                  return (
                    <tr 
                      key={idx} 
                      className={`transition-colors ${r.isMe ? 'bg-forest/20 font-bold border-l-4 border-l-forest-light' : 'hover:bg-white/[0.02]'}`}
                    >
                      <td className="py-3.5 px-3 text-cream-dark font-bold">{r.pos}</td>
                      <td className="py-3.5 px-3 flex items-center gap-2.5">
                        <img src={crest} alt={r.teamName} className="w-6 h-6 rounded-full object-cover bg-black/40 border border-white/10" />
                        <div>
                          <span className={r.isMe ? 'text-forest-light' : 'text-white'}>{r.teamName}</span>
                          <span className="text-[10px] text-cream-dark block font-normal">{r.owner}</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-3 text-center text-white font-bold">{r.points}</td>
                      <td className="py-3.5 px-3 text-right text-gold">+{r.totalPrize.toLocaleString()} €</td>
                      <td className="py-3.5 px-3 text-right text-white">{(r.squadValue / 1000000).toFixed(2)}M €</td>
                      <td className="py-3.5 px-3 text-right text-cream-dark">{(r.estimatedCash / 1000000).toFixed(2)}M €</td>
                      <td className="py-3.5 px-3 text-right font-bold text-white">{(r.totalWealth / 1000000).toFixed(2)}M €</td>
                      <td className="py-3.5 px-3 text-center">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          r.isMe ? 'bg-forest-light/20 text-forest-light border border-forest-light/30' :
                          r.power.includes('Alta') ? 'bg-gold/10 text-gold border border-gold/20' :
                          r.power.includes('Endeudada') ? 'bg-red-500/20 text-red-400 border border-red-500/30' :
                          'bg-white/5 text-cream-dark'
                        }`}>
                          {r.power}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}
