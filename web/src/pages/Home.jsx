import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Trophy, ChevronRight, TrendingUp, Users, ChevronLeft, Calendar, Flame, ShoppingBag, Eye, X, ArrowUpRight } from 'lucide-react'
import squadData from '../data/squad.json'
import matchData from '../data/matches.json'
import newsData from '../data/news.json'
import marketData from '../data/market.json'
import { getCategoryBadgeStyle } from './Noticias'
import PlayerProfileModal from '../components/PlayerProfileModal'

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
  const [selectedNews, setSelectedNews] = useState(null)
  const [profilePlayer, setProfilePlayer] = useState(null)

  // Jugadores reales a la venta hoy en el mercado de Comunio
  const realMarketTargets = (marketData || []).filter(p => p.price > 0).slice(0, 3)

  // Auto-play carrusel cada 6 segundos
  useEffect(() => {
    if (featuredNews.length <= 1) return
    const timer = setInterval(() => {
      setCurrentSlide(prev => (prev + 1) % featuredNews.length)
    }, 6000)
    return () => clearInterval(timer)
  }, [featuredNews.length])

  const nextSlide = () => setCurrentSlide((currentSlide + 1) % featuredNews.length)
  const prevSlide = () => setCurrentSlide((currentSlide - 1 + featuredNews.length) % featuredNews.length)

  // Posición real del Racing de Oslo
  const myTeamInStandings = matchData.standingsData?.find(t => (t.team || '').toLowerCase().includes('racing de oslo') || (t.team || '').toLowerCase().includes('oslo'))
  const currentPos = myTeamInStandings ? myTeamInStandings.pos : (matchData.standingsInfo?.position || 10)
  const currentPts = myTeamInStandings ? myTeamInStandings.pts : (matchData.standingsInfo?.points || 0)

  // Once titular para el Mini Campo
  const starters = squadData.players.filter(p => p.isStarter)
  const keeper = starters.find(p => (p.position || '').toLowerCase() === 'keeper') || starters[0]
  const defenders = starters.filter(p => (p.position || '').toLowerCase() === 'defender')
  const midfielders = starters.filter(p => (p.position || '').toLowerCase() === 'midfielder')
  const strikers = starters.filter(p => (p.position || '').toLowerCase() === 'striker')

  const posLabels = {
    keeper: 'POR',
    defender: 'DEF',
    midfielder: 'MED',
    striker: 'DEL'
  }

  const posColors = {
    keeper: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
    defender: 'bg-blue-500/20 text-blue-300 border-blue-500/40',
    midfielder: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
    striker: 'bg-rose-500/20 text-rose-300 border-rose-500/40'
  }

  return (
    <div className="space-y-4 pb-8">
      {/* BANNER ÉPICO ULTRA-COMPACTO DE PORTADA */}
      <section className="relative w-full h-[180px] sm:h-[210px] bg-clubBlack overflow-hidden flex items-center justify-center border-b border-forest/40 shadow-xl">
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
        <div className="relative z-10 text-center px-4 max-w-4xl mx-auto space-y-1.5">
          <span className="text-forest-light font-bold tracking-[0.3em] text-[10px] sm:text-xs block uppercase drop-shadow">
            SEGUNDA REGIONAL CÁNTABRA · EST. 2018
          </span>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-display font-bold uppercase leading-none text-white drop-shadow-[0_10px_20px_rgba(0,0,0,0.8)] tracking-wide">
            RACING DE OSLO
          </h2>
          <div className="flex flex-wrap justify-center gap-2.5 pt-1">
            <Link to="/alineacion" className="inline-flex items-center gap-1.5 bg-cream text-clubBlack px-4 py-1.5 rounded-sm text-xs font-bold tracking-wide hover:bg-white transition-all shadow-lg hover:scale-105">
              VER ONCE TITULAR <ChevronRight size={14} />
            </Link>
            <Link to="/noticias" className="inline-flex items-center gap-1.5 bg-forest-dark/80 border border-forest-light/60 text-cream px-4 py-1.5 rounded-sm text-xs font-bold tracking-wide hover:bg-forest transition-all shadow-lg">
              COMUNICADOS OFICIALES
            </Link>
          </div>
        </div>
      </section>

      {/* BARRA UNIFICADA: PRÓXIMO PARTIDO & ESTADO CLUB */}
      <section className="border-y border-forest/40 bg-forest-dark/50 backdrop-blur-md py-2.5 shadow-md">
        <div className="container mx-auto px-6 flex flex-wrap justify-between items-center text-xs font-semibold tracking-wider gap-3">
          <div className="flex items-center gap-2.5">
            <Trophy size={16} className="text-forest-light animate-bounce" />
            <span className="text-white font-bold">{matchData.nextMatch.competition}</span>
            <span className="text-cream/40">•</span>
            <span className="text-forest-light font-bold uppercase">RACING DE OSLO</span>
            <span className="text-cream/60">vs</span>
            <span className="text-white">{matchData.nextMatch.opponent}</span>
          </div>

          <div className="flex items-center gap-4 text-cream/90 text-[11px] font-mono">
            <div className="flex items-center gap-2 bg-black/40 px-3 py-1 rounded-sm border border-forest/30">
              <TrendingUp size={13} className="text-forest-light" />
              <span>POSICIÓN: <strong className="text-white font-bold">{currentPos}º</strong></span>
              <span className="text-cream/40">|</span>
              <span>PUNTOS: <strong className="text-forest-light font-bold">{currentPts} pts</strong></span>
            </div>
            <span className="hidden sm:inline text-cream/60">{matchData.nextMatch.venue}</span>
          </div>
        </div>
      </section>

      {/* MAIN CONTENT GRID (Alineación vertical perfecta "De un plumazo") */}
      <section className="container mx-auto px-6 grid grid-cols-1 lg:grid-cols-3 gap-6 pt-1 items-stretch">
        {/* COLUMNA IZQUIERDA: CARRUSEL NOTICIAS + SEGUIMIENTO MERCADO REAL */}
        <div className="lg:col-span-2 space-y-6 flex flex-col justify-between">
          {/* 1. COMUNICADOS Y ACTUALIDAD (CARRUSEL COMPACTO) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-forest/40 pb-2">
              <h3 className="text-lg font-display font-bold flex items-center gap-2 text-white">
                <span className="w-2.5 h-2.5 rounded-full bg-forest-light animate-pulse shadow-[0_0_10px_#40805c]"></span>
                ACTUALIDAD Y COMUNICADOS
              </h3>
              <Link to="/noticias" className="text-xs text-forest-light font-bold tracking-widest hover:text-cream transition-colors">
                VER TODAS ({newsData.length}) &rarr;
              </Link>
            </div>

            {featuredNews.length > 0 && (() => {
              const activeNews = featuredNews[currentSlide]
              const badgeStyle = getCategoryBadgeStyle(activeNews.category)
              return (
                <div
                  onClick={() => setSelectedNews(activeNews)}
                  className="rounded-sm overflow-hidden border border-forest/40 shadow-2xl bg-forest-dark/40 backdrop-blur-sm group cursor-pointer hover:border-forest-light/60 transition-all"
                >
                  {/* Tarjeta Split/Overlay Compacta (Altura reducida a 200px/220px) */}
                  <div className="relative h-[190px] sm:h-[220px] w-full overflow-hidden bg-black flex items-center justify-center">
                    <img
                      src={activeNews.image}
                      alt={activeNews.title}
                      className="w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-700 filter brightness-105"
                      onError={(e) => { e.target.src = '/media/crest.jpg' }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/40 to-transparent"></div>

                    {/* Navigation Arrows */}
                    {featuredNews.length > 1 && (
                      <>
                        <button
                          onClick={(e) => { e.stopPropagation(); prevSlide(); }}
                          className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/80 p-2 rounded-full text-cream hover:bg-forest transition-colors z-20 focus:outline-none border border-forest/50 shadow-lg"
                          aria-label="Noticia anterior"
                        >
                          <ChevronLeft size={18} />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); nextSlide(); }}
                          className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/80 p-2 rounded-full text-cream hover:bg-forest transition-colors z-20 focus:outline-none border border-forest/50 shadow-lg"
                          aria-label="Noticia siguiente"
                        >
                          <ChevronRight size={18} />
                        </button>
                      </>
                    )}

                    {/* Dots Indicators */}
                    {featuredNews.length > 1 && (
                      <div className="absolute top-2 right-2 flex gap-1 z-20 bg-black/80 px-2.5 py-1 rounded-full backdrop-blur-md border border-forest/40">
                        {featuredNews.map((_, idx) => (
                          <button
                            key={idx}
                            onClick={(e) => { e.stopPropagation(); setCurrentSlide(idx); }}
                            className={`h-1.5 rounded-full transition-all ${idx === currentSlide ? 'w-5 bg-forest-light' : 'w-1.5 bg-cream/40'}`}
                            aria-label={`Ir a la noticia ${idx + 1}`}
                          />
                        ))}
                      </div>
                    )}

                    {/* Overlay Text Content */}
                    <div className="absolute bottom-0 left-0 right-0 p-4 space-y-1.5 z-10">
                      <div className="flex items-center gap-2">
                        <span className={`text-[9px] font-bold px-2.5 py-0.5 uppercase tracking-widest rounded-sm ${badgeStyle.pill}`}>
                          {activeNews.category || 'NOTICIA'}
                        </span>
                        <span className="text-[10px] text-cream/70 flex items-center gap-1 font-mono">
                          <Calendar size={12} className="text-forest-light" />
                          {formatNewsDate(activeNews.date)}
                        </span>
                      </div>
                      <h4 className="text-base sm:text-lg font-display font-bold text-white leading-tight line-clamp-1 group-hover:text-forest-light transition-colors">
                        {activeNews.title}
                      </h4>
                      <p className="text-xs text-cream-dark line-clamp-1 leading-snug">
                        {activeNews.excerpt || activeNews.summary}
                      </p>
                    </div>
                  </div>
                </div>
              )
            })()}
          </div>

          {/* 2. MERCADO EN VIVO: OPORTUNIDADES Y RUMORES REALES (CONECTADO A COMUNIO) */}
          <div className="space-y-3 pt-1">
            <div className="flex items-center justify-between border-b border-forest/40 pb-2">
              <div className="flex items-center gap-2">
                <ShoppingBag size={18} className="text-amber-400 animate-pulse" />
                <h3 className="text-lg font-display font-bold text-white uppercase tracking-wide">
                  MERCADO EN VIVO <span className="text-xs font-mono text-amber-400 font-normal">({marketData.length} OPORTUNIDADES)</span>
                </h3>
              </div>
              <Link to="/mercado" className="text-xs font-bold text-forest-light hover:text-white transition-colors flex items-center gap-1">
                VER MERCADO COMPLETO <ArrowUpRight size={14} />
              </Link>
            </div>

            {/* Grid de Jugadores Reales a la Venta Hoy en Comunio */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {realMarketTargets.map(player => {
                const posKey = (player.position || 'midfielder').toLowerCase()
                const posClass = posColors[posKey] || 'bg-forest/20 text-cream border-forest/40'
                const posText = posLabels[posKey] || 'JUG'

                return (
                  <div key={player.id} onClick={() => setProfilePlayer(player)} className="bg-forest-dark/30 border border-forest/40 p-3 rounded-sm hover:border-forest-light/60 transition-all flex flex-col justify-between space-y-2.5 group shadow-md cursor-pointer">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-full overflow-hidden flex-shrink-0 bg-black border border-forest/40">
                        <img
                          src={player.image}
                          alt={player.name}
                          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                          onError={(e) => { e.target.src = '/media/crest.jpg' }}
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded-sm border uppercase ${posClass}`}>
                            {posText}
                          </span>
                          <span className="text-[10px] text-cream/50 truncate font-mono">
                            {player.owner === 'Computer' ? 'Computadora' : player.owner}
                          </span>
                        </div>
                        <h4 className="text-xs font-bold text-white group-hover:text-forest-light transition-colors truncate mt-0.5">
                          {player.name}
                        </h4>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-forest/30 flex justify-between items-center text-xs">
                      <div>
                        <span className="text-[9px] text-cream/60 uppercase block font-mono">Precio Salida</span>
                        <span className="text-xs font-bold text-amber-300">{player.price.toLocaleString('es-ES')} €</span>
                      </div>
                      <Link
                        to="/mercado"
                        className="bg-forest/40 hover:bg-forest border border-forest-light/40 text-cream text-[10px] font-bold px-2.5 py-1 rounded-sm transition-colors flex items-center gap-1"
                      >
                        VER EN MERCADO <ChevronRight size={12} />
                      </Link>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* 3. RUMORES DE MERCADO & EL DIARIO DE MATEO OSLOMANY */}
          {(() => {
            const rumorNews = (newsData || []).filter(n => (n.category || '').toLowerCase() === 'rumores').slice(0, 2)
            if (rumorNews.length === 0) return null

            return (
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between border-b border-forest/40 pb-2">
                  <div className="flex items-center gap-2">
                    <Flame size={18} className="text-purple-400 animate-pulse" />
                    <h3 className="text-lg font-display font-bold text-white uppercase tracking-wide">
                      RUMORES & DIARIO DE MATEO OSLOMANY
                    </h3>
                  </div>
                  <Link to="/noticias" className="text-xs font-bold text-purple-300 hover:text-white transition-colors flex items-center gap-1">
                    TODOS LOS RUMORES <ArrowUpRight size={14} />
                  </Link>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {rumorNews.map(rumor => {
                    const badgeStyle = getCategoryBadgeStyle(rumor.category)
                    return (
                      <div
                        key={rumor.id}
                        onClick={() => setSelectedNews(rumor)}
                        className="bg-purple-950/20 border border-purple-500/40 p-3 rounded-sm hover:border-purple-400 transition-all flex flex-col justify-between space-y-2 group shadow-md cursor-pointer"
                      >
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className={`text-[8px] font-bold px-2 py-0.5 rounded-sm border uppercase ${badgeStyle.pill}`}>
                              RUMOR DE MERCADO
                            </span>
                            <span className="text-[10px] text-cream/50 font-mono">
                              {formatNewsDate(rumor.date)}
                            </span>
                          </div>
                          <h4 className="text-xs font-bold text-white group-hover:text-purple-300 transition-colors line-clamp-1">
                            {rumor.title}
                          </h4>
                          <p className="text-[11px] text-cream/70 line-clamp-2 leading-relaxed italic border-l-2 border-purple-400 pl-2 bg-black/40 py-1 rounded-r-sm">
                            {rumor.excerpt || rumor.summary}
                          </p>
                        </div>

                        <div className="pt-2 border-t border-purple-500/30 flex justify-between items-center text-[10px]">
                          <span className="text-purple-300 font-mono font-bold">Mateo Oslomany Editorial</span>
                          <span className="bg-purple-600/30 text-purple-200 group-hover:bg-purple-600 group-hover:text-white px-2 py-1 rounded-sm border border-purple-400/40 transition-colors font-bold uppercase">
                            LEER RUMOR &rarr;
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })()}
        </div>

        {/* COLUMNA DERECHA: MINI CAMPO DE FÚTBOL (ONCE TITULAR TÁCTICO QUE OCUPA TODO EL ALTO) */}
        <div className="flex flex-col h-full space-y-3">
          <div className="flex items-center justify-between border-b border-forest/40 pb-2">
            <div className="flex items-center gap-2">
              <Users size={18} className="text-forest-light" />
              <h3 className="text-lg font-display font-bold text-white">ONCE TITULAR</h3>
            </div>
            <Link to="/alineacion" className="text-xs font-bold text-forest-light hover:text-white transition-colors">
              Ver XI Completo &rarr;
            </Link>
          </div>

          {/* MINI CAMPO VERDE QUE SE ESTIRA HASTA ALINEAR SU BORDE INFERIOR AL 100% */}
          <div className="flex-1 w-full min-h-[360px] relative bg-gradient-to-b from-forest-dark/95 via-forest/90 to-forest-dark/95 border border-forest-light/50 rounded-sm p-3 shadow-2xl flex flex-col justify-between overflow-hidden">
              {/* LÍNEAS TÁCTICAS DEL CAMPO DE FÚTBOL */}
              <div className="absolute inset-0 pointer-events-none opacity-25 border-2 border-white rounded-sm m-2">
                <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-white -translate-y-1/2"></div>
                <div className="absolute top-1/2 left-1/2 w-20 h-20 border-2 border-white rounded-full -translate-x-1/2 -translate-y-1/2"></div>
                <div className="absolute top-0 left-1/2 w-28 h-10 border-b-2 border-x-2 border-white -translate-x-1/2"></div>
                <div className="absolute bottom-0 left-1/2 w-28 h-10 border-t-2 border-x-2 border-white -translate-x-1/2"></div>
              </div>

              {/* 1. DELANTEROS */}
              <div className="relative z-10 flex justify-center gap-4 pt-1">
                {strikers.map(p => (
                  <div key={p.id} onClick={() => setProfilePlayer(p)} className="flex flex-col items-center cursor-pointer hover:scale-110 transition-transform">
                    <img
                      src={p.image}
                      alt={p.name}
                      className="w-7 h-7 rounded-full border-2 border-forest-light bg-black object-cover shadow-lg"
                      onError={(e) => { e.target.src = '/media/crest.jpg' }}
                    />
                    <span className="text-[8px] font-bold text-white bg-black/90 px-1 py-0.5 rounded-sm border border-forest/40 truncate max-w-[70px] mt-0.5 shadow-md">
                      {p.name.split(' ').pop()}
                    </span>
                  </div>
                ))}
              </div>

              {/* 2. CENTROCAMPISTAS */}
              <div className="relative z-10 flex justify-around px-1">
                {midfielders.map(p => (
                  <div key={p.id} onClick={() => setProfilePlayer(p)} className="flex flex-col items-center cursor-pointer hover:scale-110 transition-transform">
                    <img
                      src={p.image}
                      alt={p.name}
                      className="w-6.5 h-6.5 rounded-full border-2 border-cream bg-black object-cover shadow-md"
                      onError={(e) => { e.target.src = '/media/crest.jpg' }}
                    />
                    <span className="text-[8px] font-bold text-white bg-black/90 px-1 py-0.5 rounded-sm border border-forest/40 truncate max-w-[58px] mt-0.5 shadow-sm">
                      {p.name.split(' ').pop()}
                    </span>
                  </div>
                ))}
              </div>

              {/* 3. DEFENSAS */}
              <div className="relative z-10 flex justify-around px-2">
                {defenders.map(p => (
                  <div key={p.id} onClick={() => setProfilePlayer(p)} className="flex flex-col items-center cursor-pointer hover:scale-110 transition-transform">
                    <img
                      src={p.image}
                      alt={p.name}
                      className="w-6.5 h-6.5 rounded-full border-2 border-cream bg-black object-cover shadow-md"
                      onError={(e) => { e.target.src = '/media/crest.jpg' }}
                    />
                    <span className="text-[8px] font-bold text-white bg-black/90 px-1 py-0.5 rounded-sm border border-forest/40 truncate max-w-[58px] mt-0.5 shadow-sm">
                      {p.name.split(' ').pop()}
                    </span>
                  </div>
                ))}
              </div>

              {/* 4. PORTERO */}
              <div className="relative z-10 flex justify-center pb-1">
                {keeper && (
                  <div onClick={() => setProfilePlayer(keeper)} className="flex flex-col items-center cursor-pointer hover:scale-110 transition-transform">
                    <img
                      src={keeper.image}
                      alt={keeper.name}
                      className="w-7 h-7 rounded-full border-2 border-amber-400 bg-black object-cover shadow-lg"
                      onError={(e) => { e.target.src = '/media/crest.jpg' }}
                    />
                    <span className="text-[8px] font-bold text-amber-300 bg-black/90 px-1.5 py-0.5 rounded-sm border border-amber-400/40 truncate max-w-[70px] mt-0.5 shadow-md">
                      {keeper.name.split(' ').pop()}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
      </section>

      {/* FULL UNTRUNCATED NEWS MODAL EN LA PORTADA */}
      {selectedNews && (() => {
        const modalBadgeStyle = getCategoryBadgeStyle(selectedNews.category)
        return (
          <div className="fixed inset-0 z-50 bg-black/95 backdrop-blur-md flex items-center justify-center p-4 sm:p-6">
            <div className="bg-clubBlack border border-forest-light/60 max-w-3xl w-full rounded-sm overflow-hidden animate-fade-in relative max-h-[92vh] flex flex-col shadow-2xl">
              <button
                onClick={() => setSelectedNews(null)}
                className="absolute top-4 right-4 z-30 bg-black/80 p-2.5 rounded-full hover:bg-forest text-cream transition-colors border border-forest/40 focus:outline-none"
                aria-label="Cerrar modal"
              >
                <X size={22} />
              </button>

              <div className="overflow-y-auto p-6 sm:p-8 space-y-6">
                <div className="w-full bg-black/80 rounded-sm border border-forest/30 overflow-hidden flex items-center justify-center p-2">
                  <img
                    src={selectedNews.image}
                    alt={selectedNews.title}
                    className="w-full h-auto max-h-[60vh] object-contain rounded-sm shadow-2xl"
                    onError={(e) => { e.target.src = '/media/crest.jpg' }}
                  />
                </div>

                <div className="space-y-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className={`text-xs font-bold px-3 py-1 uppercase tracking-widest rounded-sm ${modalBadgeStyle.pill}`}>
                      {selectedNews.category || 'COMUNICADO'}
                    </span>
                    <span className="text-xs text-cream/70 font-mono flex items-center gap-1">
                      <Calendar size={14} className="text-forest-light" />
                      {formatNewsDate(selectedNews.date)}
                    </span>
                  </div>

                  <h3 className="text-2xl sm:text-3xl font-display font-bold text-white leading-tight">
                    {selectedNews.title}
                  </h3>

                  <div className="pt-4 border-t border-forest/30 text-cream/90 text-sm leading-relaxed whitespace-pre-wrap font-sans space-y-4">
                    {selectedNews.content || selectedNews.excerpt}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )
      })()}

      {/* PLAYER PROFILE MODAL */}
      <PlayerProfileModal player={profilePlayer} onClose={() => setProfilePlayer(null)} />
    </div>
  )
}
