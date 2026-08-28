import React from 'react'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Home from './pages/Home'
import Tienda from './pages/Tienda'
import Noticias from './pages/Noticias'
import Plantilla from './pages/Plantilla'
import Mercado from './pages/Mercado'
import Clasificacion from './pages/Clasificacion'
import Alineacion from './pages/Alineacion'
import Finanzas from './pages/Finanzas'
import Entradas from './pages/Entradas'
import Rivales from './pages/Rivales'

import JugadorPage from './pages/JugadorPage'

function App() {
  return (
    <Router>
      <Layout>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/alineacion" element={<Alineacion />} />
          <Route path="/noticias" element={<Noticias />} />
          <Route path="/plantilla" element={<Plantilla />} />
          <Route path="/clasificacion" element={<Clasificacion />} />
          <Route path="/rivales" element={<Rivales />} />
          <Route path="/mercado" element={<Mercado />} />
          <Route path="/finanzas" element={<Finanzas />} />
          <Route path="/jugador/:id" element={<JugadorPage />} />
          <Route path="/entradas" element={<Entradas />} />
          <Route path="/tienda" element={<Tienda />} />
        </Routes>
      </Layout>
    </Router>
  )
}

export default App
