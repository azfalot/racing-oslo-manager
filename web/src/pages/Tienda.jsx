import React from 'react'
import { ShoppingBag, Tag, ExternalLink } from 'lucide-react'

export default function Tienda() {
  return (
    <div className="container mx-auto px-6 py-12">
      <div className="mb-12 text-center max-w-2xl mx-auto">
        <h2 className="text-4xl md:text-5xl font-display font-bold mb-4">Tienda Oficial</h2>
        <p className="text-cream-dark">Viste los colores del Racing de Oslo. Gracias a nuestro patrocinador oficial, puedes conseguir la equipación con un descuento exclusivo.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-5xl mx-auto">
        {/* Kit Local */}
        <div className="bg-black border border-forest/30 rounded-sm overflow-hidden group">
          <div className="relative h-80 bg-forest-dark/20 p-8 flex items-center justify-center">
            {/* Placeholder for actual shirt, using crest for now or a generic shirt icon */}
            <img src="/media/poster_j1.jpg" alt="Local" className="w-full h-full object-cover mix-blend-screen opacity-50 group-hover:opacity-100 transition-opacity" />
            <div className="absolute top-4 right-4 bg-forest text-cream text-xs font-bold px-2 py-1 uppercase">1ª Equipación</div>
          </div>
          <div className="p-6 text-center">
            <h3 className="text-xl font-display font-bold mb-2">Camiseta Local 26/27</h3>
            <p className="text-forest-light font-bold text-lg mb-4">59,99 €</p>
            <a href="https://store.hookr.com/racing-oslo" target="_blank" rel="noreferrer" className="block w-full bg-cream text-clubBlack py-3 font-bold uppercase tracking-widest hover:bg-white transition-colors">
              Comprar
            </a>
          </div>
        </div>

        {/* Mallas / Training */}
        <div className="bg-black border border-forest/30 rounded-sm overflow-hidden group">
          <div className="relative h-80 bg-forest-dark/20 p-8 flex items-center justify-center">
            <img src="/media/crest.jpg" alt="Training" className="w-48 h-48 object-cover rounded-full mix-blend-screen opacity-50 group-hover:opacity-100 transition-opacity" />
            <div className="absolute top-4 right-4 bg-gray-600 text-cream text-xs font-bold px-2 py-1 uppercase">Entrenamiento</div>
          </div>
          <div className="p-6 text-center">
            <h3 className="text-xl font-display font-bold mb-2">Chándal Oficial</h3>
            <p className="text-forest-light font-bold text-lg mb-4">74,99 €</p>
            <a href="https://store.hookr.com/racing-oslo" target="_blank" rel="noreferrer" className="block w-full bg-cream text-clubBlack py-3 font-bold uppercase tracking-widest hover:bg-white transition-colors">
              Comprar
            </a>
          </div>
        </div>

        {/* Promo Box */}
        <div className="bg-forest border border-forest-light rounded-sm p-8 flex flex-col justify-center text-center">
          <Tag size={40} className="mx-auto text-cream mb-4" />
          <h3 className="text-3xl font-display font-bold text-white mb-4">Socio Fundador</h3>
          <p className="text-cream-dark text-sm mb-6">Usa el código de Mateo Oslomany al tramitar tu pedido y llévate un 15% de descuento en toda la tienda.</p>
          <code className="bg-black text-white text-2xl font-mono py-3 px-6 rounded-sm tracking-widest border border-forest-light">OSLO15</code>
        </div>
      </div>
    </div>
  )
}
