import React, { useState } from 'react'
import newsData from '../data/news.json'
import { Calendar, X, Eye, Flame, TrendingUp, Shield, Activity, Award, DollarSign, Clock, User, Feather, Filter } from 'lucide-react'

export function formatNewsDate(dateStr) {
  if (!dateStr) return ''
  if (typeof dateStr === 'string' && (dateStr.includes('de') || dateStr.includes('ago'))) {
    return dateStr
  }
  const parsed = new Date(dateStr)
  if (isNaN(parsed.getTime())) {
    return dateStr
  }
  return parsed.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })
}

/**
 * Periodistas deportivos oficiales del Racing de Oslo
 */
export function getNewsJournalist(authorName, category = '') {
  const author = (authorName || '').toLowerCase()
  const cat = (category || '').toLowerCase()

  if (author.includes('fabrizio') || (!authorName && (cat.includes('rumor') || cat.includes('rival') || cat.includes('mercado')))) {
    return { 
      name: 'Fabrizio Oslomano', 
      role: 'Especialista en Fichajes & Mercado', 
      tag: '✍️ Here We Go Oslo!',
      color: 'text-amber-300',
      badgeBg: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
      activeBg: 'bg-amber-500 text-black border-amber-300 font-bold shadow-[0_0_15px_rgba(245,158,11,0.5)]'
    }
  }
  if (author.includes('julio') || (!authorName && (cat.includes('táctica') || cat.includes('previa') || cat.includes('mvp') || cat.includes('scout') || cat.includes('equipo')))) {
    return { 
      name: 'Julio Osldini', 
      role: 'Analista Táctico & Scouting', 
      tag: '📋 Pizarra Táctica',
      color: 'text-cyan-300',
      badgeBg: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40',
      activeBg: 'bg-cyan-500 text-black border-cyan-300 font-bold shadow-[0_0_15px_rgba(6,182,212,0.5)]'
    }
  }
  if (author.includes('pedroslo') || author.includes('josep') || (!authorName && (cat.includes('crónica') || cat.includes('exclusiva')))) {
    return { 
      name: 'Josep Pedroslo', 
      role: 'Redactor Jefe & Exclusivas', 
      tag: '🔥 ¡Tic, Tac, Oslo!',
      color: 'text-yellow-300',
      badgeBg: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40',
      activeBg: 'bg-yellow-500 text-black border-yellow-300 font-bold shadow-[0_0_15px_rgba(234,179,8,0.5)]'
    }
  }
  return { 
    name: 'Mateo Oslomany', 
    role: 'Director Deportivo', 
    tag: '💼 Secretaría Técnica',
    color: 'text-emerald-300',
    badgeBg: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
    activeBg: 'bg-emerald-600 text-white border-emerald-400 font-bold shadow-[0_0_15px_rgba(16,185,129,0.5)]'
  }
}

/**
 * Escala cromática y estilo de insignias tipo prensa deportiva (Diario MARCA / LaLiga)
 */
