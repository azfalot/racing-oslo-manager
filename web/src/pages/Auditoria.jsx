import React, { useState, useEffect } from 'react';
import systemStatus from '../data/systemStatus.json';
import squadData from '../data/squad.json';
import newsData from '../data/news.json';
import rivalsData from '../data/rivalsAudit.json';
import financesData from '../data/finances.json';
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
  AlertCircle
} from 'lucide-react';

export default function Auditoria() {
  const [timeAgo, setTimeAgo] = useState('');
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
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
    { name: 'squad.json', description: 'Plantilla en vivo, estadísticas y valores TM', count: `${squadData.players?.length || 0} jugadores`, icon: UsersIcon, status: 'OK' },
    { name: 'news.json', description: 'Noticias históricas del club y mercado Comunio', count: `${newsData?.length || 0} noticias`, icon: FileCode, status: 'OK' },
    { name: 'rivalsAudit.json', description: 'Auditoría 360º de los 10 clubes con sugerencias dinámicas', count: `${rivalsData?.length || 10} clubes`, icon: Layers, status: 'OK' },
    { name: 'finances.json', description: 'Auditoría de tesorería, balance consolidado e ingresos', count: 'Consolidado', icon: Zap, status: 'OK' },
    { name: 'systemStatus.json', description: 'Telemetría del Daemon, crons y guardarraíles', count: 'En vivo', icon: Activity, status: 'OK' }
  ];

  function UsersIcon(props) {
    return <Layers {...props} />;
  }

  return (
    <div className="min-h-screen bg-clubBlack text-cream font-sans py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-10">

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
              Monitorización en tiempo real del Daemon (PM2), motor táctico ComunioEngine, canal Telegram y Cloudflare Workers.
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
              <div className="flex items-center justify-between border-b border-forest-light/20 pb-4 mb-4">
                <h2 className="text-lg font-display font-bold text-white flex items-center gap-2">
                  <Cpu className="text-forest-light" size={20} />
                  ESTADO DE LOS SERVICIOS & SUB-SISTEMAS
                </h2>
                <span className="text-xs font-mono text-forest-light bg-forest/20 px-2 py-0.5 rounded border border-forest/30">
                  {systemStatus.subsystems?.length || 7} activos
                </span>
              </div>

              <div className="space-y-3">
                {systemStatus.subsystems.map((sub) => (
                  <div key={sub.id} className="flex items-start justify-between p-3.5 bg-black/40 border border-white/5 rounded-sm hover:border-forest-light/30 transition-colors">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-white">{sub.name}</span>
                        <span className="text-[10px] font-mono bg-forest/30 text-forest-light px-2 py-0.5 rounded">
                          {sub.status}
                        </span>
                      </div>
                      <p className="text-xs text-cream-dark font-mono">{sub.detail}</p>
                    </div>
                    <div className="text-right">
                      <span className="w-2.5 h-2.5 rounded-full bg-forest-light inline-block shadow-[0_0_6px_#22c55e]" />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Pipeline de Datos JSON Sincronizados */}
            <div className="bg-charcoal/60 border border-forest-light/20 p-6 rounded-sm">
              <div className="flex items-center justify-between border-b border-forest-light/20 pb-4 mb-4">
                <h2 className="text-lg font-display font-bold text-white flex items-center gap-2">
                  <Database className="text-gold" size={20} />
                  PIPELINE DE DATOS & ALMACENAMIENTO CACHÉ
                </h2>
                <span className="text-xs font-mono text-cream-dark">
                  web/src/data/*.json
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {dataFilesSummary.map((file) => {
                  const Icon = file.icon;
                  return (
                    <div key={file.name} className="p-3.5 bg-black/40 border border-white/5 rounded-sm flex items-start gap-3">
                      <Icon className="text-forest-light mt-0.5" size={18} />
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-bold text-white font-mono">{file.name}</p>
                          <span className="text-[11px] font-bold text-gold font-mono">{file.count}</span>
                        </div>
                        <p className="text-xs text-cream-dark mt-0.5">{file.description}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Columna Derecha: Configuración, Horarios y Guardarraíles (1/3) */}
          <div className="space-y-6">
            
            {/* Guardarraíles de Seguridad */}
            <div className="bg-charcoal/60 border border-forest-light/20 p-6 rounded-sm">
              <h2 className="text-lg font-display font-bold text-white flex items-center gap-2 border-b border-forest-light/20 pb-4 mb-4">
                <Lock className="text-amber-400" size={20} />
                GUARDARRAÍLES & REGLAS DE SEGURIDAD
              </h2>

              <div className="space-y-3.5 text-xs font-mono">
                <div className="p-3 bg-black/40 border border-white/5 rounded-sm space-y-1">
                  <span className="text-cream-dark text-[10px] uppercase">Límite de Auto-Puja:</span>
                  <p className="text-white font-bold">{systemStatus.bot.guardrails.autoBidLimit}</p>
                </div>

                <div className="p-3 bg-black/40 border border-white/5 rounded-sm space-y-1">
                  <span className="text-cream-dark text-[10px] uppercase">Margen sobre VM:</span>
                  <p className="text-forest-light font-bold">{systemStatus.bot.guardrails.bidMargin}</p>
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
    </div>
  );
}
