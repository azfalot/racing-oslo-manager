import React from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import squadData from '../data/squad.json'
import marketData from '../data/market.json'
import PlayerProfileModal from '../components/PlayerProfileModal'

export default function JugadorPage() {
  const { id } = useParams()
  const navigate = useNavigate()

  const playerId = parseInt(id)
  const allPlayers = [...(squadData.players || []), ...(marketData || [])]
  const player = allPlayers.find(p => p.id === playerId)

  if (!player) {
    return (
      <div className="container mx-auto px-6 py-20 text-center space-y-4">
        <h2 className="text-3xl font-display font-bold text-white">Jugador no encontrado</h2>
        <p className="text-cream/70 text-sm">No se han encontrado registros oficiales para el jugador #{id}.</p>
        <Link to="/" className="inline-block bg-forest text-cream font-bold px-6 py-2 rounded-sm text-xs tracking-wider">
          VOLVER AL INICIO
        </Link>
      </div>
    )
  }

  return <PlayerProfileModal player={player} onClose={() => navigate(-1)} />
}
