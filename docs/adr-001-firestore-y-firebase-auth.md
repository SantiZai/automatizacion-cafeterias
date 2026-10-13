# ADR-001: Firestore y Firebase Auth en lugar de PostgreSQL

- **Fecha:** 2026-10-13
- **Estado:** Aceptada
- **Reemplaza:** las decisiones de base de datos, autenticación, colas y tiempo real de `docs/arquitectura-y-plan.md` (secciones 4 a 6). El resto del documento sigue vigente, incluido el **monolito modular**.

## Contexto

El plan original proponía PostgreSQL con Row Level Security, colas con Redis y autenticación propia. El equipo prefiere Firestore y Firebase Auth: menos infraestructura que mantener, tiempo real incorporado y despliegue simple para un equipo chico.

## Decisión

- **Base de datos:** Firestore (modo nativo), región `southamerica-east1`.
- **Autenticación:**
  - Dueños y equipo: Firebase Auth con **Google** (y email por link como alternativa futura).
  - Clientes finales: Firebase Auth con **teléfono (OTP)**, a implementar en el próximo sprint.
- **Servidor:** Next.js (Server Actions y Route Handlers) con Admin SDK. Sigue siendo un monolito modular.
- **Front:** Next.js + Tailwind + componentes estilo shadcn/ui.

## Equivalencias con el plan original

| Plan original | Con Firestore |
| --- | --- |
| Multi-tenencia con `cafe_id` y RLS | Todo bajo `/cafes/{cafeId}/...` y **reglas de seguridad** por membresía |
| Transacciones SQL | Transacciones y `WriteBatch` de Firestore |
| `JOIN` y reportes con SQL | Denormalización, agregaciones (`count`, `sum`, `average`) y, más adelante, exportación a BigQuery |
| Redis + BullMQ | Cloud Scheduler + Cloud Tasks o Cloud Functions, y rutas protegidas con secreto para los trabajos programados |
| SSE para el panel del mostrador | Listeners en tiempo real (`onSnapshot`) en el cliente |
| Identidad global del cliente | Colección `users/` para dueños y equipo; `personUid` en `customers/` para vincular al cliente con su cuenta de teléfono |

## Reglas de diseño que se derivan

1. **El navegador solo lee.** Las reglas de Firestore niegan toda escritura desde el cliente. Las escrituras pasan por el servidor para aplicar antifraude, límites y auditoría.
2. **Cada consulta necesita su índice.** Los índices compuestos se versionan en `firestore.indexes.json`.
3. **Diseñar para pocas lecturas.** Firestore cobra por documento leído. Los paneles usan contadores y resúmenes precalculados en lugar de recorrer colecciones.
4. **Contadores con transacciones o `FieldValue.increment`.** Evitar contadores globales con escrituras muy frecuentes sobre un mismo documento (límite de escrituras sostenidas por documento).
5. **Datos del cliente por café.** Cada café ve solo su `customers/{id}`. Si más adelante hay pasaporte de cafés, se usará una colección separada con datos mínimos.

## Consecuencias

**A favor**

- Menos infraestructura que operar: sin servidores de base de datos, colas ni Redis al inicio.
- Autenticación, sesiones y revocación resueltas por Firebase.
- Tiempo real nativo para el panel del mostrador.
- Emuladores locales de Auth y Firestore para desarrollar y testear sin tocar producción.

**En contra y cómo se mitiga**

| Riesgo | Mitigación |
| --- | --- |
| Consultas analíticas complejas (cohortes, retención) | Agregaciones nativas al inicio; exportar a BigQuery cuando el panel de métricas lo exija |
| Costo por lectura si se diseñan mal las pantallas | Paginación, resúmenes precalculados y revisión de lecturas por pantalla |
| Dependencia del proveedor (Google) | Capa de acceso a datos en `src/lib/data/` y reglas de negocio puras en `src/domain/`, que no conocen Firestore |
| SMS de Firebase Phone Auth tienen costo | Medir el costo por cliente; evaluar OTP por WhatsApp con tokens personalizados (`createCustomToken`) |
| Reglas de seguridad difíciles de probar | Tests con `@firebase/rules-unit-testing` y los emuladores (pendiente) |

## Pendiente de validar

- Costo real del OTP por SMS en Argentina frente a un OTP por WhatsApp.
- Límites de consultas con múltiples filtros y rangos en las bandejas de oportunidades.
- Estrategia de borrado de datos de un cliente (derecho de supresión) a través de varios cafés.
