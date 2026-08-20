import React from 'react'
import { Link } from 'react-router-dom'

export default function Layout({ children }) {
  return (
    <div className="min-h-screen flex flex-col bg-clubBlack text-cream font-sans">
      <header className="border-b border-forest-light bg-black sticky top-0 z-50">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3 group">
            <img src="/media/crest.jpg" alt="Racing de Oslo Crest" className="h-12 w-12 rounded-full border-2 border-forest transition-transform group-hover:scale-110 object-cover" />
            <div className="hidden sm:block">
              <h1 className="font-display font-bold text-xl tracking-wider">RACING DE OSLO</h1>
              <p className="text-xs text-cream-dark tracking-widest opacity-80">EST. 2018</p>
            </div>
          </Link>
          <nav className="hidden lg:flex gap-8 text-sm font-semibold tracking-wide items-center">
            <Link to="/" className="hover:text-forest-light transition-colors">INICIO</Link>
            <Link to="/noticias" className="hover:text-forest-light transition-colors">NOTICIAS</Link>
            <Link to="/alineacion" className="hover:text-forest-light transition-colors">EL ONCE</Link>
            <Link to="/plantilla" className="hover:text-forest-light transition-colors">PLANTILLA</Link>
            <Link to="/clasificacion" className="hover:text-forest-light transition-colors">CLASIFICACIÓN</Link>
            <Link to="/mercado" className="hover:text-forest-light transition-colors">MERCADO</Link>
            <Link to="/entradas" className="hover:text-forest-light transition-colors">ENTRADAS</Link>
            <Link to="/tienda" className="bg-forest text-cream px-4 py-2 rounded-sm hover:bg-forest-light transition-colors">TIENDA</Link>
          </nav>
          {/* Mobile menu simple fallback */}
          <nav className="flex lg:hidden gap-4 text-xs font-semibold tracking-wide items-center overflow-x-auto">
            <Link to="/plantilla">PLANTILLA</Link>
            <Link to="/noticias">NOTICIAS</Link>
            <Link to="/tienda" className="text-forest-light">TIENDA</Link>
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
          <p className="text-xs text-forest-light opacity-60 mb-4">© 2026 Racing de Oslo. Todos los derechos reservados.</p>
          <div className="flex justify-center gap-4 text-xs text-cream/50">
            <a href="https://comunio.es" target="_blank" rel="noreferrer" className="hover:text-cream">Patrocinado por Comunio</a>
            <span>•</span>
            <Link to="/tienda" className="hover:text-cream">Tienda Oficial</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
