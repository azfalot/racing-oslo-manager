import React from 'react'
import newsData from '../data/news.json'
import { Calendar } from 'lucide-react'

export default function Noticias() {
  return (
    <div className="container mx-auto px-6 py-12">
      <div className="mb-12">
        <h2 className="text-4xl md:text-5xl font-display font-bold mb-4 border-l-4 border-forest pl-4">Comunicados Oficiales</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl">
        {newsData.map(news => (
          <article key={news.id} className="bg-forest-dark/10 border border-forest/20 rounded-sm overflow-hidden group hover:border-forest/50 transition-colors">
            <div className="h-64 overflow-hidden relative">
              <img src={news.image} alt={news.title} className="w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-700" />
              <div className="absolute top-4 left-4">
                <span className="bg-forest text-cream text-xs font-bold px-3 py-1 uppercase tracking-wider shadow-lg">{news.category}</span>
              </div>
            </div>
            <div className="p-6">
              <div className="flex items-center gap-2 text-xs text-forest-light font-semibold mb-3">
                <Calendar size={14} />
                <span>{new Date(news.date).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
              </div>
              <h3 className="text-2xl font-display font-bold mb-3 group-hover:text-white transition-colors">{news.title}</h3>
              <p className="text-cream-dark text-sm leading-relaxed">{news.excerpt}</p>
              <button className="mt-6 text-sm font-bold tracking-widest text-forest-light group-hover:text-cream transition-colors uppercase flex items-center gap-2">
                Leer más &rarr;
              </button>
            </div>
          </article>
        ))}
      </div>
    </div>
  )
}
