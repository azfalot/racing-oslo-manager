import React from 'react'
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom'
import { Shield, ChevronRight, Users, Trophy, TrendingUp, History } from 'lucide-react'
import squadData from './data/squad.json'
import matchData from './data/matches.json'

function Layout({ children }) {
  return (
    <div className="min-h-screen flex flex-col bg-clubBlack text-cream font-sans">
      <header className="border-b border-forest-light bg-black">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3 group">
            <img src="/media/crest.jpg" alt="Racing de Oslo Crest" className="h-12 w-12 rounded-full border-2 border-forest transition-transform group-hover:scale-110 object-cover" />
            <div>
              <h1 className="font-display font-bold text-xl tracking-wider">RACING DE OSLO</h1>
              <p className="text-xs text-cream-dark tracking-widest opacity-80">EST. 2024</p>
            </div>
          </Link>
          <nav className="hidden md:flex gap-8 text-sm font-semibold tracking-wide">
            <Link to="/" className="hover:text-forest-light transition-colors">INICIO</Link>
            <Link to="/plantilla" className="hover:text-forest-light transition-colors">PLANTILLA</Link>
            <Link to="/jornadas" className="hover:text-forest-light transition-colors">JORNADAS</Link>
            <Link to="/mercado" className="hover:text-forest-light transition-colors">MERCADO</Link>
            <Link to="/historia" className="hover:text-forest-light transition-colors">HISTORIA</Link>
          </nav>
        </div>
      </header>

      <main className="flex-grow">
        {children}
      </main>

      <footer className="bg-black border-t border-forest-dark py-12 mt-20">
        <div className="container mx-auto px-6 text-center">
          <img src="/media/crest.jpg" alt="Racing de Oslo" className="h-16 w-16 mx-auto mb-6 rounded-full opacity-50 grayscale hover:grayscale-0 transition-all" />
          <p className="text-cream-dark text-sm mb-2">Instinto. Inteligencia. Familia. Racing.</p>
          <p className="text-xs text-forest-light opacity-60">© 2026 Racing de Oslo. Todos los derechos reservados.</p>
        </div>
      </footer>
    </div>
  )
}

