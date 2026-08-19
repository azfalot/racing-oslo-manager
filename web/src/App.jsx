import React from 'react'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Home from './pages/Home'
import Tienda from './pages/Tienda'

import Noticias from './pages/Noticias'

// Placeholder components for the other routes until we build them out fully
const Plantilla = () => <div className="container mx-auto px-6 py-20 text-center"><h2 className="text-4xl font-display">PLANTILLA (En construcción)</h2></div>
const Jornadas = () => <div className="container mx-auto px-6 py-20 text-center"><h2 className="text-4xl font-display">JORNADAS (En construcción)</h2></div>


function App() {
  return (
    <Router>
      <Layout>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/noticias" element={<Noticias />} />
          <Route path="/plantilla" element={<Plantilla />} />
          <Route path="/jornadas" element={<Jornadas />} />
          <Route path="/tienda" element={<Tienda />} />
        </Routes>
      </Layout>
    </Router>
  )
}

export default App
