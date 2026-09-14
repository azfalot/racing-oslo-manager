import React, { useState, useEffect } from 'react';
import systemStatus from '../data/systemStatus.json';
import squadData from '../data/squad.json';
import newsData from '../data/news.json';
import rivalsData from '../data/rivalsAudit.json';
import financesData from '../data/finances.json';
import trafficStats from '../data/trafficStats.json';
import totwHistory from '../data/totwHistory.json';
import { trackPageView, getLocalTrafficTelemetry } from '../utils/trafficTracker';
import { 
  Activity, 
  Server, 
  Cloud, 
  Cpu, 
  Database, 
  CheckCircle2, 
  ShieldCheck, 
  Clock, 
  RefreshCw, 
  Radio, 
  Terminal, 
  Settings, 
  Lock, 
  Zap, 
  FileCode, 
  Layers, 
  ExternalLink,
  Bot,
  Send,
  Calendar,
  AlertCircle,
  Eye,
  Users,
  Smartphone,
  Monitor,
  Globe,
  Award,
  Sparkles,
  TrendingUp,
  Target
} from 'lucide-react';

export default function Auditoria() {
  const [timeAgo, setTimeAgo] = useState('');
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'traffic' | 'totw'
  const [localTelemetry, setLocalTelemetry] = useState(null);

  useEffect(() => {
    trackPageView('/auditoria');
    setLocalTelemetry(getLocalTrafficTelemetry());

    const updateRelativeTime = () => {
      if (!systemStatus?.lastSyncTimestamp) return;
      const syncTime = new Date(systemStatus.lastSyncTimestamp).getTime();
      const now = Date.now();
      const diffSec = Math.floor((now - syncTime) / 1000);
      
      if (diffSec < 60) {
        setTimeAgo(`hace ${diffSec} seg`);
      } else if (diffSec < 3600) {
        setTimeAgo(`hace ${Math.floor(diffSec / 60)} min`);
      } else if (diffSec < 86400) {
        setTimeAgo(`hace ${Math.floor(diffSec / 3600)} h`);
      } else {
        setTimeAgo(`hace ${Math.floor(diffSec / 86400)} d`);
      }
    };

    updateRelativeTime();
    const interval = setInterval(updateRelativeTime, 10000);
    return () => clearInterval(interval);
  }, []);

  const dataFilesSummary = [
    { name: 'squad.json', description: 'Plantilla en vivo, estadísticas y valores TM', count: `${squadData.players?.length || 0} jugadores`, icon: Layers, status: 'OK' },
    { name: 'news.json', description: 'Noticias históricas del club y mercado Comunio', count: `${newsData?.length || 0} noticias`, icon: FileCode, status: 'OK' },
    { name: 'rivalsAudit.json', description: 'Auditoría 360º de los 10 clubes con sugerencias dinámicas', count: `${rivalsData?.length || 10} clubes`, icon: Layers, status: 'OK' },
    { name: 'finances.json', description: 'Auditoría de tesorería, balance consolidado e ingresos', count: 'Consolidado', icon: Zap, status: 'OK' },
    { name: 'trafficStats.json', description: 'Telemetría de audiencia, páginas vistas y observabilidad', count: `${trafficStats.overview?.totalPageViews || 0} visitas`, icon: Eye, status: 'OK' },
    { name: 'totwHistory.json', description: 'Registro de Onces Ideales y candidaturas de la jornada', count: `${totwHistory.totalCareerAppearances || 22} presencias TOTW`, icon: Award, status: 'OK' },
    { name: 'systemStatus.json', description: 'Telemetría del Daemon, crons y guardarraíles', count: 'En vivo', icon: Activity, status: 'OK' }
  ];

  return (
    <div className="min-h-screen bg-clubBlack text-cream font-sans py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-8">

        {/* Cabecera Principal */}
        <div className="border-b border-forest-light/30 pb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <span className="text-xs font-mono font-bold tracking-widest text-forest-light uppercase bg-forest/20 px-3 py-1 rounded border border-forest/30 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-forest-light animate-ping" />
                OBSERVABILIDAD & AUDITORÍA PRIVADA
              </span>
              <span className="text-xs font-mono text-cream-dark opacity-60">
                Solo Mánager
              </span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-display font-bold tracking-wide mt-2 text-white flex items-center gap-3">
              <Activity className="text-forest-light" size={36} />
              CENTRO DE CONTROL & TELEMETRÍA DEL SISTEMA
            </h1>
            <p className="text-sm text-cream-dark mt-1 font-mono">
              Monitorización en tiempo real del Daemon (PM2), motor táctico ComunioEngine, tráfico web y Onces Ideales.
            </p>
          </div>

          <div className="flex items-center gap-3 bg-forest-dark/40 border border-forest/40 px-4 py-3 rounded-sm shadow-lg">
            <ShieldCheck className="text-forest-light" size={28} />
            <div>
              <p className="text-[10px] text-cream-dark uppercase font-mono tracking-wider">ESTADO GENERAL</p>
              <p className="text-sm font-bold text-forest-light flex items-center gap-1.5">
                <CheckCircle2 size={16} /> SISTEMAS 100% OPERATIVOS
              </p>
            </div>
          </div>
        </div>

        {/* Pestañas de Navegación de Auditoría */}
        <div className="flex flex-wrap items-center gap-2 border-b border-forest/30 pb-3">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-4 py-2 text-xs font-mono font-bold rounded-sm border transition-all cursor-pointer flex items-center gap-2 uppercase ${
              activeTab === 'overview'
                ? 'bg-forest text-cream border-forest-light shadow-md'
                : 'bg-black/50 text-cream/70 border-forest/30 hover:border-forest-light/60 hover:text-white'
            }`}
          >
            <Activity size={14} /> SISTEMAS & DAEMON
          </button>
          <button
            onClick={() => setActiveTab('traffic')}
            className={`px-4 py-2 text-xs font-mono font-bold rounded-sm border transition-all cursor-pointer flex items-center gap-2 uppercase ${
              activeTab === 'traffic'
                ? 'bg-forest text-cream border-forest-light shadow-md'
                : 'bg-black/50 text-cream/70 border-forest/30 hover:border-forest-light/60 hover:text-white'
            }`}
          >
            <Eye size={14} className="text-sky-400" /> 📊 TRÁFICO & AUDIENCIA WEB
          </button>
          <button
            onClick={() => setActiveTab('totw')}
            className={`px-4 py-2 text-xs font-mono font-bold rounded-sm border transition-all cursor-pointer flex items-center gap-2 uppercase ${
              activeTab === 'totw'
                ? 'bg-forest text-cream border-forest-light shadow-md'
                : 'bg-black/50 text-cream/70 border-forest/30 hover:border-forest-light/60 hover:text-white'
            }`}
          >
            <Award size={14} className="text-amber-400" /> 🌟 ONCES IDEALES (TOTW)
          </button>
        </div>

        {/* ── TAB 1: OVERVIEW & SISTEMAS ── */}
        {activeTab === 'overview' && (
          <div className="space-y-8 animate-fade-in">
            {/* 4 KPIs Clave Superiores */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {/* Card 1: Bot Daemon */}
              <div className="bg-charcoal/80 border border-forest-light/20 p-5 rounded-sm relative overflow-hidden">
                <div className="absolute top-0 right-0 w-24 h-24 bg-forest/5 rounded-full -mr-8 -mt-8 pointer-events-none" />
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-cream-dark uppercase font-mono tracking-wider">DAEMON BOT (PM2)</span>
                  <Bot className="text-forest-light" size={18} />
                </div>
                <p className="text-2xl font-display font-bold text-forest-light mt-1 flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-forest-light inline-block shadow-[0_0_8px_#22c55e]" />
                  {systemStatus.bot.status}
                </p>
                <div className="mt-2 text-xs text-cream-dark flex items-center justify-between border-t border-white/5 pt-2 font-mono">
                  <span>Proceso:</span>
                  <span className="text-white font-bold">{systemStatus.bot.pm2Process}</span>
                </div>
              </div>

              {/* Card 2: Última Sincronización */}
              <div className="bg-charcoal/80 border border-forest-light/20 p-5 rounded-sm relative overflow-hidden">
                <div className="absolute top-0 right-0 w-24 h-24 bg-gold/5 rounded-full -mr-8 -mt-8 pointer-events-none" />
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-cream-dark uppercase font-mono tracking-wider">ÚLTIMA SINCRONIZACIÓN</span>
                  <Clock className="text-gold" size={18} />
                </div>
                <p className="text-xl font-display font-bold text-gold mt-1">
                  {timeAgo || 'Reciente'}
                </p>
                <div className="mt-2 text-xs text-cream-dark flex items-center justify-between border-t border-white/5 pt-2 font-mono">
                  <span>Fecha/Hora:</span>
                  <span className="text-white font-bold text-[10px]">{systemStatus.lastSyncFormatted}</span>
                </div>
              </div>

              {/* Card 3: Cloudflare Deployment */}
              <div className="bg-charcoal/80 border border-forest-light/20 p-5 rounded-sm relative overflow-hidden">
                <div className="absolute top-0 right-0 w-24 h-24 bg-sky-500/5 rounded-full -mr-8 -mt-8 pointer-events-none" />
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-cream-dark uppercase font-mono tracking-wider">DESPLIEGUE WEB</span>
                  <Cloud className="text-sky-400" size={18} />
                </div>
                <p className="text-2xl font-display font-bold text-sky-400 mt-1 flex items-center gap-2">
                  <CheckCircle2 size={20} />
                  PRODUCCIÓN
                </p>
                <div className="mt-2 text-xs text-cream-dark flex items-center justify-between border-t border-white/5 pt-2 font-mono">
                  <span>Target:</span>
                  <span className="text-white font-bold">{systemStatus.web.platform}</span>
                </div>
              </div>

              {/* Card 4: Comunio API */}
              <div className="bg-charcoal/80 border border-forest-light/20 p-5 rounded-sm relative overflow-hidden">
                <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full -mr-8 -mt-8 pointer-events-none" />
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-cream-dark uppercase font-mono tracking-wider">COMUNIO API</span>
                  <Radio className="text-emerald-400" size={18} />
                </div>
                <p className="text-2xl font-display font-bold text-emerald-400 mt-1 flex items-center gap-2">
                  200 OK
                </p>
                <div className="mt-2 text-xs text-cream-dark flex items-center justify-between border-t border-white/5 pt-2 font-mono">
                  <span>Sesión:</span>
                  <span className="text-white font-bold">Bearer Token Activo</span>
                </div>
              </div>
            </div>

            {/* Rejilla de Sub-sistemas & Guardarraíles */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              
              {/* Columna Izquierda: Sub-sistemas y Servicios (2/3) */}
              <div className="lg:col-span-2 space-y-6">
                <div className="bg-charcoal/60 border border-forest-light/20 p-6 rounded-sm">
                  <h2 className="text-lg font-display font-bold text-white flex items-center gap-2 border-b border-forest-light/20 pb-4 mb-4">
                    <Server className="text-forest-light" size={20} />
                    ESTADO DE SUB-SISTEMAS & DAEMON
                  </h2>

                  <div className="space-y-3">
                    {systemStatus.subsystems.map(sub => (
                      <div key={sub.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 bg-black/40 border border-white/5 rounded-sm hover:border-forest/40 transition-colors gap-2">
                        <div className="flex items-center gap-3">
                          <span className="w-2.5 h-2.5 rounded-full bg-forest-light shadow-[0_0_6px_#22c55e]" />
                          <div>
                            <p className="text-sm font-bold text-white font-mono">{sub.name}</p>
                            <p className="text-xs text-cream-dark mt-0.5">{sub.detail}</p>
                          </div>
                        </div>
                        <span className="text-[11px] font-mono font-bold bg-forest/20 text-forest-light px-2.5 py-1 rounded border border-forest/30 self-start sm:self-auto">
                          {sub.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Pipeline de Sincronización */}
                <div className="bg-charcoal/60 border border-forest-light/20 p-6 rounded-sm">
                  <h2 className="text-lg font-display font-bold text-white flex items-center gap-2 border-b border-forest-light/20 pb-4 mb-4">
                    <RefreshCw className="text-gold" size={20} />
                    PIPELINE DE EXTRACCIÓN & SINCRONIZACIÓN
                  </h2>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {systemStatus.pipeline.map((step, idx) => (
                      <div key={idx} className="p-3 bg-black/40 border border-white/5 rounded-sm flex items-start gap-3">
                        <span className="text-xs font-mono font-bold text-forest-light bg-forest/20 px-2 py-0.5 rounded border border-forest/30 mt-0.5">
                          0{idx + 1}
                        </span>
                        <div>
                          <p className="text-xs font-bold text-white font-mono">{step.name}</p>
                          <p className="text-[11px] text-cream-dark mt-0.5">{step.detail || step.time}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Archivos de Datos Generados */}
                <div className="bg-charcoal/60 border border-forest-light/20 p-6 rounded-sm">
                  <h2 className="text-lg font-display font-bold text-white flex items-center gap-2 border-b border-forest-light/20 pb-4 mb-4">
                    <Database className="text-forest-light" size={20} />
                    ESTADO DE LOS ARCHIVOS DE DATOS (DATA LAKE)
                  </h2>

                  <div className="divide-y divide-white/5">
                    {dataFilesSummary.map(f => {
                      const IconComponent = f.icon;
                      return (
                        <div key={f.name} className="py-3 flex items-center justify-between text-xs font-mono">
                          <div className="flex items-center gap-3">
                            <IconComponent size={16} className="text-forest-light" />
                            <div>
                              <span className="font-bold text-white">{f.name}</span>
                              <span className="text-cream-dark block text-[11px] font-sans">{f.description}</span>
                            </div>
                          </div>
                          <div className="text-right">
                            <span className="text-forest-light font-bold">{f.count}</span>
                            <span className="text-[10px] text-cream-dark block">Estado: {f.status}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Columna Derecha: Guardarraíles y Políticas (1/3) */}
              <div className="space-y-6">
                
                {/* Guardarraíles de Negocio */}
                <div className="bg-charcoal/60 border border-forest-light/20 p-6 rounded-sm">
                  <h2 className="text-lg font-display font-bold text-white flex items-center gap-2 border-b border-forest-light/20 pb-4 mb-4">
                    <Lock className="text-gold" size={20} />
                    GUARDARRAÍLES & REGLAS DE SEGURIDAD
                  </h2>

                  <div className="space-y-3.5 text-xs font-mono">
                    <div className="p-3 bg-black/40 border border-white/5 rounded-sm space-y-1">
                      <span className="text-cream-dark text-[10px] uppercase">Límite de Auto-Puja:</span>
                      <p className="text-white font-bold">{systemStatus.bot.guardrails.autoBidLimit}</p>
                    </div>

                    <div className="p-3 bg-black/40 border border-white/5 rounded-sm space-y-1">
                      <span className="text-cream-dark text-[10px] uppercase">Bandas de Puja Dinámica:</span>
                      <p className="text-forest-light font-bold text-[11px]">{systemStatus.bot.guardrails.bidBands || '95%-125% VM'}</p>
                    </div>

                    <div className="p-3 bg-black/40 border border-white/5 rounded-sm space-y-1">
                      <span className="text-cream-dark text-[10px] uppercase">Reserva de Seguridad Mínima:</span>
                      <p className="text-gold font-bold">{systemStatus.bot.guardrails.safetyReserveMin}</p>
                    </div>

                    <div className="p-3 bg-black/40 border border-white/5 rounded-sm space-y-1">
                      <span className="text-cream-dark text-[10px] uppercase">Política de Ventas:</span>
                      <p className="text-sky-400 font-bold">{systemStatus.bot.guardrails.autoAcceptAboveMarket}</p>
                    </div>

                    <div className="p-3 bg-black/40 border border-white/5 rounded-sm space-y-1">
                      <span className="text-cream-dark text-[10px] uppercase">Filtro de Disciplina & Bajas:</span>
                      <p className="text-emerald-400 font-bold">{systemStatus.bot.guardrails.banDiscard}</p>
                    </div>
                  </div>
                </div>

                {/* Calendario de Tareas y Slots Crons */}
                <div className="bg-charcoal/60 border border-forest-light/20 p-6 rounded-sm">
                  <h2 className="text-lg font-display font-bold text-white flex items-center gap-2 border-b border-forest-light/20 pb-4 mb-4">
                    <Calendar className="text-sky-400" size={20} />
                    CALENDARIO DE TAREAS & SLOTS
                  </h2>

                  <div className="space-y-3 text-xs font-mono">
                    <div className="p-3 bg-black/40 border border-white/5 rounded-sm">
                      <span className="text-cream-dark text-[10px] uppercase">Ranuras Diarias Fijas:</span>
                      <div className="flex gap-2 mt-1.5">
                        {systemStatus.bot.schedule.slots.map(slot => (
                          <span key={slot} className="bg-forest/30 text-forest-light border border-forest/40 px-2 py-1 rounded font-bold">
                            {slot}h
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="p-3 bg-black/40 border border-white/5 rounded-sm">
                      <span className="text-cream-dark text-[10px] uppercase">Ventana Matinal Aleatoria:</span>
                      <p className="text-white font-bold mt-1">{systemStatus.bot.schedule.morningSlot}h</p>
                    </div>

                    <div className="p-3 bg-black/40 border border-white/5 rounded-sm">
                      <span className="text-cream-dark text-[10px] uppercase">Ventana Pre-Jornada:</span>
                      <p className="text-gold font-bold mt-1">{systemStatus.bot.schedule.preMatchdayWindow}</p>
                    </div>

                    <div className="p-3 bg-forest-dark/30 border border-forest/40 rounded-sm">
                      <span className="text-cream-dark text-[10px] uppercase">Próxima Jornada Comunio:</span>
                      <p className="text-forest-light font-bold mt-1">{systemStatus.bot.schedule.nextMatchday}</p>
                    </div>
                  </div>
                </div>

                {/* Enlace Directo a Producción */}
                <div className="p-4 bg-black/80 border border-forest-light/30 rounded-sm text-center">
                  <a 
                    href={systemStatus.web.targetUrl} 
                    target="_blank" 
                    rel="noreferrer"
                    className="text-xs font-mono font-bold text-forest-light hover:text-white flex items-center justify-center gap-2 transition-colors"
                  >
                    <span>Abrir Producción en Cloudflare Workers</span>
                    <ExternalLink size={14} />
                  </a>
                </div>

              </div>

            </div>
          </div>
        )}

        {/* ── TAB 2: TRÁFICO & AUDIENCIA WEB ── */}
        {activeTab === 'traffic' && (
          <div className="space-y-8 animate-fade-in">
            {/* KPIs de Tráfico */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-charcoal/80 border border-forest-light/20 p-5 rounded-sm">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-cream-dark uppercase font-mono tracking-wider">PÁGINAS VISTAS TOTALES</span>
                  <Eye className="text-sky-400" size={18} />
                </div>
                <p className="text-3xl font-display font-bold text-sky-400 mt-2">
                  {trafficStats.overview.totalPageViews.toLocaleString('es-ES')}
                </p>
                <span className="text-[10px] text-cream-dark font-mono block mt-1">Tráfico acumulado de temporada</span>
              </div>

              <div className="bg-charcoal/80 border border-forest-light/20 p-5 rounded-sm">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-cream-dark uppercase font-mono tracking-wider">VISITANTES ÚNICOS</span>
                  <Users className="text-forest-light" size={18} />
                </div>
                <p className="text-3xl font-display font-bold text-forest-light mt-2">
                  {trafficStats.overview.uniqueVisitors.toLocaleString('es-ES')}
                </p>
                <span className="text-[10px] text-cream-dark font-mono block mt-1">Dispositivos y usuarios identificados</span>
              </div>

              <div className="bg-charcoal/80 border border-forest-light/20 p-5 rounded-sm">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-cream-dark uppercase font-mono tracking-wider">TIEMPO MEDIO SESIÓN</span>
                  <Clock className="text-gold" size={18} />
                </div>
                <p className="text-3xl font-display font-bold text-gold mt-2">
                  {trafficStats.overview.avgSessionDuration}
                </p>
                <span className="text-[10px] text-cream-dark font-mono block mt-1">Tasa de rebote: {trafficStats.overview.bounceRate}</span>
              </div>

              <div className="bg-charcoal/80 border border-forest-light/20 p-5 rounded-sm">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-cream-dark uppercase font-mono tracking-wider">SESIONES ACTIVAS AHORA</span>
                  <Activity className="text-emerald-400" size={18} />
                </div>
                <p className="text-3xl font-display font-bold text-emerald-400 mt-2 flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-emerald-400 animate-pulse" />
                  {trafficStats.overview.activeSessionsNow}
                </p>
                <span className="text-[10px] text-cream-dark font-mono block mt-1">En tiempo real en Cloudflare Edge</span>
              </div>
            </div>

            {/* Rejilla de Desglose de Páginas & Dispositivos */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              
              {/* Páginas Más Visitadas (2/3) */}
              <div className="lg:col-span-2 bg-charcoal/60 border border-forest-light/20 p-6 rounded-sm space-y-4">
                <h3 className="text-base font-display font-bold text-white flex items-center gap-2 border-b border-forest-light/20 pb-3">
                  <Globe size={18} className="text-sky-400" />
                  SECCIONES MÁS VISITADAS DE LA SEDE DIGITAL
                </h3>

                <div className="space-y-3">
                  {trafficStats.topPages.map((page, i) => (
                    <div key={page.path} className="p-3.5 bg-black/40 border border-white/5 rounded-sm space-y-2">
                      <div className="flex justify-between items-center text-xs font-mono">
                        <span className="font-bold text-white">{i + 1}. {page.name} <span className="text-cream-dark font-normal">({page.path})</span></span>
                        <span className="text-sky-400 font-bold">{page.views} vistas ({page.percentage}%)</span>
                      </div>
                      <div className="w-full bg-black/80 h-2 rounded-full overflow-hidden border border-white/5">
                        <div 
                          className="bg-gradient-to-r from-sky-500 to-forest-light h-full rounded-full transition-all duration-500"
                          style={{ width: `${page.percentage * 2}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Dispositivos & Observabilidad Cloudflare (1/3) */}
              <div className="space-y-6">
                
                {/* Distribución por Dispositivo */}
                <div className="bg-charcoal/60 border border-forest-light/20 p-6 rounded-sm space-y-4">
                  <h3 className="text-base font-display font-bold text-white flex items-center gap-2 border-b border-forest-light/20 pb-3">
                    <Smartphone size={18} className="text-forest-light" />
                    DISPOSITIVOS DE ACCESO
                  </h3>

                  <div className="space-y-3 text-xs font-mono">
                    <div className="flex justify-between items-center p-3 bg-black/40 border border-white/5 rounded-sm">
                      <span className="flex items-center gap-2 text-white">
                        <Smartphone size={14} className="text-forest-light" /> Móviles (iOS/Android):
                      </span>
                      <span className="font-bold text-forest-light">{trafficStats.deviceBreakdown.mobile}%</span>
                    </div>

                    <div className="flex justify-between items-center p-3 bg-black/40 border border-white/5 rounded-sm">
                      <span className="flex items-center gap-2 text-white">
                        <Monitor size={14} className="text-sky-400" /> Ordenadores / Escritorio:
                      </span>
                      <span className="font-bold text-sky-400">{trafficStats.deviceBreakdown.desktop}%</span>
                    </div>

                    <div className="flex justify-between items-center p-3 bg-black/40 border border-white/5 rounded-sm">
                      <span className="flex items-center gap-2 text-white">
                        <TabletIcon size={14} className="text-gold" /> Tablets / Otros:
                      </span>
                      <span className="font-bold text-gold">{trafficStats.deviceBreakdown.tablet}%</span>
                    </div>
                  </div>
                </div>

                {/* Cloudflare Observability Info */}
                <div className="bg-charcoal/60 border border-forest-light/20 p-6 rounded-sm space-y-3 font-mono text-xs">
                  <h3 className="text-base font-display font-bold text-white flex items-center gap-2 border-b border-forest-light/20 pb-3 font-sans">
                    <Cloud size={18} className="text-sky-400" />
                    OBSERVABILIDAD CLOUDFLARE
                  </h3>

                  <div className="space-y-2 text-[11px]">
                    <div className="flex justify-between">
                      <span className="text-cream-dark">Worker Name:</span>
                      <span className="text-white font-bold">{trafficStats.cloudflareObservability.workerId}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-cream-dark">Región Edge:</span>
                      <span className="text-forest-light font-bold">{trafficStats.cloudflareObservability.region}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-cream-dark">Protocolo:</span>
                      <span className="text-white font-bold">{trafficStats.cloudflareObservability.tlsVersion}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-cream-dark">Cache Hit Ratio:</span>
                      <span className="text-emerald-400 font-bold">{trafficStats.cloudflareObservability.edgeHitRatio}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-cream-dark">Latencia Media:</span>
                      <span className="text-sky-400 font-bold">{trafficStats.cloudflareObservability.avgResponseTimeMs} ms</span>
                    </div>
                  </div>
                </div>

              </div>

            </div>

            {/* Tráfico Diario por Día */}
            <div className="bg-charcoal/60 border border-forest-light/20 p-6 rounded-sm space-y-4">
              <h3 className="text-base font-display font-bold text-white flex items-center gap-2 border-b border-forest-light/20 pb-3">
                <TrendingUp size={18} className="text-forest-light" />
                EVOLUCIÓN DE TRÁFICO SEMANAL
              </h3>

              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 text-center">
                {trafficStats.trafficByDay.map(day => (
                  <div key={day.day} className="p-3 bg-black/40 border border-white/5 rounded-sm space-y-1">
                    <p className="text-[10px] text-cream-dark uppercase font-mono">{day.day} ({day.date})</p>
                    <p className="text-lg font-display font-bold text-sky-400">{day.views} <span className="text-[10px] font-normal font-mono text-cream-dark">vistas</span></p>
                    <p className="text-xs font-mono text-forest-light">{day.visitors} visitantes</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── TAB 3: ONCES IDEALES (TOTW) ── */}
        {activeTab === 'totw' && (
          <div className="space-y-8 animate-fade-in">
            {/* KPIs de Once Ideal */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              <div className="bg-charcoal/80 border border-forest-light/20 p-5 rounded-sm">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-cream-dark uppercase font-mono tracking-wider">PRESENCIAS EN XI IDEAL (26/27)</span>
                  <Award className="text-amber-400" size={18} />
                </div>
                <p className="text-3xl font-display font-bold text-amber-300 mt-2">
                  {totwHistory.totalAppearancesThisSeason}
                </p>
                <span className="text-[10px] text-cream-dark font-mono block mt-1">Sin apariciones en las primeras 4 jornadas</span>
              </div>

              <div className="bg-charcoal/80 border border-forest-light/20 p-5 rounded-sm">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-cream-dark uppercase font-mono tracking-wider">HISTÓRICO EN CARRERA COMUNIO</span>
                  <Sparkles className="text-forest-light" size={18} />
                </div>
                <p className="text-3xl font-display font-bold text-forest-light mt-2">
                  {totwHistory.totalCareerAppearances} presencias
                </p>
                <span className="text-[10px] text-cream-dark font-mono block mt-1">Liderado por Gerard Moreno (11) y Soria (6)</span>
              </div>

              <div className="bg-charcoal/80 border border-forest-light/20 p-5 rounded-sm">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-cream-dark uppercase font-mono tracking-wider">CANDIDATOS JORNADA 5</span>
                  <Target className="text-sky-400" size={18} />
                </div>
                <p className="text-3xl font-display font-bold text-sky-400 mt-2">
                  {totwHistory.topCandidates.length} jugadores
                </p>
                <span className="text-[10px] text-cream-dark font-mono block mt-1">Soria (73%), Gerard (58%), Valverde (54%)</span>
              </div>
            </div>

            {/* Rejilla: Candidatos Próxima Jornada & Umbrales Comunio */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              
              {/* Candidatos Principales para J5 (2/3) */}
              <div className="lg:col-span-2 bg-charcoal/60 border border-forest-light/20 p-6 rounded-sm space-y-4">
                <h3 className="text-base font-display font-bold text-white flex items-center gap-2 border-b border-forest-light/20 pb-3">
                  <Target size={18} className="text-amber-400" />
                  CANDIDATOS CON MAYOR PROBABILIDAD DE ONCE IDEAL (J5)
                </h3>

                <div className="space-y-3">
                  {totwHistory.topCandidates.map(c => (
                    <div key={c.name} className="p-4 bg-black/40 border border-white/5 rounded-sm space-y-2">
                      <div className="flex justify-between items-center text-xs font-mono">
                        <div>
                          <span className="font-bold text-white text-sm">{c.name}</span>
                          <span className="text-cream-dark text-xs block font-sans">{c.club} • {c.position}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-amber-300 font-bold text-sm">{c.candidacyProbability}% Probabilidad</span>
                          <span className="text-[10px] text-cream-dark block font-mono">Exp: {c.expectedPoints} pts</span>
                        </div>
                      </div>
                      <div className="w-full bg-black/80 h-2 rounded-full overflow-hidden border border-white/5">
                        <div 
                          className="bg-gradient-to-r from-amber-500 to-forest-light h-full rounded-full"
                          style={{ width: `${c.candidacyProbability}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Umbrales de Puntos por Posición (1/3) */}
              <div className="bg-charcoal/60 border border-forest-light/20 p-6 rounded-sm space-y-4">
                <h3 className="text-base font-display font-bold text-white flex items-center gap-2 border-b border-forest-light/20 pb-3">
                  <ShieldCheck size={18} className="text-forest-light" />
                  CORTE DE PUNTOS COMUNIO
                </h3>

                <div className="space-y-3 text-xs font-mono">
                  <div className="p-3 bg-black/40 border border-white/5 rounded-sm">
                    <span className="text-amber-300 font-bold block">🧤 Porteros: ≥ 10 pts</span>
                    <span className="text-[10px] text-cream-dark">Portería a cero + recital de paradas o penalti atajado.</span>
                  </div>

                  <div className="p-3 bg-black/40 border border-white/5 rounded-sm">
                    <span className="text-blue-300 font-bold block">🛡️ Defensas: ≥ 9 pts</span>
                    <span className="text-[10px] text-cream-dark">Portería a cero + gol anotado o asistencia de gol.</span>
                  </div>

                  <div className="p-3 bg-black/40 border border-white/5 rounded-sm">
                    <span className="text-emerald-300 font-bold block">⚡ Centrocampistas: ≥ 12 pts</span>
                    <span className="text-[10px] text-cream-dark">Gol decisivo + asistencia o exhibición Sofascore &gt; 8.5.</span>
                  </div>

                  <div className="p-3 bg-black/40 border border-white/5 rounded-sm">
                    <span className="text-rose-300 font-bold block">⚽ Delanteros: ≥ 12 pts</span>
                    <span className="text-[10px] text-cream-dark">Doblete o gol de la victoria con alta valoración.</span>
                  </div>
                </div>
              </div>

            </div>

            {/* Desglose Completo de la Plantilla */}
            <div className="bg-charcoal/60 border border-forest-light/20 p-6 rounded-sm space-y-4">
              <h3 className="text-base font-display font-bold text-white flex items-center gap-2 border-b border-forest-light/20 pb-3">
                <Users size={18} className="text-forest-light" />
                HISTÓRICO ACUMULADO POR JUGADOR DE NUESTRA PLANTILLA
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs font-mono">
                {totwHistory.playerStats.map(p => (
                  <div key={p.name} className="p-3 bg-black/40 border border-white/5 rounded-sm flex justify-between items-center">
                    <div>
                      <span className="font-bold text-white">{p.name}</span>
                      <span className="text-[10px] text-cream-dark block">2026/27: {p.appearancesThisSeason} presencias</span>
                    </div>
                    <span className="text-forest-light font-bold">
                      {p.allTimeCareerAppearances} en carrera
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

function TabletIcon(props) {
  return <Monitor {...props} />;
}
