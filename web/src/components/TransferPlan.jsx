import React, { useEffect, useState } from 'react'
import data from '../data/transferPlan.json'

const euros = amount => Number(amount).toLocaleString('es-ES') + ' €'
const labels = { keeper: 'Portero', defender: 'Defensa', midfielder: 'Medio', striker: 'Delantero' }

export default function TransferPlan() {
  const [price, setPrice] = useState(data.scenarios[0].price)
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60000)
    return () => clearInterval(timer)
  }, [])
  const scenario = data.scenarios.find(s => s.price === price)
  const plan = scenario.plan
  const stale = now - Date.parse(data.capturedAt) > 24 * 60 * 60 * 1000
  return <section aria-labelledby="transfer-plan-title" className="border border-amber-400/40 bg-black/40 p-4 rounded-sm space-y-4">
    <div>
      <h2 id="transfer-plan-title" className="text-lg font-bold text-amber-300">Operación Yamal</h2>
      <p className="text-sm text-cream-dark">{data.target ? `${data.target.name} · Valor de mercado ${euros(data.target.price)}` : 'Objetivo fuera del mercado'} · Datos del {new Date(data.capturedAt).toLocaleString('es-ES')}</p>
      {stale && <p role="status" className="text-amber-300">Datos de más de 24 horas. Actualiza el plan antes de operar.</p>}
    </div>
    <div className="grid sm:grid-cols-3 gap-3 text-sm">
      <p>Caja libre<br /><strong>{euros(data.availableCash)}</strong></p>
      <p>Límite de puja actual<br /><strong>{euros(data.credit)}</strong></p>
      <p>Reserva para imprevistos<br /><strong>{euros(data.reserve)}</strong></p>
    </div>
    <label className="block text-sm">Precio del fichaje
      <select value={price} onChange={event => setPrice(Number(event.target.value))} className="block mt-1 p-2 bg-forest-dark text-cream border border-forest w-full sm:w-auto">
        {data.scenarios.map(s => <option key={s.price} value={s.price}>{euros(s.price)}</option>)}
      </select>
    </label>
    {!plan ? <p role="status" className="text-red-300">No viable con una plantilla de {data.squadSize} jugadores, recambios y reserva. Reduce la puja.</p> : <>
      <p className="text-sm">Viable sobre el papel: {plan.sales.length} ventas estimadas por <strong>{euros(plan.proceeds)}</strong>. Tras el fichaje quedarían <strong>{euros(plan.cashAfterSigning)}</strong>: {euros(plan.replacementBudget)} para {plan.replacements} recambios y {euros(data.reserve)} de reserva. Margen adicional: {euros(plan.spare)}.</p>
      <p className="text-amber-300 text-sm">{data.canBidNow ? 'La caja y el crédito permiten estudiar la puja.' : 'Financiación pendiente: las ventas previstas aún no son dinero disponible.'}</p>
      <details>
        <summary className="cursor-pointer text-sm font-bold">Ver jugadores a vender ({plan.sales.length})</summary>
        <ul className="mt-2 grid sm:grid-cols-2 gap-2 text-sm">{plan.sales.map(p => <li key={p.playerId}>{p.name} — {euros(p.price)}{data.actions?.find(a => a.playerId === p.playerId)?.status === 'LISTED_VERIFIED' ? ' · En venta, verificado' : ' · Venta propuesta'}</li>)}</ul>
      </details>
      <p className="text-sm">Estructura prevista: {plan.formation}. Posiciones por cubrir: {Object.entries(plan.missingPositions).filter(([, n]) => n).map(([p, n]) => `${n} ${labels[p].toLowerCase()}`).join(', ')}. Presupuesto medio por recambio: {euros(data.replacementPrice)}.</p>
    </>}
    <details>
      <summary className="cursor-pointer text-sm font-bold">Radar por debajo de un millón</summary>
      <p className="text-xs mt-2 text-amber-300">Comprueba minutos y titularidad. Los precios de jugadores rivales son valores de mercado, no ofertas aceptadas.</p>
      <div className="overflow-x-auto mt-2"><table className="w-full text-left text-sm">
        <thead><tr><th className="p-2">Jugador</th><th className="p-2">Posición</th><th className="p-2">VM</th><th className="p-2">Media últimos 5</th><th className="p-2">Vendedor</th></tr></thead>
        <tbody>{data.cheapCandidates.map(p => <tr key={p.playerId} className="border-t border-forest/30"><td className="p-2">{p.name}</td><td className="p-2">{labels[p.position]}</td><td className="p-2 whitespace-nowrap">{euros(p.price)}</td><td className="p-2">{p.recentAverage}</td><td className="p-2">{p.owner}{!p.computer && ' · Negociar'}</td></tr>)}</tbody>
      </table></div>
    </details>
    <p className="text-xs text-cream-dark">{data.warning}</p>
  </section>
}