export function getCategoryBadgeStyle(category) {
  const cat = (category || '').toLowerCase()
  if (cat.includes('fichaje') || cat.includes('signing')) {
    return {
      bg: 'bg-emerald-950/90 text-emerald-300 border-emerald-500/50',
      borderLeft: 'border-l-4 border-emerald-500',
      pill: 'bg-emerald-600 text-white font-black tracking-wider uppercase shadow-[0_0_12px_rgba(16,185,129,0.4)]',
      btnActive: 'bg-emerald-600 text-white border-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.5)]',
      icon: TrendingUp
    }
  }
  if (cat.includes('venta') || cat.includes('traspaso') || cat.includes('sale')) {
    return {
      bg: 'bg-rose-950/90 text-rose-300 border-rose-500/50',
      borderLeft: 'border-l-4 border-rose-500',
      pill: 'bg-rose-600 text-white font-black tracking-wider uppercase shadow-[0_0_12px_rgba(244,63,94,0.4)]',
      btnActive: 'bg-rose-600 text-white border-rose-400 shadow-[0_0_15px_rgba(244,63,94,0.5)]',
      icon: Shield
    }
  }
  if (cat.includes('rival') || cat.includes('mercado')) {
    return {
      bg: 'bg-amber-950/90 text-amber-300 border-amber-500/50',
      borderLeft: 'border-l-4 border-amber-500',
      pill: 'bg-amber-500 text-black font-black tracking-wider uppercase shadow-[0_0_12px_rgba(245,158,11,0.4)]',
      btnActive: 'bg-amber-500 text-black font-bold border-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.5)]',
      icon: Flame
    }
  }
  if (cat.includes('finanza') || cat.includes('econom')) {
    return {
      bg: 'bg-yellow-950/90 text-yellow-300 border-yellow-500/50',
      borderLeft: 'border-l-4 border-yellow-500',
      pill: 'bg-yellow-500 text-black font-black tracking-wider uppercase shadow-[0_0_12px_rgba(234,179,8,0.4)]',
      btnActive: 'bg-yellow-500 text-black font-bold border-yellow-400 shadow-[0_0_15px_rgba(234,179,8,0.5)]',
      icon: DollarSign
    }
  }
  if (cat.includes('mvp')) {
    return {
      bg: 'bg-amber-900/90 text-amber-200 border-amber-400/50',
      borderLeft: 'border-l-4 border-amber-400',
      pill: 'bg-gradient-to-r from-amber-400 to-yellow-500 text-black font-black tracking-wider uppercase shadow-[0_0_15px_rgba(251,191,36,0.6)]',
      btnActive: 'bg-gradient-to-r from-amber-400 to-yellow-500 text-black font-black border-amber-300 shadow-md',
      icon: Award
    }
  }
  if (cat.includes('enfermer') || cat.includes('médic') || cat.includes('medical')) {
    return {
      bg: 'bg-red-950/90 text-red-300 border-red-500/50',
      borderLeft: 'border-l-4 border-red-500',
      pill: 'bg-red-600 text-white font-black tracking-wider uppercase shadow-[0_0_12px_rgba(239,68,68,0.4)]',
      btnActive: 'bg-red-600 text-white border-red-400 shadow-[0_0_15px_rgba(239,68,68,0.5)]',
      icon: Activity
    }
  }
  if (cat.includes('rumor')) {
    return {
      bg: 'bg-purple-950/90 text-purple-300 border-purple-500/50',
      borderLeft: 'border-l-4 border-purple-500',
      pill: 'bg-purple-600 text-white font-black tracking-wider uppercase shadow-[0_0_12px_rgba(168,85,247,0.4)]',
      btnActive: 'bg-purple-600 text-white border-purple-400 shadow-[0_0_15px_rgba(168,85,247,0.5)]',
      icon: Flame
    }
  }
  return {
    bg: 'bg-forest-dark text-cream border-forest-light/40 shadow-md',
    borderLeft: 'border-l-4 border-forest-light',
    pill: 'bg-forest text-cream font-black tracking-wider uppercase border border-forest-light/40 shadow-sm',
    btnActive: 'bg-forest text-cream border-forest-light shadow-md',
    icon: Shield
  }
}

const JOURNALISTS = [
  { id: 'ALL', name: 'Todas las Firmas', role: 'Redacción Completa', tag: 'Diario de Oslo' },
  { id: 'Mateo Oslomany', name: 'Mateo Oslomany', role: 'Director Deportivo', tag: '💼 Finanzas & Club' },
  { id: 'Fabrizio Oslomano', name: 'Fabrizio Oslomano', role: 'Mercado & Fichajes', tag: '✍️ Here We Go!' },
  { id: 'Julio Osldini', name: 'Julio Osldini', role: 'Táctica & Scouting', tag: '📋 Pizarra Táctica' },
  { id: 'Josep Pedroslo', name: 'Josep Pedroslo', role: 'Redactor Jefe', tag: '🔥 Exclusivas' }
]

