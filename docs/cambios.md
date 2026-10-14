# Registro de cambios — Cafelink

> A partir del 2026-10-13 llevamos acá el contexto de cada cambio, en orden cronológico.
> Regla: cada tarea nueva agrega una entrada abajo con fecha, qué se hizo, por qué,
> archivos tocados y cómo se verificó. Así retomamos sin pisar nada.

## 2026-10-13 — QR del mostrador (Fase 1, Sprint 2)

- **Qué:** pantalla `/dashboard/qr` con QR rotativo cada 60 s + versión imprimible (print → PDF).
- **Por qué:** desbloquea la prueba punta a punta; reutiliza `domain/qr-token.ts` ya testeado.
- **Archivos:**
  - `src/lib/data/cafes.ts` — `getCafeLocations()`
  - `src/lib/server/qr.ts` (nuevo) — firma server-only, `scanUrl = {origin}/v/{token}`
  - `src/app/api/cafe/qr/route.ts` (nuevo) — `GET`, café derivado de la sesión, Zod para `locationId`
  - `src/app/(app)/dashboard/qr/page.tsx` + `qr-display.tsx` (nuevos) — QR grande, cuenta regresiva, selector de local, Copiar/Imprimir, ayuda de uso
  - `src/app/(app)/dashboard/page.tsx` — paso “Mostrá el QR” linkea a `/dashboard/qr`
  - `package.json` + `pnpm-lock.yaml` — `react-qr-code`
- **Convenciones respetadas:** Server Components + Route Handlers, Admin SDK solo servidor, Zod, rioplatense, shadcn/ui, `sonner` para avisos.
- **Verificación:** `tsc` OK, `vitest` 18/18 OK, `eslint` OK, `next build` OK (`/dashboard/qr`, `/api/cafe/qr` dinámicas).

## 2026-10-13 — Ruta pública `/v/[token]` (fix 404 al escanear)

- **Qué:** `src/app/v/[token]/page.tsx` valida firma y vigencia en el servidor.
- **Por qué:** el QR apuntaba a `/v/{token}` inexistente; pegar el link daba 404.
- **Comportamiento:** vigente → “Sumá sellos en {café}” + badge; vencido → “ya se renovó, escaneá de nuevo”; inválido → “no es válido”. Busca café/local reales con Admin SDK.
- **Extra:** `appOrigin()` en `src/lib/server/qr.ts` respeta `NEXT_PUBLIC_APP_URL` para probar desde el celu en la misma WiFi (el `localhost` del QR no lo resuelve el teléfono).
- **Verificación:** `eslint` OK, `tsc` OK, 18 tests OK, `build` OK (ruta `/v/[token]` dinámica).

## 2026-10-13 — Gracia de 1 ventana en el QR (aclaración, sin código)

- **Observación:** un link copiado sigue válido pasados los 60 s.
- **Causa:** diseño intencional en `verifyQrToken`: acepta ventana actual + anterior para no rechazar escaneos al filo del cambio. Vence tras ~90–120 s (2 ventanas). Tests en `qr-token.test.ts` lo cubren.
- **Decisión:** se deja así. Probar expiración esperando 2:30 y recargando.

## 2026-10-13 — Botón “Renovar ahora” (fix percepción de roto)

- **Síntoma:** tocarlo parecía no hacer nada.
- **Causa:** dentro de la misma ventana el token re-firmado es idéntico, no hay cambio visual.
- **Fix en `qr-display.tsx`:** `refresh(id, { notify })` compara con `qrTokenRef`; en manual muestra toast “Ya tenés el QR vigente. Se renueva en 0:XX.” o “QR renovado.”. La auto-renovación sigue silenciosa. Retry de error reutiliza el mismo handler.
- **Verificación:** `eslint` OK, `tsc` OK, 18 tests OK.

## 2026-10-13 — Registro de visita + PWA del cliente (Fase 1, Sprint 2/3)

