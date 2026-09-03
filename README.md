# 💼 Racing de Oslo Manager

> **Director Deportivo Autónomo:** Mateo Oslomany  
> **Club Oficial:** Racing de Oslo (`azfalot`)  
> **Plataforma:** Comunio España (Comunidad *Segunda Regional Cántabra*)  
> **Portal Web en Producción:** [https://racing-oslo.cotero91.workers.dev](https://racing-oslo.cotero91.workers.dev)

---

## 🌟 Visión General del Proyecto

**Racing de Oslo Manager** es una plataforma integral de ingeniería deportiva, optimización algorítmica y contabilidad forense para Comunio. Combina un daemon inteligente en Node.js, un motor táctico probabilístico, un libro mayor permanente y un portal web reactivo desplegado en Cloudflare Workers.

---

## 🚀 Arquitectura y Componentes Clave

### 1. 🧠 Motor Matemático & Táctico (`src/engine.js`)
* **Optimización Determinista de Alineaciones:** Algoritmo multi-formación (`3-4-3`, `3-5-2`, `4-4-2`, `4-3-3`, `5-3-2`, `5-4-1`) que maximiza los puntos esperados ponderando puntos por minuto, probabilidad de titularidad, competencia interna de plantilla y estados médicos.
* **Política de Seguridad Financiera (Regla de Oro):** Prohíbe la aceptación automática de ofertas de Computer a la baja y exige confirmación previa para ventas de piezas clave.
* **Pujas Racionales (0% Margen Especulativo):** Sistema de valoración estricta que ajusta ofertas al valor oficial del mercado evitando sobreprecios destructivos.

### 2. 📊 Auditoría Contable y Radar de Rivales (`src/generateRivalsAudit.js` & `src/rivals.js`)
* **Paginación Multi-Página de la API (`?start=X`):** Descarga el histórico de noticias (395+ comunicados) recuperando todas las operaciones desde el día 1 de la temporada.
* **Libro Mayor Permanente (`web/src/data/historicalTransactions.json`):** Persistencia inmutable que previene la pérdida de datos por la ventana deslizante del servidor de Comunio.
* **Cálculo Financiero Homogéneo (10 Clubes):**
  $$\text{Caja Estimada} = 20.000.000\text{ €} + \text{Ventas} + (\text{Puntos}\times 10.000\text{ €}) - \text{Compras}$$
  $$\text{Sobrepuja Media} = \frac{\sum (\text{Precio Pagado} - \text{Valor de Mercado})}{\sum \text{Valor de Mercado}} \times 100$$
  $$\text{Patrimonio Total} = \text{Valor de Plantilla} + \text{Caja Estimada}$$
* **Taxonomía Universal de Perfiles Trader (0-100):**
  * 🏦 **Banquero Suizo / Caja Fuerte (Score < 25):** Solvencia máxima, compras a valor y alta liquidez.
  * 📈 **Trader Táctico (Score 25-49):** Rotación moderada y sobreprecios controlados.
  * 🎰 **Especulador de Mercado (Score 50-74):** Alto volumen de operaciones y sobrepujas recurrentes.
  * 🦈 **Tiburón Kamikaze / Deuda (Score ≥ 75):** Saldo en descubierto, apalancamiento al límite del crédito permitido.
* **Detección de Diferenciales en Transacciones:**
  * 🔴 `+X.X% SOBREPRECIO` (Compras por encima de VM).
  * 🟢 `-X.X% GANGA` (Compras a precio de saldo o con plusvalía).
  * 🔵 `A VALOR` (Compras exactas al 100.0% de VM).

### 3. 🛡️ Modo Sigilo y Consumo Inteligente (`src/daemon.js`)
* **Cero Spam en Tablón Público:** Las auditorías tácticas y radares financieros se alojan exclusivamente en el portal web privado. Solo se emite comunicado público en Comunio ante fichajes galácticos (>15M €).
* **Ciclos de Sincronización Automática:**
  * **09:00h:** Sincronización matinal de mercado y actualización de noticias.
  * **15:00h:** Comprobación de estado médico y noticias de prensa deportiva.
  * **02:50h (Pre-Cierre):** Verificación de alineaciones y saldo positivo antes del corte diario.
  * **15-30 min pre-kickoff:** Blindaje de alineación y registro de pronósticos oficiales.

---

## 💻 Portal Web Oficial (`/web`)

Desarrollado en React 19 + Tailwind CSS + Vite y alojado en Cloudflare Workers:
* 🏆 **Clasificación & Plantillas en Vivo:** Puntos, valoración y alineaciones de las 10 entidades.
* 🛡️ **Rivales 360º:** Auditoría de liquidez, radar de sobrepuja, hitos de mercado (mejor compra vs peor movimiento) e historial desplegable con badges diferenciales.
* 📰 **Noticiario del Club:** Comunicados oficiales con infografías generadas dinámicamente.
* 🔮 **Predicciones & Auditoría de Jornada:** Comparativa de pronósticos vs puntos reales conseguidos.

---

## 🧪 Suite de Pruebas Automatizadas

El proyecto cuenta con una batería de tests unitarios que validan las reglas de negocio y algoritmos de optimización:

```powershell
npm test
```

```
✔ 1. Candidate beats worst player but does NOT improve best XI -> no aggressive bid
✔ 2. Candidate genuinely upgrades starting XI -> strategic score increases
✔ 3. Superstar opportunity with low cash -> valuation remains high but constrained
✔ 4. Expensive player with poor PPM -> valuation penalized appropriately
✔ 5. Strong positional need increases valuation
✔ 6. Rival pressure never exceeds maximum rational bid
✔ 7. Negative balance does NOT accept terrible offers automatically
✔ 8. Small debt prefers low-impact sale over sacrificing stars
✔ 9. Two cheap sales preferred over one expensive key player
✔ 10. High-scoring redundant player can be sold if not core to XI
✔ 11. Lower-scoring core player protected against loss
✔ 12. No sale triggered when liquidity and squad are balanced
✔ 13. High-value transaction requires explicit confirmation
✔ 14. Deterministic lineup optimization validity
✔ 15. Discard sanctioned / banned players
✔ 16. Positional club competition depth chart
✔ System Rule 1: evaluateIncomingOffer NEVER accepts offers automatically
✔ System Rule 2: Deny-by-default on non-Computer auto-bidding
✔ System Rule 3: Recommended bid is strictly 100.0% of market value
✔ System Rule 4: isWithinPreMatchdayWindow checks exact 15-30 min boundary
✔ System Rule 5: getAutoBidLimit standardization
✔ System Rule 6: acquireSyncLock single-process exclusion

Total: 22 tests passing (0 failures)
```

---

## 🛠️ Despliegue y Comandos de Producción

```powershell
# Ejecutar suite de pruebas
npm test

# Generar auditoría de rivales y libro mayor
node src/generateRivalsAudit.js

# Compilar portal web
npm run build

# Reiniciar daemon en PM2
pm2 restart comunio-bot
```

---

## 📁 Estructura del Repositorio

* `src/comunioClient.js`: Conexión directa y gestión de sesiones con la API de Comunio.
* `src/engine.js`: Motor de decisión, optimización de once y lógica de pujas.
* `src/generateRivalsAudit.js`: Auditoría matemática, cálculo de sobreprecios e hitos de mercado.
* `src/rivals.js`: Inteligencia de rivales basada en histórico permanente.
* `src/daemon.js`: Planificador en segundo plano y bot interactivo de Telegram.
* `src/syncWeb.mjs`: Orquestador de sincronización web, noticias y despliegue continuo.
* `web/`: Aplicación React SPA con la suite visual del club.
* `web/src/data/historicalTransactions.json`: Libro mayor permanente con todas las transferencias de la temporada.
* `web/src/data/rivalsAudit.json`: Dataset estructurado de las 10 entidades.
