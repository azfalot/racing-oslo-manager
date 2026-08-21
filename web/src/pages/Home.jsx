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
    <div className="space-y-6 pb-12">
      {/* BANNER ÉPICO DE PORTADA (Renderizado de imagen de alta fidelidad) */}
      <section className="relative w-full h-[380px] sm:h-[450px] md:h-[500px] bg-clubBlack overflow-hidden flex items-center justify-center border-b border-forest/40 shadow-2xl">
        <div className="absolute inset-0 z-0">
          <img
            src="/media/poster_j1.jpg"
            alt="Racing de Oslo"
            className="w-full h-full object-cover object-center opacity-85 filter brightness-105 contrast-105 saturate-[1.05]"
            onError={(e) => { e.target.src = '/media/crest.jpg' }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-clubBlack via-clubBlack/20 to-black/30"></div>
          <div className="absolute inset-0 bg-gradient-to-r from-forest-dark/30 via-transparent to-forest-dark/30"></div>
        </div>
        <div className="relative z-10 text-center px-4 max-w-4xl mx-auto space-y-3">
          <span className="text-forest-light font-bold tracking-[0.3em] text-xs sm:text-sm block uppercase drop-shadow">
            SEGUNDA REGIONAL CÁNTABRA · EST. 2018
          </span>
          <h2 className="text-4xl sm:text-5xl md:text-6xl font-display font-bold uppercase leading-none text-white drop-shadow-[0_10px_20px_rgba(0,0,0,0.8)] tracking-wide">
            RACING DE OSLO
          </h2>
          <div className="flex flex-wrap justify-center gap-4 pt-2">
            <Link to="/alineacion" className="inline-flex items-center gap-2 bg-cream text-clubBlack px-6 py-2.5 rounded-sm text-xs font-bold tracking-wide hover:bg-white transition-all shadow-xl hover:scale-105">
              VER ONCE TITULAR <ChevronRight size={16} />
            </Link>
            <Link to="/noticias" className="inline-flex items-center gap-2 bg-forest-dark/80 border border-forest-light/60 text-cream px-6 py-2.5 rounded-sm text-xs font-bold tracking-wide hover:bg-forest transition-all shadow-xl">
              COMUNICADOS OFICIALES
            </Link>
          </div>
        </div>
      </section>

      {/* MATCH INFO BAR */}
      <section className="border-y border-forest/40 bg-forest-dark/50 backdrop-blur-md py-3 shadow-md">
        <div className="container mx-auto px-6 flex flex-wrap justify-between items-center text-xs font-semibold tracking-wider gap-2">
          <div className="flex items-center gap-3">
            <Trophy size={18} className="text-forest-light animate-bounce" />
            <span className="text-white font-bold">{matchData.nextMatch.competition}</span>
            <span className="text-cream/40">•</span>
            <span className="text-forest-light font-bold uppercase">RACING DE OSLO</span>
            <span className="text-cream/60">vs</span>
            <span className="text-white">{matchData.nextMatch.opponent}</span>
          </div>

          <div className="flex items-center gap-4 text-cream/80 text-[11px] font-mono">
            <span>{matchData.nextMatch.venue} • {matchData.nextMatch.date}</span>
          </div>
        </div>
      </section>

      {/* MAIN CONTENT GRID */}
      <section className="container mx-auto px-6 grid grid-cols-1 lg:grid-cols-3 gap-8 pt-2">
        {/* COLUMNA IZQUIERDA: CARROUSEL CON IMAGEN COMPLETA QUE OCUPA SU ESPACIO NATURAL */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between border-b border-forest/40 pb-3">
            <h3 className="text-xl font-display font-bold flex items-center gap-2 text-white">
              <span className="w-3 h-3 rounded-full bg-forest-light animate-pulse shadow-[0_0_10px_#40805c]"></span>
              ACTUALIDAD Y NOTICIAS
            </h3>
            <Link to="/noticias" className="text-xs text-forest-light font-bold tracking-widest hover:text-cream transition-colors">
              VER TODAS ({newsData.length}) &rarr;
            </Link>
          </div>

          {/* Carousel Slide Container */}
          {featuredNews.length > 0 && (
            <div className="rounded-sm overflow-hidden border border-forest/40 shadow-2xl bg-forest-dark/30 backdrop-blur-sm group">
              {/* 1. TOP: Imagen Oficial Completa que Ocupa Todo el Espacio Natural (object-cover con altura ampliada en escritorio) */}
              <div className="relative h-[260px] sm:h-[360px] md:h-[450px] lg:h-[480px] w-full overflow-hidden bg-black flex items-center justify-center">
                <img
                  src={featuredNews[currentSlide].image}
                  alt={featuredNews[currentSlide].title}
                  className="w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-700 filter brightness-105"
                  onError={(e) => { e.target.src = '/media/crest.jpg' }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/20"></div>

                {/* Navigation Arrows */}
                {featuredNews.length > 1 && (
                  <>
                    <button
                      onClick={prevSlide}
                      className="absolute left-3 top-1/2 -translate-y-1/2 bg-black/80 p-2.5 rounded-full text-cream hover:bg-forest transition-colors z-20 focus:outline-none border border-forest/50 shadow-lg"
                      aria-label="Noticia anterior"
                    >
                      <ChevronLeft size={20} />
                    </button>
                    <button
                      onClick={nextSlide}
                      className="absolute right-3 top-1/2 -translate-y-1/2 bg-black/80 p-2.5 rounded-full text-cream hover:bg-forest transition-colors z-20 focus:outline-none border border-forest/50 shadow-lg"
                      aria-label="Noticia siguiente"
                    >
                      <ChevronRight size={20} />
                    </button>
                  </>
                )}

                {/* Dots Indicators */}
                {featuredNews.length > 1 && (
                  <div className="absolute top-3 right-3 flex gap-1.5 z-20 bg-black/80 px-3 py-1.5 rounded-full backdrop-blur-md border border-forest/40">
                    {featuredNews.map((_, idx) => (
                      <button
                        key={idx}
                        onClick={() => setCurrentSlide(idx)}
                        className={`h-2 rounded-full transition-all ${idx === currentSlide ? 'w-6 bg-forest-light' : 'w-2 bg-cream/40'}`}
                        aria-label={`Ir a la noticia ${idx + 1}`}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* 2. BOTTOM: Espacio Inferior Estructurado para el Texto Completo */}
              <div className="p-6 space-y-3 bg-forest-dark/40 border-t border-forest/30">
                <div className="flex items-center gap-3">
                  <span className="bg-forest text-cream text-[10px] font-bold px-3 py-1 uppercase tracking-widest rounded-sm border border-forest-light/40 shadow-sm">
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
                <div className="pt-2">
                  <Link
                    to="/noticias"
                    className="inline-flex items-center gap-2 text-xs font-bold tracking-widest text-forest-light hover:text-white transition-colors uppercase"
                  >
                    LEER COMUNICADO COMPLETO &rarr;
                  </Link>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* COLUMNA DERECHA: ESTADO CLUB & MINI CAMPO DE FÚTBOL (ONCE TITULAR TÁCTICO) */}
        <div className="space-y-6">
          <div>
            <div className="flex items-center gap-2 mb-3 border-b border-forest/40 pb-2.5">
              <TrendingUp size={18} className="text-forest-light" />
              <h3 className="text-lg font-display font-bold text-white">ESTADO CLUB</h3>
            </div>
            <div className="bg-forest-dark/30 border border-forest/40 p-4 rounded-sm space-y-3 shadow-lg">
              <div>
                <p className="text-[10px] text-cream/60 uppercase tracking-widest">Posición Actual</p>
                <p className="text-4xl font-display font-bold text-white">{matchData.standingsInfo.position}º</p>
              </div>
              <div className="pt-2.5 border-t border-forest/30 flex justify-between items-center text-xs font-semibold">
                <span className="text-cream/70">Puntos Acumulados:</span>
                <span className="text-forest-light font-bold">{matchData.standingsInfo.points} pts</span>
              </div>
            </div>
          </div>

          {/* MINI CAMPO DE FÚTBOL TÁCTICO PARA EL ONCE TITULAR */}
          <div>
            <div className="flex items-center justify-between mb-3 border-b border-forest/40 pb-2.5">
              <div className="flex items-center gap-2">
                <Users size={18} className="text-forest-light" />
                <h3 className="text-lg font-display font-bold text-white">ONCE TITULAR</h3>
              </div>
              <Link to="/alineacion" className="text-xs font-bold text-forest-light hover:text-white transition-colors">
                Ver XI Completo &rarr;
              </Link>
            </div>

            {/* MINI CAMPO VERDE VIBRANTE */}
            <div className="relative w-full h-[320px] bg-gradient-to-b from-forest-dark/95 via-forest/90 to-forest-dark/95 border border-forest-light/50 rounded-sm p-3 shadow-2xl flex flex-col justify-between overflow-hidden">
              {/* LÍNEAS TÁCTICAS DEL CAMPO DE FÚTBOL */}
              <div className="absolute inset-0 pointer-events-none opacity-25 border-2 border-white rounded-sm m-2">
                <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-white -translate-y-1/2"></div>
                <div className="absolute top-1/2 left-1/2 w-20 h-20 border-2 border-white rounded-full -translate-x-1/2 -translate-y-1/2"></div>
                <div className="absolute top-0 left-1/2 w-28 h-12 border-b-2 border-x-2 border-white -translate-x-1/2"></div>
                <div className="absolute bottom-0 left-1/2 w-28 h-12 border-t-2 border-x-2 border-white -translate-x-1/2"></div>
              </div>

              {/* 1. DELANTEROS */}
              <div className="relative z-10 flex justify-center gap-4 pt-1">
                {strikers.map(p => (
                  <div key={p.id} className="flex flex-col items-center">
                    <img
                      src={p.image}
                      alt={p.name}
                      className="w-8 h-8 rounded-full border-2 border-forest-light bg-black object-cover shadow-lg"
                      onError={(e) => { e.target.src = '/media/crest.jpg' }}
                    />
                    <span className="text-[9px] font-bold text-white bg-black/90 px-1.5 py-0.5 rounded-sm border border-forest/40 truncate max-w-[75px] mt-0.5 shadow-md">
                      {p.name.split(' ').pop()}
                    </span>
                  </div>
                ))}
              </div>

              {/* 2. CENTROCAMPISTAS */}
              <div className="relative z-10 flex justify-around px-1">
                {midfielders.map(p => (
                  <div key={p.id} className="flex flex-col items-center">
                    <img
                      src={p.image}
                      alt={p.name}
                      className="w-7 h-7 rounded-full border-2 border-cream bg-black object-cover shadow-md"
                      onError={(e) => { e.target.src = '/media/crest.jpg' }}
                    />
                    <span className="text-[8px] font-bold text-white bg-black/90 px-1 py-0.5 rounded-sm border border-forest/40 truncate max-w-[60px] mt-0.5 shadow-sm">
                      {p.name.split(' ').pop()}
                    </span>
                  </div>
                ))}
              </div>

              {/* 3. DEFENSAS */}
              <div className="relative z-10 flex justify-around px-2">
                {defenders.map(p => (
                  <div key={p.id} className="flex flex-col items-center">
                    <img
                      src={p.image}
                      alt={p.name}
                      className="w-7 h-7 rounded-full border-2 border-cream bg-black object-cover shadow-md"
                      onError={(e) => { e.target.src = '/media/crest.jpg' }}
                    />
                    <span className="text-[8px] font-bold text-white bg-black/90 px-1 py-0.5 rounded-sm border border-forest/40 truncate max-w-[60px] mt-0.5 shadow-sm">
                      {p.name.split(' ').pop()}
                    </span>
                  </div>
                ))}
              </div>

              {/* 4. PORTERO */}
              <div className="relative z-10 flex justify-center pb-1">
                {keeper && (
                  <div className="flex flex-col items-center">
                    <img
                      src={keeper.image}
                      alt={keeper.name}
                      className="w-8 h-8 rounded-full border-2 border-amber-400 bg-black object-cover shadow-lg"
                      onError={(e) => { e.target.src = '/media/crest.jpg' }}
                    />
                    <span className="text-[9px] font-bold text-amber-300 bg-black/90 px-1.5 py-0.5 rounded-sm border border-amber-400/40 truncate max-w-[75px] mt-0.5 shadow-md">
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
