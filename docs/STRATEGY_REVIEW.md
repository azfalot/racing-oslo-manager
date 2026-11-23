# Revisión deportiva y ventas manuales — 23/11/2026

Se retira la recomendación deportiva de desmantelar la plantilla para pujar 30 M€ por Yamal. El plan anterior demuestra financiación teórica; no demuestra mejora de puntos ni un once de titulares con minutos.

## Situación observada

La clasificación en vivo de Comunio sitúa al Racing noveno. Registra 396 puntos acumulados y 33 de la jornada en curso; Fermín tiene 661 y 59, respectivamente. La diferencia de acumulados es 265; sumando los marcadores en directo, 291 (720 contra 429). Son cifras provisionales, con la jornada 13 aún abierta. Si esa diferencia se consolidara, quedarían 25 jornadas de una temporada de 38 y haría falta ganar aproximadamente 11,64 puntos por jornada al líder para empatarlo. No se presenta una probabilidad de título: el modelo contiene baselines históricos y no permite justificarla solo con esta consulta.

## Once hipotético tras pagar 30 M€ por Yamal

Después de las ocho ventas planteadas, un 3-4-3 por posiciones sería:

- Portero por fichar.
- Pau Navarro, Aihen Muñoz y Copete.
- Denis Suárez, Nico Serrano, Cajuste y medio por fichar.
- Yamal, Kike García y Uche.

Junior Firpo y una tercera incorporación completarían la plantilla. Kike y Uche no tienen puntos; Nico, Junior y Copete figuran con cero de media en los últimos cinco. No es un once competitivo verificable: hay portería sin resolver y varias plazas sin minutos fiables. La media 15 de Copete contradice sus cero puntos de temporada, por lo que no se debe usar para prometer rendimiento. Yamal tenía VM de 22,64 M€: pagar 30 M€ consume 7,36 M€ de prima respecto a VM.

## Alternativa equilibrada, pendiente de ofertas y autorización por operación

Conservar Soria, Valverde, Mandi, Adrián, Denis, Johnny, Gerard y Mariano. Estudiar ventas de Gavi (1,69 M€), Copete (630.000 €), Cajuste (430.000 €), Kike (280.000 €), Junior (250.000 €), Nico (230.000 €) y Uche (170.000 €): total 3,68 M€. No se han solicitado ni aceptado nuevas ventas para esta alternativa.

Objetivos observados: Ndukwe (Computer, VM 2,05 M€), Swedberg (Suances nin, VM 820.000 €) e Iker Muñoz (Pachangueros, VM 870.000 €). Total hipotético 3,74 M€, solo si se adjudican o negocian a esos precios. Los dos últimos pertenecen a rivales y no tienen un precio acordado.

Once 3-5-2: **Soria; Mandi, Adrián, Ndukwe; Valverde, Denis, Johnny, Swedberg, Iker; Gerard y Mariano**. Banquillo: Pau Navarro y Aihen. Serían 13 jugadores y quedarían 945.988 € de caja. La suma de medias recientes de este once es 41,6 frente a 35 de una estructura actual 3-5-2 comparable: es un indicador descriptivo, no una predicción ni un incremento garantizado. Se deben comprobar minutos, lesiones, rival y titularidades antes de cada fichaje. No bastaría por sí solo para afirmar que se recuperará el liderato.

## Seguridad operativa

El daemon original se detuvo antes de tocar la vía automática de aceptación. La API de venta exige ahora `confirmedByUser === true`; el único llamador de producción que lo proporciona es el callback manual `acc_sale` de Telegram. Los jobs de trading y de deuda no lo suministran y quedan bloqueados. Las simulaciones offline no transfieren jugadores. Tres pruebas nuevas reproducen el fallo y verifican el bloqueo sin tráfico real de venta. No se han aceptado ofertas ni enviado pujas durante esta revisión.
