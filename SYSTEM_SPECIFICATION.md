# 📖 RACING DE OSLO MANAGER — ESPECIFICACIÓN TÉCNICA Y OPERATIVA INTERNA

**Versión:** 2.0.0  
**Estado:** Producción Blindada  
**Fecha de Revisión:** 1 de Septiembre de 2026  
**Autor:** Mateo Oslomany (Director Deportivo & IA Operativa)

---

## 🎯 1. MISIÓN Y VISIÓN DEL SISTEMA

El objetivo principal de **Racing de Oslo Manager** es maximizar de forma científica y matemática los puntos conseguidos a lo largo de las 38 jornadas de LaLiga en la plataforma Comunio, optimizando la plantilla, el valor patrimonial y la toma de decisiones sin incurrir en riesgos operativos ni sanciones por deuda.

---

## 🛡️ 2. LAS 7 REGLAS DE ORO INVIOLABLES (PROTOCOLOS DE SEGURIDAD)

Cualquier cambio de código o comportamiento del sistema debe respetar estrictamente estos 7 mandamientos operativos:

### Regla 1: PROHIBICIÓN TOTAL DE VENTAS AUTOMÁTICAS
* **El bot NUNCA aceptará una oferta de venta por su cuenta**, bajo ninguna condición de deuda, saldo o descarte.
* Todas las ofertas recibidas (de Computer o rivales) se envían a Telegram con botones interactivos:
  * `[✅ ACEPTAR VENTA (X €)]`
  * `[❌ RECHAZAR OFERTA]`
* **Solo la interacción física del mánager humano** en Telegram puede autorizar la salida de un futbolista.

### Regla 2: COMPRAS EXCLUSIVAS A COMPUTER (Cero Financiación a Rivales)
* Las compras automáticas o recomendadas se dirigen **únicamente a jugadores propiedad de Computer**.
* Queda terminantemente prohibido comprar futbolistas a mánagers rivales para evitar transferirles liquidez directa que puedan usar para competir contra nosotros.

### Regla 3: PUJAS A PRECIO EXACTO (0% Sobreprecio Innecesario)
* Las pujas emitidas a Computer deben ajustarse exactamente al **100.0% del Valor de Mercado (VM)** o precio de salida fijado por Comunio.
* No se admiten márgenes dinámicos (+1% a +10%) salvo instrucción humana explícita para asegurar un jugador concreto.

### Regla 4: TOLERANCIA CERO A OFERTAS POR DEBAJO DEL VALOR DE MERCADO
* Cualquier evaluación de venta rechazará fulminantemente ofertas con precio inferior al 100% del VM del jugador ($PrecioOferta < VM \implies RECHAZADA$).

### Regla 5: LÍNEA ROJA DE TESORERÍA Y JORNADAS
* Para sumar puntos, el saldo debe ser estrictamente **$\ge 0\text{ €}$ antes del pitido inicial del primer partido de cada jornada**.
* El sistema debe contemplar **Jornadas Extraordinarias o partidos adelantados** (ejemplo: Real Sociedad - Celta en jueves) donde el cierre contable se adelanta 24 horas.
* **Prohibido realizar ventas por pánico antes del cierre oficial de la jornada anterior**: Las decisiones de saneamiento se toman siempre tras ingresar las primas oficiales de puntos (martes por la mañana).

### Regla 6: BLINDAJE CONTRA SPAM DE ALINEACIONES
* Queda prohibido enviar y guardar alineaciones oficiales en Comunio durante los días laborables cotidianos para evitar inundar las noticias de la comunidad.
* **Ventana Oficial de Guardado:** Se ejecuta de forma única y automática **15 a 30 minutos antes del inicio del primer partido** de la jornada (`isPreMatchdaySlot`).

### Regla 7: EL ONCE TITULAR MAXIMIZA PUNTOS BRUTOS ($\max \sum E[\text{Points}]$)
* El Once Oficial debe alinear siempre a los 11 jugadores con mayor proyección de **Puntos Esperados Absolutos**, considerando estado médico y **Momentum de rendimiento reciente**.
* El ratio de ROI ($\text{pts}/\text{M€}$) se utiliza como criterio de compra/venta y desempate secundario, **nunca para sentar a titulares de alto valor que puntúan más en términos absolutos**.

---

## 🏗️ 3. ARQUITECTURA DE MÓDULOS Y RESPONSABILIDADES

