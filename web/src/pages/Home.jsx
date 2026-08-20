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

  return (
    <div className="space-y-4 pb-12">
      {/* SLEEK EPIC HERO BANNER (Altura optimizada a 260px para ver las noticias en pantalla completa) */}
      <section className="relative w-full h-[220px] sm:h-[260px] md:h-[280px] bg-black overflow-hidden flex items-center justify-center">
        <div className="absolute inset-0 z-0">
          <img
            src="/media/poster_j1.jpg"
            alt="Racing de Oslo"
            className="w-full h-full object-cover opacity-50 blur-[1px]"
            onError={(e) => { e.target.src = '/media/crest.jpg' }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-clubBlack via-black/30 to-black/60"></div>
        </div>
        <div className="relative z-10 text-center px-4 max-w-4xl mx-auto space-y-2 sm:space-y-3">
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

      {/* PORTADA & CARROUSEL DE NOTICIAS (VISIBLE 100% EN PRIMERA PANTALLA) */}
      <section className="container mx-auto px-6 grid grid-cols-1 lg:grid-cols-3 gap-6 pt-2">
        {/* CARROUSEL DE NOTICIAS PRINCIPAL */}
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
            <div className="relative rounded-sm overflow-hidden bg-forest-dark/20 border border-forest/30 shadow-2xl group">
              <div className="relative h-[280px] sm:h-[340px] md:h-[360px] w-full overflow-hidden bg-black flex items-center justify-center">
                <img
                  src={featuredNews[currentSlide].image}
                  alt={featuredNews[currentSlide].title}
                  className="w-full h-full object-cover transform group-hover:scale-105 transition-all duration-700"
                  onError={(e) => { e.target.src = '/media/crest.jpg' }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-transparent"></div>
              </div>

              {/* Navigation Arrows */}
              {featuredNews.length > 1 && (
                <>
                  <button
                    onClick={prevSlide}
                    className="absolute left-3 top-1/2 -translate-y-1/2 bg-black/75 p-2.5 rounded-full text-cream hover:bg-forest transition-colors z-20 focus:outline-none border border-forest/30"
                    aria-label="Noticia anterior"
                  >
                    <ChevronLeft size={20} />
                  </button>
                  <button
                    onClick={nextSlide}
                    className="absolute right-3 top-1/2 -translate-y-1/2 bg-black/75 p-2.5 rounded-full text-cream hover:bg-forest transition-colors z-20 focus:outline-none border border-forest/30"
                    aria-label="Noticia siguiente"
                  >
                    <ChevronRight size={20} />
                  </button>
                </>
              )}

              {/* News Info Overlay */}
              <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-6 space-y-2 z-10">
                <div className="flex items-center gap-3">
                  <span className="bg-forest text-cream text-[10px] font-bold px-2.5 py-0.5 uppercase tracking-widest rounded-sm shadow-md border border-forest-light/40">
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
                <p className="text-xs text-cream-dark line-clamp-2 leading-relaxed">
                  {featuredNews[currentSlide].excerpt || featuredNews[currentSlide].summary}
                </p>
                <Link
                  to="/noticias"
                  className="inline-flex items-center gap-1.5 text-xs font-bold tracking-widest text-forest-light hover:text-white transition-colors pt-1 uppercase"
                >
                  LEER COMUNICADO COMPLETO &rarr;
                </Link>
              </div>

              {/* Dots Indicators */}
              {featuredNews.length > 1 && (
                <div className="absolute top-3 right-3 flex gap-1.5 z-20 bg-black/70 px-2.5 py-1 rounded-full backdrop-blur-sm border border-forest/30">
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
          )}
        </div>

        {/* SIDEBAR: ESTADO Y ONCE TITULAR */}
        <div className="space-y-5">
          <div>
            <div className="flex items-center gap-2 mb-2.5 border-b border-forest/30 pb-2">
              <TrendingUp size={16} className="text-forest-light" />
              <h3 className="text-lg font-display font-bold">ESTADO CLUB</h3>
            </div>
            <div className="bg-forest-dark/20 border border-forest/30 p-4 rounded-sm space-y-3">
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

          <div>
            <div className="flex items-center justify-between mb-2.5 border-b border-forest/30 pb-2">
              <div className="flex items-center gap-2">
                <Users size={16} className="text-forest-light" />
                <h3 className="text-lg font-display font-bold">ONCE TITULAR</h3>
              </div>
              <Link to="/alineacion" className="text-[11px] font-bold text-forest-light hover:text-white transition-colors">
                Ver XI &rarr;
              </Link>
            </div>
            <ul className="space-y-2">
              {squadData.players.filter(p => p.isStarter).slice(0, 5).map(p => (
                <li key={p.id} className="flex items-center justify-between bg-black/50 p-2 rounded-sm border-l-2 border-forest hover:border-forest-light transition-all">
                  <div className="flex items-center gap-2.5 overflow-hidden">
                    <img src={p.image} alt={p.name} className="w-7 h-7 rounded-full bg-forest-dark/50 object-cover flex-shrink-0" onError={(e) => { e.target.src = '/media/crest.jpg' }} />
                    <span className="font-bold text-xs truncate">{p.name}</span>
                  </div>
                  <span className="text-[9px] font-bold uppercase tracking-wider text-forest-light bg-forest/20 px-2 py-0.5 rounded-sm border border-forest/30">{p.position}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>
    </div>
  )
}
