# Proteger capital y comprar mejoras financiadas

## Objetivo y alcance

Evitar pérdidas operativas por sobrepujas, caja comprometida dos veces, respuestas inciertas, salidas sin autorización y fichajes sin mejora demostrable del once. El VM puede caer y las proyecciones deportivas pueden fallar: no se garantiza preservar cada euro ni remontar la clasificación.

BDD: issue #20 / PR #21, rama `feature/20-yamal-financing`. Propiedad de este cambio: `src/capital*.js`, `src/reportCapital.mjs`, cliente de Comunio, motor de valoración, monitor, especulación, reportes/handlers del daemon y tests correspondientes. Sin migraciones ni dependencias nuevas. Estados: PLANNING → IMPLEMENTING → TESTING → WAITING_CI → REVIEWING. La fusión queda pendiente de revisión.

## Compras

- Un único límite financiero en `ComunioClient.placeBid`: usa caja real menos compromisos de API y reservas locales, sin contar ventas previstas ni primas futuras.
- Reserva predeterminada: 1.000.000 €. Máximo de plantilla: 15, incluyendo compromisos. Cada nueva compra no puede exceder el 35 % del patrimonio observado.
- Todas las recomendaciones y peticiones usan VM exacto y Computer verificado. La valoración teórica del modelo se separa del precio que se recomienda ofrecer.
- Una compra autónoma exige disponibilidad, media reciente positiva, entrada en el XI y mejora estimada de al menos 0,75 puntos. El XI de comparación incluye las compras pendientes suponiendo que se adjudican, para evitar dos pujas que pretendan sustituir al mismo jugador débil. Si no hay datos de un compromiso, no se autoriza otra compra autónoma. Una confirmación manual puede omitir ese filtro deportivo; sigue obligada a cumplir límites financieros, propiedad, precio y capacidad.
- Las oportunidades de especulación basadas únicamente en un precio bajo o una recuperación supuesta no autorizan compras. El radar conserva hipótesis identificadas como tales y reconoce riesgo no nulo.
- Los puntos de temporada no se interpretan como puntos de la última jornada. Una media contradictoria con cero puntos de temporada y cero recientes no convierte a un jugador en titular probado.

## Exclusión mutua y compromisos

El bloqueo `.capital-purchase.lock` coordina las compras entre procesos en el mismo workspace. Solo el propietario lo libera; un PID terminado permite recuperar un bloqueo abandonado. Un bloqueo corrupto o con PID vivo bloquea compras para revisión. El mecanismo está diseñado para el daemon local en un único host, no para varios servidores con discos independientes.

`data/capitalCommitments.json` registra la intención antes del POST. Un resultado explícitamente rechazado libera fondos. Un timeout, cuerpo desconocido o resultado ambiguo mantiene el compromiso como UNCERTAIN y evita volver a pujar. Las reservas locales y de API se deduplican por jugador con el mayor importe. Un estado ausente en una respuesta posterior no demuestra rechazo ni libera dinero por sí solo.

Las reservas se retiran cuando el jugador aparece realmente en plantilla, se observa un rechazo/caducidad/cancelación explícitos, o se solicita una cancelación manual cuya desaparición se verifica en la API. La caja se consulta después de la plantilla. Si un registro incierto no puede resolverse, revisar la cuenta y el libro local antes de modificarlo; nunca borrarlo solo para recuperar presupuesto aparente. El cliente no realiza reintentos por navegador.

## Ventas y mejora del equipo

Las ventas requieren `confirmedByUser === true` y conservan el botón manual de Telegram. Las ofertas muestran coste de adquisición de `purchaseInfo.price` cuando existe, resultado si se vende, diferencia contra VM y pérdida estimada del XI. Un coste desconocido no se sustituye por cero ni se presenta como beneficio. El botón identifica una venta con pérdida o de una pieza del once. El watchdog de deuda avisa para revisar ofertas en vez de aceptar ventas.

Los planes condicionales prueban hasta tres salidas de una bolsa limitada de jugadores prescindibles y simulan el XI completo después del fichaje. Exigen once completo, reserva, capacidad y ganancia neta conjunta. Las ventas se estiman a VM y siguen pendientes de ofertas reales: el cliente de compras no permite gastar esos ingresos hasta que sean efectivos. Una propuesta no obliga a vender ni transmite una puja.

Una puja registrada no garantiza adjudicación. Reservar su importe protege únicamente el escenario financiero de que se ganen todas; no descuenta patrimonio ni registra un activo adquirido. Los planes contemplan ganar y perder la subasta: no se propone vender antes si, al perder, quedaría un once incompleto o con pérdida estimada de puntos. Se muestran las cajas de ambos escenarios y no se inventa una probabilidad de éxito. La subida esperada del XI solo se presenta condicionada a la adjudicación.

Una puja especulativa enviada se registra en `pendingPurchases`; solo pasa a `activeTradingPlayers` cuando se observa el jugador adquirido. Se usa el coste real de la plantilla cuando está disponible.

Los pendientes guardan `bidAmount` y `submittedAt`, no un coste de compra. Si el jugador aparece en plantilla sin coste confirmado, este permanece desconocido: no se sustituye por la puja ni por el VM. El balance histórico conserva las pérdidas y no reemplaza su resumen por una afirmación fija de «100% de plusvalías»; cero beneficios o cero operaciones siguen siendo cero.

## Seguimiento y puesta en servicio

`/capital`, el informe diario y `npm run capital:report` comparten los mismos cálculos. `--record` y el informe diario registran la primera observación de cada día en `data/capitalHistory.json`, con caja, compromisos, patrimonio, tamaño de plantilla y once estimado. La variación patrimonial incluye primas y cambios de VM; no equivale a plusvalía realizada. Las estimaciones del once pueden cambiar al actualizar datos o el modelo.

El bot local se ejecuta desde este worktree y conserva `D:/racing-oslo-manager` como directorio de datos y credenciales. Tras probar y reiniciar, PM2 conserva el script de la rama y `COMUNIO_NOTIFY_STARTUP=false` evita el mensaje de arranque. No eliminar el worktree antes de incorporar los cambios y actualizar la ruta del servicio. El despliegue del portal web y su comprobación de Cloudflare siguen siendo independientes del daemon local.

## Validación

`npm test`: 113 pruebas, incluidas integración del cliente con API simulada, propietario desconocido sin suplantar a Computer, reserva entre instancias, concurrencia, mejoras pendientes sin duplicar su ganancia, respuesta incierta sin reintentos, errores de negocio dentro de HTTP 200, cancelación y liberación verificada, ventas manuales, costes desconocidos y planes conjuntos. Las regresiones fallaron antes del arreglo; los logs `capital-*-before.log` conservan la evidencia. No se han eliminado tests; la antigua expectativa de riesgo cero se sustituyó por el nuevo requisito de riesgo cuantificado y no garantizado, conservando la identificación de candidatos. Los tests de bandas conservan los límites de la valoración teórica (`modelValuation`, `modelBand`, `modelMarginPct`) y añaden la exigencia más estricta de recomendación a VM exacto. La suite habitual incorpora ahora estrategia de campeonato y consistencia del modelo, antes fuera de `npm test`.

Evidencia: `docs/evidence/20-yamal/capital-after.log`, `capital-build.log`, `capital-live.json` y `capital-live.log`. La consulta real es de lectura; no se realizan operaciones para probar las protecciones.