- **Qué:** el escaneo suma sellos de verdad con Phone Auth.
  - `POST /api/visits/scan` — valida firma/vigencia del QR (410 si vencido), verifica ID token de teléfono con Admin SDK, resuelve programa activo y registra en transacción: cliente (crea si es nuevo), tarjeta y visita.
  - Antifraude con `evaluateStampAttempt` (intervalo + tope diario por `dayKey` en zona del café). Responde 429 `too_soon` / `daily_limit` con mensajes rioplatenses.
  - Idempotencia sin índices extra: visita con ID `{customerId}_{ventanaQR}`; reintentar el mismo QR devuelve el progreso sin duplicar.
  - Consentimiento: `marketingOptIn` solo se eleva por este endpoint (la baja vivirá en el perfil). Sin `displayName` en cliente nuevo → 400.
  - `/v/[token]` ahora monta `VisitFlow`: join (nombre + teléfono E.164 + opt-in desmarcado) → OTP por SMS → registro → tarjeta con puntos, “te faltan X para {premio}” y badge “¡Te falta poco!”. Sesión persistida: la próxima visita escanea y suma sin pedir nada.
- **Por qué:** es el corazón del MVP (F1 + flujo 10.2/10.3 del plan).
- **Archivos:**
  - `src/domain/visits.ts` + `visits.test.ts` (nuevos) — `qrWindowFromToken`, `visitDocId`/`idempotencyKeyFor`
  - `src/lib/data/programs.ts` (nuevo) — `getActiveProgram()`
  - `src/app/api/visits/scan/route.ts` (nuevo)
  - `src/app/v/[token]/visit-flow.tsx` (nuevo) — recaptcha invisible, `onAuthStateChanged`, manejo 200/400/401/410/429/500
  - `src/app/v/[token]/page.tsx` — la bienvenida placeholder ahora monta `VisitFlow`
- **Decisiones:**
  - Contadores desnormalizados en la tarjeta (`currentDayKey`, `stampsToday`, `lastStampAt`) para evaluar antifraude con 2 lecturas y sin índices compuestos nuevos.
  - Sin rate-limit todavía (pendiente) ni eventos `VisitRecorded` (cuando exista el worker de oportunidades).
- **Probar en local:** emuladores arriba, `/dashboard/qr` en PC, escanear con celu en la misma WiFi usando `NEXT_PUBLIC_APP_URL=http://TU_IP:3000`. El código SMS se ve en http://localhost:4000/auth.
- **Verificación:** `eslint` OK, `tsc` OK, `vitest` 22/22 OK (18 previas + 4 nuevas), `next build` OK (nueva ruta `/api/visits/scan`).

## 2026-10-13 — Ficha de cliente (F2 del plan)

- **Qué:**
  - `/dashboard/clientes` — lista con búsqueda por nombre o teléfono (insensible a acentos/espacios/guiones), estados vacíos según plan 10.10.
  - `/dashboard/clientes/[id]` — tarjeta con progreso, pedido habitual + gustos editables, notas del equipo (autor + fecha), últimas 20 visitas con local.
  - Dashboard con datos reales: visitas hoy, clientes activos (agregaciones `count`, sin leer documentos) y pasos dinámicos (primera visita tacha el paso 3 y habilita “Conocé a tus clientes”).
- **Por qué:** con visitas ya registrándose, el dashboard en 0 no servía; la ficha es F2 del MVP.
- **Archivos:**
  - `src/domain/customers.ts` + `customers.test.ts` (nuevos) — `filterCustomers`
  - `src/lib/data/customers.ts` (nuevo) — `searchCustomers`, `getCustomerDetail`, `getDashboardStats`
  - `src/app/(app)/dashboard/clientes/page.tsx` (nueva)
  - `src/app/(app)/dashboard/clientes/[id]/page.tsx` + `actions.ts` + `profile-form.tsx` + `notes-form.tsx` (nuevos) — Server Actions con Zod, `revalidatePath`, aislamiento por café (el `customerId` solo resuelve bajo el café de la sesión)
  - `src/app/(app)/dashboard/page.tsx` — stats y pasos dinámicos
  - `firestore.indexes.json` — compuestos `visits(customerId, visitedAt)` y `programs(active, createdAt)` que las nuevas consultas exigen en producción
