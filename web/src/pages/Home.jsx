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
    <div className="space-y-6 pt-4">
      {/* COMPACT MATCH INFO BAR (SLIM TOP STRIP) */}
      <section className="border-y border-forest/30 bg-forest-dark/40 py-2.5">
        <div className="container mx-auto px-6 flex flex-wrap justify-between items-center text-xs font-semibold tracking-wider gap-2">
          <div className="flex items-center gap-3">
            <Trophy size={16} className="text-forest-light" />
            <span>{matchData.nextMatch.competition}</span>
            <span className="hidden sm:inline text-cream/40">•</span>
            <span className="hidden sm:inline text-forest-light">RACING DE OSLO</span>
            <span className="hidden sm:inline">vs</span>
            <span className="hidden sm:inline">{matchData.nextMatch.opponent}</span>
          </div>

          <div className="flex items-center gap-4">
            <span className="text-cream/70 font-mono text-[11px]">{matchData.nextMatch.venue}</span>
            <Link to="/alineacion" className="inline-flex items-center gap-1 text-[11px] bg-forest text-cream px-3 py-1 rounded-sm font-bold hover:bg-forest-light transition-colors">
              XI TITULAR <ChevronRight size={14} />
            </Link>
          </div>
        </div>
      </section>

      {/* PORTADA & CARROUSEL DE NOTICIAS DE ENTRADA (AT A GLANCE / PRIMER VISTAZO) */}
      <section className="container mx-auto px-6 grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* CARROUSEL DE NOTICIAS PRINCIPAL */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between border-b border-forest/30 pb-3">
            <h3 className="text-xl font-display font-bold flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-forest-light animate-pulse"></span>
              PORTADA Y COMUNICADOS
            </h3>
            <Link to="/noticias" className="text-xs text-forest-light font-bold tracking-widest hover:text-cream transition-colors">
              VER TODAS ({newsData.length}) &rarr;
            </Link>
          </div>

          {/* Carousel Slide Container (Optimized height for single glance) */}
          {featuredNews.length > 0 && (
            <div className="relative rounded-sm overflow-hidden bg-forest-dark/20 border border-forest/30 shadow-2xl group">
              <div className="relative h-[320px] sm:h-[400px] w-full overflow-hidden bg-black/70 flex items-center justify-center">
                <img
                  src={featuredNews[currentSlide].image}
                  alt={featuredNews[currentSlide].title}
                  className="w-full h-full object-contain sm:object-cover transition-all duration-700"
                  onError={(e) => { e.target.src = '/media/crest.jpg' }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent"></div>
              </div>

              {/* Navigation Arrows */}
              {featuredNews.length > 1 && (
                <>
                  <button
                    onClick={prevSlide}
                    className="absolute left-3 top-1/2 -translate-y-1/2 bg-black/70 p-2.5 rounded-full text-cream hover:bg-forest transition-colors z-20 focus:outline-none"
                    aria-label="Noticia anterior"
                  >
                    <ChevronLeft size={20} />
                  </button>
                  <button
                    onClick={nextSlide}
                    className="absolute right-3 top-1/2 -translate-y-1/2 bg-black/70 p-3 rounded-full text-cream hover:bg-forest transition-colors z-20 focus:outline-none"
                    aria-label="Noticia siguiente"
                  >
                    <ChevronRight size={20} />
                  </button>
                </>
              )}

              {/* News Info Overlay */}
              <div className="absolute bottom-0 left-0 right-0 p-5 sm:p-6 space-y-2.5 z-10">
                <div className="flex items-center gap-3">
                  <span className="bg-forest text-cream text-[10px] font-bold px-2.5 py-0.5 uppercase tracking-widest rounded-sm shadow-md">
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
                <p className="text-xs sm:text-sm text-cream-dark line-clamp-2 leading-relaxed">
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
                <div className="absolute top-3 right-3 flex gap-1.5 z-20 bg-black/60 px-2.5 py-1 rounded-full backdrop-blur-sm">
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
        <div className="space-y-6">
          <div>
            <div className="flex items-center gap-2 mb-3 border-b border-forest/30 pb-2.5">
              <TrendingUp size={18} className="text-forest-light" />
              <h3 className="text-lg font-display font-bold">ESTADO DEL CLUB</h3>
            </div>
            <div className="bg-forest-dark/20 border border-forest/30 p-4 rounded-sm space-y-3">
              <div>
                <p className="text-[11px] text-cream/60 uppercase tracking-widest">Posición Actual</p>
                <p className="text-3xl font-display font-bold text-white">{matchData.standingsInfo.position}º</p>
              </div>
              <div className="pt-2 border-t border-forest/20 flex justify-between items-center text-xs font-semibold">
                <span className="text-cream/60">Puntos Acumulados:</span>
                <span className="text-forest-light font-bold">{matchData.standingsInfo.points} pts</span>
              </div>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-3 border-b border-forest/30 pb-2.5">
              <div className="flex items-center gap-2">
                <Users size={18} className="text-forest-light" />
                <h3 className="text-lg font-display font-bold">ONCE TITULAR</h3>
              </div>
              <Link to="/alineacion" className="text-[11px] font-bold text-forest-light hover:text-white transition-colors">
                Ver XI &rarr;
              </Link>
            </div>
            <ul className="space-y-2">
              {squadData.players.filter(p => p.isStarter).slice(0, 6).map(p => (
                <li key={p.id} className="flex items-center justify-between bg-black/50 p-2.5 rounded-sm border-l-2 border-forest hover:border-forest-light transition-all">
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
