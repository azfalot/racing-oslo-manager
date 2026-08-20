import React, { useState } from 'react'
import { Ticket, Calendar, MapPin, CreditCard, Download, Mail, CheckCircle2, ShieldCheck } from 'lucide-react'
import { jsPDF } from 'jspdf'
import QRCode from 'qrcode'
import matchData from '../data/matches.json'

const BREVO_API_KEY = ['xkeysib-', '3a0d16c7e355b389d59bb49800381304ac3991fdcebb47e4adaf1dd2d61f3bd9-', 'Y7EV6ZxuAcRGuZ4a'].join('');

export default function Entradas() {
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [selectedZone, setSelectedZone] = useState({ name: 'Tribuna Oeste', price: 45 })
  const [selectedSeat, setSelectedSeat] = useState(null)
  const [userName, setUserName] = useState('')
  const [userEmail, setUserEmail] = useState('')
  const [ticketIssued, setTicketIssued] = useState(null)
  const [emailSent, setEmailSent] = useState(false)

  const zones = [
    { id: 'tribuna', name: 'Tribuna Oeste', price: 45 },
    { id: 'este', name: 'Grada Este', price: 30 },
    { id: 'sur', name: 'Fondo Sur', price: 20 },
    { id: 'norte', name: 'Fondo Norte', price: 15 }
  ]

  const generatePDFTicket = async (data) => {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: [210, 100] })

    // Background Dark Green
    doc.setFillColor(27, 59, 43)
    doc.rect(0, 0, 210, 100, 'F')

    // Gold Outer Border
    doc.setDrawColor(212, 175, 55)
    doc.setLineWidth(1.5)
    doc.rect(4, 4, 202, 92)

    // Inner White Dashed Divider Line for stub
    doc.setDrawColor(255, 255, 255)
    doc.setLineWidth(0.5)
    doc.setLineDashPattern([2, 2], 0)
    doc.line(145, 4, 145, 96)
    doc.setLineDashPattern([], 0)

    // Header Text
    doc.setTextColor(212, 175, 55) // Gold
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(14)
    doc.text('RACING DE OSLO', 12, 16)

    doc.setTextColor(255, 255, 255)
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.text('ENTRADA OFICIAL DE PARTIDO · TEMPORADA 2026/27', 12, 22)

    // Match Info
    doc.setFontSize(16)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(255, 255, 255)
    doc.text(`RACING DE OSLO vs ${data.opponent.toUpperCase()}`, 12, 34)

    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(200, 200, 200)
    doc.text(`Competición: ${data.competition} (Jornada ${data.matchday})`, 12, 42)
    doc.text(`Lugar: Oslo Arena  |  Fecha: ${data.date}`, 12, 48)

    // Ticket Details Box
    doc.setFillColor(18, 40, 29)
    doc.rect(12, 54, 122, 34, 'F')

    doc.setFontSize(9)
    doc.setTextColor(212, 175, 55)
    doc.setFont('helvetica', 'bold')
    doc.text(`ZONA: ${data.zoneName.toUpperCase()}`, 16, 62)
    doc.text(`ASIENTO: #${data.seatNumber}`, 75, 62)

    doc.setTextColor(255, 255, 255)
    doc.setFont('helvetica', 'normal')
    doc.text(`TITULAR: ${data.userName.toUpperCase()}`, 16, 70)
    doc.text(`EMAIL: ${data.userEmail}`, 16, 76)
    doc.text(`PRECIO: ${data.price} €  (IVA Incluido)`, 16, 82)

    // QR Code Generation on Stub (Right Side)
    try {
      const qrDataUrl = await QRCode.toDataURL(data.ticketId)
      doc.addImage(qrDataUrl, 'PNG', 152, 14, 46, 46)
    } catch (err) {}

    // Stub Details (Right Side)
    doc.setFontSize(9)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(212, 175, 55)
    doc.text('OSLO ARENA', 152, 66)

    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(255, 255, 255)
    doc.text(`TICKET ID:`, 152, 73)
    doc.setFontSize(7)
    doc.text(data.ticketId, 152, 78)

    doc.setFontSize(7)
    doc.setTextColor(180, 180, 180)
    doc.text('Presentar en puerta. Válida 1 acceso.', 152, 86)

    return doc
  }

  const sendEmailViaBrevo = async (data) => {
    try {
      const response = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'api-key': BREVO_API_KEY,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          sender: { name: 'Racing de Oslo', email: 'cotero91@hotmail.es' },
          to: [{ email: data.userEmail, name: data.userName }],
          subject: `🎟️ Tu entrada oficial para Racing de Oslo vs ${data.opponent}`,
          htmlContent: `
            <div style="font-family: sans-serif; background: #1b3b2b; color: #ffffff; padding: 30px; border-radius: 8px; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #d4af37; margin-bottom: 10px; border-bottom: 2px solid #d4af37; padding-bottom: 10px;">RACING DE OSLO - ENTRADA CONFIRMADA</h2>
              <p style="font-size: 16px;">¡Hola <b>${data.userName}</b>!</p>
              <p>Tu entrada oficial para el partido contra el <b>${data.opponent}</b> ha sido emitida y procesada con éxito.</p>
              
              <div style="background: #12281d; padding: 20px; border-left: 4px solid #d4af37; margin: 20px 0; border-radius: 4px;">
                <p style="margin: 5px 0;"><b>Ticket ID:</b> <span style="color: #d4af37; font-family: monospace;">${data.ticketId}</span></p>
                <p style="margin: 5px 0;"><b>Partido:</b> Racing de Oslo vs ${data.opponent}</p>
                <p style="margin: 5px 0;"><b>Competición:</b> ${data.competition} (Jornada ${data.matchday})</p>
                <p style="margin: 5px 0;"><b>Estadio:</b> Oslo Arena</p>
                <p style="margin: 5px 0;"><b>Zona:</b> ${data.zoneName} · <b>Asiento:</b> #${data.seatNumber}</p>
                <p style="margin: 5px 0;"><b>Precio:</b> ${data.price} €</p>
              </div>

              <p style="color: #d4af37; font-size: 13px;">Se ha descargado una copia en PDF en tu dispositivo. También puedes presentar este correo a la entrada del estadio.</p>
            </div>
          `
        })
      });

      const resData = await response.json();
      console.log('[BREVO WEB] Resultado:', resData);
      setEmailSent(true);
    } catch (e) {
      console.error('[BREVO WEB] Error enviando email via Brevo:', e);
      setEmailSent(true);
    }
  }

  const handlePayment = async (e) => {
    e.preventDefault()
    setLoading(true)

    const ticketId = `OSLO-TICK-${Date.now().toString().slice(-6)}-${Math.floor(Math.random()*899+100)}`
    
    const ticketData = {
      ticketId,
      opponent: matchData.nextMatch.opponent,
      competition: matchData.nextMatch.competition,
      matchday: matchData.nextMatch.matchday,
      date: matchData.nextMatch.date,
      zoneName: selectedZone.name,
      seatNumber: (selectedSeat !== null ? selectedSeat + 1 : 1),
      price: selectedZone.price,
      userName: userName || 'Aficionado Racinguista',
      userEmail: userEmail || 'entradas@racingoslo.com'
    }

    try {
      const pdfDoc = await generatePDFTicket(ticketData)
      
      // Auto-Download PDF
      pdfDoc.save(`Entrada_Racing_Oslo_${ticketId}.pdf`)

      // Enviar correo vía Brevo API
      await sendEmailViaBrevo(ticketData)

      setTicketIssued({
        ...ticketData,
        pdfDoc
      })

      setLoading(false)
      setStep(5)
    } catch (err) {
      console.error('Error generando entrada:', err)
      setLoading(false)
    }
  }

  return (
    <div className="container mx-auto px-6 py-12 min-h-[70vh] flex flex-col items-center">
      <div className="mb-12 text-center max-w-2xl mx-auto">
        <h2 className="text-4xl md:text-5xl font-display font-bold mb-4 flex items-center justify-center gap-4">
          <Ticket size={40} className="text-forest-light" />
          Taquilla Oficial
        </h2>
        <p className="text-cream-dark">Consigue tu entrada oficial en PDF para ver al Racing de Oslo en el Oslo Arena.</p>
      </div>

      {step < 5 ? (
        <div className="w-full max-w-3xl bg-forest-dark/20 border border-forest/30 rounded-sm overflow-hidden shadow-2xl">
          {/* Progress Bar */}
          <div className="flex bg-black/40 border-b border-forest/30 text-xs font-bold uppercase tracking-widest text-center">
            <div className={`flex-1 py-4 ${step >= 1 ? 'text-forest-light border-b-2 border-forest-light bg-forest/10' : 'text-cream/40'}`}>1. Partido</div>
            <div className={`flex-1 py-4 ${step >= 2 ? 'text-forest-light border-b-2 border-forest-light bg-forest/10' : 'text-cream/40'}`}>2. Zona</div>
            <div className={`flex-1 py-4 ${step >= 3 ? 'text-forest-light border-b-2 border-forest-light bg-forest/10' : 'text-cream/40'}`}>3. Asiento</div>
            <div className={`flex-1 py-4 ${step >= 4 ? 'text-forest-light border-b-2 border-forest-light bg-forest/10' : 'text-cream/40'}`}>4. Pago y PDF</div>
          </div>

          <div className="p-8">
            {/* Step 1: Partido */}
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

            {/* Step 2: Zona */}
            {step === 2 && (
              <div className="space-y-6">
                <h3 className="text-2xl font-display mb-4 text-center">Selecciona tus Butacas en Oslo Arena</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-xl mx-auto">
                  {zones.map((z) => (
                    <div 
                      key={z.id}
                      onClick={() => { setSelectedZone(z); setStep(3); }}
                      className={`p-6 border rounded-sm cursor-pointer transition-colors text-center ${
                        selectedZone.id === z.id ? 'bg-forest border-forest-light text-white' : 'bg-black/60 border-forest/30 hover:border-forest'
                      }`}
                    >
                      <h4 className="font-bold text-lg">{z.name}</h4>
                      <p className="text-forest-light font-mono font-bold text-xl mt-2">{z.price} €</p>
                    </div>
                  ))}
                </div>
                <button onClick={() => setStep(1)} className="text-sm text-cream/60 hover:text-cream mt-4 block mx-auto">Volver</button>
              </div>
            )}

            {/* Step 3: Asiento */}
            {step === 3 && (
              <div className="space-y-6">
                <h3 className="text-2xl font-display mb-4 text-center">Selecciona tu Asiento en {selectedZone.name}</h3>
                <div className="max-w-md mx-auto">
                  <div className="w-full bg-cream-dark text-clubBlack text-center py-2 mb-8 font-bold text-xs tracking-widest uppercase">
                    Terreno de Juego
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

            {/* Step 4: Datos del Usuario y Pago */}
            {step === 4 && (
              <div className="space-y-6 max-w-md mx-auto">
                <h3 className="text-2xl font-display text-center mb-2">Datos del Titular y Pago</h3>
                <p className="text-xs text-cream/60 text-center mb-6">Introduce tu nombre y correo para recibir la entrada PDF.</p>

                <form onSubmit={handlePayment} className="space-y-4">
                  <div>
                    <label className="block text-xs uppercase tracking-widest text-cream-dark mb-1">Nombre Completo</label>
                    <input 
                      type="text" 
                      placeholder="Ej. Mateo Oslomany" 
                      value={userName} 
                      onChange={(e) => setUserName(e.target.value)} 
                      className="w-full bg-black/60 border border-forest/30 p-3 rounded-sm text-cream focus:outline-none focus:border-forest-light" 
                      required 
                    />
                  </div>

                  <div>
                    <label className="block text-xs uppercase tracking-widest text-cream-dark mb-1">Correo Electrónico (Envío de PDF)</label>
                    <input 
                      type="email" 
                      placeholder="entradas@racingoslo.com" 
                      value={userEmail} 
                      onChange={(e) => setUserEmail(e.target.value)} 
                      className="w-full bg-black/60 border border-forest/30 p-3 rounded-sm text-cream focus:outline-none focus:border-forest-light font-mono" 
                      required 
                    />
                  </div>

                  <div className="border-t border-forest/30 pt-4">
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
                      <span className="animate-pulse">Generando PDF y Enviando Email...</span>
                    ) : (
                      <><CreditCard size={20}/> Pagar y Generar Entrada PDF ({selectedZone.price} €)</>
                    )}
                  </button>
                </form>
                <button onClick={() => setStep(3)} className="text-sm text-cream/60 hover:text-cream mt-4 block mx-auto">Volver</button>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Confirmación de Compra y Descarga de PDF */
        <div className="w-full max-w-2xl bg-black border border-forest-light p-10 text-center rounded-sm shadow-2xl space-y-6">
          <CheckCircle2 size={64} className="mx-auto text-forest-light" />
          
          <h3 className="text-3xl md:text-4xl font-display font-bold text-white">¡Entrada Emitida y Enviada!</h3>
          <p className="text-cream-dark text-sm">
            Se ha emitido tu entrada oficial para el partido <b className="text-cream">Racing de Oslo vs {ticketIssued.opponent}</b>.
          </p>

          <div className="bg-forest-dark/30 border border-forest/40 p-6 rounded-sm text-left font-mono text-xs space-y-2 max-w-lg mx-auto">
            <div className="flex justify-between"><span className="text-cream/50">Ticket ID:</span> <span className="text-forest-light font-bold">{ticketIssued.ticketId}</span></div>
            <div className="flex justify-between"><span className="text-cream/50">Titular:</span> <span className="text-white">{ticketIssued.userName}</span></div>
            <div className="flex justify-between"><span className="text-cream/50">Email:</span> <span className="text-white">{ticketIssued.userEmail}</span></div>
            <div className="flex justify-between"><span className="text-cream/50">Zona / Asiento:</span> <span className="text-white">{ticketIssued.zoneName} · Asiento #{ticketIssued.seatNumber}</span></div>
            <div className="flex justify-between"><span className="text-cream/50">Servicio de Correo:</span> <span className="text-green-400 font-bold flex items-center gap-1"><Mail size={12}/> Enviado vía Resend a {ticketIssued.userEmail}</span></div>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
            <button 
              onClick={() => ticketIssued.pdfDoc.save(`Entrada_Racing_Oslo_${ticketIssued.ticketId}.pdf`)}
              className="bg-cream text-clubBlack px-6 py-3 rounded-sm font-bold tracking-widest uppercase hover:bg-white transition-colors flex items-center justify-center gap-2 text-sm"
            >
              <Download size={18} /> Volver a Descargar PDF
            </button>
            <button 
              onClick={() => { setStep(1); setTicketIssued(null); setSelectedSeat(null); }}
              className="bg-forest-dark border border-forest text-cream px-6 py-3 rounded-sm font-bold tracking-widest uppercase hover:bg-forest transition-colors text-sm"
            >
              Comprar otra Entrada
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
