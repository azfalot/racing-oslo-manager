import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Trophy, ChevronRight, TrendingUp, Users, ChevronLeft, Calendar } from 'lucide-react'
import squadData from '../data/squad.json'
import matchData from '../data/matches.json'
import newsData from '../data/news.json'

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

export default function Home() {
  const featuredNews = newsData.slice(0, 5)
  const [currentSlide, setCurrentSlide] = useState(0)

  // Auto-play carousel every 5 seconds
  useEffect(() => {
    if (featuredNews.length <= 1) return
    const timer = setInterval(() => {
      setCurrentSlide(prev => (prev + 1) % featuredNews.length)
    }, 5000)
    return () => clearInterval(timer)
  }, [featuredNews.length])

  const nextSlide = () => setCurrentSlide((currentSlide + 1) % featuredNews.length)
  const prevSlide = () => setCurrentSlide((currentSlide - 1 + featuredNews.length) % featuredNews.length)

  // Starters list for Mini Pitch
  const starters = squadData.players.filter(p => p.isStarter)
  const keeper = starters.find(p => (p.position || '').toLowerCase() === 'keeper') || starters[0]
  const defenders = starters.filter(p => (p.position || '').toLowerCase() === 'defender')
  const midfielders = starters.filter(p => (p.position || '').toLowerCase() === 'midfielder')
  const strikers = starters.filter(p => (p.position || '').toLowerCase() === 'striker')

  return (
    <div className="space-y-4 pb-12">
      {/* HERO BANNER */}
      <section className="relative w-full h-[220px] sm:h-[250px] md:h-[270px] bg-black overflow-hidden flex items-center justify-center">
        <div className="absolute inset-0 z-0">
          <img
            src="/media/poster_j1.jpg"
            alt="Racing de Oslo"
            className="w-full h-full object-cover opacity-50 blur-[1px]"
            onError={(e) => { e.target.src = '/media/crest.jpg' }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-clubBlack via-black/30 to-black/60"></div>
        </div>
        <div className="relative z-10 text-center px-4 max-w-4xl mx-auto space-y-2">
          <span className="text-forest-light font-bold tracking-[0.3em] text-[10px] sm:text-xs block uppercase">
            SEGUNDA REGIONAL CÁNTABRA · EST. 2018
          </span>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-display font-bold uppercase leading-none text-white drop-shadow-2xl">
            RACING DE OSLO
          </h2>
          <div className="flex flex-wrap justify-center gap-3 pt-1">
            <Link to="/alineacion" className="inline-flex items-center gap-1.5 bg-cream text-clubBlack px-5 py-2 rounded-sm text-xs font-bold tracking-wide hover:bg-white transition-all shadow-lg">
              VER ONCE TITULAR <ChevronRight size={16} />
            </Link>
            <Link to="/noticias" className="inline-flex items-center gap-1.5 bg-black/70 border border-forest/40 text-cream px-4 py-2 rounded-sm text-xs font-bold tracking-wide hover:bg-white/10 transition-all">
              COMUNICADOS OFICIALES
            </Link>
          </div>
        </div>
      </section>

      {/* COMPACT MATCH INFO BAR */}
      <section className="border-y border-forest/30 bg-forest-dark/40 py-2.5">
        <div className="container mx-auto px-6 flex flex-wrap justify-between items-center text-xs font-semibold tracking-wider gap-2">
          <div className="flex items-center gap-2.5">
            <Trophy size={16} className="text-forest-light" />
            <span>{matchData.nextMatch.competition}</span>
            <span className="text-cream/40">•</span>
            <span className="text-forest-light font-bold">RACING DE OSLO</span>
            <span>vs</span>
            <span>{matchData.nextMatch.opponent}</span>
          </div>

          <div className="flex items-center gap-4 text-cream/70 text-[11px] font-mono">
            <span>{matchData.nextMatch.venue} • {matchData.nextMatch.date}</span>
          </div>
        </div>
      </section>

      {/* MAIN CONTENT GRID */}
      <section className="container mx-auto px-6 grid grid-cols-1 lg:grid-cols-3 gap-6 pt-2">
        {/* COLUMNA IZQUIERDA: CARROUSEL DE NOTICIAS CON PANEL INFERIOR DEDICADO */}
        <div className="lg:col-span-2 space-y-3">
          <div className="flex items-center justify-between border-b border-forest/30 pb-2.5">
            <h3 className="text-lg sm:text-xl font-display font-bold flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-forest-light animate-pulse"></span>
              ACTUALIDAD Y NOTICIAS
            </h3>
            <Link to="/noticias" className="text-[11px] text-forest-light font-bold tracking-widest hover:text-cream transition-colors">
              VER TODAS ({newsData.length}) &rarr;
            </Link>
          </div>

          {/* Carousel Slide Container */}
          {featuredNews.length > 0 && (
            <div className="rounded-sm overflow-hidden border border-forest/30 shadow-2xl bg-clubBlack">
              {/* 1. TOP: Imagen Oficial Completa (Uncropped Image Area) */}
              <div className="relative h-[250px] sm:h-[280px] w-full bg-black/90 flex items-center justify-center p-2 border-b border-forest/30">
                <img
                  src={featuredNews[currentSlide].image}
                  alt={featuredNews[currentSlide].title}
                  className="w-full h-full object-contain rounded-sm"
                  onError={(e) => { e.target.src = '/media/crest.jpg' }}
                />

                {/* Navigation Arrows */}
                {featuredNews.length > 1 && (
                  <>
                    <button
                      onClick={prevSlide}
                      className="absolute left-3 top-1/2 -translate-y-1/2 bg-black/80 p-2.5 rounded-full text-cream hover:bg-forest transition-colors z-20 focus:outline-none border border-forest/40"
                      aria-label="Noticia anterior"
                    >
                      <ChevronLeft size={20} />
                    </button>
                    <button
                      onClick={nextSlide}
                      className="absolute right-3 top-1/2 -translate-y-1/2 bg-black/80 p-2.5 rounded-full text-cream hover:bg-forest transition-colors z-20 focus:outline-none border border-forest/40"
                      aria-label="Noticia siguiente"
                    >
                      <ChevronRight size={20} />
                    </button>
                  </>
                )}

                {/* Dots Indicators */}
                {featuredNews.length > 1 && (
                  <div className="absolute top-3 right-3 flex gap-1.5 z-20 bg-black/80 px-2.5 py-1 rounded-full backdrop-blur-sm border border-forest/40">
                    {featuredNews.map((_, idx) => (
                      <button
                        key={idx}
                        onClick={() => setCurrentSlide(idx)}
                        className={`h-1.5 rounded-full transition-all ${idx === currentSlide ? 'w-5 bg-forest-light' : 'w-1.5 bg-cream/40'}`}
                        aria-label={`Ir a la noticia ${idx + 1}`}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* 2. BOTTOM: Espacio Inferior Dedicado para el Texto Completo de la Noticia */}
              <div className="p-5 space-y-2.5 bg-forest-dark/15 border-t border-forest/20">
                <div className="flex items-center gap-3">
                  <span className="bg-forest text-cream text-[10px] font-bold px-2.5 py-0.5 uppercase tracking-widest rounded-sm border border-forest-light/40">
                    {featuredNews[currentSlide].category}
                  </span>
                  <span className="text-xs text-cream/70 flex items-center gap-1 font-mono">
                    <Calendar size={13} className="text-forest-light" />
                    {formatNewsDate(featuredNews[currentSlide].date)}
                  </span>
                </div>
                <h4 className="text-xl sm:text-2xl font-display font-bold text-white leading-tight">
                  {featuredNews[currentSlide].title}
                </h4>
                <p className="text-xs sm:text-sm text-cream-dark leading-relaxed">
                  {featuredNews[currentSlide].excerpt || featuredNews[currentSlide].summary}
                </p>
                <div className="pt-1">
                  <Link
                    to="/noticias"
                    className="inline-flex items-center gap-1.5 text-xs font-bold tracking-widest text-forest-light hover:text-white transition-colors uppercase"
                  >
                    LEER COMUNICADO COMPLETO &rarr;
                  </Link>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* COLUMNA DERECHA: ESTADO CLUB & MINI CAMPO DE FÚTBOL (ONCE TITULAR TÁCTICO) */}
        <div className="space-y-5">
          <div>
            <div className="flex items-center gap-2 mb-2 border-b border-forest/30 pb-2">
              <TrendingUp size={16} className="text-forest-light" />
              <h3 className="text-lg font-display font-bold">ESTADO CLUB</h3>
            </div>
            <div className="bg-forest-dark/20 border border-forest/30 p-4 rounded-sm space-y-2">
              <div>
                <p className="text-[10px] text-cream/60 uppercase tracking-widest">Posición Actual</p>
                <p className="text-3xl font-display font-bold text-white">{matchData.standingsInfo.position}º</p>
              </div>
              <div className="pt-2 border-t border-forest/20 flex justify-between items-center text-xs font-semibold">
                <span className="text-cream/60">Puntos Acumulados:</span>
                <span className="text-forest-light font-bold">{matchData.standingsInfo.points} pts</span>
              </div>
            </div>
          </div>

          {/* MINI CAMPO DE FÚTBOL TÁCTICO PARA EL ONCE TITULAR */}
          <div>
            <div className="flex items-center justify-between mb-2 border-b border-forest/30 pb-2">
              <div className="flex items-center gap-2">
                <Users size={16} className="text-forest-light" />
                <h3 className="text-lg font-display font-bold">ONCE TITULAR</h3>
              </div>
              <Link to="/alineacion" className="text-[11px] font-bold text-forest-light hover:text-white transition-colors">
                Ver XI Completo &rarr;
              </Link>
            </div>

            {/* MINI CAMPO VERDE */}
            <div className="relative w-full h-[320px] bg-gradient-to-b from-forest-dark/95 via-forest/90 to-forest-dark/95 border border-forest-light/40 rounded-sm p-3 shadow-2xl flex flex-col justify-between overflow-hidden">
              {/* LÍNEAS TÁCTICAS DEL CAMPO DE FÚTBOL */}
              <div className="absolute inset-0 pointer-events-none opacity-20 border-2 border-white rounded-sm m-2">
                {/* Línea Central */}
                <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-white -translate-y-1/2"></div>
                {/* Círculo Central */}
                <div className="absolute top-1/2 left-1/2 w-20 h-20 border-2 border-white rounded-full -translate-x-1/2 -translate-y-1/2"></div>
                {/* Área de Penalti Superior */}
                <div className="absolute top-0 left-1/2 w-28 h-12 border-b-2 border-x-2 border-white -translate-x-1/2"></div>
                {/* Área de Penalti Inferior */}
                <div className="absolute bottom-0 left-1/2 w-28 h-12 border-t-2 border-x-2 border-white -translate-x-1/2"></div>
              </div>

              {/* 1. DELANTEROS (FRENTE) */}
              <div className="relative z-10 flex justify-center gap-4 pt-1">
                {strikers.map(p => (
                  <div key={p.id} className="flex flex-col items-center">
                    <img
                      src={p.image}
                      alt={p.name}
                      className="w-8 h-8 rounded-full border-2 border-forest-light bg-black object-cover shadow-lg"
                      onError={(e) => { e.target.src = '/media/crest.jpg' }}
                    />
                    <span className="text-[9px] font-bold text-white bg-black/80 px-1.5 py-0.5 rounded-sm border border-forest/40 truncate max-w-[70px] mt-0.5 shadow-md">
                      {p.name.split(' ').pop()}
                    </span>
                  </div>
                ))}
              </div>

              {/* 2. CENTROCAMPISTAS (MEDULAR) */}
              <div className="relative z-10 flex justify-around px-1">
                {midfielders.map(p => (
                  <div key={p.id} className="flex flex-col items-center">
                    <img
                      src={p.image}
                      alt={p.name}
                      className="w-7 h-7 rounded-full border-2 border-cream bg-black object-cover shadow-md"
                      onError={(e) => { e.target.src = '/media/crest.jpg' }}
                    />
                    <span className="text-[8px] font-bold text-white bg-black/80 px-1 py-0.5 rounded-sm border border-forest/40 truncate max-w-[60px] mt-0.5 shadow-sm">
                      {p.name.split(' ').pop()}
                    </span>
                  </div>
                ))}
              </div>

              {/* 3. DEFENSAS (LÍNEA DE 4) */}
              <div className="relative z-10 flex justify-around px-2">
                {defenders.map(p => (
                  <div key={p.id} className="flex flex-col items-center">
                    <img
                      src={p.image}
                      alt={p.name}
                      className="w-7 h-7 rounded-full border-2 border-cream bg-black object-cover shadow-md"
                      onError={(e) => { e.target.src = '/media/crest.jpg' }}
                    />
                    <span className="text-[8px] font-bold text-white bg-black/80 px-1 py-0.5 rounded-sm border border-forest/40 truncate max-w-[60px] mt-0.5 shadow-sm">
                      {p.name.split(' ').pop()}
                    </span>
                  </div>
                ))}
              </div>

              {/* 4. PORTERO (META) */}
              <div className="relative z-10 flex justify-center pb-1">
                {keeper && (
                  <div className="flex flex-col items-center">
                    <img
                      src={keeper.image}
                      alt={keeper.name}
                      className="w-8 h-8 rounded-full border-2 border-amber-400 bg-black object-cover shadow-lg"
                      onError={(e) => { e.target.src = '/media/crest.jpg' }}
                    />
                    <span className="text-[9px] font-bold text-amber-300 bg-black/90 px-1.5 py-0.5 rounded-sm border border-amber-400/40 truncate max-w-[70px] mt-0.5 shadow-md">
                      {keeper.name.split(' ').pop()}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
