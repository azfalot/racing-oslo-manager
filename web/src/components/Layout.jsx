import React, { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Menu, X, Home, Newspaper, Users, Trophy, ShoppingBag, Ticket, Shirt, Briefcase } from 'lucide-react'

export default function Layout({ children }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const location = useLocation()

  const navLinks = [
    { to: '/', label: 'INICIO', icon: Home },
    { to: '/noticias', label: 'NOTICIAS', icon: Newspaper },
    { to: '/alineacion', label: 'EL ONCE', icon: Users },
    { to: '/plantilla', label: 'PLANTILLA', icon: Users },
    { to: '/clasificacion', label: 'CLASIFICACIÓN', icon: Trophy },
    { to: '/mercado', label: 'MERCADO', icon: Briefcase },
    { to: '/entradas', label: 'ENTRADAS', icon: Ticket },
    { to: '/tienda', label: 'TIENDA OFICIAL', icon: Shirt, highlight: true }
  ]

  const closeMenu = () => setMobileMenuOpen(false)

  return (
    <div className="min-h-screen flex flex-col bg-clubBlack text-cream font-sans relative overflow-x-hidden">
      {/* Header */}
      <header className="border-b border-forest-light/40 bg-black/95 backdrop-blur-md sticky top-0 z-50">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          {/* Logo & Crest */}
          <Link to="/" onClick={closeMenu} className="flex items-center gap-3 group">
            <img src="/media/crest.jpg" alt="Racing de Oslo Crest" className="h-12 w-12 rounded-full border-2 border-forest transition-transform group-hover:scale-110 object-cover shadow-lg" />
            <div>
              <h1 className="font-display font-bold text-lg sm:text-xl tracking-wider leading-tight">RACING DE OSLO</h1>
              <p className="text-[10px] sm:text-xs text-cream-dark tracking-widest opacity-80 font-mono">EST. 2018</p>
            </div>
          </Link>

          {/* Desktop Navigation (>= lg) */}
          <nav className="hidden lg:flex gap-7 text-xs font-bold tracking-widest items-center">
            {navLinks.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className={
                  link.highlight
                    ? "bg-forest text-cream px-4 py-2 rounded-sm hover:bg-forest-light transition-colors uppercase"
                    : `transition-colors hover:text-forest-light ${location.pathname === link.to ? 'text-forest-light border-b border-forest-light pb-0.5' : 'text-cream/80'}`
                }
              >
                {link.label}
              </Link>
            ))}
          </nav>

          {/* Mobile Hamburger Button (< lg) */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="lg:hidden p-2.5 rounded-sm bg-forest-dark/40 border border-forest/40 text-cream hover:bg-forest/20 transition-colors focus:outline-none"
            aria-label="Abrir menú"
          >
            {mobileMenuOpen ? <X size={26} className="text-forest-light" /> : <Menu size={26} className="text-cream" />}
          </button>
        </div>

        {/* Mobile Slide-down Menu Drawer */}
        {mobileMenuOpen && (
          <div className="lg:hidden bg-black/98 border-b border-forest-light/40 py-6 px-6 shadow-2xl animate-fade-in">
            <nav className="flex flex-col gap-3">
              {navLinks.map((link) => {
                const IconComponent = link.icon
                const isActive = location.pathname === link.to

                return (
                  <Link
                    key={link.to}
                    to={link.to}
                    onClick={closeMenu}
                    className={`flex items-center gap-4 px-4 py-3 rounded-sm text-sm font-bold tracking-widest transition-all ${
                      link.highlight
                        ? 'bg-forest text-cream border border-forest-light'
                        : isActive
                        ? 'bg-forest/20 text-forest-light border-l-4 border-forest-light pl-3'
                        : 'text-cream/80 hover:bg-white/5 hover:text-white'
                    }`}
                  >
                    <IconComponent size={20} className={isActive ? 'text-forest-light' : 'text-cream/60'} />
                    <span>{link.label}</span>
                  </Link>
                )
              })}
            </nav>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="flex-grow">
        {children}
      </main>

      {/* Footer */}
      <footer className="bg-black border-t border-forest-dark py-12 mt-20">
        <div className="container mx-auto px-6 text-center">
          <img src="/media/crest.jpg" alt="Racing de Oslo" className="h-16 w-16 mx-auto mb-6 rounded-full opacity-50 grayscale hover:grayscale-0 transition-all" />
          <p className="text-cream-dark text-sm mb-2 font-display">Instinto. Inteligencia. Familia. Racing.</p>
          <p className="text-xs text-forest-light opacity-60 mb-4 font-mono">© 2026 Racing de Oslo · Est. 2018. Todos los derechos reservados.</p>
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
