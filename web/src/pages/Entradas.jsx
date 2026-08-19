import React, { useState } from 'react'
import { Ticket, Calendar, MapPin, CreditCard, AlertCircle, XCircle } from 'lucide-react'
import matchData from '../data/matches.json'

export default function Entradas() {
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [showPrank, setShowPrank] = useState(false)
  const [selectedSeat, setSelectedSeat] = useState(null)

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
            <div className={`flex-1 py-4 ${step >= 3 ? 'text-forest-light border-b-2 border-forest-light bg-forest/10' : 'text-cream/40'}`}>3. Asiento</div>
            <div className={`flex-1 py-4 ${step >= 4 ? 'text-forest-light border-b-2 border-forest-light bg-forest/10' : 'text-cream/40'}`}>4. Pago</div>
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
                    <span className="bg-cream text-clubBlack text-xs font-bold px-2 py-1 uppercase">{matchData.nextMatch.competition}</span>
                    <span className="text-forest-light font-bold">Jornada {matchData.nextMatch.matchday}</span>
                  </div>
                  <h4 className="text-3xl font-display font-bold mb-2">Racing de Oslo vs {matchData.nextMatch.opponent}</h4>
                  <div className="flex gap-4 text-cream-dark text-sm">
                    <span className="flex items-center gap-1"><Calendar size={16}/> {matchData.nextMatch.date}</span>
                    <span className="flex items-center gap-1"><MapPin size={16}/> {matchData.nextMatch.venue}</span>
                  </div>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-6">
                <h3 className="text-2xl font-display mb-4 text-center">Selecciona tus Butacas en Oslo Arena</h3>
                <div className="relative w-full max-w-lg mx-auto bg-green-900 border-2 border-white rounded-lg p-4 aspect-[4/3] flex flex-col justify-between">
                  {/* Campo */}
                  <div className="absolute inset-4 border border-white/50 rounded-sm flex items-center justify-center opacity-30 pointer-events-none">
                    <div className="w-16 h-16 border border-white/50 rounded-full"></div>
                    <div className="absolute w-full h-px bg-white/50"></div>
                  </div>
                  
                  {/* Gradas */}
                  <div className="grid grid-cols-3 gap-2 h-full z-10 relative">
                    <div className="col-span-3 flex justify-center">
                      <button onClick={() => setStep(3)} className="w-3/4 bg-forest-dark/80 hover:bg-forest hover:border-forest-light border border-transparent p-2 text-xs font-bold text-center transition-colors rounded-b-lg">Fondo Norte (15€)</button>
                    </div>
                    <div className="flex flex-col justify-center items-start">
                      <button onClick={() => setStep(3)} className="h-3/4 w-8 bg-forest-dark/80 hover:bg-forest hover:border-forest-light border border-transparent p-2 text-xs font-bold transition-colors rounded-r-lg writing-vertical-rl rotate-180">Tribuna Oeste (45€)</button>
                    </div>
                    <div className="flex items-center justify-center pointer-events-none">
                      {/* Círculo central vacío para diseño */}
                    </div>
                    <div className="flex flex-col justify-center items-end">
                      <button onClick={() => setStep(3)} className="h-3/4 w-8 bg-forest-dark/80 hover:bg-forest hover:border-forest-light border border-transparent p-2 text-xs font-bold transition-colors rounded-l-lg writing-vertical-rl">Grada Este (30€)</button>
                    </div>
                    <div className="col-span-3 flex justify-center items-end">
                      <button onClick={() => setStep(3)} className="w-3/4 bg-forest-dark/80 hover:bg-forest hover:border-forest-light border border-transparent p-2 text-xs font-bold text-center transition-colors rounded-t-lg">Fondo Sur (20€)</button>
                    </div>
                  </div>
                </div>
                <p className="text-center text-xs text-cream-dark uppercase tracking-widest mt-4">Haz clic en la grada para continuar</p>
                <button onClick={() => setStep(1)} className="text-sm text-cream/60 hover:text-cream mt-4 block mx-auto">Volver</button>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-6">
                <h3 className="text-2xl font-display mb-4 text-center">Selecciona tu Asiento</h3>
                <div className="max-w-md mx-auto">
                  <div className="w-full bg-cream-dark text-clubBlack text-center py-2 mb-8 font-bold text-xs tracking-widest uppercase">
                    Césped
                  </div>
                  <div className="grid grid-cols-8 gap-2">
                    {Array.from({length: 32}).map((_, i) => (
                      <button 
                        key={i}
                        onClick={() => setSelectedSeat(i)}
                        className={`w-full aspect-square rounded-sm border flex items-center justify-center text-[10px] transition-colors ${
                          selectedSeat === i 
                            ? 'bg-forest-light border-forest-light text-white font-bold' 
                            : 'bg-black/60 border-forest/30 hover:border-forest text-cream-dark'
                        }`}
                      >
                        {i + 1}
                      </button>
                    ))}
                  </div>
                  <button 
                    onClick={() => setStep(4)} 
                    disabled={selectedSeat === null}
                    className="w-full bg-forest text-cream font-bold uppercase tracking-widest py-3 rounded-sm hover:bg-forest-light transition-colors mt-8 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Confirmar Asiento
                  </button>
                  <button onClick={() => setStep(2)} className="text-sm text-cream/60 hover:text-cream mt-4 block mx-auto">Volver</button>
                </div>
              </div>
            )}

            {step === 4 && (
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
                <button onClick={() => setStep(3)} className="text-sm text-cream/60 hover:text-cream mt-4 block mx-auto">Volver</button>
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
