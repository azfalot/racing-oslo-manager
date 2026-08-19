import React, { useState } from 'react'
import { Ticket, Calendar, MapPin, CreditCard, AlertCircle, XCircle } from 'lucide-react'

export default function Entradas() {
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [showPrank, setShowPrank] = useState(false)

  const handlePayment = (e) => {
    e.preventDefault()
    setLoading(true)
    setTimeout(() => {
      setLoading(false)
      setShowPrank(true)
    }, 2000)
  }

  return (
    <div className="container mx-auto px-6 py-12 min-h-[70vh] flex flex-col items-center">
      <div className="mb-12 text-center max-w-2xl mx-auto">
        <h2 className="text-4xl md:text-5xl font-display font-bold mb-4 flex items-center justify-center gap-4">
          <Ticket size={40} className="text-forest-light" />
          Taquilla Oficial
        </h2>
        <p className="text-cream-dark">Consigue tus entradas para los próximos partidos en el Oslo Arena.</p>
      </div>

      {!showPrank ? (
        <div className="w-full max-w-3xl bg-forest-dark/20 border border-forest/30 rounded-sm overflow-hidden">
          {/* Progress Bar */}
          <div className="flex bg-black/40 border-b border-forest/30 text-xs font-bold uppercase tracking-widest text-center">
            <div className={`flex-1 py-4 ${step >= 1 ? 'text-forest-light border-b-2 border-forest-light bg-forest/10' : 'text-cream/40'}`}>1. Partido</div>
            <div className={`flex-1 py-4 ${step >= 2 ? 'text-forest-light border-b-2 border-forest-light bg-forest/10' : 'text-cream/40'}`}>2. Zona</div>
            <div className={`flex-1 py-4 ${step >= 3 ? 'text-forest-light border-b-2 border-forest-light bg-forest/10' : 'text-cream/40'}`}>3. Pago</div>
          </div>

          <div className="p-8">
            {step === 1 && (
              <div className="space-y-6">
                <h3 className="text-2xl font-display mb-4">Selecciona el Partido</h3>
                <div 
                  className="bg-black/60 border border-forest/50 hover:border-cream cursor-pointer p-6 rounded-sm transition-colors"
                  onClick={() => setStep(2)}
                >
                  <div className="flex justify-between items-center mb-4">
                    <span className="bg-cream text-clubBlack text-xs font-bold px-2 py-1 uppercase">Próximo Partido</span>
                    <span className="text-forest-light font-bold">Jornada 1</span>
                  </div>
                  <h4 className="text-3xl font-display font-bold mb-2">Racing de Oslo vs CD Cayón B</h4>
                  <div className="flex gap-4 text-cream-dark text-sm">
                    <span className="flex items-center gap-1"><Calendar size={16}/> Sábado, 18:00h</span>
                    <span className="flex items-center gap-1"><MapPin size={16}/> Oslo Arena</span>
                  </div>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-6">
                <h3 className="text-2xl font-display mb-4">Selecciona tu Zona</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {['Tribuna Principal (45€)', 'Fondo Sur (20€)', 'Grada Lateral (30€)', 'VIP Lounge (120€)'].map((zona, i) => (
                    <div 
                      key={i} 
                      className="bg-black/60 border border-forest/30 hover:border-forest-light cursor-pointer p-4 rounded-sm flex justify-between items-center transition-colors"
                      onClick={() => setStep(3)}
                    >
                      <span className="font-semibold">{zona}</span>
                      <Ticket size={20} className="text-forest-light"/>
                    </div>
                  ))}
                </div>
                <button onClick={() => setStep(1)} className="text-sm text-cream/60 hover:text-cream mt-4 block">Volver</button>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-6 max-w-md mx-auto">
                <h3 className="text-2xl font-display text-center mb-6">Pasarela de Pago Segura</h3>
                <form onSubmit={handlePayment} className="space-y-4">
                  <div>
                    <label className="block text-xs uppercase tracking-widest text-cream-dark mb-1">Número de Tarjeta</label>
                    <input type="text" placeholder="0000 0000 0000 0000" className="w-full bg-black/60 border border-forest/30 p-3 rounded-sm text-cream focus:outline-none focus:border-forest-light font-mono" required />
                  </div>
                  <div className="flex gap-4">
                    <div className="flex-1">
                      <label className="block text-xs uppercase tracking-widest text-cream-dark mb-1">Caducidad</label>
                      <input type="text" placeholder="MM/AA" className="w-full bg-black/60 border border-forest/30 p-3 rounded-sm text-cream focus:outline-none focus:border-forest-light font-mono" required />
                    </div>
                    <div className="flex-1">
                      <label className="block text-xs uppercase tracking-widest text-cream-dark mb-1">CVV</label>
                      <input type="text" placeholder="123" className="w-full bg-black/60 border border-forest/30 p-3 rounded-sm text-cream focus:outline-none focus:border-forest-light font-mono" required />
                    </div>
                  </div>
                  <button 
                    type="submit" 
                    className="w-full bg-cream text-clubBlack font-bold uppercase tracking-widest py-4 rounded-sm hover:bg-white transition-colors mt-6 flex justify-center items-center gap-2"
                    disabled={loading}
                  >
                    {loading ? (
                      <span className="animate-pulse">Procesando pago...</span>
                    ) : (
                      <><CreditCard size={20}/> Pagar Entrada</>
                    )}
                  </button>
                </form>
                <button onClick={() => setStep(2)} className="text-sm text-cream/60 hover:text-cream mt-4 block mx-auto">Volver</button>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="w-full max-w-2xl bg-black border border-forest-light p-12 text-center rounded-sm shadow-[0_0_50px_rgba(30,61,32,0.5)] animate-fade-in">
          <AlertCircle size={60} className="mx-auto text-forest-light mb-6" />
          <h3 className="text-4xl font-display font-bold mb-4 text-white">¡INOCENTE! 🃏</h3>
          <p className="text-lg text-cream-dark leading-relaxed mb-8">
            El <b>Racing de Oslo</b> es un club tan exclusivo que el Oslo Arena existe solo en nuestros corazones (y en los servidores de Comunio). <br/><br/>
            Guarda tu cartera, no te vamos a cobrar entrada por ver jugar a Álex Remiro y Gerard Moreno... al menos de momento 😉.
          </p>
          <button onClick={() => window.location.href='/'} className="bg-forest text-cream px-8 py-3 rounded-sm font-bold tracking-widest uppercase hover:bg-forest-light transition-colors">
            Volver al inicio
          </button>
        </div>
      )}
    </div>
  )
}
