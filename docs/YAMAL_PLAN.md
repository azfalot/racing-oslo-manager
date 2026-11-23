# Operación Yamal — 23 de noviembre de 2026

Datos consultados directamente en Comunio, cuenta Racing de Oslo. Captura y listados verificables en `web/src/data/transferPlan.json`.

## Decisión y números

Caja: 1.005.988 €. Plantilla: 35.230.000 €. Patrimonio: 36.235.988 €. Límite de puja comunicado por Comunio: 9.813.488 €. No había ofertas pendientes de compra ni de venta en la consulta. Yamal estaba en Computer a un valor de mercado de 22.640.000 €.

El escenario de 30.000.000 € requiere vender Gerard Moreno (3,33 M), David Soria (2,93 M), Mandi (2,23 M), Mariano Díaz (3,46 M), Valverde (12,22 M), Gavi (1,69 M), Johnny Cardoso (1,70 M) y Adrián de la Fuente (3,44 M). Total: 31.000.000 €. Se han puesto a la venta y comprobado su presencia en el mercado: **no están vendidos**.

Si se ingresara exactamente ese importe, quedarían 2.005.988 € tras fichar a Yamal. De ellos, 1.500.000 € se destinan a tres incorporaciones (presupuesto medio 500.000 €) para llegar a 13 jugadores y 500.000 € a imprevistos. Margen adicional: solo 5.988 €. La posición más urgente es portero; también falta un medio para el 3-4-3 previsto. La tercera plaza permite rotación. Los jugadores actuales baratos incluyen suplentes sin minutos: completar posiciones no equivale a garantizar once titulares.

32,5 y 35 millones no son viables con estas reservas. Incluso liquidando todo, 35 millones dejarían solo 1.235.988 € para otros diez jugadores, menos que diez precios mínimos de 160.000 €. Se recomienda un techo de 30 millones; pagar 30 ya implica aproximadamente un 32,5 % sobre su VM actual y perder varias piezas importantes. No se ha emitido puja: el crédito actual es insuficiente y no hay ingresos de ventas confirmados.

## Resto de la semana

1. Lunes: solicitar ofertas con los ocho listados, conservar los baratos y la liquidez. Listar no obliga a aceptar una oferta ni garantiza comprador.
2. Martes, tras la actualización del mercado: consultar ofertas, saldo, límite de crédito y disponibilidad de Yamal de nuevo. Recalcular con precios reales; una caída pequeña de las ofertas consume el escaso margen. No sacrificar la plantilla si otro mánager ya ha fichado al objetivo. No hay una tarea automática nueva de venta o puja programada.
3. Martes a jueves: priorizar portero con minutos, después medio y tercer refuerzo, por menos de un millón cada uno y dentro del presupuesto conjunto. El portero puede requerir más de 500.000 € y obliga a compensar en los otros dos. No hay un portero con puntos por menos de un millón en el mercado observado.
4. Radar exclusivo de Computer: José Salinas (590.000 €, media últimos cinco 2,4) y Kiko Femenía (270.000 €, 1,4). Hay otros activos baratos sin rendimiento reciente; un precio bajo no demuestra titularidad. Los rivales quedan excluidos porque no venden: no se planifican negociaciones ni fichajes de sus jugadores. No hay pujas lanzadas por estas opciones durante esta revisión.
5. Antes del próximo cierre de jornada: confirmar la hora oficial en calendario, saldo no negativo y once por posiciones con minutos probables. Mantener el colchón. Si no hay portero o suficientes titulares, rebajar el precio objetivo o aplazar la operación.

Las [FAQ oficiales de Comunio](https://stats.comunio.es/foro/viewtopic.php?t=6) explican que Computer normalmente oferta al día siguiente por jugadores listados antes de las 03:00 y que el crédito se recalcula al aceptar ventas. Eso no garantiza que Yamal siga disponible cuando lleguen las ofertas.

## Contrato BDD y evidencia

- Issue: #20. Rama: `feature/20-yamal-financing`.
- Estado: AVAILABLE → PLANNING → IMPLEMENTING → TESTING → WAITING_CI → REVIEWING. DONE requiere CI correcto y entrega; no se fusiona automáticamente.
- Propiedad: planificación de fichajes (`src/transferPlan.js`, `src/planTransfer.mjs`), exportación de snapshot (`src/syncWeb.mjs`), panel de Mercado, tests y documentación. Ajustes puntuales del módulo de especulación para los dos fallos preexistentes reproducidos. Sin migraciones ni nuevas dependencias.
- Aceptación: separar caja de crédito y ventas estimadas; comprobar posiciones y fondos para recambios; mostrar 30/32,5/35 M; listar únicamente los ocho seleccionados, verificar por API; no aceptar ventas ni pujar sin fondos.
- Regresiones previas: simulación offline duplicaba jugadores ya listados; decisiones de trading incluían ofertas de jugadores ajenos al libro. Las pruebas nuevas fallaron antes del arreglo. La API real sigue prevaleciendo sobre listados históricos.
- Evidencia: `docs/evidence/20-yamal/regression-before.log`, `tests.log`, `e2e.log`, `desktop.png`, `mobile.png` y `trace.zip`. El workflow adjunta los artefactos del navegador.
