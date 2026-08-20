import React from 'react'
import { ShoppingBag, Tag, ExternalLink } from 'lucide-react'

export default function Tienda() {
  const products = [
    {
      name: "Camiseta Local 26/27",
      price: "59,99 €",
      type: "1ª Equipación",
      image: "/media/products/jersey_home.jpg",
      description: "Diseño oficial crema con cruz nórdica en negro y verde bosque."
    },
    {
      name: "Chándal Oficial",
      price: "74,99 €",
      type: "Entrenamiento",
      image: "/media/products/tracksuit.jpg",
      description: "Chaqueta de cuello alto y pantalón pitillo en verde técnico."
    },
    {
      name: "Sudadera Clásica",
      price: "49,99 €",
      type: "Ropa Casual",
      image: "/media/products/hoodie.jpg",
      description: "Sudadera premium con capucha, escudo bordado y banderas nórdicas."
    },
    {
      name: "Bufanda del Club",
      price: "19,99 €",
      type: "Accesorios",
      image: "/media/products/scarf.jpg",
      description: "Pasión • Familia • Coraje • Orgullo con flecos dorados."
    },
    {
      name: "Gorra Oficial",
      price: "24,99 €",
      type: "Accesorios",
      image: "/media/products/cap.jpg",
      description: "Gorra bocolor de visera curva con escudo tejido del hurón."
    }
  ];

  return (
    <div className="container mx-auto px-6 py-12">
      {/* Header */}
      <div className="mb-12 text-center max-w-2xl mx-auto">
        <h2 className="text-4xl md:text-5xl font-display font-bold mb-4">Tienda Oficial</h2>
        <p className="text-cream-dark">Viste los colores del Racing de Oslo. Colección oficial diseñada por Hookr en colaboración con el club.</p>
      </div>

      {/* Grid de Productos Individuales */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
        {products.map((item, idx) => (
          <div key={idx} className="bg-black border border-forest/30 rounded-sm overflow-hidden group hover:border-forest-light transition-all flex flex-col justify-between">
            {/* Foto del Producto */}
            <div className="relative h-80 bg-black flex items-center justify-center overflow-hidden border-b border-forest/20">
              <img 
                src={item.image} 
                alt={item.name} 
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" 
              />
              <div className="absolute top-4 right-4 bg-forest text-cream text-[10px] font-bold px-2 py-1 uppercase tracking-wider rounded-sm shadow-md">
                {item.type}
              </div>
            </div>

            {/* Detalles */}
            <div className="p-6 flex-1 flex flex-col justify-between text-center">
              <div>
                <h3 className="text-xl font-display font-bold mb-1">{item.name}</h3>
                <p className="text-xs text-cream/60 mb-4">{item.description}</p>
              </div>
              <div>
                <p className="text-forest-light font-display font-bold text-2xl mb-4">{item.price}</p>
                <a 
                  href="https://store.hookr.com/racing-oslo" 
                  target="_blank" 
                  rel="noreferrer" 
                  className="block w-full bg-cream text-clubBlack py-3 font-bold uppercase tracking-widest hover:bg-white transition-colors text-sm rounded-sm"
                >
                  Comprar Producto
                </a>
              </div>
            </div>
          </div>
        ))}

        {/* Promo Box Socio Fundador */}
        <div className="bg-gradient-to-br from-forest-dark to-black border border-forest-light rounded-sm p-8 flex flex-col justify-center text-center shadow-2xl relative overflow-hidden">
          <Tag size={44} className="mx-auto text-[#D4AF37] mb-4" />
          <h3 className="text-3xl font-display font-bold text-[#D4AF37] mb-2">Descuento de Socio</h3>
          <p className="text-cream-dark text-sm mb-6">Usa el código oficial de Mateo Oslomany al tramitar tu pedido y consigue un 15% de descuento directo.</p>
          <div className="bg-black/80 border border-[#D4AF37] py-3 px-6 rounded-sm">
            <span className="text-xs text-cream/50 uppercase tracking-widest block mb-1">Código Promocional</span>
            <code className="text-[#D4AF37] text-2xl font-mono font-bold tracking-widest">OSLO15</code>
          </div>
        </div>
      </div>
    </div>
  )
}
