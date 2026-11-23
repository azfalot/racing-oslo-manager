# 1. Centralizar la autorización financiera de compras

- Status: Accepted
- Date: 2026-11-23
- Author: Codex

## Context

El monitor, el módulo especulativo y las órdenes manuales compartían caja sin un control final común. Podían usar respuestas atrasadas o disparar un segundo intento tras un timeout. El proyecto persiste sus libros operativos como JSON y ejecuta el daemon con PM2 en un único host Windows.

## Decision

Aplicar la política en el límite de escritura `ComunioClient.placeBid`, con contexto fresco, exclusión mutua por archivo, un libro de compromisos escrito antes de enviar y reconciliación conservadora. Mantener los cálculos puros separados de ejecución e informes. Las ventas reales permanecen sujetas a confirmación manual.

## Alternatives Considered

1. Repetir límites en cada bot: deja huecos en órdenes manuales y no coordina procesos.
2. Solo un mutex en memoria: no impide que dos procesos comprometan el mismo saldo ni conserva incertidumbre tras reiniciar.
3. Introducir una nueva base de datos para esta entrega: aumenta alcance sin necesidad para un solo host. Una evolución con varios hosts deberá usar almacenamiento transaccional compartido; cualquier PostgreSQL local reutilizará la instancia compartida del entorno.

## Consequences

- Positive: las rutas de compra comparten límites; los estados inciertos no desaparecen al reiniciar; los informes distinguen caja, compromisos y estimaciones.
- Negative / Trade-offs: consultas adicionales antes de comprar, compras bloqueadas mientras persiste incertidumbre, y coordinación limitada a procesos que comparten este workspace. La recuperación manual de registros inciertos debe comprobar el estado real antes de liberar fondos.
