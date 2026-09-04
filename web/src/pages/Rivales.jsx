import React, { useState } from 'react';
import rivalsData from '../data/rivalsAudit.json';
import { 
  Shield, 
  TrendingUp, 
  AlertTriangle, 
  CheckCircle2, 
  DollarSign, 
  UserCheck, 
  Sparkles, 
  ChevronRight, 
  BarChart3, 
  ArrowRight,
  Info,
  Layers,
  ChevronDown,
  ChevronUp,
  History,
  ArrowDownLeft,
  ArrowUpRight
} from 'lucide-react';

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
};

export default function Rivales() {
  const [selectedId, setSelectedId] = useState(rivalsData[0]?.id || 21163674);
  const [showTransfers, setShowTransfers] = useState(false);
  const club = rivalsData.find(c => c.id === selectedId) || rivalsData[0];
  const osloClub = rivalsData.find(c => c.isMe) || rivalsData[1];

  const posEmoji = { keeper: '🧤', defender: '🛡️', midfielder: '⚙️', striker: '⚡' };

  // Group starters by line
  const keepers = (club.starters || []).filter(p => p.position === 'keeper');
  const defenders = (club.starters || []).filter(p => p.position === 'defender');
  const midfielders = (club.starters || []).filter(p => p.position === 'midfielder');
  const strikers = (club.starters || []).filter(p => p.position === 'striker');

  return (
    <div className="container mx-auto px-2.5 sm:px-4 md:px-6 py-4 sm:py-8 space-y-6 sm:space-y-8 max-w-7xl">
      
      {/* HEADER */}
      <div className="text-center space-y-2 sm:space-y-3 max-w-3xl mx-auto px-2">
        <div className="inline-flex items-center gap-1.5 sm:gap-2 bg-forest-dark border border-forest-light/40 px-2.5 sm:px-3 py-1 rounded-full text-[10px] sm:text-xs font-bold text-cream">
          <BarChart3 size={13} className="text-amber-300" />
          <span>SCOUTING & AUDITORÍA 360º DE LA COMUNIDAD</span>
        </div>
        <h1 className="text-2xl sm:text-3xl md:text-5xl font-display font-bold text-white tracking-wide">
          Centro de Análisis de Clubes
        </h1>
        <p className="text-xs sm:text-sm md:text-base text-cream-dark leading-relaxed">
          Consulta la radiografía táctica, el Once Titular proyectado, el estado financiero y las debilidades de cualquier equipo de la liga.
        </p>
      </div>

      {/* SELECTOR DE CLUBES (Optimizado con scroll horizontal táctil en móvil y grid en desktop) */}
      <div className="bg-black/80 border border-forest/40 p-3 sm:p-4 rounded-sm shadow-xl space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="text-[11px] sm:text-xs font-bold text-cream-dark uppercase tracking-wider flex items-center gap-1.5">
            <Layers size={13} className="text-forest-light" />
            <span>Clubes de la Liga (10):</span>
          </span>
          <span className="text-[10px] sm:text-[11px] text-amber-300 font-mono">
            {rivalsData.length} equipos auditados
          </span>
        </div>

        {/* Barra de chips interactivos horizontal en móvil / grid en desktop */}
        <div className="flex sm:grid sm:grid-cols-3 md:grid-cols-5 gap-2 overflow-x-auto pb-2 sm:pb-0 scrollbar-thin scrollbar-thumb-forest scrollbar-track-black/40 snap-x">
          {rivalsData.map((c) => {
            const isSelected = c.id === selectedId;
            return (
              <button
                key={c.id}
                onClick={() => setSelectedId(c.id)}
                className={`flex items-center gap-2 p-2 rounded-sm border text-left transition-all shrink-0 min-w-[155px] sm:min-w-0 snap-start ${
                  isSelected 
                    ? 'bg-forest border-forest-light text-white shadow-lg ring-1 ring-forest-light' 
                    : 'bg-forest-dark/30 border-forest/20 text-cream/80 hover:bg-forest-dark/60 hover:border-forest/40'
                }`}
              >
                <img 
                  src={CLUB_CRESTS[c.teamName] || c.crest || '/media/crest.jpg'} 
                  alt={c.teamName} 
                  onError={(e) => { e.currentTarget.src = '/media/crest.jpg'; }}
                  className="w-6 h-6 sm:w-7 sm:h-7 rounded-full object-cover border border-white/20 flex-shrink-0" 
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-[11px] sm:text-xs font-bold truncate">{c.teamName}</span>
                    <span className="text-[9px] sm:text-[10px] font-mono text-amber-300">#{c.pos}</span>
                  </div>
                  <div className="text-[9px] sm:text-[10px] text-cream-dark/70 truncate">{c.points} pts</div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* SNAPSHOT PRINCIPAL DEL CLUB SELECCIONADO */}
      <div className="bg-gradient-to-br from-forest-dark/70 via-black to-black border border-forest-light/40 rounded-sm p-3.5 sm:p-6 md:p-8 shadow-2xl space-y-4 sm:space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 sm:gap-6 pb-4 sm:pb-6 border-b border-forest/30">
          <div className="flex items-center gap-3 sm:gap-4">
            <img 
              src={CLUB_CRESTS[club.teamName] || club.crest || '/media/crest.jpg'} 
              alt={club.teamName} 
              onError={(e) => { e.currentTarget.src = '/media/crest.jpg'; }}
              className="w-13 h-13 sm:w-16 sm:h-16 md:w-20 md:h-20 rounded-full border-2 border-forest-light object-cover shadow-2xl bg-black/60 shrink-0" 
            />
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="bg-amber-300/20 text-amber-300 text-[10px] sm:text-xs font-mono font-bold px-1.5 sm:px-2 py-0.5 rounded-sm border border-amber-300/30">
                  {club.pos}º CLASIFICADO
                </span>
                {club.isMe && (
                  <span className="bg-forest-light/20 text-forest-light text-[10px] sm:text-xs font-mono font-bold px-1.5 sm:px-2 py-0.5 rounded-sm border border-forest-light/30">
                    TU CLUB
                  </span>
                )}
              </div>
              <h2 className="text-xl sm:text-2xl md:text-3xl font-display font-bold text-white mt-1 truncate">
                {club.teamName}
              </h2>
              <p className="text-[11px] sm:text-xs text-cream-dark font-mono truncate">
                Mánager: <span className="text-white font-bold">{club.manager}</span>
              </p>
            </div>
          </div>

          {/* KPI CARDS (2 cols en móvil / 3 cols en tablet) */}
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            <div className="bg-black/60 border border-forest/30 p-2 sm:p-3 rounded-sm text-center">
              <span className="text-[9px] sm:text-[10px] text-cream-dark uppercase tracking-wider font-bold block truncate">Puntos</span>
              <span className="text-sm sm:text-xl font-display font-bold text-amber-300">{club.points} pts</span>
            </div>
            <div className="bg-black/60 border border-forest/30 p-2 sm:p-3 rounded-sm text-center">
              <span className="text-[9px] sm:text-[10px] text-cream-dark uppercase tracking-wider font-bold block truncate">Plantilla</span>
              <span className="text-sm sm:text-xl font-display font-bold text-white">{(club.squadValue / 1000000).toFixed(1)}M €</span>
            </div>
            <div className="bg-black/60 border border-forest/30 p-2 sm:p-3 rounded-sm text-center">
              <span className="text-[9px] sm:text-[10px] text-cream-dark uppercase tracking-wider font-bold block truncate">Techo 11</span>
              <span className="text-sm sm:text-xl font-display font-bold text-forest-light">~{club.projectedScore} pts</span>
            </div>
          </div>
        </div>

        {/* ALERTA FINANCIERA & DIAGNÓSTICO */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4">
          <div className="bg-black/50 border border-forest/30 p-3 sm:p-4 rounded-sm space-y-1.5 sm:space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-bold text-cream uppercase">
              <DollarSign size={14} className="text-forest-light" />
              <span>Salud Financiera</span>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-xs sm:text-sm font-bold ${
                club.financialHealth.includes('Riesgo') || club.financialHealth.includes('Apalancamiento') || club.financialHealth.includes('Negativo')
                  ? 'text-red-400'
                  : 'text-emerald-400'
              }`}>
                {club.financialHealth}
              </span>
            </div>
            <p className="text-[11px] sm:text-xs text-cream-dark leading-relaxed">
              {club.debtAlert || 'El club cuenta con equilibrio presupuestario y solvencia para afrontar las próximas jornadas.'}
            </p>
          </div>

          <div className="bg-black/50 border border-forest/30 p-3 sm:p-4 rounded-sm space-y-1.5 sm:space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-bold text-cream uppercase">
              <CheckCircle2 size={14} className="text-emerald-400" />
              <span>Fortalezas Clave</span>
            </div>
            <ul className="space-y-1 text-[11px] sm:text-xs text-cream-dark">
              {club.strengths.map((st, i) => (
                <li key={i} className="flex items-start gap-1.5">
                  <span className="text-emerald-400 mt-0.5">•</span>
                  <span>{st}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="bg-black/50 border border-forest/30 p-3 sm:p-4 rounded-sm space-y-1.5 sm:space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-bold text-cream uppercase">
              <AlertTriangle size={14} className="text-amber-400" />
              <span>Puntos Débiles & Carencias</span>
            </div>
            <ul className="space-y-1 text-[11px] sm:text-xs text-cream-dark">
              {club.weaknesses.map((wk, i) => (
                <li key={i} className="flex items-start gap-1.5">
                  <span className="text-amber-400 mt-0.5">•</span>
                  <span>{wk}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* RADAR ESPECULATIVO & SOBREPUJAS */}
        {club.speculation && (
          <div className="bg-black/70 border border-forest/40 p-3.5 sm:p-5 rounded-sm shadow-xl space-y-3 sm:space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 border-b border-forest/20">
              <div className="flex items-center gap-1.5">
                <Sparkles size={15} className="text-amber-300" />
                <h3 className="text-xs sm:text-base font-display font-bold text-white uppercase tracking-wider">
                  Radar Especulativo & Perfil de Sobrepujas
                </h3>
              </div>
              <div className="inline-flex items-center self-start sm:self-auto gap-1.5 px-2.5 py-0.5 sm:py-1 rounded-full border text-[10px] sm:text-xs font-bold font-mono" style={{ borderColor: club.speculation.badgeColor, color: club.speculation.badgeColor, backgroundColor: `${club.speculation.badgeColor}15` }}>
                <span>{club.speculation.badge}</span>
              </div>
            </div>

            {/* Barra Escala 0-100 */}
            <div className="space-y-1">
              <div className="flex justify-between items-center text-[11px] sm:text-xs">
                <span className="text-cream-dark font-medium">Índice de Especulación:</span>
                <span className="font-mono font-bold" style={{ color: club.speculation.badgeColor }}>
                  {club.speculation.score} / 100 ({club.speculation.riskLevel})
                </span>
              </div>
              <div className="w-full bg-black/80 h-2.5 sm:h-3 rounded-full overflow-hidden p-0.5 border border-forest/30 relative">
                <div 
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${club.speculation.score}%`,
                    background: club.speculation.score > 80 
                      ? 'linear-gradient(90deg, #10b981 0%, #f59e0b 50%, #ef4444 100%)'
                      : club.speculation.score > 50
                      ? 'linear-gradient(90deg, #10b981 0%, #f59e0b 100%)'
                      : 'linear-gradient(90deg, #10b981 0%, #3b82f6 100%)'
                  }}
                />
              </div>
              <div className="flex justify-between text-[9px] sm:text-[10px] text-cream-dark/60 font-mono">
                <span>0 (Saneado)</span>
                <span>50 (Moderado)</span>
                <span>100 (Deuda / Apalancado)</span>
              </div>
            </div>

            {/* Métricas clave */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 pt-1">
              <div className="bg-black/50 border border-forest/20 p-2 sm:p-2.5 rounded-sm text-center">
                <span className="text-[9px] sm:text-[10px] text-cream-dark uppercase block truncate">Sobrepuja Media</span>
                <span className="text-xs sm:text-base font-bold font-mono" style={{ color: club.speculation.score > 70 ? '#ef4444' : '#10b981' }}>
                  {club.speculation.overbidRate}
                </span>
              </div>
              <div className="bg-black/50 border border-forest/20 p-2 sm:p-2.5 rounded-sm text-center">
                <span className="text-[9px] sm:text-[10px] text-cream-dark uppercase block truncate">Total Gastado</span>
                <span className="text-xs sm:text-base font-bold font-mono text-white">
                  {(club.speculation.totalSpent / 1000000).toFixed(1)}M €
                </span>
                <span className="text-[8px] sm:text-[9px] text-cream-dark/60 block">({club.speculation.purchasesCount} compras)</span>
              </div>
              <div className="bg-black/50 border border-forest/20 p-2 sm:p-2.5 rounded-sm text-center">
                <span className="text-[9px] sm:text-[10px] text-cream-dark uppercase block truncate">Total Ingresado</span>
                <span className="text-xs sm:text-base font-bold font-mono text-emerald-400">
                  {(club.speculation.totalReceived / 1000000).toFixed(1)}M €
                </span>
                <span className="text-[8px] sm:text-[9px] text-cream-dark/60 block">({club.speculation.salesCount} ventas)</span>
              </div>
              <div className="bg-black/50 border border-forest/20 p-2 sm:p-2.5 rounded-sm text-center">
                <span className="text-[9px] sm:text-[10px] text-cream-dark uppercase block truncate">Caja Estimada</span>
                <span className="text-xs sm:text-base font-bold font-mono text-amber-300">
                  {club.speculation.estimatedCash !== undefined ? `${(club.speculation.estimatedCash / 1000000).toFixed(1)}M €` : 'N/D'}
                </span>
                <span className="text-[8px] sm:text-[9px] text-cream-dark/60 block">(+{((club.speculation.prizesEarned || 0) / 1000).toFixed(0)}k € premios)</span>
              </div>
            </div>

            {/* Diagnóstico Textual */}
            <div className="bg-forest-dark/20 border border-forest/20 p-2.5 sm:p-3 rounded-sm text-[11px] sm:text-xs text-cream-dark leading-relaxed flex items-start gap-2">
              <Info size={14} className="text-amber-300 mt-0.5 flex-shrink-0" />
              <span>{club.speculation.analysis}</span>
            </div>

            {/* HITOS DE MERCADO: FICHAJE MAESTRO (ROI), MEJOR GANGA & MAYOR SOBREPRECIO */}
            {club.keyDeals && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 sm:gap-3 pt-1 sm:pt-2">
                {/* 1. FICHAJE MAESTRO (ROI DEPORTIVO) */}
                {club.keyDeals.smartBuy && (
                  <div className="bg-amber-950/30 border border-amber-500/40 p-3 rounded-sm space-y-1.5 shadow-sm">
                    <div className="flex items-center justify-between gap-2 border-b border-amber-500/20 pb-1">
                      <span className="text-[10px] sm:text-xs font-bold text-amber-300 uppercase tracking-wider flex items-center gap-1">
                        <span>🎯 FICHAJE MAESTRO</span>
                      </span>
                      <span className="text-[9px] sm:text-[10px] bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded-sm font-mono font-bold shrink-0">
                        {club.keyDeals.smartBuy.tag}
                      </span>
                    </div>
                    <div className="text-sm font-bold text-white font-mono">
                      {club.keyDeals.smartBuy.player}
                    </div>
                    <p className="text-[11px] sm:text-xs text-cream-dark leading-relaxed">
                      {club.keyDeals.smartBuy.impact}
                    </p>
                  </div>
                )}

                {/* 2. MAYOR PLUSVALÍA / REVALORIZACIÓN */}
                <div className="bg-emerald-950/30 border border-emerald-500/30 p-3 rounded-sm space-y-1.5">
                  <div className="flex items-center justify-between gap-2 border-b border-emerald-500/20 pb-1">
                    <span className="text-[10px] sm:text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1">
                      <span>📈 MAYOR PLUSVALÍA</span>
                    </span>
                    <span className="text-[9px] sm:text-[10px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded-sm font-mono font-bold shrink-0">
                      {club.keyDeals.bestBuy.tag}
                    </span>
                  </div>
                  <div className="text-sm font-bold text-white font-mono">
                    {club.keyDeals.bestBuy.player}
                  </div>
                  <p className="text-[11px] sm:text-xs text-cream-dark leading-relaxed">
                    {club.keyDeals.bestBuy.impact}
                  </p>
                </div>

                {/* 3. MAYOR SOBREPRECIO / RIESGO */}
                <div className="bg-red-950/30 border border-red-500/30 p-3 rounded-sm space-y-1.5">
                  <div className="flex items-center justify-between gap-2 border-b border-red-500/20 pb-1">
                    <span className="text-[10px] sm:text-xs font-bold text-red-400 uppercase tracking-wider flex items-center gap-1">
                      <span>⚠️ MAYOR SOBREPRECIO</span>
                    </span>
                    <span className="text-[9px] sm:text-[10px] bg-red-500/20 text-red-300 px-1.5 py-0.5 rounded-sm font-mono font-bold shrink-0">
                      {club.keyDeals.worstMove.tag}
                    </span>
                  </div>
                  <div className="text-sm font-bold text-white font-mono">
                    {club.keyDeals.worstMove.player}
                  </div>
                  <p className="text-[11px] sm:text-xs text-cream-dark leading-relaxed">
                    {club.keyDeals.worstMove.impact}
                  </p>
                </div>
              </div>
            )}

            {/* DESPLEGABLE INTERACTIVO: HISTORIAL COMPLETO DE FICHAJES Y VENTAS */}
            {club.transfersHistory && (club.transfersHistory.purchases.length > 0 || club.transfersHistory.sales.length > 0) && (
              <div className="pt-2 border-t border-forest/20">
                <button
                  onClick={() => setShowTransfers(!showTransfers)}
                  className="w-full flex items-center justify-between p-2.5 rounded-sm bg-black/60 hover:bg-forest-dark/40 border border-forest/30 text-cream transition-all text-[11px] sm:text-xs font-bold"
                >
                  <span className="flex items-center gap-1.5 sm:gap-2">
                    <History size={14} className="text-amber-300 shrink-0" />
                    <span>HISTORIAL DE TRASPASOS ({club.transfersHistory.purchases.length} C · {club.transfersHistory.sales.length} V)</span>
                  </span>
                  <span className="text-cream-dark flex items-center gap-1 text-[10px] sm:text-[11px] font-mono shrink-0 ml-2">
                    {showTransfers ? 'Ocultar' : 'Desplegar'}
                    {showTransfers ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                  </span>
                </button>

                {showTransfers && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4 mt-3 animate-fade-in">
                    {/* COLUMNA COMPRAS */}
                    <div className="bg-black/50 border border-emerald-500/20 p-2.5 sm:p-3 rounded-sm space-y-2">
                      <div className="flex items-center justify-between text-xs font-bold text-emerald-400 border-b border-emerald-500/20 pb-1.5">
                        <span className="flex items-center gap-1.5">
                          <ArrowDownLeft size={14} />
                          <span>ALTAS / COMPRAS ({club.transfersHistory.purchases.length})</span>
                        </span>
                        <span className="font-mono text-white text-[11px] sm:text-xs">
                          -{(club.speculation.totalSpent / 1000000).toFixed(2)}M €
                        </span>
                      </div>
                      {club.transfersHistory.purchases.length === 0 ? (
                        <p className="text-[11px] text-cream-dark/60 italic py-2">Sin compras registradas en este periodo.</p>
                      ) : (
                        <div className="space-y-1.5 max-h-80 overflow-y-auto pr-1">
                          {club.transfersHistory.purchases.map((tx, idx) => (
                            <div key={idx} className="p-2 rounded bg-black/40 border border-white/5 hover:border-emerald-500/30 space-y-1">
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                                  <span className="font-bold text-white text-xs">{tx.playerName}</span>
                                  {tx.isOverbid && (
                                    <span className="text-[8px] sm:text-[9px] bg-red-500/20 text-red-300 px-1 py-0.2 rounded font-mono font-bold">
                                      +{tx.diffPct}% SOBREPRECIO
                                    </span>
                                  )}
                                  {(tx.isGain || tx.gain > 30000) && !tx.isOverbid && (
                                    <span className="text-[8px] sm:text-[9px] bg-emerald-500/20 text-emerald-300 px-1 py-0.2 rounded font-mono font-bold">
                                      +{tx.gainPct || Math.abs(tx.diffPct)}% PLUSVALÍA
                                    </span>
                                  )}
                                  {!tx.isOverbid && !tx.isGain && !(tx.gain > 30000) && (
                                    <span className="text-[8px] sm:text-[9px] bg-blue-500/20 text-blue-300 px-1 py-0.2 rounded font-mono">
                                      A VALOR
                                    </span>
                                  )}
                                </div>
                                <div className="text-right flex-shrink-0">
                                  <span className="font-mono font-bold text-red-400 text-xs">
                                    -{(tx.price).toLocaleString()} €
                                  </span>
                                </div>
                              </div>
                              <div className="flex items-center justify-between text-[10px] text-cream-dark/70 font-mono">
                                <span className="truncate">de {tx.seller} · VM: {(tx.marketValue || tx.price).toLocaleString()} €</span>
                                <div className="flex items-center gap-1.5 shrink-0 ml-2">
                                  {tx.diff !== 0 && (
                                    <span className={tx.diff > 0 ? 'text-red-400/80' : 'text-emerald-400/80'}>
                                      {tx.diff > 0 ? `(+${(tx.diff).toLocaleString()} €)` : `(-${Math.abs(tx.diff).toLocaleString()} €)`}
                                    </span>
                                  )}
                                  <span className="text-cream-dark/50">· {new Date(tx.date).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}</span>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* COLUMNA VENTAS */}
                    <div className="bg-black/50 border border-blue-500/20 p-2.5 sm:p-3 rounded-sm space-y-2">
                      <div className="flex items-center justify-between text-xs font-bold text-blue-400 border-b border-blue-500/20 pb-1.5">
                        <span className="flex items-center gap-1.5">
                          <ArrowUpRight size={14} />
                          <span>BAJAS / VENTAS ({club.transfersHistory.sales.length})</span>
                        </span>
                        <span className="font-mono text-emerald-400 text-[11px] sm:text-xs">
                          +{(club.speculation.totalReceived / 1000000).toFixed(2)}M €
                        </span>
                      </div>
                      {club.transfersHistory.sales.length === 0 ? (
                        <p className="text-[11px] text-cream-dark/60 italic py-2">Sin ventas registradas en este periodo.</p>
                      ) : (
                        <div className="space-y-1.5 max-h-80 overflow-y-auto pr-1">
                          {club.transfersHistory.sales.map((tx, idx) => (
                            <div key={idx} className="p-2 rounded bg-black/40 border border-white/5 hover:border-blue-500/30 space-y-1">
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                                  <span className="font-bold text-white text-xs">{tx.playerName}</span>
                                  {tx.diff > 10000 && (
                                    <span className="text-[8px] sm:text-[9px] bg-emerald-500/20 text-emerald-300 px-1 py-0.2 rounded font-mono font-bold">
                                      +{tx.diffPct}% SOBRE VALOR
                                    </span>
                                  )}
                                  {tx.diff < -10000 && (
                                    <span className="text-[8px] sm:text-[9px] bg-amber-500/20 text-amber-300 px-1 py-0.2 rounded font-mono font-bold">
                                      {tx.diffPct}% OFERTA
                                    </span>
                                  )}
                                  {Math.abs(tx.diff) <= 10000 && (
                                    <span className="text-[8px] sm:text-[9px] bg-blue-500/20 text-blue-300 px-1 py-0.2 rounded font-mono">
                                      A VALOR
                                    </span>
                                  )}
                                </div>
                                <div className="text-right flex-shrink-0">
                                  <span className="font-mono font-bold text-emerald-400 text-xs">
                                    +{(tx.price).toLocaleString()} €
                                  </span>
                                </div>
                              </div>
                              <div className="flex items-center justify-between text-[10px] text-cream-dark/70 font-mono">
                                <span className="truncate">a {tx.buyer} · VM: {(tx.marketValue || tx.price).toLocaleString()} €</span>
                                <span className="text-cream-dark/50 shrink-0 ml-2">· {new Date(tx.date).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* PIZARRA TÁCTICA DEL ONCE TITULAR DEL RIVAL */}
      <div className="space-y-3 sm:space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 sm:gap-2 border-b border-forest/30 pb-2.5 sm:pb-3">
          <div>
            <h3 className="text-lg sm:text-2xl font-display font-bold text-white flex items-center gap-2">
              <span>🛡️ Once Titular ({club.formation})</span>
            </h3>
            <p className="text-[11px] sm:text-xs text-cream-dark">Alineación más probable calculada según la plantilla actual.</p>
          </div>
          <div className="text-[11px] sm:text-xs font-mono text-amber-300 bg-forest-dark px-2.5 py-1 rounded-sm border border-forest/40 self-start sm:self-auto">
            Techo estimado: ~{club.projectedScore} pts
          </div>
        </div>

        {/* ALERTAS TÁCTICAS & RIESGOS EN EL ONCE */}
        {club.tacticalAlerts && club.tacticalAlerts.length > 0 && (
          <div className="bg-black/80 border border-forest/40 p-3 sm:p-4 rounded-sm shadow-xl space-y-2.5">
            <div className="flex items-center justify-between border-b border-forest/20 pb-2">
              <div className="flex items-center gap-2">
                <AlertTriangle size={15} className="text-amber-300 shrink-0" />
                <h4 className="text-xs sm:text-sm font-display font-bold text-white uppercase tracking-wider">
                  Auditoría de Disponibilidad & Riesgos del Once
                </h4>
              </div>
              <span className="text-[10px] font-mono text-cream-dark/70">
                {club.tacticalAlerts.filter(a => a.type !== 'success').length} incidencias
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 sm:gap-2.5">
              {club.tacticalAlerts.map((alert, idx) => (
                <div 
                  key={idx} 
                  className={`p-2.5 sm:p-3 rounded-sm border space-y-1 transition-all ${
                    alert.type === 'danger'
                      ? 'bg-red-950/30 border-red-500/40 text-red-200'
                      : alert.type === 'warning'
                      ? 'bg-amber-950/30 border-amber-500/40 text-amber-200'
                      : alert.type === 'caution'
                      ? 'bg-yellow-950/30 border-yellow-500/40 text-yellow-200'
                      : alert.type === 'suboptimal'
                      ? 'bg-purple-950/30 border-purple-500/40 text-purple-200'
                      : 'bg-emerald-950/20 border-emerald-500/30 text-emerald-200'
                  }`}
                >
                  <div className="flex items-center justify-between text-[11px] sm:text-xs font-bold gap-1">
                    <span className="flex items-center gap-1.5 truncate">
                      <span className="text-white font-mono font-bold truncate">{alert.player}</span>
                      {alert.position && <span className="text-[9px] text-cream-dark/60">({alert.position})</span>}
                    </span>
                    <span className={`text-[9px] sm:text-[10px] px-1.5 py-0.5 rounded-sm font-mono font-bold shrink-0 ${
                      alert.type === 'danger'
                        ? 'bg-red-500/20 text-red-300 border border-red-500/30'
                        : alert.type === 'warning'
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        : alert.type === 'caution'
                        ? 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30'
                        : alert.type === 'suboptimal'
                        ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                        : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    }`}>
                      {alert.badge}
                    </span>
                  </div>
                  <p className="text-[10px] sm:text-[11px] text-cream-dark leading-relaxed">
                    {alert.description}
                  </p>
                  {alert.action && (
                    <div className="text-[9px] sm:text-[10px] text-white/90 font-mono bg-black/40 p-1 rounded-sm border border-white/5 flex items-center gap-1">
                      <span className="text-amber-300 shrink-0">💡 Sugerencia:</span>
                      <span className="truncate">{alert.action}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* CAMPO DE FÚTBOL RIVAL (Escalado adaptable para móvil) */}
        <div 
          className="bg-green-900 rounded-lg p-3 sm:p-6 relative shadow-2xl overflow-hidden border-2 sm:border-4 border-white/10 max-w-4xl mx-auto"
          style={{
            backgroundImage: "linear-gradient(rgba(255,255,255,0.08) 1px, transparent 1px)",
            backgroundSize: "100% 12%"
          }}
        >
          <div className="absolute inset-2 sm:inset-4 border-2 border-white/20 pointer-events-none rounded-sm"></div>
          <div className="absolute top-1/2 left-2 right-2 sm:left-4 sm:right-4 h-0.5 bg-white/20 pointer-events-none"></div>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-20 h-20 sm:w-28 sm:h-28 border-2 border-white/20 rounded-full pointer-events-none"></div>

          <div className="relative z-10 flex flex-col justify-between h-[460px] sm:h-[560px] md:h-[620px] py-2 sm:py-4">
            {/* Delanteros */}
            <div className="flex justify-center gap-3 sm:gap-6">
              {strikers.map(p => (
                <div key={p.id} className="flex flex-col items-center animate-fade-in group">
                  <div className="relative">
                    <img src={p.image} alt={p.name} className="w-10 h-10 sm:w-14 sm:h-14 md:w-16 md:h-16 rounded-full border-2 border-white/40 object-cover shadow-lg bg-black/60" />
                    {p.riskBadge && (
                      <span className={`absolute -top-1 -right-1 text-[8px] font-bold px-1 py-0.2 rounded-full border shadow font-mono ${
                        p.riskBadge.includes('Sanción') || p.riskBadge.includes('Lesión') 
                          ? 'bg-red-600 text-white border-red-300' 
                          : p.riskBadge.includes('Duda')
                          ? 'bg-amber-600 text-white border-amber-300'
                          : 'bg-yellow-500 text-black border-yellow-200'
                      }`}>
                        {p.riskBadge}
                      </span>
                    )}
                  </div>
                  <div className="mt-1 bg-black/85 px-1.5 sm:px-2 py-0.5 rounded-sm text-center border border-forest/40 min-w-[55px] sm:min-w-[70px]">
                    <p className="text-[9px] sm:text-[11px] font-bold text-white truncate max-w-[65px] sm:max-w-[90px]">{p.name}</p>
                    <p className="text-[8px] sm:text-[9px] text-amber-300 font-mono">{(p.price/1000000).toFixed(1)}M €</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Centrocampistas */}
            <div className="flex justify-around gap-1 sm:gap-2">
              {midfielders.map(p => (
                <div key={p.id} className="flex flex-col items-center animate-fade-in group">
                  <div className="relative">
                    <img src={p.image} alt={p.name} className="w-10 h-10 sm:w-14 sm:h-14 md:w-16 md:h-16 rounded-full border-2 border-white/40 object-cover shadow-lg bg-black/60" />
                    {p.riskBadge && (
                      <span className={`absolute -top-1 -right-1 text-[8px] font-bold px-1 py-0.2 rounded-full border shadow font-mono ${
                        p.riskBadge.includes('Sanción') || p.riskBadge.includes('Lesión') 
                          ? 'bg-red-600 text-white border-red-300' 
                          : p.riskBadge.includes('Duda')
                          ? 'bg-amber-600 text-white border-amber-300'
                          : 'bg-yellow-500 text-black border-yellow-200'
                      }`}>
                        {p.riskBadge}
                      </span>
                    )}
                  </div>
                  <div className="mt-1 bg-black/85 px-1.5 sm:px-2 py-0.5 rounded-sm text-center border border-forest/40 min-w-[55px] sm:min-w-[70px]">
                    <p className="text-[9px] sm:text-[11px] font-bold text-white truncate max-w-[65px] sm:max-w-[90px]">{p.name}</p>
                    <p className="text-[8px] sm:text-[9px] text-amber-300 font-mono">{(p.price/1000000).toFixed(1)}M €</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Defensas */}
            <div className="flex justify-around gap-1 sm:gap-2">
              {defenders.map(p => (
                <div key={p.id} className="flex flex-col items-center animate-fade-in group">
                  <div className="relative">
                    <img src={p.image} alt={p.name} className="w-10 h-10 sm:w-14 sm:h-14 md:w-16 md:h-16 rounded-full border-2 border-white/40 object-cover shadow-lg bg-black/60" />
                    {p.riskBadge && (
                      <span className={`absolute -top-1 -right-1 text-[8px] font-bold px-1 py-0.2 rounded-full border shadow font-mono ${
                        p.riskBadge.includes('Sanción') || p.riskBadge.includes('Lesión') 
                          ? 'bg-red-600 text-white border-red-300' 
                          : p.riskBadge.includes('Duda')
                          ? 'bg-amber-600 text-white border-amber-300'
                          : 'bg-yellow-500 text-black border-yellow-200'
                      }`}>
                        {p.riskBadge}
                      </span>
                    )}
                  </div>
                  <div className="mt-1 bg-black/85 px-1.5 sm:px-2 py-0.5 rounded-sm text-center border border-forest/40 min-w-[55px] sm:min-w-[70px]">
                    <p className="text-[9px] sm:text-[11px] font-bold text-white truncate max-w-[65px] sm:max-w-[90px]">{p.name}</p>
                    <p className="text-[8px] sm:text-[9px] text-amber-300 font-mono">{(p.price/1000000).toFixed(1)}M €</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Portero */}
            <div className="flex justify-center">
              {keepers.map(p => (
                <div key={p.id} className="flex flex-col items-center animate-fade-in group">
                  <div className="relative">
                    <img src={p.image} alt={p.name} className="w-10 h-10 sm:w-14 sm:h-14 md:w-16 md:h-16 rounded-full border-2 border-white/40 object-cover shadow-lg bg-black/60" />
                    {p.riskBadge && (
                      <span className={`absolute -top-1 -right-1 text-[8px] font-bold px-1 py-0.2 rounded-full border shadow font-mono ${
                        p.riskBadge.includes('Sanción') || p.riskBadge.includes('Lesión') 
                          ? 'bg-red-600 text-white border-red-300' 
                          : p.riskBadge.includes('Duda')
                          ? 'bg-amber-600 text-white border-amber-300'
                          : 'bg-yellow-500 text-black border-yellow-200'
                      }`}>
                        {p.riskBadge}
                      </span>
                    )}
                  </div>
                  <div className="mt-1 bg-black/85 px-1.5 sm:px-2 py-0.5 rounded-sm text-center border border-forest/40 min-w-[55px] sm:min-w-[70px]">
                    <p className="text-[9px] sm:text-[11px] font-bold text-white truncate max-w-[65px] sm:max-w-[90px]">{p.name}</p>
                    <p className="text-[8px] sm:text-[9px] text-amber-300 font-mono">{(p.price/1000000).toFixed(1)}M €</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* SUPLENTES */}
        {(club.bench || []).length > 0 && (
          <div className="bg-black/60 border border-forest/30 p-3 sm:p-4 rounded-sm">
            <h4 className="text-[11px] sm:text-xs font-bold text-cream uppercase tracking-wider mb-2.5">
              🔲 Banquillo de Reservas ({club.bench.length} jugadores):
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
              {club.bench.map(p => (
                <div key={p.id} className="flex items-center gap-2 bg-forest-dark/40 border border-forest/20 p-1.5 sm:p-2 rounded-sm relative">
                  <div className="relative shrink-0">
                    <img src={p.image} alt={p.name} className="w-7 h-7 sm:w-8 sm:h-8 rounded-full object-cover border border-white/20" />
                    {p.riskBadge && (
                      <span className="absolute -top-1 -right-1 text-[7px] font-bold px-1 rounded-full bg-red-600 text-white border border-red-300 font-mono">
                        !
                      </span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] sm:text-xs font-bold text-white truncate">{p.name}</p>
                    <p className="text-[9px] sm:text-[10px] text-cream-dark font-mono">{(p.price/1000000).toFixed(2)}M € · {p.points} pts</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* RECOMENDACIONES DE FICHAJES PARA EL RIVAL (ASISTENCIA IA) */}
      <div className="bg-black/80 border border-forest/40 p-3.5 sm:p-6 rounded-sm shadow-xl space-y-3 sm:space-y-4">
        <div className="flex items-center gap-2">
          <Sparkles size={16} className="text-amber-300" />
          <h3 className="text-base sm:text-lg font-display font-bold text-white">
            Asistencia IA: Sugerencias de Mercado para {club.teamName}
          </h3>
        </div>
        <p className="text-[11px] sm:text-xs text-cream-dark">
          Basado en las debilidades y vacíos de su plantilla, estos jugadores actualmente en el mercado elevarían significativamente su rendimiento:
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 sm:gap-3">
          {club.recommendations.map((rec, i) => (
            <div key={i} className="bg-forest-dark/40 border border-forest/30 p-3 sm:p-4 rounded-sm space-y-1.5 sm:space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] sm:text-xs font-bold text-amber-300">{rec.pos}</span>
                <span className="text-[11px] sm:text-xs font-mono font-bold text-white">{(rec.price/1000000).toFixed(2)}M €</span>
              </div>
              <h4 className="text-xs sm:text-sm font-bold text-white">{rec.name}</h4>
              <p className="text-[11px] sm:text-xs text-cream-dark leading-relaxed">
                {rec.reason}
              </p>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
