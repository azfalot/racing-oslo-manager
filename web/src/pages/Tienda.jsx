import React from 'react'
import { ShoppingBag, Tag, ExternalLink } from 'lucide-react'

export default function Tienda() {
  return (
    <div className="container mx-auto px-6 py-12">
      <div className="mb-12 text-center max-w-2xl mx-auto">
        <h2 className="text-4xl md:text-5xl font-display font-bold mb-4">Tienda Oficial</h2>
        <p className="text-cream-dark">Viste los colores del Racing de Oslo. Gracias a nuestro patrocinador oficial, puedes conseguir la equipación con un descuento exclusivo.</p>
      </div>

      <div className="bg-forest-dark/20 border border-forest/30 rounded-sm overflow-hidden flex flex-col md:flex-row max-w-4xl mx-auto">
        <div className="md:w-1/2 bg-black relative">
          <img src="/media/poster_j1.jpg" alt="Equipación 2026/27" className="w-full h-full object-cover opacity-80" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent flex items-end p-6">
            <span className="text-2xl font-display font-bold">1ª EQUIPACIÓN 26/27</span>
          </div>
        </div>
        
        <div className="md:w-1/2 p-8 md:p-12 flex flex-col justify-center">
          <div className="inline-block bg-forest/30 text-forest-light px-3 py-1 rounded-sm text-xs font-bold tracking-widest uppercase mb-4 w-max">
            Temporada Oficial
          </div>
          <h3 className="text-3xl font-display font-bold mb-4">Armadura Crema y Verde Bosque</h3>
          <p className="text-cream-dark text-sm mb-8 leading-relaxed">
            La misma camiseta que visten los jugadores en el Oslo Arena. Diseñada con tecnología de última generación para el máximo rendimiento en la Segunda Regional Cántabra.
          </p>
          
          <div className="bg-black/50 p-4 border border-forest/20 rounded-sm mb-8">
            <div className="flex items-center gap-3 mb-2">
              <Tag size={18} className="text-forest-light" />
              <span className="font-bold text-sm uppercase tracking-wide">Código de Descuento (15%)</span>
            </div>
            <code className="text-2xl font-mono text-white tracking-widest">OSLO15</code>
          </div>

          <a 
            href="https://store.hookr.com/racing-oslo?ref=mateo" 
            target="_blank" 
            rel="noreferrer"
            className="flex items-center justify-center gap-3 bg-cream text-clubBlack px-6 py-4 rounded-sm font-bold tracking-wider hover:bg-white transition-colors"
          >
            <ShoppingBag size={20} />
            COMPRAR EN TIENDA OFICIAL
            <ExternalLink size={16} className="ml-2 opacity-50" />
          </a>
        </div>
      </div>
    </div>
  )
}
