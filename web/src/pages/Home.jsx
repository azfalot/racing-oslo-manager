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
    <div className="space-y-12">
      {/* HERO SECTION */}
      <section className="relative w-full h-[65vh] md:h-[70vh] bg-black overflow-hidden flex items-center justify-center">
        <div className="absolute inset-0 z-0">
          <img src="/media/poster_j1.jpg" alt="Racing de Oslo" className="w-full h-full object-cover opacity-40 blur-[2px]" />
          <div className="absolute inset-0 bg-gradient-to-t from-clubBlack via-transparent to-black/70"></div>
        </div>
        <div className="relative z-10 text-center px-4 max-w-4xl mx-auto">
          <span className="text-forest-light font-bold tracking-[0.3em] text-xs sm:text-sm mb-4 block uppercase">
            SEGUNDA REGIONAL CÁNTABRA · EST. 2018
          </span>
          <h2 className="text-4xl sm:text-6xl md:text-7xl font-display font-bold uppercase mb-6 leading-tight text-white drop-shadow-2xl">
            INSTINTO · INTELIGENCIA<br /><span className="text-forest-light">FAMILIA RACING</span>
          </h2>
          <div className="flex flex-wrap justify-center gap-4">
            <Link to="/alineacion" className="inline-flex items-center gap-2 bg-forest text-cream px-8 py-3 rounded-sm font-bold tracking-wider hover:bg-forest-light transition-all shadow-lg">
              VER ONCE TITULAR <ChevronRight size={20} />
            </Link>
            <Link to="/noticias" className="inline-flex items-center gap-2 bg-black/60 border border-forest/40 text-cream px-6 py-3 rounded-sm font-bold tracking-wider hover:bg-white/10 transition-all">
              COMUNICADOS OFICIALES
            </Link>
          </div>
        </div>
      </section>

      {/* MATCH INFO BAR */}
      <section className="border-y border-forest/30 bg-forest-dark/40 py-4">
        <div className="container mx-auto px-6 flex flex-col md:flex-row justify-center items-center gap-4 md:gap-16 text-xs sm:text-sm font-semibold tracking-wider">
          <div className="flex items-center gap-3">
            <Trophy size={18} className="text-forest-light" />
            <span>{matchData.nextMatch.competition}</span>
          </div>
          <div className="hidden md:block w-1 h-1 bg-cream/30 rounded-full"></div>
          <div className="flex items-center gap-3">
            <span className="text-forest-light font-bold">RACING DE OSLO</span>
            <span>vs</span>
            <span>{matchData.nextMatch.opponent}</span>
          </div>
          <div className="hidden md:block w-1 h-1 bg-cream/30 rounded-full"></div>
          <div className="flex items-center gap-3 text-cream/70">
            <span>{matchData.nextMatch.venue} • {matchData.nextMatch.date}</span>
          </div>
        </div>
      </section>

      {/* INTERACTIVE NEWS CAROUSEL & SIDEBAR */}
      <section className="container mx-auto px-6 py-6 grid grid-cols-1 lg:grid-cols-3 gap-12">
        {/* CARROUSEL DE NOTICIAS DE PORTADA */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between border-b border-forest/30 pb-4">
            <h3 className="text-2xl font-display font-bold flex items-center gap-3">
              <span className="w-3 h-3 rounded-full bg-forest-light animate-pulse"></span>
              ACTUALIDAD DEL CLUB
            </h3>
            <Link to="/noticias" className="text-xs text-forest-light font-bold tracking-widest hover:text-cream transition-colors">
              VER TODAS ({newsData.length}) &rarr;
            </Link>
          </div>

          {/* Carousel Main Slide Container */}
          {featuredNews.length > 0 && (
            <div className="relative rounded-sm overflow-hidden bg-forest-dark/20 border border-forest/30 shadow-2xl group">
              <div className="relative h-[380px] sm:h-[460px] w-full overflow-hidden bg-black/60 flex items-center justify-center">
                <img
                  src={featuredNews[currentSlide].image}
                  alt={featuredNews[currentSlide].title}
                  className="w-full h-full object-contain sm:object-cover transition-all duration-700"
                  onError={(e) => { e.target.src = '/media/crest.jpg' }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-transparent"></div>
              </div>

              {/* Navigation Arrows */}
              {featuredNews.length > 1 && (
                <>
                  <button
                    onClick={prevSlide}
                    className="absolute left-4 top-1/2 -translate-y-1/2 bg-black/70 p-3 rounded-full text-cream hover:bg-forest transition-colors z-20 focus:outline-none"
                    aria-label="Noticia anterior"
                  >
                    <ChevronLeft size={22} />
                  </button>
                  <button
                    onClick={nextSlide}
                    className="absolute right-4 top-1/2 -translate-y-1/2 bg-black/70 p-3 rounded-full text-cream hover:bg-forest transition-colors z-20 focus:outline-none"
                    aria-label="Noticia siguiente"
                  >
                    <ChevronRight size={22} />
                  </button>
                </>
              )}

              {/* News Info Overlay */}
              <div className="absolute bottom-0 left-0 right-0 p-6 sm:p-8 space-y-3 z-10">
                <div className="flex items-center gap-3">
                  <span className="bg-forest text-cream text-[10px] sm:text-xs font-bold px-3 py-1 uppercase tracking-widest rounded-sm shadow-md">
                    {featuredNews[currentSlide].category}
                  </span>
                  <span className="text-xs text-cream/70 flex items-center gap-1 font-mono">
                    <Calendar size={13} className="text-forest-light" />
                    {formatNewsDate(featuredNews[currentSlide].date)}
                  </span>
                </div>
                <h4 className="text-2xl sm:text-3xl font-display font-bold text-white leading-tight">
                  {featuredNews[currentSlide].title}
                </h4>
                <p className="text-xs sm:text-sm text-cream-dark line-clamp-2 leading-relaxed">
                  {featuredNews[currentSlide].excerpt || featuredNews[currentSlide].summary}
                </p>
                <Link
                  to="/noticias"
                  className="inline-flex items-center gap-2 text-xs font-bold tracking-widest text-forest-light hover:text-white transition-colors pt-2 uppercase"
                >
                  LEER COMUNICADO COMPLETO &rarr;
                </Link>
              </div>

              {/* Dots Indicators */}
              {featuredNews.length > 1 && (
                <div className="absolute top-4 right-4 flex gap-2 z-20 bg-black/60 px-3 py-1.5 rounded-full backdrop-blur-sm">
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
          )}
        </div>

        {/* SIDEBAR: PLANTILLA & CLASIFICACIÓN */}
        <div className="space-y-8">
          <div>
            <div className="flex items-center gap-3 mb-6 border-b border-forest/30 pb-4">
              <TrendingUp className="text-forest-light" />
              <h3 className="text-xl font-display font-bold">ESTADO CLUB</h3>
            </div>
            <div className="bg-forest-dark/20 border border-forest/30 p-6 rounded-sm space-y-4">
              <div>
                <p className="text-xs text-cream/60 uppercase tracking-widest">Posición Actual</p>
                <p className="text-4xl font-display font-bold text-white">{matchData.standingsInfo.position}º</p>
              </div>
              <div className="pt-4 border-t border-forest/20 flex justify-between items-center text-sm font-semibold">
                <span className="text-cream/60">Puntos Acumulados:</span>
                <span className="text-forest-light font-bold">{matchData.standingsInfo.points} pts</span>
              </div>
            </div>
          </div>

          <div>
            <div className="flex items-center gap-3 mb-6 border-b border-forest/30 pb-4">
              <Users className="text-forest-light" />
              <h3 className="text-xl font-display font-bold">ONCE TITULAR</h3>
            </div>
            <ul className="space-y-2.5">
              {squadData.players.filter(p => p.isStarter).slice(0, 7).map(p => (
                <li key={p.id} className="flex items-center justify-between bg-black/50 p-3 rounded-sm border-l-2 border-forest hover:border-forest-light transition-all">
                  <div className="flex items-center gap-3 overflow-hidden">
                    <img src={p.image} alt={p.name} className="w-8 h-8 rounded-full bg-forest-dark/50 object-cover flex-shrink-0" onError={(e) => { e.target.src = '/media/crest.jpg' }} />
                    <span className="font-bold text-xs truncate">{p.name}</span>
                  </div>
                  <span className="text-[9px] font-bold uppercase tracking-wider text-forest-light bg-forest/20 px-2 py-0.5 rounded-sm border border-forest/30">{p.position}</span>
                </li>
              ))}
            </ul>
            <Link to="/alineacion" className="block text-center mt-4 text-xs font-bold text-cream/70 hover:text-white transition-colors">
              Ver Alineación Completa &rarr;
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
