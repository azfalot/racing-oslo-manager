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
        {/* Productos */}
        {[
          { name: "Camiseta Local", price: "59,99 €", type: "1ª Equipación 26/27" },
          { name: "Chándal Oficial", price: "74,99 €", type: "Entrenamiento" },
          { name: "Sudadera Clásica", price: "49,99 €", type: "Ropa Casual" },
          { name: "Bufanda del Club", price: "19,99 €", type: "Accesorios" },
          { name: "Gorra", price: "24,99 €", type: "Accesorios" }
        ].map((item, idx) => (
          <div key={idx} className="bg-black border border-forest/30 rounded-sm overflow-hidden group">
            <div className="relative h-64 bg-forest-dark/20 flex items-center justify-center overflow-hidden">
              <img src="/media/merch_collection.jpg" alt={item.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500 opacity-80 group-hover:opacity-100" />
              <div className="absolute top-4 right-4 bg-forest text-cream text-[10px] font-bold px-2 py-1 uppercase">{item.type}</div>
            </div>
            <div className="p-6 text-center">
              <h3 className="text-xl font-display font-bold mb-2">{item.name}</h3>
              <p className="text-forest-light font-bold text-lg mb-4">{item.price}</p>
              <a href="https://store.hookr.com/racing-oslo" target="_blank" rel="noreferrer" className="block w-full bg-cream text-clubBlack py-3 font-bold uppercase tracking-widest hover:bg-white transition-colors">
                Comprar
              </a>
            </div>
          </div>
        ))}

        {/* Promo Box Socio Fundador */}
        <div className="bg-gradient-to-br from-forest to-black border border-forest-light rounded-sm p-8 flex flex-col justify-center text-center shadow-lg">
          <Tag size={40} className="mx-auto text-[#D4AF37] mb-4" />
          <h3 className="text-3xl font-display font-bold text-[#D4AF37] mb-4">Socio Fundador</h3>
          <p className="text-cream-dark text-sm mb-6">Usa el código de Mateo Oslomany al tramitar tu pedido y llévate un 15% de descuento en la colección.</p>
          <code className="bg-black text-[#D4AF37] text-2xl font-mono py-3 px-6 rounded-sm tracking-widest border border-[#D4AF37]">OSLO15</code>
        </div>
      </div>
    </div>
  )
}
