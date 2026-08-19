import React from 'react'
import squadData from '../data/squad.json'
import { Shield, Activity, Target, AlertTriangle } from 'lucide-react'

export default function Plantilla() {
  const getPosColor = (pos) => {
    switch(pos) {
      case 'keeper': return 'bg-yellow-600'
      case 'defender': return 'bg-blue-600'
      case 'midfielder': return 'bg-green-600'
      case 'striker': return 'bg-red-600'
      default: return 'bg-forest'
    }
  }

  const getPosName = (pos) => {
    switch(pos) {
      case 'keeper': return 'Portero'
      case 'defender': return 'Defensa'
      case 'midfielder': return 'Centrocampista'
      case 'striker': return 'Delantero'
      default: return pos
    }
  }

  return (
    <div className="container mx-auto px-6 py-12">
      <div className="mb-12">
        <h2 className="text-4xl md:text-5xl font-display font-bold mb-2 border-l-4 border-forest pl-4">Primera Plantilla</h2>
        <p className="text-cream-dark ml-5 text-sm uppercase tracking-widest">Temporada 2026/27</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
        {squadData.players.map(p => (
          <div key={p.id} className="bg-black border border-forest/30 rounded-sm overflow-hidden flex flex-col group hover:border-forest transition-colors">
            {/* Cabecera Tarjeta */}
            <div className="relative h-48 bg-forest-dark/40 overflow-hidden flex items-end p-4 border-b border-forest/30">
              <div className="absolute inset-0 flex justify-center items-end opacity-80 pt-4">
                {p.image ? (
                  <img src={p.image} alt={p.name} className="h-full object-cover" />
                ) : null}
              </div>
              <div className="absolute top-4 left-4 z-10">
                <span className={`text-[10px] font-bold uppercase tracking-wider text-white px-2 py-1 rounded-sm ${getPosColor(p.position)}`}>
                  {getPosName(p.position)}
                </span>
              </div>
              <div className="absolute -right-4 -bottom-4 opacity-30 font-display font-bold text-9xl">
                {p.number}
              </div>
              <h3 className="text-3xl font-display font-bold relative z-10 group-hover:text-white transition-colors bg-black/60 px-2 py-1 rounded-sm">
                {p.name}
              </h3>
            </div>
            
            {/* Estadísticas Históricas */}
            <div className="p-6 bg-gradient-to-b from-black to-clubBlack flex-1">
              <h4 className="text-xs uppercase tracking-widest text-forest-light font-bold mb-4 flex items-center gap-2">
                <Activity size={14} /> Estadísticas Históricas
              </h4>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-forest-dark/20 p-3 rounded-sm border border-forest/10 flex flex-col items-center justify-center">
                  <span className="text-2xl font-display font-bold">{p.stats?.matches || 0}</span>
                  <span className="text-[10px] uppercase tracking-wider text-cream-dark text-center">Partidos</span>
                </div>
                
                {p.position === 'keeper' || p.position === 'defender' ? (
                  <div className="bg-forest-dark/20 p-3 rounded-sm border border-forest/10 flex flex-col items-center justify-center">
                    <span className="text-2xl font-display font-bold">{p.stats?.cleanSheets || 0}</span>
                    <span className="text-[10px] uppercase tracking-wider text-cream-dark text-center">Porterías Imbatidas</span>
                  </div>
                ) : (
                  <div className="bg-forest-dark/20 p-3 rounded-sm border border-forest/10 flex flex-col items-center justify-center">
                    <span className="text-2xl font-display font-bold">{p.stats?.assists || 0}</span>
                    <span className="text-[10px] uppercase tracking-wider text-cream-dark text-center">Asistencias</span>
                  </div>
                )}
                
                <div className="bg-forest-dark/20 p-3 rounded-sm border border-forest/10 flex flex-col items-center justify-center">
                  <span className="text-2xl font-display font-bold flex items-center gap-1">
                    {p.stats?.goals || 0} <Target size={14} className="text-forest-light"/>
                  </span>
                  <span className="text-[10px] uppercase tracking-wider text-cream-dark text-center">Goles</span>
                </div>
                
                <div className="bg-forest-dark/20 p-3 rounded-sm border border-forest/10 flex flex-col items-center justify-center">
                  <span className="text-2xl font-display font-bold flex items-center gap-1">
                    {p.stats?.yellows || 0} <AlertTriangle size={14} className="text-yellow-500"/>
                  </span>
                  <span className="text-[10px] uppercase tracking-wider text-cream-dark text-center">Amarillas</span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
      
      <div className="mt-16 bg-forest-dark/40 border border-forest-light p-6 rounded-sm flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-6">
          <img src="/media/mateo.jpg" alt="Mateo Oslomany" className="w-24 h-24 rounded-full border-2 border-forest-light object-cover shadow-xl" />
          <div>
            <h3 className="text-xl font-display font-bold">Cuerpo Técnico</h3>
            <p className="text-sm text-cream-dark">Director Deportivo / Entrenador</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-3xl font-display font-bold text-white">{squadData.coach}</p>
          <p className="text-xs text-forest-light uppercase tracking-widest mt-1">El Arquitecto</p>
        </div>
      </div>
    </div>
  )
}