- **Decisiones:**
  - Búsqueda en memoria sobre los últimos 50 (suficiente hasta 500 clientes del plan Esencial; con volumen se pasa a índice dedicado sin cambiar la UI).
  - Gustos como arreglo en el cliente (sin subcolección) para el MVP.
  - Aviso anti-datos-sensibles junto al campo de notas (plan 8.2).
- **Verificación:** `eslint` OK, `tsc` OK, `vitest` 26/26 OK (4 nuevas de búsqueda), `next build` OK (rutas `/dashboard/clientes`, `/dashboard/clientes/[id]`).

## 2026-10-13 — Canje de premios (flujo 10.4 del plan)

- **Qué:** loop de lealtad completo.
  - Cliente con tarjeta completa → “Generar código de canje”: código de 6 letras (ABC-DEF), 2 min, un solo uso. Espera con cuenta regresiva y sondeo cada 5 s → “¡Disfrutalo!” al confirmarse.
  - Staff en `/dashboard/canjear`: ingresa el código → ve “{premio} · {cliente} · ¿Confirmar?” → confirma y la tarjeta reinicia en 0.
- **Por qué:** sin canje, las tarjetas completas eran un callejón sin salida.
- **Archivos:**
  - `src/domain/redemption.ts` + `redemption.test.ts` (nuevos) — alfabeto sin 0/O/1/I, normalizado, TTL 120 s
  - `src/app/api/redemptions/create|status|lookup|redeem/route.ts` (nuevas) — creación con unicidad por doc ID, confirmación en transacción (código + tarjeta a 0 atómicos, doble canje imposible)
  - `src/app/v/[token]/visit-flow.tsx` — sección de canje (crear, mostrar, sondear, estados vencido/confirmado)
  - `src/app/v/[token]/page.tsx` — pasa `cafeId` al flujo
  - `src/app/(app)/dashboard/canjear/page.tsx` + `redeem-client.tsx` (nuevas)
  - `src/app/(app)/dashboard/page.tsx` — accesos directos a QR, Clientes y Canjear
  - `firestore.rules` — lectura de `redemptions` para miembros (escritura solo servidor)
  - `README.md` — estado y próximo sprint actualizados
- **Decisiones:**
  - Códigos opacos aleatorios en Firestore (no firmados): dictables y revocables, sin secretos nuevos.
  - Varios códigos pendientes del mismo cliente son inofensivos: el primero en confirmarse invalida el resto (la tarjeta deja de estar completa).
- **Verificación:** `eslint` OK, `tsc` OK, `vitest` 31/31 OK (5 nuevas de canje), `next build` OK (rutas `/api/redemptions/*`, `/dashboard/canjear`).

## 2026-10-14 — Gracia amplia en POST /api/visits/scan (fix 410 en alta con OTP)

- **Qué:** el scan acepta QR de hasta 10 ventanas (~10 min) mientras `/v/[token]` sigue estricto (actual + anterior).
- **Por qué:** el cliente abría el link válido y tardaba 1-4 min en nombre + teléfono + SMS + OTP; el POST llegaba con el token vencido y devolvía 410 "ya se renovó".
- **Archivos:**
  - `src/domain/qr-token.ts` — `verifyQrToken(..., graceWindows = 1)`
  - `src/lib/server/qr.ts` — `verifyCafeQrToken(token, now, graceWindows)`
  - `src/app/api/visits/scan/route.ts` — `SCAN_QR_GRACE_WINDOWS = 10`
  - `src/app/v/[token]/visit-flow.tsx` — mensaje de expirado pide re-escanear el QR actual
  - `src/app/(app)/dashboard/qr/qr-display.tsx` — aviso de que el link copiado vence en <1 min
  - `src/domain/qr-token.test.ts` — test de gracia amplia
- **Decisiones:**
  - La foto del QR sirve hasta 10 min, pero el antifraude (1 sello/día, 240 min entre sellos) bloquea el abuso. Se prioriza conversión en el alta.
- **Verificación:** `eslint` OK, `tsc` OK, `vitest` 32/32 OK, `next build` OK.

---

## Cómo agregar una entrada nueva

1. Título con fecha y nombre corto del cambio.
2. Bloques: Qué / Por qué / Archivos / Verificación.
3. Si hay decisión de producto (ej. gracia del QR), anotarla como Decisión.
