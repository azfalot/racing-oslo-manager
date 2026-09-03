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
  Layers
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
  const club = rivalsData.find(c => c.id === selectedId) || rivalsData[0];
  const osloClub = rivalsData.find(c => c.isMe) || rivalsData[1];

  const posEmoji = { keeper: '🧤', defender: '🛡️', midfielder: '⚙️', striker: '⚡' };

  // Group starters by line
  const keepers = (club.starters || []).filter(p => p.position === 'keeper');
  const defenders = (club.starters || []).filter(p => p.position === 'defender');
  const midfielders = (club.starters || []).filter(p => p.position === 'midfielder');
  const strikers = (club.starters || []).filter(p => p.position === 'striker');

  return (
    <div className="container mx-auto px-4 sm:px-6 py-10 space-y-10">
      
      {/* HEADER */}
      <div className="text-center space-y-3 max-w-3xl mx-auto">
        <div className="inline-flex items-center gap-2 bg-forest-dark border border-forest-light/40 px-3 py-1 rounded-full text-xs font-bold text-cream">
          <BarChart3 size={14} className="text-amber-300" />
          <span>SCOUTING & AUDITORÍA 360º DE LA COMUNIDAD</span>
        </div>
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-display font-bold text-white tracking-wide">
          Centro de Análisis de Clubes
        </h1>
        <p className="text-sm sm:text-base text-cream-dark leading-relaxed">
          Consulta la radiografía táctica, el Once Titular proyectado, el estado financiero y las debilidades de cualquier equipo de la liga.
        </p>
      </div>

      {/* SELECTOR DE CLUBES (Pills / Dropdown) */}
      <div className="bg-black/80 border border-forest/40 p-4 rounded-sm shadow-xl space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-cream-dark uppercase tracking-wider flex items-center gap-2">
            <Layers size={14} className="text-forest-light" />
            Selecciona un Club de la Liga (10 Clubes):
          </span>
          <span className="text-[11px] text-amber-300/80 font-mono">
            {rivalsData.length} equipos auditados
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
          {rivalsData.map((c) => {
            const isSelected = c.id === selectedId;
            return (
              <button
                key={c.id}
                onClick={() => setSelectedId(c.id)}
                className={`flex items-center gap-2.5 p-2 rounded-sm border text-left transition-all ${
                  isSelected 
                    ? 'bg-forest border-forest-light text-white shadow-lg ring-1 ring-forest-light' 
                    : 'bg-forest-dark/30 border-forest/20 text-cream/80 hover:bg-forest-dark/60 hover:border-forest/40'
                }`}
              >
                <img 
                  src={CLUB_CRESTS[c.teamName] || c.crest || '/media/crest.jpg'} 
                  alt={c.teamName} 
                  onError={(e) => { e.currentTarget.src = '/media/crest.jpg'; }}
                  className="w-7 h-7 rounded-full object-cover border border-white/20 flex-shrink-0" 
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-xs font-bold truncate">{c.teamName}</span>
                    <span className="text-[10px] font-mono text-amber-300">#{c.pos}</span>
                  </div>
                  <div className="text-[10px] text-cream-dark/70 truncate">{c.points} pts</div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* SNAPSHOT PRINCIPAL DEL CLUB SELECCIONADO */}
      <div className="bg-gradient-to-br from-forest-dark/70 via-black to-black border border-forest-light/40 rounded-sm p-6 sm:p-8 shadow-2xl space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-forest/30">
          <div className="flex items-center gap-4">
            <img 
              src={CLUB_CRESTS[club.teamName] || club.crest || '/media/crest.jpg'} 
              alt={club.teamName} 
              onError={(e) => { e.currentTarget.src = '/media/crest.jpg'; }}
              className="w-16 h-16 sm:w-20 sm:h-20 rounded-full border-2 border-forest-light object-cover shadow-2xl bg-black/60" 
            />
            <div>
              <div className="flex items-center gap-2">
                <span className="bg-amber-300/20 text-amber-300 text-xs font-mono font-bold px-2 py-0.5 rounded-sm border border-amber-300/30">
                  {club.pos}º CLASIFICADO
                </span>
                {club.isMe && (
                  <span className="bg-forest-light/20 text-forest-light text-xs font-mono font-bold px-2 py-0.5 rounded-sm border border-forest-light/30">
                    TU CLUB
                  </span>
                )}
              </div>
              <h2 className="text-2xl sm:text-3xl font-display font-bold text-white mt-1">
                {club.teamName}
              </h2>
              <p className="text-xs text-cream-dark font-mono">
                Mánager Oficial: <span className="text-white font-bold">{club.manager}</span>
              </p>
            </div>
          </div>

          {/* KPI CARDS */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="bg-black/60 border border-forest/30 p-3 rounded-sm text-center">
              <span className="text-[10px] text-cream-dark uppercase tracking-wider font-bold block">Puntos Acumulados</span>
              <span className="text-xl font-display font-bold text-amber-300">{club.points} pts</span>
            </div>
            <div className="bg-black/60 border border-forest/30 p-3 rounded-sm text-center">
              <span className="text-[10px] text-cream-dark uppercase tracking-wider font-bold block">Valor de Plantilla</span>
              <span className="text-xl font-display font-bold text-white">{(club.squadValue / 1000000).toFixed(1)}M €</span>
            </div>
            <div className="bg-black/60 border border-forest/30 p-3 rounded-sm text-center col-span-2 sm:col-span-1">
              <span className="text-[10px] text-cream-dark uppercase tracking-wider font-bold block">Proyección 11</span>
              <span className="text-xl font-display font-bold text-forest-light">~{club.projectedScore} pts</span>
            </div>
          </div>
        </div>

        {/* ALERTA FINANCIERA & DIAGNÓSTICO */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-black/50 border border-forest/30 p-4 rounded-sm space-y-2">
            <div className="flex items-center gap-2 text-xs font-bold text-cream uppercase">
              <DollarSign size={15} className="text-forest-light" />
              <span>Salud Financiera</span>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-sm font-bold ${
                club.financialHealth.includes('Riesgo') || club.financialHealth.includes('Apalancamiento')
                  ? 'text-red-400'
                  : 'text-emerald-400'
              }`}>
                {club.financialHealth}
              </span>
            </div>
            <p className="text-xs text-cream-dark leading-relaxed">
              {club.debtAlert || 'El club cuenta con equilibrio presupuestario y solvencia para afrontar las próximas jornadas.'}
            </p>
          </div>

          <div className="bg-black/50 border border-forest/30 p-4 rounded-sm space-y-2">
            <div className="flex items-center gap-2 text-xs font-bold text-cream uppercase">
              <CheckCircle2 size={15} className="text-emerald-400" />
              <span>Fortalezas Clave</span>
            </div>
            <ul className="space-y-1.5 text-xs text-cream-dark">
              {club.strengths.map((st, i) => (
                <li key={i} className="flex items-start gap-1.5">
                  <span className="text-emerald-400 mt-0.5">•</span>
                  <span>{st}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="bg-black/50 border border-forest/30 p-4 rounded-sm space-y-2">
            <div className="flex items-center gap-2 text-xs font-bold text-cream uppercase">
              <AlertTriangle size={15} className="text-amber-400" />
              <span>Puntos Débiles & Carencias</span>
            </div>
            <ul className="space-y-1.5 text-xs text-cream-dark">
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
          <div className="bg-black/70 border border-forest/40 p-5 rounded-sm shadow-xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-forest/20">
              <div className="flex items-center gap-2">
                <Sparkles size={16} className="text-amber-300" />
                <h3 className="text-sm sm:text-base font-display font-bold text-white uppercase tracking-wider">
                  Radar Especulativo & Perfil de Sobrepujas
                </h3>
              </div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border text-xs font-bold font-mono" style={{ borderColor: club.speculation.badgeColor, color: club.speculation.badgeColor, backgroundColor: `${club.speculation.badgeColor}15` }}>
                <span>{club.speculation.badge}</span>
              </div>
            </div>

            {/* Barra Escala 0-100 */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center text-xs">
                <span className="text-cream-dark font-medium">Índice de Especulación & Rotación:</span>
                <span className="font-mono font-bold" style={{ color: club.speculation.badgeColor }}>
                  {club.speculation.score} / 100 ({club.speculation.riskLevel})
                </span>
              </div>
              <div className="w-full bg-black/80 h-3 rounded-full overflow-hidden p-0.5 border border-forest/30 relative">
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
              <div className="flex justify-between text-[10px] text-cream-dark/60 font-mono">
                <span>0 (Conservador / Saneado)</span>
                <span>50 (Moderado)</span>
                <span>100 (Kamikaze / Deuda Extrema)</span>
              </div>
            </div>

            {/* Métricas clave */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
              <div className="bg-black/50 border border-forest/20 p-2.5 rounded-sm text-center">
                <span className="text-[10px] text-cream-dark uppercase block">Sobrepuja Media</span>
                <span className="text-sm sm:text-base font-bold font-mono" style={{ color: club.speculation.score > 70 ? '#ef4444' : '#10b981' }}>
                  {club.speculation.overbidRate}
                </span>
              </div>
              <div className="bg-black/50 border border-forest/20 p-2.5 rounded-sm text-center">
                <span className="text-[10px] text-cream-dark uppercase block">Total Gastado</span>
                <span className="text-sm sm:text-base font-bold font-mono text-white">
                  {(club.speculation.totalSpent / 1000000).toFixed(1)}M €
                </span>
                <span className="text-[9px] text-cream-dark/60 block">({club.speculation.purchasesCount} compras)</span>
              </div>
              <div className="bg-black/50 border border-forest/20 p-2.5 rounded-sm text-center">
                <span className="text-[10px] text-cream-dark uppercase block">Total Ingresado</span>
                <span className="text-sm sm:text-base font-bold font-mono text-emerald-400">
                  {(club.speculation.totalReceived / 1000000).toFixed(1)}M €
                </span>
                <span className="text-[9px] text-cream-dark/60 block">({club.speculation.salesCount} ventas)</span>
              </div>
              <div className="bg-black/50 border border-forest/20 p-2.5 rounded-sm text-center">
                <span className="text-[10px] text-cream-dark uppercase block">Caja Estimada</span>
                <span className="text-sm sm:text-base font-bold font-mono text-amber-300">
                  {club.speculation.estimatedCash !== undefined ? `${(club.speculation.estimatedCash / 1000000).toFixed(1)}M €` : 'N/D'}
                </span>
                <span className="text-[9px] text-cream-dark/60 block">(+{((club.speculation.prizesEarned || 0) / 1000).toFixed(0)}k € premios)</span>
              </div>
            </div>

            {/* Diagnóstico Textual */}
            <div className="bg-forest-dark/20 border border-forest/20 p-3 rounded-sm text-xs text-cream-dark leading-relaxed flex items-start gap-2">
              <Info size={14} className="text-amber-300 mt-0.5 flex-shrink-0" />
              <span>{club.speculation.analysis}</span>
            </div>
          </div>
        )}
      </div>

      {/* PIZARRA TÁCTICA DEL ONCE TITULAR DEL RIVAL */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-forest/30 pb-3">
          <div>
            <h3 className="text-xl sm:text-2xl font-display font-bold text-white flex items-center gap-2">
              <span>🛡️ Once Titular Estimado ({club.formation})</span>
            </h3>
            <p className="text-xs text-cream-dark">Alineación más probable calculada por el motor de optimización según la plantilla actual.</p>
          </div>
          <div className="text-xs font-mono text-amber-300 bg-forest-dark px-3 py-1 rounded-sm border border-forest/40">
            Techo estimado: ~{club.projectedScore} pts
          </div>
        </div>

        {/* CAMPO DE FÚTBOL RIVAL */}
        <div 
          className="bg-green-900 rounded-lg p-6 relative shadow-2xl overflow-hidden border-4 border-white/10 max-w-4xl mx-auto"
          style={{
            backgroundImage: "linear-gradient(rgba(255,255,255,0.08) 1px, transparent 1px)",
            backgroundSize: "100% 12%"
          }}
        >
          <div className="absolute inset-4 border-2 border-white/20 pointer-events-none rounded-sm"></div>
          <div className="absolute top-1/2 left-4 right-4 h-0.5 bg-white/20 pointer-events-none"></div>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-28 h-28 border-2 border-white/20 rounded-full pointer-events-none"></div>

          <div className="relative z-10 flex flex-col justify-between h-[600px] py-4">
            {/* Delanteros */}
            <div className="flex justify-center gap-6">
              {strikers.map(p => (
                <div key={p.id} className="flex flex-col items-center animate-fade-in group">
                  <div className="relative">
                    <img src={p.image} alt={p.name} className="w-14 h-14 sm:w-16 sm:h-16 rounded-full border-2 border-white/40 object-cover shadow-lg bg-black/60" />
                  </div>
                  <div className="mt-1.5 bg-black/85 px-2 py-0.5 rounded-sm text-center border border-forest/40 min-w-[70px]">
                    <p className="text-[11px] font-bold text-white truncate max-w-[90px]">{p.name}</p>
                    <p className="text-[9px] text-amber-300 font-mono">{(p.price/1000000).toFixed(1)}M €</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Centrocampistas */}
            <div className="flex justify-around">
              {midfielders.map(p => (
                <div key={p.id} className="flex flex-col items-center animate-fade-in group">
                  <div className="relative">
                    <img src={p.image} alt={p.name} className="w-14 h-14 sm:w-16 sm:h-16 rounded-full border-2 border-white/40 object-cover shadow-lg bg-black/60" />
                  </div>
                  <div className="mt-1.5 bg-black/85 px-2 py-0.5 rounded-sm text-center border border-forest/40 min-w-[70px]">
                    <p className="text-[11px] font-bold text-white truncate max-w-[90px]">{p.name}</p>
                    <p className="text-[9px] text-amber-300 font-mono">{(p.price/1000000).toFixed(1)}M €</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Defensas */}
            <div className="flex justify-around">
              {defenders.map(p => (
                <div key={p.id} className="flex flex-col items-center animate-fade-in group">
                  <div className="relative">
                    <img src={p.image} alt={p.name} className="w-14 h-14 sm:w-16 sm:h-16 rounded-full border-2 border-white/40 object-cover shadow-lg bg-black/60" />
                  </div>
                  <div className="mt-1.5 bg-black/85 px-2 py-0.5 rounded-sm text-center border border-forest/40 min-w-[70px]">
                    <p className="text-[11px] font-bold text-white truncate max-w-[90px]">{p.name}</p>
                    <p className="text-[9px] text-amber-300 font-mono">{(p.price/1000000).toFixed(1)}M €</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Portero */}
            <div className="flex justify-center">
              {keepers.map(p => (
                <div key={p.id} className="flex flex-col items-center animate-fade-in group">
                  <div className="relative">
                    <img src={p.image} alt={p.name} className="w-14 h-14 sm:w-16 sm:h-16 rounded-full border-2 border-white/40 object-cover shadow-lg bg-black/60" />
                  </div>
                  <div className="mt-1.5 bg-black/85 px-2 py-0.5 rounded-sm text-center border border-forest/40 min-w-[70px]">
                    <p className="text-[11px] font-bold text-white truncate max-w-[90px]">{p.name}</p>
                    <p className="text-[9px] text-amber-300 font-mono">{(p.price/1000000).toFixed(1)}M €</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* SUPLENTES */}
        {(club.bench || []).length > 0 && (
          <div className="bg-black/60 border border-forest/30 p-4 rounded-sm">
            <h4 className="text-xs font-bold text-cream uppercase tracking-wider mb-3">
              🔲 Banquillo de Reservas ({club.bench.length} jugadores):
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {club.bench.map(p => (
                <div key={p.id} className="flex items-center gap-2 bg-forest-dark/40 border border-forest/20 p-2 rounded-sm">
                  <img src={p.image} alt={p.name} className="w-8 h-8 rounded-full object-cover border border-white/20" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-white truncate">{p.name}</p>
                    <p className="text-[10px] text-cream-dark font-mono">{(p.price/1000000).toFixed(2)}M €</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* RECOMENDACIONES DE FICHAJES PARA EL RIVAL (ASISTENCIA IA) */}
      <div className="bg-black/80 border border-forest/40 p-6 rounded-sm shadow-xl space-y-4">
        <div className="flex items-center gap-2">
          <Sparkles size={18} className="text-amber-300" />
          <h3 className="text-lg font-display font-bold text-white">
            Asistencia IA: Sugerencias de Mercado para {club.teamName}
          </h3>
        </div>
        <p className="text-xs text-cream-dark">
          Basado en las debilidades y vacíos de su plantilla, estos jugadores actualmente en el mercado elevarían significativamente su rendimiento:
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {club.recommendations.map((rec, i) => (
            <div key={i} className="bg-forest-dark/40 border border-forest/30 p-4 rounded-sm space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-amber-300">{rec.pos}</span>
                <span className="text-xs font-mono font-bold text-white">{(rec.price/1000000).toFixed(2)}M €</span>
              </div>
              <h4 className="text-sm font-bold text-white">{rec.name}</h4>
              <p className="text-xs text-cream-dark leading-relaxed">
                {rec.reason}
              </p>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