```
d:\racing-oslo-manager\
├── src/
│   ├── daemon.js              ➔ Orquestador central: Crons (09:00, 18:00, 23:50), Telegram Bot y eventos.
│   ├── comunioClient.js       ➔ Capa de red API Comunio: Sesiones, pujas, alineaciones y scraping.
│   ├── engine.js              ➔ Motor estratégico principal: Cálculos de E[Points], análisis de mercado.
│   ├── squadOptimizer.js      ➔ Algoritmo matemático del Once, formaciones válidas y evaluación de ofertas.
│   ├── benchTrendAuditor.js   ➔ Auditor de rendimiento de suplentes y cálculo del multiplicador Momentum.
│   ├── marketMonitor.js       ➔ Escáner de oportunidades y seguimiento de variaciones de mercado.
│   ├── comunioNewsConsumer.js ➔ Ingesta de noticias, partes médicos y sanciones de LaLiga.
│   └── syncWeb.mjs            ➔ Exportación de métricas y sincronización con el Dashboard Web.
├── web/                       ➔ Frontend Vite + Tailwind desplegado en Cloudflare Pages.
├── config.json                ➔ Parámetros de configuración general.
└── SYSTEM_SPECIFICATION.md    ➔ Este documento maestro de gobernanza.
```

---

## ⏱️ 4. CICLO DE VIDA OPERATIVO SEMANAL

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                 CRONOGRAMA SEMANAL TIPO                                │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ ☀️ LUNES NOCHE:                                                                        │
│    • Finalización de los partidos de la jornada.                                       │
│    • Auditoría de banquillo y puntos generados (/banquillo).                          │
│    • ⛔ PROHIBIDO vender o tomar decisiones económicas antes del pago oficial.         │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ ☀️ MARTES (07:00 - 09:00 AM):                                                          │
│    • Comunio abona las primas oficiales (10.000 € por punto).                          │
│    • Cálculo exacto del balance de tesorería y deuda remanente.                        │
│    • Escaneo de la nueva tanda de jugadores puesta a la venta por Computer.            │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ 🛒 MIÉRCOLES - JUEVES:                                                                 │
│    • Monitorización de pujas activas a precio exacto.                                  │
│    • Notificación de ofertas entrantes a Telegram con botones interactivos.            │
│    • Actualización médica de dudas, molestias y convocatorias.                         │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ 🚨 PRE-JORNADA (15-30 min antes del primer partido):                                   │
│    • Verificación estricta de saldo >= 0 €.                                            │
│    • Selección de la mejor formación (3-5-2, 4-4-2, 3-4-3) según partidos activos.     │
│    • Guardado y publicación del Once Oficial en Comunio.                               │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ ⚽ FIN DE SEMANA:                                                                      │
│    • Seguimiento de puntuaciones en directo.                                           │
│    • Sincronización del Dashboard Web y clasificación general.                         │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 📱 5. MANUAL DE COMANDOS DE TELEGRAM (CONTROL DEL MÁNAGER)

| Comando | Función |
| :--- | :--- |
| `/once` | Muestra la alineación titular proyectada y su formación táctica recomendada. |
| `/plantilla` | Lista completa de jugadores en plantilla con valor, puntos y estado físico. |
| `/balance` | Informe de tesorería: saldo disponible, valor de plantilla y primas proyectadas. |
| `/mercado` | Escaneo en vivo de las oportunidades activas de Computer. |
| `/ofertas` | Lista ofertas recibidas con botones interactivos `[Aceptar]` y `[Rechazar]`. |
| `/banquillo` | Auditoría de puntos de suplentes, once óptimo a posteriori y tendencias. |
| `/pujar <jugador> <precio>` | Emite una puja manual por un jugador del mercado. |
| `/cancelar <jugador>` | Cancela una puja activa en Comunio. |
| `/vender <jugador>` | Pone a un jugador de tu plantilla en el mercado de Comunio. |
| `/sync` | Sincroniza la base de datos y despliega el Dashboard a Cloudflare Pages. |

---

## 🔐 6. PROTOCOLO DE AUDITORÍA Y CONTROL DE CALIDAD

1. **Inmutabilidad de Reglas:** Ninguna actualización del código puede reintroducir llamadas a `acceptSaleOffer` dentro de rutinas desatendidas (`runMarketCheck`).
2. **Registro de Auditoría:** Todas las acciones ejecutadas deben quedar registradas en `audit_log.json` con marca temporal en zona horaria `Europe/Madrid`.
3. **Resiliencia de Procesos:** El proceso debe mantenerse en ejecución continua bajo PM2 (`pm2 restart comunio-bot`) con arranque automático en caso de reinicio del servidor.
