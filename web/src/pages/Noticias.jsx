import React, { useState } from 'react'
import newsData from '../data/news.json'
import { Calendar, X, Eye } from 'lucide-react'

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

export default function Noticias() {
  const [selectedNews, setSelectedNews] = useState(null)
  const [filterCategory, setFilterCategory] = useState('ALL')

  const categories = ['ALL', 'Fichajes', 'Ventas', 'Enfermería', 'Rumores', 'Club', 'Equipo']

  const filteredNews = filterCategory === 'ALL'
    ? newsData
    : newsData.filter(n => (n.category || '').toLowerCase() === filterCategory.toLowerCase())

  return (
    <div className="container mx-auto px-6 py-12">
      {/* Title & Filter Tabs */}
      <div className="mb-10 space-y-6">
        <div>
          <h2 className="text-4xl md:text-5xl font-display font-bold mb-2 border-l-4 border-forest pl-4">
            COMUNICADOS OFICIALES
          </h2>
          <p className="text-sm text-cream/70 pl-4 font-mono">
            Actualidad oficial, mercado de fichajes, partes médicos y comunicados del Racing de Oslo.
          </p>
        </div>

        {/* Category Filters */}
        <div className="flex flex-wrap gap-2 pt-2 border-b border-forest/30 pb-4">
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setFilterCategory(cat)}
              className={`px-4 py-2 text-xs font-bold tracking-widest uppercase transition-all rounded-sm ${
                filterCategory === cat
                  ? 'bg-forest text-cream border border-forest-light shadow-md'
                  : 'bg-black/40 text-cream/70 hover:bg-white/10 hover:text-white border border-forest/20'
              }`}
            >
              {cat === 'ALL' ? 'TODOS' : cat}
            </button>
          ))}
        </div>
      </div>

      {/* News Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {filteredNews.map(news => (
          <article
            key={news.id}
            onClick={() => setSelectedNews(news)}
            className="bg-forest-dark/10 border border-forest/30 rounded-sm overflow-hidden group hover:border-forest-light transition-all cursor-pointer flex flex-col justify-between shadow-xl"
          >
            <div>
              {/* Image Preview Container */}
              <div className="h-56 overflow-hidden relative bg-black/60 flex items-center justify-center">
                <img
                  src={news.image}
                  alt={news.title}
                  className="w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-700"
                  onError={(e) => { e.target.src = '/media/crest.jpg' }}
                />
                <div className="absolute top-4 left-4">
                  <span className="bg-forest text-cream text-[10px] font-bold px-3 py-1 uppercase tracking-widest rounded-sm shadow-md border border-forest-light/40">
                    {news.category || 'NOTICIA'}
                  </span>
                </div>
              </div>

              {/* Card Body */}
              <div className="p-6 space-y-3">
                <div className="flex items-center gap-2 text-xs text-forest-light font-semibold font-mono">
                  <Calendar size={14} />
                  <span>{formatNewsDate(news.date)}</span>
                </div>
                <h3 className="text-xl font-display font-bold group-hover:text-forest-light transition-colors leading-tight">
                  {news.title}
                </h3>
                <p className="text-cream-dark text-xs sm:text-sm line-clamp-3 leading-relaxed">
                  {news.excerpt || news.summary}
                </p>
              </div>
            </div>

            {/* Read More Footer */}
            <div className="p-6 pt-0">
              <button className="text-xs font-bold tracking-widest text-forest-light group-hover:text-cream transition-colors uppercase flex items-center gap-2">
                <Eye size={14} /> Leer Comunicado &rarr;
              </button>
            </div>
          </article>
        ))}
      </div>

      {/* FULL UNTRUNCATED NEWS MODAL */}
      {selectedNews && (
        <div className="fixed inset-0 z-50 bg-black/95 backdrop-blur-md flex items-center justify-center p-4 sm:p-6">
          <div className="bg-clubBlack border border-forest-light/60 max-w-3xl w-full rounded-sm overflow-hidden animate-fade-in relative max-h-[92vh] flex flex-col shadow-2xl">
            {/* Close Button */}
            <button
              onClick={() => setSelectedNews(null)}
              className="absolute top-4 right-4 z-30 bg-black/80 p-2.5 rounded-full hover:bg-forest text-cream transition-colors border border-forest/40 focus:outline-none"
              aria-label="Cerrar modal"
            >
              <X size={22} />
            </button>

            {/* Modal Body Scroll Container */}
            <div className="overflow-y-auto p-6 sm:p-8 space-y-6">
              {/* Full Graphic Image Container - UNTRUNCATED (object-contain) */}
              <div className="w-full bg-black/80 rounded-sm border border-forest/30 overflow-hidden flex items-center justify-center p-2">
                <img
                  src={selectedNews.image}
                  alt={selectedNews.title}
                  className="w-full h-auto max-h-[60vh] object-contain rounded-sm shadow-2xl"
                  onError={(e) => { e.target.src = '/media/crest.jpg' }}
                />
              </div>

              {/* News Header & Content */}
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="bg-forest text-cream text-xs font-bold px-3 py-1 uppercase tracking-widest rounded-sm border border-forest-light/40">
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
      )}
    </div>
  )
}