function Home() {
  return (
    <div>
      {/* HERO SECTION */}
      <section className="relative w-full h-[70vh] bg-black overflow-hidden flex items-center justify-center">
        <div className="absolute inset-0 z-0">
          <img src="/media/poster_j1.jpg" alt="Plantilla" className="w-full h-full object-cover opacity-40 blur-[2px]" />
          <div className="absolute inset-0 bg-gradient-to-t from-clubBlack via-transparent to-black/60"></div>
        </div>
        <div className="relative z-10 text-center px-4 max-w-4xl mx-auto">
          <span className="text-forest-light font-bold tracking-[0.3em] text-sm mb-4 block">SEGUNDA REGIONAL CÁNTABRA</span>
          <h2 className="text-5xl md:text-7xl font-display font-bold uppercase mb-6 leading-tight text-white drop-shadow-lg">
            Comienza la<br/>Nueva Era
          </h2>
          <Link to="/jornadas" className="inline-flex items-center gap-2 bg-cream text-clubBlack px-8 py-3 rounded-sm font-bold tracking-wide hover:bg-white transition-colors">
            PREVIA JORNADA 1 <ChevronRight size={20} />
          </Link>
        </div>
      </section>

      {/* MATCH INFO BAR */}
      <section className="border-y border-forest/30 bg-forest-dark/40 py-4">
        <div className="container mx-auto px-6 flex flex-col md:flex-row justify-center items-center gap-4 md:gap-16 text-sm font-semibold tracking-wider">
          <div className="flex items-center gap-3">
            <Trophy size={18} className="text-cream/60" />
            <span>{matchData.nextMatch.competition}</span>
          </div>
          <div className="hidden md:block w-1 h-1 bg-cream/30 rounded-full"></div>
          <div className="flex items-center gap-3">
            <span>{matchData.nextMatch.opponent}</span>
          </div>
          <div className="hidden md:block w-1 h-1 bg-cream/30 rounded-full"></div>
          <div className="flex items-center gap-3 text-cream-dark">
            <span>{matchData.nextMatch.venue} • {matchData.nextMatch.date}</span>
          </div>
        </div>
      </section>

      {/* CONTENT GRID */}
      <section className="container mx-auto px-6 py-16 grid grid-cols-1 md:grid-cols-3 gap-12">
        {/* POSTER DESTACADO */}
        <div className="md:col-span-2">
          <div className="flex items-center justify-between mb-8 border-b border-forest/30 pb-4">
            <h3 className="text-2xl font-display font-bold">ACTUALIDAD</h3>
            <span className="text-sm text-forest-light font-semibold tracking-widest">COMUNICADOS</span>
          </div>
          <div className="group overflow-hidden rounded-sm relative">
            <img src="/media/poster_j1.jpg" alt="Cartel Oficial" className="w-full h-auto object-cover transform group-hover:scale-105 transition-transform duration-700" />
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black via-black/80 to-transparent p-6 pt-20">
              <span className="bg-forest text-cream text-xs font-bold px-3 py-1 uppercase tracking-wider mb-3 inline-block">Oficial</span>
              <h4 className="text-2xl font-display font-bold text-white mb-2">Presentación de la Equipación Oficial 2026/27</h4>
              <p className="text-sm text-cream-dark line-clamp-2">Instinto. Inteligencia. Familia. Racing. Descubre la nueva armadura crema y verde bosque que vestirá nuestro once titular en la Segunda Regional Cántabra.</p>
            </div>
          </div>
        </div>

        {/* SIDEBAR: PLANTILLA & ESTADO */}
        <div className="flex flex-col gap-10">
          {/* Clasificación rápida */}
          <div>
            <div className="flex items-center gap-3 mb-6 border-b border-forest/30 pb-4">
              <TrendingUp className="text-forest-light" />
              <h3 className="text-xl font-display font-bold">ESTADO</h3>
            </div>
            <div className="bg-forest-dark/20 border border-forest/30 p-5 rounded-sm">
              <p className="text-sm text-cream-dark mb-1">Posición Actual</p>
              <p className="text-3xl font-display font-bold text-white">{matchData.standings.position}º</p>
              <div className="mt-4 pt-4 border-t border-forest/20 flex justify-between text-sm">
                <span className="text-cream/60">Puntos:</span>
                <span className="font-bold">{matchData.standings.points} pts</span>
              </div>
            </div>
          </div>

          {/* Plantilla Snippet */}
          <div>
            <div className="flex items-center gap-3 mb-6 border-b border-forest/30 pb-4">
              <Users className="text-forest-light" />
              <h3 className="text-xl font-display font-bold">EL ONCE</h3>
            </div>
            <ul className="flex flex-col gap-3">
              {squadData.players.slice(0, 5).map(p => (
                <li key={p.id} className="flex items-center justify-between bg-black/40 p-3 rounded-sm border-l-2 border-forest hover:border-cream transition-colors">
                  <div className="flex items-center gap-3">
                    <span className="text-forest-light font-display text-lg w-6 text-center">{p.number}</span>
                    <span className="font-semibold text-sm">{p.name}</span>
                  </div>
                  <span className="text-[10px] uppercase tracking-wider text-cream/50 bg-forest-dark/50 px-2 py-1 rounded-full">{p.position}</span>
                </li>
              ))}
            </ul>
            <Link to="/plantilla" className="block mt-4 text-center text-sm text-forest-light hover:text-cream transition-colors font-semibold tracking-wide">
              VER PLANTILLA COMPLETA &rarr;
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}

function App() {
  return (
    <Router>
      <Layout>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/plantilla" element={<div className="container mx-auto px-6 py-20 text-center"><h2 className="text-4xl font-display">PLANTILLA (Próximamente)</h2></div>} />
          <Route path="/jornadas" element={<div className="container mx-auto px-6 py-20 text-center"><h2 className="text-4xl font-display">JORNADAS (Próximamente)</h2></div>} />
          <Route path="/mercado" element={<div className="container mx-auto px-6 py-20 text-center"><h2 className="text-4xl font-display">MERCADO (Próximamente)</h2></div>} />
          <Route path="/historia" element={<div className="container mx-auto px-6 py-20 text-center"><h2 className="text-4xl font-display">HISTORIA (Próximamente)</h2></div>} />
        </Routes>
      </Layout>
    </Router>
  )
}

export default App