export default function Noticias() {
  const [selectedNews, setSelectedNews] = useState(null)
  const [filterCategory, setFilterCategory] = useState('ALL')
  const [filterAuthor, setFilterAuthor] = useState('ALL')

  const categories = ['ALL', 'Fichajes', 'Mercado', 'Rivales', 'Competición', 'Ventas', 'Finanzas', 'Rumores']

  // Filtrado compuesto por Categoría y Periodista Autor
  const filteredNews = newsData.filter(n => {
    // 1. Filtro por Periodista
    if (filterAuthor !== 'ALL') {
      const j = getNewsJournalist(n.author, n.category)
      if (j.name.toLowerCase() !== filterAuthor.toLowerCase()) return false
    }

    // 2. Filtro por Categoría
    if (filterCategory !== 'ALL') {
      const cat = (n.category || '').toLowerCase()
      const target = filterCategory.toLowerCase()
      const title = (n.title || '').toLowerCase()
      const matches = cat.includes(target) || 
        (target === 'rivales' && (cat.includes('rival') || title.includes('táctico') || title.includes('scouting'))) || 
        (target === 'fichajes' && (cat.includes('fichaj') || title.includes('fichaje') || title.includes('oficial') || title.includes('nuevo jugador'))) ||
        (target === 'mercado' && (cat.includes('mercado') || title.includes('mercado') || cat.includes('fichaje')))
      if (!matches) return false
    }

    return true
  })

  const featuredNews = filteredNews.length > 0 ? filteredNews[0] : null
  const secondaryNews = filteredNews.slice(1)
  const featuredJournalist = featuredNews ? getNewsJournalist(featuredNews.author, featuredNews.category) : null

  return (
    <div className="min-h-screen bg-[#0d1611] text-[#f4efe6]">
      {/* 🔴 BREAKING NEWS TICKER (ESTILO DIARIO MARCA) */}
      <div className="bg-[#12241b] border-b border-[#2d5a42]/50 px-4 py-2 text-xs font-mono flex items-center gap-3 overflow-hidden shadow-inner">
        <div className="flex items-center gap-1.5 bg-red-600 text-white text-[10px] font-black px-2.5 py-0.5 rounded-sm uppercase tracking-widest animate-pulse shrink-0">
          <span className="inline-block w-2 h-2 rounded-full bg-white animate-ping"></span>
          Última Hora
        </div>
        <div className="flex items-center gap-6 whitespace-nowrap text-[#d4ceb8] font-semibold text-xs overflow-hidden">
          <span>✍️ <b>FABRIZIO OSLOMANO:</b> <i>"Here we go Oslo! Saldo de 19.76M€ y 10 ofertas prioritarias activas."</i></span>
          <span className="text-forest-light">•</span>
          <span>📋 <b>JULIO OSLDINI:</b> Pizarra táctica lista para la próxima jornada liguera.</span>
          <span className="text-forest-light">•</span>
          <span>🔥 <b>JOSEP PEDROSLO:</b> <i>"¡Exclusinda en el Oslo Arena! Cuentas 100% saneadas y deuda cero."</i></span>
          <span className="text-forest-light">•</span>
          <span>💼 <b>MATEO OSLOMANY:</b> <i>"Balance económico impecable con 61.07M€ de patrimonio."</i></span>
        </div>
      </div>

      <div className="container mx-auto px-4 sm:px-6 py-8 max-w-7xl">
        {/* HEADER PRINCIPAL */}
        <div className="mb-6 border-b-2 border-[#2d5a42] pb-6 flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-mono font-bold tracking-widest text-[#d4af37] uppercase mb-1">
              <Shield size={14} className="text-[#d4af37]" />
              Diario Oficial · Segunda Regional Cántabra · Temporada 26/27
            </div>
            <h1 className="text-4xl md:text-6xl font-display font-black tracking-tight text-white uppercase">
              NOTICIAS & MERCADO
            </h1>
            <p className="text-sm text-[#a3a092] font-sans mt-1">
              Crónica deportiva, exclusivas de mercado, partes médicos e informes firmados por nuestro equipo periodístico.
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs font-mono text-[#a3a092] bg-black/40 px-3 py-2 rounded-sm border border-[#2d5a42]/40">
            <Feather size={14} className="text-[#d4af37]" />
            <span>Filtra por <b>Columnista</b> o <b>Categoría</b></span>
          </div>
        </div>

        {/* ✍️ EQUIPO DE REDACCIÓN OFICIAL (FILTROS INTERACTIVOS POR PERIODISTA) */}
        <div className="mb-6 bg-[#12241b] p-3 rounded-sm border border-[#2d5a42]/60 shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-mono font-bold text-[#d4af37] uppercase tracking-wider flex items-center gap-1.5">
              <Feather size={13} />
              Firmas & Columnistas Oficiales
            </span>
            {filterAuthor !== 'ALL' && (
              <button
                onClick={() => setFilterAuthor('ALL')}
                className="text-[10px] font-bold text-amber-300 hover:text-white uppercase flex items-center gap-1 bg-amber-950/60 px-2 py-0.5 rounded-sm border border-amber-500/40 cursor-pointer"
              >
                Limpiar filtro de autor ✕
              </button>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            {JOURNALISTS.map(j => {
              const isSelected = filterAuthor === j.id
              const meta = getNewsJournalist(j.id)
              const count = j.id === 'ALL' 
                ? newsData.length 
                : newsData.filter(n => getNewsJournalist(n.author, n.category).name === j.name).length

              return (
                <button
                  key={j.id}
                  onClick={() => setFilterAuthor(j.id)}
                  className={'flex items-center gap-2 px-3 py-1.5 rounded-sm border text-xs font-mono transition-all cursor-pointer ' + (
                    isSelected
                      ? (j.id === 'ALL' ? 'bg-[#d4af37] text-black border-amber-300 font-bold shadow-md' : meta.activeBg)
                      : (j.id === 'ALL' ? 'bg-black/50 text-[#d4ceb8] border-[#2d5a42]/40 hover:bg-white/10' : meta.badgeBg + ' hover:opacity-80')
                  )}
                >
                  <Feather size={12} />
                  <span className="font-bold">{j.name}</span>
                  <span className="text-[10px] opacity-75">({j.tag})</span>
                  <span className="bg-black/40 text-[10px] px-1.5 py-0.2 rounded-full font-mono">{count}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* BARRA DE CATEGORÍAS */}
        <div className="flex flex-wrap gap-2 mb-8 bg-[#12241b] p-2 rounded-sm border border-[#2d5a42]/40 shadow-lg">
          {categories.map(cat => {
            const badgeStyle = getCategoryBadgeStyle(cat)
            const isSelected = filterCategory === cat
            return (
              <button
                key={cat}
                onClick={() => setFilterCategory(cat)}
                className={'px-4 py-2 text-xs font-black tracking-wider uppercase transition-all rounded-sm border cursor-pointer ' + (
                  isSelected
                    ? cat === 'ALL'
                      ? 'bg-[#d4af37] text-black border-amber-300 shadow-[0_0_15px_rgba(212,175,55,0.4)]'
                      : badgeStyle.btnActive
                    : 'bg-black/40 text-[#d4ceb8] hover:bg-white/10 hover:text-white border-[#2d5a42]/30'
                )}
              >
                {cat === 'ALL' ? '📰 TODAS LAS NOTICIAS' : cat}
              </button>
            )
          })}
        </div>

        {/* SI NO HAY NOTICIAS TRAS EL FILTRADO */}
        {filteredNews.length === 0 && (
          <div className="bg-[#12241b] border border-[#2d5a42] p-12 text-center rounded-sm my-8 space-y-4">
            <Filter size={32} className="mx-auto text-[#d4af37]" />
            <h3 className="text-xl font-bold text-white uppercase">No hay publicaciones con estos filtros</h3>
            <p className="text-xs text-[#a3a092] font-mono">
              Prueba a seleccionar otro columnista o categoría.
            </p>
            <button
              onClick={() => { setFilterAuthor('ALL'); setFilterCategory('ALL'); }}
              className="bg-[#d4af37] text-black font-bold text-xs uppercase px-4 py-2 rounded-sm hover:bg-amber-300 transition-colors cursor-pointer"
            >
              Restablecer todos los filtros
            </button>
          </div>
        )}

        {/* 🌟 NOTICIA PRINCIPAL DE PORTADA (HERO BANNER) */}
        {featuredNews && filterCategory === 'ALL' && filterAuthor === 'ALL' && (
          <div className="mb-12">
            <div
              onClick={() => setSelectedNews(featuredNews)}
              className="bg-[#12241b] border-2 border-[#2d5a42] rounded-sm overflow-hidden group hover:border-[#d4af37] transition-all duration-300 cursor-pointer shadow-2xl grid grid-cols-1 lg:grid-cols-12 gap-0 relative"
            >
              {/* Imagen Hero 16:9 */}
              <div className="lg:col-span-7 h-72 sm:h-96 lg:h-[480px] overflow-hidden relative bg-black flex items-center justify-center">
                <img
                  src={featuredNews.image}
                  alt={featuredNews.title}
                  className="w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-700"
                  onError={(e) => { e.target.src = '/media/crest.jpg' }}
                />
                <div className="absolute top-4 left-4 flex gap-2">
                  <span className="bg-red-600 text-white font-black text-xs px-3 py-1 uppercase tracking-widest shadow-md">
                    EXCLUSIVA
                  </span>
                  <span className={'text-xs font-black px-3 py-1 uppercase tracking-widest rounded-sm ' + getCategoryBadgeStyle(featuredNews.category).pill}>
                    {featuredNews.category || 'OFICIAL'}
                  </span>
                </div>
              </div>

              {/* Contenido Hero */}
              <div className="lg:col-span-5 p-6 sm:p-8 flex flex-col justify-between bg-gradient-to-b from-[#162e22] to-[#12241b]">
                <div className="space-y-4">
                  <div className="flex items-center gap-3 text-xs font-mono text-[#d4af37]">
                    <Calendar size={14} />
                    <span>{formatNewsDate(featuredNews.date)}</span>
                    <span className="text-[#2d5a42]">•</span>
                    <Clock size={14} />
                    <span>2 min lectura</span>
                  </div>

                  <h2 className="text-2xl sm:text-4xl font-display font-black text-white group-hover:text-[#d4af37] transition-colors leading-tight">
                    {featuredNews.title}
                  </h2>

                  <p className="text-[#d4ceb8] text-sm sm:text-base leading-relaxed line-clamp-4 font-sans">
                    {featuredNews.excerpt || featuredNews.summary}
                  </p>
                </div>

                <div className="pt-6 mt-6 border-t border-[#2d5a42]/50 flex items-center justify-between">
                  <div className="flex items-center gap-2.5 text-xs font-mono">
                    <Feather size={15} className={featuredJournalist.color} />
                    <div>
                      <span className="text-[#a3a092] block text-[10px]">{featuredJournalist.role}</span>
                      <span className="font-bold text-white tracking-wide">{featuredJournalist.name}</span>
                    </div>
                  </div>
                  <span className="text-xs font-black uppercase text-[#d4af37] group-hover:translate-x-1 transition-transform flex items-center gap-1">
                    Leer crónica completa &rarr;
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 📰 GRID DE NOTICIAS EDITORIALES */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {(filterCategory === 'ALL' && filterAuthor === 'ALL' ? secondaryNews : filteredNews).map(news => {
            const badgeStyle = getCategoryBadgeStyle(news.category)
            const journalist = getNewsJournalist(news.author, news.category)

            return (
              <article
                key={news.id}
                onClick={() => setSelectedNews(news)}
                className={'bg-[#12241b]/90 border border-[#2d5a42]/40 rounded-sm overflow-hidden group hover:border-[#d4af37] transition-all duration-300 cursor-pointer flex flex-col justify-between shadow-xl ' + badgeStyle.borderLeft}
              >
                <div>
                  {/* Container Imagen */}
                  <div className="h-52 overflow-hidden relative bg-black flex items-center justify-center">
                    <img
                      src={news.image}
                      alt={news.title}
                      className="w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-500"
                      onError={(e) => { e.target.src = '/media/crest.jpg' }}
                    />
                    <div className="absolute top-3 left-3">
                      <span className={'text-[10px] font-black px-2.5 py-1 uppercase tracking-wider rounded-sm ' + badgeStyle.pill}>
                        {news.category || 'ACTUALIDAD'}
                      </span>
                    </div>
                    <div className="absolute bottom-3 right-3 bg-black/85 px-2 py-0.5 rounded-sm border border-white/20 text-[10px] font-mono text-white font-bold flex items-center gap-1">
                      <Feather size={10} className={journalist.color} />
                      {journalist.tag}
                    </div>
                  </div>

                  {/* Cuerpo Noticia */}
                  <div className="p-5 space-y-2.5">
                    <div className="flex items-center gap-2 text-xs text-[#d4af37] font-mono font-semibold">
                      <Calendar size={13} />
                      <span>{formatNewsDate(news.date)}</span>
                    </div>

                    <h3 className="text-lg sm:text-xl font-display font-black text-white group-hover:text-[#d4af37] transition-colors leading-snug">
                      {news.title}
                    </h3>

                    <p className="text-[#a3a092] text-xs sm:text-sm line-clamp-3 leading-relaxed">
                      {news.excerpt || news.summary}
                    </p>
                  </div>
                </div>

                {/* Footer Tarjeta con Firma del Periodista */}
                <div className="p-5 pt-0 border-t border-[#2d5a42]/20 mt-4 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5 text-xs text-[#a3a092] font-mono truncate max-w-[190px]">
                    <Feather size={12} className={journalist.color} />
                    <span className="truncate"><b>{journalist.name}</b></span>
                  </div>
                  <span className="font-bold text-forest-light group-hover:text-[#d4af37] transition-colors uppercase flex items-center gap-1 shrink-0">
                    <Eye size={13} /> Ver &rarr;
                  </span>
                </div>
              </article>
            )
          })}
        </div>
      </div>

      {/* 📖 MODAL DE LECTURA COMPLETA CON FIRMA OFICIAL */}
      {selectedNews && (() => {
        const modalBadgeStyle = getCategoryBadgeStyle(selectedNews.category)
        const modalJournalist = getNewsJournalist(selectedNews.author, selectedNews.category)

        return (
          <div className="fixed inset-0 z-50 bg-black/95 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 animate-fade-in">
            <div className="bg-[#12241b] border-2 border-[#2d5a42] max-w-4xl w-full rounded-sm overflow-hidden relative max-h-[92vh] flex flex-col shadow-2xl">
              {/* Botón Cerrar */}
              <button
                onClick={() => setSelectedNews(null)}
                className="absolute top-4 right-4 z-30 bg-black/80 p-2.5 rounded-full hover:bg-red-600 text-white transition-colors border border-white/20 focus:outline-none shadow-lg cursor-pointer"
                aria-label="Cerrar modal"
              >
                <X size={20} />
              </button>

              {/* Contenedor con Scroll */}
              <div className="overflow-y-auto p-6 sm:p-8 space-y-6">
                {/* Imagen en Alta Resolución */}
                <div className="w-full bg-black rounded-sm border border-[#2d5a42] overflow-hidden flex items-center justify-center p-1 shadow-2xl">
                  <img
                    src={selectedNews.image}
                    alt={selectedNews.title}
                    className="w-full h-auto max-h-[65vh] object-contain rounded-sm"
                    onError={(e) => { e.target.src = '/media/crest.jpg' }}
                  />
                </div>

                {/* Metadatos y Titular */}
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#2d5a42]/40 pb-4">
                    <div className="flex items-center gap-2">
                      <span className={'text-xs font-black px-3 py-1 uppercase tracking-wider rounded-sm ' + modalBadgeStyle.pill}>
                        {selectedNews.category || 'COMUNICADO'}
                      </span>
                      <span className="text-xs text-[#d4af37] font-mono flex items-center gap-1.5 ml-2">
                        <Calendar size={14} />
                        {formatNewsDate(selectedNews.date)}
                      </span>
                    </div>

                    {/* Tarjeta de Firma del Periodista */}
                    <div className="flex items-center gap-2 bg-black/50 border border-[#2d5a42] px-3 py-1.5 rounded-sm">
                      <Feather size={14} className={modalJournalist.color} />
                      <div className="text-xs font-mono">
                        <span className="text-[#a3a092] block text-[10px]">{modalJournalist.role}</span>
                        <span className="font-bold text-white">{modalJournalist.name}</span>
                      </div>
                    </div>
                  </div>

                  <h2 className="text-2xl sm:text-4xl font-display font-black text-white leading-tight">
                    {selectedNews.title}
                  </h2>

                  {/* Cuerpo del Artículo */}
                  <div className="pt-2 text-[#f4efe6] text-sm sm:text-base leading-relaxed whitespace-pre-wrap font-sans space-y-4 bg-black/30 p-6 rounded-sm border border-[#2d5a42]/30">
                    {(selectedNews.content || selectedNews.excerpt || selectedNews.summary || '').split('\\n').join('\n')}
                  </div>

                  {/* Footer Oficial */}
                  <div className="pt-4 border-t border-[#2d5a42]/40 flex items-center justify-between text-xs text-[#a3a092] font-mono">
                    <span>© Racing de Oslo · Redacción Diario Oficial</span>
                    <span className="text-[#d4af37]">Firmado por {modalJournalist.name} ({modalJournalist.tag})</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
