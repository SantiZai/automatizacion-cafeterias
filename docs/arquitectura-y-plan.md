# Cafelink: documento maestro de producto y arquitectura

> **Nombre de trabajo:** "Cafelink" (provisorio, reemplazalo cuando definas la marca).
> **Mercado inicial:** cafeterías de Argentina (español rioplatense, pesos argentinos, WhatsApp, Mercado Pago).
> **Referencia analizada:** [coffeefy.app](https://www.coffeefy.app). El análisis se hizo solo sobre su página pública; no se vio la app por dentro, así que algunas funciones que figuran como "faltantes" podrían existir sin estar publicadas.
> **Supuesto de equipo:** 1 a 3 desarrolladores, presupuesto acotado, necesidad de salir al mercado rápido.

---

## Índice

1. Resumen ejecutivo
2. Visión, usuarios y propuesta de valor
3. Decisión de arquitectura: monolito modular vs microservicios
4. Arquitectura técnica detallada
5. Stack tecnológico recomendado
6. Modelo de datos
7. Integraciones externas
8. Seguridad, privacidad y cumplimiento legal
9. Diseño UI (sistema de diseño y pantallas)
10. Diseño UX (flujos y principios)
11. Funcionalidades en detalle
12. Diferenciales frente a Coffeefy
13. Planes y precios
14. Métricas y analítica
15. Plan de acción por fases
16. Riesgos y mitigaciones
17. Próximos pasos inmediatos

---

## 1. Resumen ejecutivo

Cafelink es una plataforma de fidelización y relación con clientes para cafeterías. Cada visita se registra con un QR, el café recuerda gustos y notas de cada cliente, y el sistema detecta oportunidades (cumpleaños, ausencias, premios cercanos) para que el café actúe en un toque.

**Qué hace Coffeefy hoy (según su página pública):**

- Tarjeta de sellos por QR que se abre en el navegador, sin descargar app.
- Ficha de cliente con pedido habitual, notas del equipo e historial de visitas.
- Alertas de cumpleaños, ausencia y premio cercano, con mensajes preparados que **nadie envía solo**: el café los revisa.
- Sellos extra por dejar una reseña en Google Maps o subir una historia etiquetando al local.
- Un único plan de $70.000/mes con 30 días gratis, clientes y visitas ilimitados.

**Qué proponemos para ganar:**

1. **Acción en un toque:** el mensaje sale por WhatsApp directamente, con aprobación opcional.
2. **Valor medible:** panel de retención y un resumen semanal que dice qué hacer.
3. **Planes por necesidad:** un plan de entrada accesible para cafés chicos y un plan para cadenas.
4. **Efecto red:** pasaporte de cafés que lleva clientes de un local a otro.
5. **Más allá de los sellos:** horas valle, referidos, pedido anticipado y pago por QR de mesa.

**Decisión de arquitectura en una línea:** empezamos con un **monolito modular** (un solo despliegue, módulos bien separados por dominio) y extraemos servicios solo cuando una métrica real lo justifique. Los microservicios desde el día uno serían un costo sin beneficio para un equipo chico.

---

## 2. Visión, usuarios y propuesta de valor

### 2.1 Visión

Que ninguna cafetería de barrio pierda a un cliente habitual sin enterarse, y que cada visita se sienta personal.

### 2.2 Usuarios (personas)

| Persona | Quién es | Qué necesita | Dolor actual |
| --- | --- | --- | --- |
| **Dueño/a de café de barrio** | Atiende o supervisa 1 local, 2 a 6 empleados | Que vuelvan sus clientes, sin complicarse con tecnología | Tarjetas de papel que se pierden, no sabe quién dejó de venir |
| **Encargado/a de cadena** | 3 o más sucursales | Ver métricas por sucursal y estandarizar premios | Cada local hace lo suyo, no hay datos comparables |
| **Barista / mozo** | Registra visitas en el mostrador | Hacerlo en segundos, sin frenar la fila | Cualquier fricción lo hace abandonar la herramienta |
| **Cliente habitual** | Va varias veces por semana | Ver su progreso, que lo reconozcan | Tarjetas de cada café, ninguna a mano |
| **Cliente explorador** | Busca cafés nuevos | Descubrir lugares y tener un motivo para volver | No sabe qué café elegir |

### 2.3 Propuesta de valor

- **Para el café:** más visitas repetidas, menos clientes perdidos, y datos claros para decidir.
- **Para el cliente:** premios simples, atención reconocida, cero descargas.
- **Para el equipo:** una herramienta que se usa en menos de 5 segundos por visita.

---

## 3. Decisión de arquitectura: monolito modular vs microservicios

### 3.1 Comparativa

| Criterio | Monolito modular | Microservicios |
| --- | --- | --- |
| Velocidad de desarrollo inicial | Alta | Baja (infra, contratos, tracing) |
| Costo de infraestructura | Bajo (1 app + 1 DB + 1 cola) | Alto (múltiples servicios, gateway, mensajería) |
| Complejidad operativa | Baja | Alta |
| Consistencia de datos | Transacciones simples en una DB | Consistencia eventual, sagas |
| Debug y observabilidad | Un solo proceso | Trazas distribuidas necesarias |
| Escalado independiente | Limitado, pero suficiente al inicio | Granular |
| Tamaño de equipo necesario | 1 a 3 personas | 5 o más personas |

### 3.2 Recomendación

**Monolito modular con workers separados por proceso.**

- Un solo repositorio (monorepo) y un solo despliegue de la API.
- Módulos con fronteras claras (clientes, sellos, campañas, mensajería, facturación). Cada módulo expone una interfaz interna y **no** accede a las tablas de otro módulo directamente.
- Un **proceso worker** aparte (misma base de código) para trabajos pesados o lentos: envío de WhatsApp, cálculo de oportunidades, reportes.
- Eventos de dominio internos (por ejemplo `VisitRecorded`, `RewardEarned`) para desacoplar módulos sin red de por medio.

### 3.3 Cuándo extraer un servicio

Extraer solo si se cumple **al menos una** de estas señales:

| Señal | Candidato a extraer | Por qué |
| --- | --- | --- |
| La cola de mensajes de WhatsApp compite por recursos con la API | Servicio de mensajería | Aislar fallos y escalar workers solos |
| Las consultas de analítica ralentizan la base transaccional | Servicio de analítica (con réplica de lectura o warehouse) | Proteger el mostrador en horas pico |
| Un equipo distinto mantiene un dominio | El dominio de ese equipo | Reducir conflictos de código |
| Un componente necesita otro lenguaje o runtime | Ese componente | Por ejemplo, generación de Wallet passes |

**Regla práctica:** si no podés señalar la métrica que duele, no extraigas.

### 3.4 Diagrama lógico de la arquitectura

```
                         ┌──────────────────────────────┐
                         │          Clientes            │
                         │  PWA cliente · Panel staff   │
                         │  Panel dueño · Superadmin    │
                         └──────────────┬───────────────┘
                                        │ HTTPS
                              ┌─────────▼─────────┐
                              │   CDN / Edge      │
                              │ (estáticos, caché)│
                              └─────────┬─────────┘
                                        │
                  ┌─────────────────────▼─────────────────────┐
                  │          API (monolito modular)           │
                  │  ┌────────┐ ┌────────┐ ┌────────────────┐ │
                  │  │ Auth   │ │Clientes│ │ Sellos/Premios │ │
                  │  └────────┘ └────────┘ └────────────────┘ │
                  │  ┌────────┐ ┌────────┐ ┌────────────────┐ │
                  │  │Campañas│ │Ofertas │ │ Facturación    │ │
                  │  └────────┘ └────────┘ └────────────────┘ │
                  │  ┌────────────────────────────────────┐   │
                  │  │ Bus de eventos de dominio (interno)│   │
                  │  └────────────────────────────────────┘   │
                  └───────┬──────────────┬──────────────┬─────┘
                          │              │              │
                 ┌────────▼───┐   ┌──────▼─────┐  ┌─────▼──────┐
                 │ PostgreSQL │   │   Redis    │  │ Object     │
                 │ (RLS multi-│   │ cache+cola │  │ Storage    │
                 │  tenant)   │   │            │  │ (imágenes) │
                 └────────────┘   └──────┬─────┘  └────────────┘
                                         │
                                  ┌──────▼───────┐
                                  │   Workers    │
                                  │ WhatsApp ·   │
                                  │ Oportunidades│
                                  │ Reportes     │
                                  └──────┬───────┘
                                         │
        ┌────────────────┬───────────────┼───────────────┬───────────────┐
        │                │               │               │               │
 ┌──────▼──────┐  ┌──────▼──────┐ ┌──────▼──────┐ ┌──────▼──────┐ ┌──────▼──────┐
 │ WhatsApp    │  │ Mercado     │ │ Google      │ │ Instagram   │ │ Apple/Google│
 │ Cloud API   │  │ Pago        │ │ Places/GBP  │ │ Graph API   │ │ Wallet      │
 └─────────────┘  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘
```

---

## 4. Arquitectura técnica detallada

### 4.1 Aplicaciones del sistema

| App | Usuario | Plataforma | Notas |
| --- | --- | --- | --- |
| **PWA del cliente** | Cliente final | Navegador móvil, instalable | Se abre al escanear el QR; sin descarga obligatoria |
| **Panel de mostrador (staff)** | Barista, mozo | Tablet o celular, PWA | Optimizado para velocidad y uso con una mano |
| **Panel del dueño** | Dueño, encargado | Web responsive | Métricas, campañas, configuración |
| **Superadmin interno** | Equipo propio | Web | Soporte, facturación, auditoría |
| **Sitio de marketing** | Prospectos | Web estática | Landing, precios, alta de prueba |

Las cuatro primeras comparten API, base de datos y sistema de diseño.

### 4.2 Estructura del monorepo

```
cafelink/
├─ apps/
│  ├─ web/            # Next.js: PWA cliente + panel dueño + panel staff
│  ├─ api/            # API (NestJS o Next route handlers) + workers
│  └─ marketing/      # Landing estática
├─ packages/
│  ├─ ui/             # Sistema de diseño (componentes, tokens)
│  ├─ db/             # Esquema, migraciones, cliente tipado
│  ├─ domain/         # Reglas de negocio puras (sellos, oportunidades)
│  ├─ config/         # ESLint, TS config, variables compartidas
│  └─ sdk/            # Cliente tipado de la API
├─ infra/             # IaC, Docker, scripts de despliegue
└─ docs/              # ADRs, runbooks, este documento
```

### 4.3 Módulos del monolito

| Módulo | Responsabilidad | Eventos que emite |
| --- | --- | --- |
| `identity` | Cuentas, sesiones, roles, magic links | `UserSignedIn` |
| `tenancy` | Cafés, sucursales, configuración, planes | `CafeCreated`, `PlanChanged` |
| `customers` | Perfil del cliente, gustos, notas, consentimientos | `CustomerJoined`, `NoteAdded` |
| `loyalty` | Visitas, sellos, tarjetas, premios, canjes | `VisitRecorded`, `RewardEarned`, `RewardRedeemed` |
| `engagement` | Reseñas, historias, referidos, sellos extra | `ReviewClaimed`, `ReferralCompleted` |
| `opportunities` | Detección de cumpleaños, ausencias, premios cercanos | `OpportunityDetected` |
| `campaigns` | Plantillas, borradores, aprobación, envío | `CampaignApproved`, `MessageSent` |
| `offers` | Ofertas de horas valle, cupones | `OfferActivated`, `OfferRedeemed` |
| `orders` (fase 3) | Pedido anticipado, pago por QR de mesa | `OrderPlaced`, `OrderPaid` |
| `network` (fase 3) | Pasaporte de cafés, descubrimiento | `PassportStamped` |
| `analytics` | Métricas, cohortes, resumen semanal | `WeeklyDigestReady` |
| `billing` | Suscripciones, facturas, cobros | `InvoicePaid`, `PaymentFailed` |
| `audit` | Registro inmutable de acciones sensibles | n/a |

**Regla de dependencias:** `loyalty` no importa `campaigns`. Si `campaigns` necesita saber algo de `loyalty`, escucha un evento o llama a una interfaz pública.

### 4.4 Multi-tenencia

- **Modelo:** base de datos compartida, esquema compartido, columna `cafe_id` en toda tabla de negocio.
- **Aislamiento:** Row Level Security (RLS) de PostgreSQL. Cada conexión fija `app.current_cafe_id` y las políticas filtran por ese valor.
- **Por qué:** es el modelo más barato y simple para cientos o miles de cafés chicos. Si un cliente enterprise exige aislamiento físico, se ofrece una base dedicada como plan especial.
- **Prueba obligatoria:** un test automatizado que intente leer datos de otro café con cada rol y falle si lo logra.

### 4.5 Identidad del cliente final

Un cliente puede ir a varios cafés. Para soportar el pasaporte de cafés sin romper privacidad:

- Existe una **identidad global** del cliente (`person`) con teléfono verificado.
- Cada café ve solo su **perfil local** (`customer_profile`): visitas, notas, sellos en ese café.
- El cliente decide qué comparte entre cafés. Por defecto: nada, salvo el pasaporte (solo sellos de "visitó este café").
- Las notas del equipo son **propiedad del café** y nunca se muestran a otros cafés ni al cliente sin que el café lo decida.

### 4.6 Flujo clave: registrar una visita

```
1. Cliente escanea QR del mostrador (token rotativo cada 60 s)
2. PWA abre /v/{token}; la API valida firma y vigencia
3. Si el cliente no tiene sesión: pide nombre y teléfono (una vez) y consentimiento
4. API aplica reglas antifraude (intervalo mínimo, límite diario)
5. Se crea Visit + se suma Stamp en una transacción
6. Se emite VisitRecorded
7. Listeners: actualizar tarjeta, evaluar RewardEarned, resetear contador de ausencia
8. PWA muestra animación "+1 sello" y el próximo premio
9. El panel de staff muestra la visita en vivo (opcional, vía SSE o WebSocket)
```

**Tiempo objetivo:** menos de 1,5 segundos desde el escaneo hasta ver el sello (con conexión móvil normal).

### 4.7 Flujo clave: detectar y actuar sobre una oportunidad

```
1. Worker programado (cada hora) recorre cafés activos
2. Por café, evalúa reglas: cumpleaños hoy, ausencia > umbral, 1 sello de premio, etc.
3. Crea Opportunity (única por cliente + tipo + período) para evitar duplicados
4. Genera un borrador de mensaje con la plantilla del café (variables: nombre, premio)
5. El dueño ve "3 para revisar" en el panel
6. Aprueba → se encola SendMessage; o edita y aprueba; o descarta
7. Worker envía por WhatsApp (plantilla aprobada por Meta) con reintentos
8. Se registra entrega y respuesta; si el cliente vuelve dentro de N días, se atribuye la recuperación
```

**Modo de aprobación configurable:** `manual` (default), `automático para cumpleaños`, `automático para todo`. Nada se envía sin que el dueño haya elegido ese modo.

### 4.8 Tiempo real

- **Panel de staff:** Server-Sent Events (SSE) para mostrar visitas nuevas. Más simple que WebSocket y suficiente.
- **PWA del cliente:** actualización optimista y refresco al volver al foco.
- **Modo offline del mostrador (fase 2):** cola local en IndexedDB para registrar visitas sin conexión y sincronizar al volver. Resolución de conflictos: gana el servidor y se ajusta el intervalo antifraude con la hora del cliente.

### 4.9 Colas y trabajos

| Cola | Trabajo | Reintentos | Prioridad |
| --- | --- | --- | --- |
| `messages` | Enviar WhatsApp | 5, con backoff exponencial | Alta |
| `opportunities` | Evaluar reglas por café | 3 | Media |
| `digests` | Resumen semanal | 3 | Baja |
| `wallet` | Emitir y actualizar passes | 3 | Media |
| `billing` | Cobros y avisos | 5 | Alta |
| `reports` | Exportes CSV/PDF | 2 | Baja |

Todos los trabajos son **idempotentes** (clave de idempotencia por trabajo) para tolerar reintentos.

### 4.10 Caché

- Redis para sesiones, tokens de QR vigentes, límites de tasa y contadores.
- Caché de lectura corta (30 a 60 s) para el panel del dueño. Se invalida por eventos.
- Las pantallas del cliente cachean la tarjeta y la sirven al instante mientras revalidan.

### 4.11 Observabilidad

- **Logs estructurados** (JSON) con `cafe_id`, `request_id`, `user_id`.
- **Métricas:** latencia por endpoint, tasa de error, tamaño de cola, tasa de entrega de WhatsApp.
- **Trazas** con OpenTelemetry, aunque sea un monolito (útil para ver llamadas a terceros).
- **Alertas:** error rate > 2 % por 5 min, cola `messages` con más de 15 min de retraso, fallo de cobro.
- **Errores de frontend:** Sentry o equivalente.

### 4.12 Despliegue y entornos

| Entorno | Propósito | Datos |
| --- | --- | --- |
| `local` | Desarrollo | Semillas ficticias |
| `preview` | Un entorno por pull request | Datos ficticios |
| `staging` | Pruebas previas a producción | Copia anonimizada |
| `production` | Clientes reales | Reales, con backups |

- **CI/CD:** GitHub Actions. En cada PR: lint, tipos, tests unitarios, tests de integración con base efímera, build.
- **Migraciones:** automáticas en despliegue, siempre compatibles hacia atrás (expand/contract) para desplegar sin cortes.
- **Backups:** diarios con retención de 30 días y restauración probada trimestralmente.
- **Región:** Sudamérica (São Paulo) para reducir latencia desde Argentina.

---

## 5. Stack tecnológico recomendado

> Son recomendaciones razonadas, no obligaciones. Si tu equipo domina otro stack, elegí lo que conozca: la ventaja de velocidad pesa más que la herramienta.

| Capa | Recomendación | Por qué | Alternativa |
| --- | --- | --- | --- |
| Lenguaje | TypeScript en todo | Un lenguaje, tipos compartidos entre front y back | Python en backend |
| Frontend | Next.js + React | PWA, SSR, ecosistema enorme | Remix, SvelteKit |
| Estilos | Tailwind CSS + componentes propios (Radix UI) | Rápido, accesible, consistente | CSS Modules |
| Estado/datos en cliente | TanStack Query | Caché y revalidación simples | SWR |
| Backend | NestJS (módulos nativos) | Calza con el monolito modular | Fastify + estructura propia |
| API | REST con OpenAPI, o tRPC si todo es TypeScript | Tipado extremo a extremo | GraphQL (no hace falta al inicio) |
| Base de datos | PostgreSQL | RLS, JSONB, fiabilidad | Ninguna mejor para este caso |
| ORM / queries | Drizzle o Prisma | Migraciones y tipos | Kysely |
| Cola | BullMQ sobre Redis | Reintentos, prioridades, simple | pg-boss (usa Postgres, una pieza menos) |
| Caché | Redis | Estándar | Upstash (serverless) |
| Archivos | S3 compatible (R2, S3) | Imágenes de premios, logos | Supabase Storage |
| Auth cliente | Teléfono + OTP por WhatsApp/SMS | Los clientes no usan contraseñas | Magic link por email |
| Auth staff/dueño | Email + magic link o contraseña + 2FA opcional | Simple y seguro | Clerk, Auth0 |
| Pagos | Mercado Pago (suscripciones) | Estándar en Argentina | Stripe para exterior |
| Mensajería | WhatsApp Business Cloud API (Meta) | Canal principal en Argentina | Proveedor BSP (Twilio, 360dialog) |
| Hosting | Railway, Render o Fly.io para API; Vercel o Cloudflare para web | Despliegue simple | AWS (más control, más trabajo) |
| Monitoreo | Sentry + Grafana/Datadog | Errores y métricas | Better Stack |
| IaC | Terraform o scripts simples | Reproducibilidad | Pulumi |

**Sobre Supabase:** es una opción válida para acelerar (Postgres con RLS, auth, storage). Si la elegís, mantené la lógica de negocio en tu API y usá Supabase como infraestructura, para no quedar atado.

---

## 6. Modelo de datos

### 6.1 Entidades principales

```
Café (tenant)
 ├─ Sucursal (location)
 ├─ Usuario del café (staff / dueño / encargado)
 ├─ Programa de fidelidad
 │    └─ Premio (reward)
 ├─ Perfil de cliente (customer_profile)  ── pertenece a ──▶  Persona (person, global)
 │    ├─ Visita (visit) ──▶ Sello (stamp)
 │    ├─ Tarjeta (stamp_card)
 │    ├─ Nota (note)
 │    ├─ Gusto (taste)
 │    ├─ Consentimiento (consent)
 │    └─ Reclamo de sello extra (review_claim / story_claim)
 ├─ Oportunidad (opportunity)
 ├─ Campaña / Mensaje (campaign, message)
 ├─ Oferta (offer) ──▶ Canje de oferta (offer_redemption)
 ├─ Referido (referral)
 ├─ Producto y Pedido (product, order)   [fase 3]
 └─ Suscripción y Factura (subscription, invoice)
```

### 6.2 Esquema (SQL simplificado)

```sql
-- Identidad global del cliente final
create table person (
  id uuid primary key default gen_random_uuid(),
  phone_e164 text unique not null,
  phone_verified_at timestamptz,
  display_name text,
  created_at timestamptz default now()
);

-- Tenant
create table cafe (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  plan text not null default 'essential',  -- essential | growth | network
  timezone text not null default 'America/Argentina/Buenos_Aires',
  settings jsonb not null default '{}',
  created_at timestamptz default now()
);

create table location (
  id uuid primary key default gen_random_uuid(),
  cafe_id uuid not null references cafe(id),
  name text not null,
  address text,
  google_place_id text,
  instagram_handle text
);

create table staff_user (
  id uuid primary key default gen_random_uuid(),
  cafe_id uuid not null references cafe(id),
  email text not null,
  name text,
  role text not null check (role in ('owner','manager','staff')),
  location_ids uuid[] default '{}',
  unique (cafe_id, email)
);

-- Perfil local del cliente en un café
create table customer_profile (
  id uuid primary key default gen_random_uuid(),
  cafe_id uuid not null references cafe(id),
  person_id uuid not null references person(id),
  first_seen_at timestamptz default now(),
  last_visit_at timestamptz,
  visit_count int not null default 0,
  birthday date,                      -- opcional, con consentimiento
  usual_order text,                   -- "Latte con medialunas"
  status text not null default 'active',  -- active | at_risk | lost
  unique (cafe_id, person_id)
);

create table note (
  id uuid primary key default gen_random_uuid(),
  cafe_id uuid not null references cafe(id),
  customer_profile_id uuid not null references customer_profile(id),
  author_staff_id uuid references staff_user(id),
  body text not null,
  created_at timestamptz default now()
);

create table taste (
  id uuid primary key default gen_random_uuid(),
  cafe_id uuid not null,
  customer_profile_id uuid not null references customer_profile(id),
  kind text not null,                 -- bebida | comida | leche | temperatura | alergia
  value text not null
);

create table consent (
  id uuid primary key default gen_random_uuid(),
  cafe_id uuid not null,
  person_id uuid not null references person(id),
  channel text not null,              -- whatsapp | email
  purpose text not null,              -- marketing | transactional
  granted boolean not null,
  granted_at timestamptz default now(),
  source text                         -- qr_join | staff_form | import
);

-- Fidelidad
create table loyalty_program (
  id uuid primary key default gen_random_uuid(),
  cafe_id uuid not null references cafe(id),
  name text not null,
  stamps_required int not null,
  min_minutes_between_stamps int not null default 240,
  max_stamps_per_day int not null default 1,
  active boolean not null default true
);

create table reward (
  id uuid primary key default gen_random_uuid(),
  cafe_id uuid not null,
  program_id uuid not null references loyalty_program(id),
  name text not null,                 -- "Café con medialunas gratis"
  at_stamp int not null               -- sello en el que se desbloquea
);

create table stamp_card (
  id uuid primary key default gen_random_uuid(),
  cafe_id uuid not null,
  customer_profile_id uuid not null references customer_profile(id),
  program_id uuid not null references loyalty_program(id),
  stamps int not null default 0,
  completed_at timestamptz
);

create table visit (
  id uuid primary key default gen_random_uuid(),
  cafe_id uuid not null,
  location_id uuid not null references location(id),
  customer_profile_id uuid not null references customer_profile(id),
  method text not null,               -- customer_scan | staff_scan | manual
  visited_at timestamptz not null default now(),
  amount_ars numeric(12,2),           -- cuando haya integración con POS
  idempotency_key text unique
);

create table stamp (
  id uuid primary key default gen_random_uuid(),
  cafe_id uuid not null,
  stamp_card_id uuid not null references stamp_card(id),
  visit_id uuid references visit(id),
  source text not null,               -- visit | review | story | referral | manual
  value int not null default 1,
  created_at timestamptz default now()
);

create table redemption (
  id uuid primary key default gen_random_uuid(),
  cafe_id uuid not null,
  stamp_card_id uuid not null references stamp_card(id),
  reward_id uuid not null references reward(id),
  redeemed_by_staff_id uuid references staff_user(id),
  redeemed_at timestamptz default now()
);

-- Sellos extra
create table engagement_claim (
  id uuid primary key default gen_random_uuid(),
  cafe_id uuid not null,
  customer_profile_id uuid not null references customer_profile(id),
  kind text not null,                 -- google_review | instagram_story
  evidence_url text,
  status text not null default 'pending',  -- pending | approved | rejected
  reviewed_by_staff_id uuid references staff_user(id),
  stamps_awarded int default 0,
  created_at timestamptz default now()
);

-- Oportunidades y campañas
create table opportunity (
  id uuid primary key default gen_random_uuid(),
  cafe_id uuid not null,
  customer_profile_id uuid not null references customer_profile(id),
  kind text not null,                 -- birthday | absence | near_reward | custom
  period_key text not null,           -- ej. '2026-10-13' o '2026-W42'
  status text not null default 'open',  -- open | approved | dismissed | sent | converted
  detected_at timestamptz default now(),
  unique (cafe_id, customer_profile_id, kind, period_key)
);

create table message (
  id uuid primary key default gen_random_uuid(),
  cafe_id uuid not null,
  opportunity_id uuid references opportunity(id),
  customer_profile_id uuid not null,
  channel text not null default 'whatsapp',
  template_key text,
  body text not null,
  status text not null default 'draft',  -- draft | approved | queued | sent | delivered | read | failed
  approved_by_staff_id uuid references staff_user(id),
  sent_at timestamptz,
  provider_message_id text
);

-- Ofertas de horas valle
create table offer (
  id uuid primary key default gen_random_uuid(),
  cafe_id uuid not null,
  name text not null,
  rule jsonb not null,                -- días, franjas horarias, descuento, cupo
  starts_at timestamptz,
  ends_at timestamptz,
  active boolean default true
);

-- Referidos
create table referral (
  id uuid primary key default gen_random_uuid(),
  cafe_id uuid not null,
  referrer_profile_id uuid not null references customer_profile(id),
  referred_profile_id uuid references customer_profile(id),
  code text unique not null,
  status text not null default 'invited',  -- invited | joined | first_visit | rewarded
  created_at timestamptz default now()
);

-- Facturación
create table subscription (
  id uuid primary key default gen_random_uuid(),
  cafe_id uuid not null references cafe(id),
  plan text not null,
  status text not null,               -- trialing | active | past_due | canceled
  trial_ends_at timestamptz,
  provider_subscription_id text
);

-- Auditoría
create table audit_log (
  id bigserial primary key,
  cafe_id uuid,
  actor_type text not null,           -- staff | system | person
  actor_id uuid,
  action text not null,
  entity text,
  entity_id uuid,
  meta jsonb,
  created_at timestamptz default now()
);
```

### 6.3 Políticas RLS (ejemplo)

```sql
alter table customer_profile enable row level security;

create policy tenant_isolation on customer_profile
  using (cafe_id = current_setting('app.current_cafe_id')::uuid);
```

La API ejecuta `set local app.current_cafe_id = '<uuid>'` al comienzo de cada transacción.

### 6.4 Índices importantes

| Tabla | Índice | Para qué |
| --- | --- | --- |
| `customer_profile` | `(cafe_id, last_visit_at)` | Detectar ausencias |
| `customer_profile` | `(cafe_id, birthday)` parcial por mes/día | Cumpleaños |
| `visit` | `(cafe_id, visited_at desc)` | Panel y métricas |
| `visit` | `(customer_profile_id, visited_at desc)` | Intervalo antifraude |
| `opportunity` | `(cafe_id, status, detected_at)` | Bandeja de revisión |
| `message` | `(cafe_id, status)` | Seguimiento de envíos |

### 6.5 Reglas antifraude de sellos

| Regla | Valor por defecto | Configurable |
| --- | --- | --- |
| Intervalo mínimo entre sellos | 4 horas | Sí |
| Máximo de sellos por día | 1 | Sí |
| Token de QR rotativo | Cambia cada 60 segundos | No |
| Confirmación del staff para canjes | Obligatoria | No |
| Aprobación del staff para sellos por reseña/historia | Obligatoria al inicio | Sí |
| Detección de patrones raros (varios teléfonos, mismo dispositivo) | Alerta al dueño | Sí |

---

## 7. Integraciones externas

### 7.1 WhatsApp Business Cloud API

- **Uso:** mensajes de recuperación, cumpleaños, premio cercano; códigos OTP del cliente.
- **Requisitos:** cuenta de Meta Business verificada, número dedicado por café o número compartido de la plataforma (decisión de producto, ver abajo), plantillas aprobadas por Meta.
- **Restricción importante:** los mensajes iniciados por la empresa fuera de la ventana de 24 horas **deben** usar plantillas aprobadas, y Meta cobra por conversación según categoría. Hay que revisar la tarifa vigente antes de fijar precios.
- **Decisión de producto:**
  - *Opción A:* número de WhatsApp del propio café (más personal, más trabajo de alta por café).
  - *Opción B:* número compartido de Cafelink (más simple, menos personal).
  - **Recomendación:** empezar con B para validar y ofrecer A en el plan Red.
- **Consentimiento:** solo se envía marketing a quien dio opt-in explícito. Guardar prueba (fecha, origen).

### 7.2 Mercado Pago

- Suscripciones recurrentes del plan del café.
- Fase 3: cobro de pedidos anticipados y pago por QR de mesa (Checkout Pro o QR interoperable).
- Webhooks firmados, con verificación y reintentos idempotentes.

### 7.3 Google (reseñas)

- **Ficha del café:** `google_place_id` por sucursal para abrir directamente la pantalla de reseña (`https://search.google.com/local/writereview?placeid=...`).
- **Limitación a tener en cuenta:** no hay una forma simple y pública de verificar automáticamente que **ese cliente** dejó **esa reseña**. Estrategia propuesta:
  1. El cliente toca "Dejar reseña" y se abre Google Maps.
  2. Al volver, la PWA pide una captura o una confirmación.
  3. El staff aprueba el sello extra en el mostrador (ver reclamo en `engagement_claim`).
  4. Opcional: el dueño conecta Google Business Profile para ver reseñas nuevas y cruzarlas por nombre.
- **Sin prometer lo que no se puede verificar:** el producto dice "el staff confirma tu reseña" para evitar abusos.

### 7.4 Instagram (historias)

- Las menciones en historias pueden detectarse mediante la API de Instagram Graph para cuentas profesionales conectadas (webhooks de menciones). **Hay que validar en la documentación vigente los permisos y la revisión de la app de Meta antes de comprometerse.**
- **Plan B:** el cliente muestra la historia en el mostrador y el staff aprueba.

### 7.5 Apple Wallet y Google Wallet

- **Google Wallet:** API de pases genéricos o de lealtad. Se actualiza el pase con cada sello.
- **Apple Wallet:** requiere cuenta de desarrollador de Apple, certificado de pases y servidor de actualización (webservice de PassKit).
- **Valor:** la tarjeta está en el celular sin app, y se pueden enviar notificaciones de pantalla de bloqueo ("Te falta 1 sello").

### 7.6 POS (fase 3)

- Integración con los POS más usados en Argentina (a relevar con los cafés piloto).
- Objetivo: sellos por consumo real y ticket promedio por cliente.
- Estrategia: empezar con importación por CSV o webhook genérico, y después conectores específicos según demanda.

### 7.7 Otros

| Servicio | Uso | Fase |
| --- | --- | --- |
| Email transaccional (Resend, Postmark) | Facturas, accesos del staff | 1 |
| SMS (proveedor local) | Respaldo del OTP si falla WhatsApp | 2 |
| Mapas (Mapbox o Google Maps) | Pasaporte de cafés, descubrimiento | 3 |
| Servicio de IA (API de un modelo de lenguaje) | Redacción de mensajes, resumen semanal | 2 |

---

## 8. Seguridad, privacidad y cumplimiento legal

### 8.1 Seguridad técnica

| Área | Medida |
| --- | --- |
| Transporte | HTTPS en todo, HSTS |
| Autenticación | Sesiones con cookies `HttpOnly`, `Secure`, `SameSite`; OTP con expiración corta y límite de intentos |
| Autorización | Roles (`owner`, `manager`, `staff`) con permisos por acción; verificación en la API, nunca solo en el frontend |
| Aislamiento de datos | RLS por `cafe_id` + tests de aislamiento |
| Secretos | Gestor de secretos, nunca en el repositorio |
| Datos sensibles | Cifrado en reposo del proveedor + cifrado de campo para tokens de terceros |
| Límite de tasa | Por IP, por teléfono y por café |
| QR | Tokens firmados (HMAC) con vigencia corta |
| Dependencias | Escaneo automático (Dependabot, `npm audit`) |
| Backups | Diarios, cifrados, restauración probada |
| Auditoría | Registro inmutable de canjes, cambios de plan, exportes y accesos del superadmin |

### 8.2 Privacidad y datos personales

- **Argentina:** la Ley 25.326 de Protección de Datos Personales regula bases de datos de personas. Hay que considerar inscripción de la base ante la autoridad (AAIP) y el deber de informar finalidad y derechos de acceso, rectificación y supresión. **Consultar con un abogado local antes del lanzamiento.**
- **Minimización:** pedir solo lo necesario (nombre y teléfono). El cumpleaños es opcional y con motivo claro.
- **Consentimiento explícito** para marketing por WhatsApp, separado del consentimiento para registrar visitas.
- **Notas del equipo:** advertir al café que no registre datos sensibles (salud, religión, etc.) en notas libres. Evitar categorías sensibles por diseño; las alergias se tratan como dato operativo mínimo y con aviso claro.
- **Derechos del cliente:** botón en la PWA para ver, descargar y borrar sus datos, y para dejar de recibir mensajes.
- **Retención:** política de borrado para clientes inactivos tras un período definido por el café.
- **Términos y privacidad:** documentos propios del servicio, con rol claro: el café es responsable del tratamiento de sus clientes y Cafelink es encargado del tratamiento.

### 8.3 Cumplimiento de WhatsApp

- Respetar las políticas comerciales de Meta (opt-in, baja inmediata con palabra clave, contenido permitido).
- Monitorear la calidad del número; si cae, limitar envíos.

### 8.4 Facturación fiscal

- Emitir factura electrónica a los cafés por el servicio (requisito de ARCA, ex AFIP). Evaluar un proveedor de facturación electrónica para automatizarlo.
- Definir el tratamiento de impuestos con un contador antes de cobrar.

---

## 9. Diseño UI (sistema de diseño y pantallas)

### 9.1 Principios visuales

1. **Cálido y artesanal, no corporativo.** La marca evoca una cafetería de barrio, no un software de gestión.
2. **Claridad sobre decoración.** Mucho aire, jerarquía fuerte, una sola acción principal por pantalla.
3. **Hecho para el pulgar.** Todo lo importante al alcance de una mano, en la mitad inferior de la pantalla.
4. **Legible en el mostrador.** Contraste alto, textos grandes, estados evidentes; el staff mira de reojo.
5. **Deleite medido.** Una animación de sello satisfactoria vale más que diez efectos.

### 9.2 Tokens de diseño

**Paleta (propuesta inicial, validar contraste AA con una herramienta):**

| Token | Uso | Valor sugerido |
| --- | --- | --- |
| `--color-bg` | Fondo general | `#FBF7F2` (crema) |
| `--color-surface` | Tarjetas | `#FFFFFF` |
| `--color-ink` | Texto principal | `#2B1D16` (café oscuro) |
| `--color-ink-soft` | Texto secundario | `#6B5A4F` |
| `--color-primary` | Acción principal | `#6F4A2F` (café con leche) |
| `--color-primary-hover` | Hover/pressed | `#5A3B25` |
| `--color-accent` | Sellos, premios, highlights | `#D98E3F` (caramelo) |
| `--color-success` | Confirmaciones | `#3E7D5A` |
| `--color-warning` | Avisos | `#C9822B` |
| `--color-danger` | Errores | `#B3402F` |
| `--color-line` | Bordes | `#E7DDD2` |

**Modo oscuro:** fondo `#1C1410`, superficies `#2A1F19`, texto `#F3E9DF`. El panel de mostrador se ofrece también en oscuro para locales con poca luz.

**Tipografía:**

| Rol | Fuente sugerida | Tamaño / peso |
| --- | --- | --- |
| Títulos | Una serif cálida (por ejemplo Fraunces) | 28 a 36 px / 600 |
| Interfaz | Sans geométrica legible (Inter o DM Sans) | 16 px base / 400 a 600 |
| Números grandes (sellos, métricas) | Sans con cifras tabulares | 32 a 48 px / 700 |
| Texto del mostrador | Misma sans | 18 px mínimo |

**Espaciado:** escala de 4 px (4, 8, 12, 16, 24, 32, 48). **Radios:** 12 px en tarjetas, 999 px en botones tipo pastilla y chips. **Sombras:** una sola, suave y baja.

**Iconografía:** set de trazo uniforme (Lucide o Phosphor), grosor 1,75 px. Ilustraciones propias de granos, tazas y medialunas con trazo simple, para marca y estados vacíos.

### 9.3 Componentes base

| Componente | Variantes | Notas |
| --- | --- | --- |
| Botón | Primario, secundario, fantasma, peligro, con ícono | Alto mínimo 48 px en mostrador |
| Tarjeta de sellos | 6, 8, 10, 12 sellos; estados vacío/lleno/premio | Corazón del producto |
| Sello | Vacío, lleno, animándose, bonus (reseña/historia) | El bonus tiene un acento distinto |
| Avatar de cliente | Iniciales con color estable por persona | Sin foto obligatoria |
| Chip | Gusto, estado, etiqueta | Seleccionable |
| Tarjeta de oportunidad | Cumpleaños, ausencia, premio cercano | Muestra borrador y acciones |
| Campo de nota | Texto corto con sugerencias | Dictado por voz en fase 2 |
| Tabla/lista de clientes | Búsqueda, filtros, orden | Virtualizada para listas largas |
| Barra de navegación inferior | 4 pestañas máximo | Móvil |
| Modal inferior (bottom sheet) | Acciones rápidas | Reemplaza modales centrados en móvil |
| Toast | Éxito, error, deshacer | Siempre ofrece deshacer en acciones reversibles |
| Estado vacío | Ilustración + frase + acción | Nunca una pantalla en blanco |
| Skeleton | Carga | Evita saltos de layout |

### 9.4 Mapa de pantallas

**A. PWA del cliente**

| Pantalla | Propósito |
| --- | --- |
| Bienvenida al escanear | Primer contacto, pide nombre y teléfono |
| Verificación (OTP) | Confirma el teléfono |
| Mi tarjeta | Sellos, próximo premio, acciones para sumar sellos extra |
| Sumar sellos extra | Reseña, historia, referir a un amigo |
| Mis premios | Disponibles, canjeados, vencimientos |
| Canjear | Muestra un código para que el staff valide |
| Pasaporte de cafés (fase 3) | Locales visitados, sugerencias |
| Mi perfil y privacidad | Datos, consentimientos, descarga y borrado |

**B. Panel de mostrador (staff)**

| Pantalla | Propósito |
| --- | --- |
| Inicio de turno | Elegir sucursal, ver QR rotativo grande |
| Reconocer cliente | Al llegar un cliente, muestra su ficha en una tarjeta breve |
| Buscar cliente | Por nombre o teléfono, para registros manuales |
| Registrar visita manual | Alternativa al QR |
| Canjear premio | Escanear o ingresar código del cliente |
| Aprobar sellos extra | Cola de reseñas e historias |
| Agregar nota rápida | En dos toques, con sugerencias |
| Alertas del día | Cumpleaños y clientes que vienen hoy |

**C. Panel del dueño**

| Pantalla | Propósito |
| --- | --- |
| Inicio | "Qué pasó hoy" y "qué hacer hoy" |
| Oportunidades | Bandeja de revisión con mensajes preparados |
| Clientes | Lista, filtros (en riesgo, VIP, cumpleaños), ficha completa |
| Programa de fidelidad | Sellos, premios, reglas antifraude |
| Campañas y mensajes | Historial, plantillas, resultados |
| Ofertas de horas valle | Crear y medir |
| Métricas | Retención, frecuencia, recuperación, reseñas |
| Equipo | Invitar staff, roles, sucursales |
| Configuración | Marca, horarios, integraciones, plan y facturación |
| Resumen semanal | Lectura de dos minutos con acciones sugeridas |

**D. Superadmin interno:** cafés, suscripciones, facturación, auditoría, soporte con impersonación registrada, estado de integraciones.

### 9.5 Wireframes clave (ASCII)

**Mi tarjeta (cliente, móvil):**

```
┌───────────────────────────────┐
│  ☰   Café del Barrio      ◐  │
├───────────────────────────────┤
│  Hola, Lucía                  │
│                               │
│  ┌─────────────────────────┐  │
│  │  Tu tarjeta             │  │
│  │  ● ● ● ● ● ● ● ● ● ○    │  │
│  │  9 de 10 sellos         │  │
│  │                         │  │
│  │  Te falta 1 para tu     │  │
│  │  café con medialunas    │  │
│  └─────────────────────────┘  │
│                               │
│  Sumá sellos extra            │
│  ┌──────────┐ ┌──────────┐    │
│  │ Reseña   │ │ Historia │    │
│  │ +2 sellos│ │ +1 sello │    │
│  └──────────┘ └──────────┘    │
│  ┌─────────────────────────┐  │
│  │ Traé a un amigo  +1     │  │
│  └─────────────────────────┘  │
├───────────────────────────────┤
│ Tarjeta  Premios  Cafés  Yo   │
└───────────────────────────────┘
```

**Panel de mostrador (tablet, horizontal):**

```
┌───────────────────────────────────────────────────────────┐
│ Café del Barrio · Sucursal Centro        Turno: Sofía  ◐ │
├──────────────────────────┬────────────────────────────────┤
│                          │  Acaba de llegar               │
│      ┌──────────┐        │  ┌──────────────────────────┐  │
│      │          │        │  │ Lucía · cliente desde    │  │
│      │   QR     │        │  │ 2024 · 18 visitas        │  │
│      │ rotativo │        │  │ Habitual: Latte +        │  │
│      │          │        │  │ medialunas               │  │
│      └──────────┘        │  │ Nota: domingos con su    │  │
│   Se renueva en 0:42     │  │ abuela Ana, ventana      │  │
│                          │  │ [+ Nota]  [Canjear]      │  │
│  Alertas de hoy          │  └──────────────────────────┘  │
│  • Cumple: Martina       │  Pendientes de aprobar (2)     │
│  • Viene hoy: Santiago   │  [Reseña · Martina G.]  ✓  ✕   │
└──────────────────────────┴────────────────────────────────┘
```

**Bandeja de oportunidades (dueño):**

```
┌───────────────────────────────────────────────────────────┐
│ Oportunidades · 3 para revisar            [Modo: Manual ▾]│
├───────────────────────────────────────────────────────────┤
│ ★ Destacada                                               │
│ Valentina · Hace 10 días que no viene (venía cada semana) │
│ ┌───────────────────────────────────────────────────────┐ │
│ │ "Hola, Valentina. Hace unos días que no te vemos por  │ │
│ │  acá. Si te dan ganas de pasar, el próximo café corre │ │
│ │  por cuenta de la casa."                              │ │
│ └───────────────────────────────────────────────────────┘ │
│  [Editar]   [Descartar]   [Enviar por WhatsApp ▶]         │
├───────────────────────────────────────────────────────────┤
│ Martina · Hoy es su cumpleaños        [Revisar]           │
│ Santiago · A una visita de su premio  [Revisar]           │
└───────────────────────────────────────────────────────────┘
```

### 9.6 Microinteracciones y movimiento

| Momento | Animación | Duración |
| --- | --- | --- |
| Sello nuevo | El sello "se estampa" con un leve rebote y vibración corta | 600 ms |
| Premio desbloqueado | Confeti sutil y cambio de color de la tarjeta | 1,2 s |
| Oportunidad enviada | La tarjeta se desliza fuera con un tilde | 300 ms |
| QR por renovarse | Anillo de progreso que se vacía | 60 s |
| Carga de listas | Skeletons | hasta que llegue la data |

Respetar `prefers-reduced-motion`: reemplazar animaciones por cambios de estado simples.

### 9.7 Responsive y plataformas

| Superficie | Prioridad de diseño |
| --- | --- |
| PWA cliente | Móvil vertical (360 a 430 px de ancho) |
| Panel de mostrador | Tablet horizontal y móvil vertical |
| Panel del dueño | Móvil primero, escritorio cómodo |
| Superadmin | Escritorio |

### 9.8 Accesibilidad

- Contraste mínimo WCAG 2.1 AA (4,5:1 texto, 3:1 elementos grandes).
- Áreas táctiles de al menos 44 × 44 px (48 px en mostrador).
- Navegación completa por teclado y lectores de pantalla en panel del dueño.
- No depender solo del color: sellos llenos con forma y texto, no solo tono.
- Textos escalables hasta 200 % sin romper el diseño.
- Etiquetas y mensajes de error asociados a cada campo.

### 9.9 Voz y tono

- **Español rioplatense**, voseo, cercano y breve: "Sumá", "Te falta 1 sello", "Dale".
- Evitar jerga técnica: "oportunidad" se explica como "momento para invitarlo a volver".
- Mensajes de error que explican qué pasó y qué hacer: "No pudimos enviar el mensaje. Probá de nuevo en un minuto."
- Mensajes a clientes del café: cálidos, sin presión, siempre con opción de baja.

---

## 10. Diseño UX (flujos y principios)

### 10.1 Principios de UX

1. **Cero fricción en el mostrador.** Registrar una visita no puede llevar más de 5 segundos de trabajo del staff.
2. **El cliente no necesita app ni contraseña.** Escaneo, teléfono, listo.
3. **Pedir datos de a poco.** Nombre y teléfono primero; cumpleaños y gustos después, cuando haya confianza.
4. **Mostrar el próximo paso siempre.** Cada pantalla responde "¿qué hago ahora?".
5. **Nada se envía sin que el dueño lo haya habilitado.** Control y confianza antes que automatización.
6. **Deshacer en lugar de confirmar.** Si la acción es reversible, se hace y se ofrece deshacer.

### 10.2 Flujo 1: primera visita del cliente

```
Escanea QR del mostrador
   ↓
Pantalla de bienvenida: "Sumá sellos en Café del Barrio"
   ↓
Ingresa nombre + teléfono   (checkbox: "Quiero recibir novedades por WhatsApp", desmarcado)
   ↓
Código OTP por WhatsApp o SMS (6 dígitos, autocompletado)
   ↓
"¡Listo, Lucía! Primer sello" → animación → Mi tarjeta
   ↓
Sugerencia suave: "Instalá la tarjeta en tu celular" (Wallet o acceso directo)
```

**Decisiones:**

- El OTP solo se pide la primera vez por dispositivo; después la sesión persiste (cookie larga).
- Si el OTP falla, se ofrece reenviar por otro canal.
- El consentimiento de marketing nunca viene premarcado.

### 10.3 Flujo 2: visita de un cliente recurrente

```
Escanea QR → sesión activa → sello sumado en < 1,5 s → tarjeta actualizada
```

Si faltan pocos sellos, la pantalla destaca el premio. Si ya pasó el intervalo antifraude, muestra un mensaje amable: "Ya sumaste hoy. ¡Te esperamos mañana!".

### 10.4 Flujo 3: canjear un premio

```
Cliente: Mis premios → "Canjear" → muestra código temporal (2 minutos)
   ↓
Staff: Canjear premio → escanea o escribe el código
   ↓
Pantalla de confirmación al staff: "Café con medialunas · Lucía · ¿Confirmar?"
   ↓
Se registra el canje; la tarjeta reinicia; el cliente ve "¡Disfrutalo!"
```

### 10.5 Flujo 4: sello extra por reseña

```
Cliente: Tarjeta → "Dejar reseña (+2)"
   ↓
Se abre Google Maps en la ficha del café
   ↓
Cliente vuelve a la PWA → "¿Ya dejaste tu reseña?" → adjunta captura opcional
   ↓
Se crea un reclamo pendiente
   ↓
Staff: ve el reclamo en "Pendientes de aprobar" → ✓ aprueba → se suman 2 sellos
   ↓
El cliente recibe aviso: "¡Gracias por tu reseña! +2 sellos"
```

### 10.6 Flujo 5: el dueño actúa sobre una oportunidad

```
Dueño abre el panel → ve "3 oportunidades"
   ↓
Abre la destacada → lee el mensaje preparado
   ↓
Opciones: Enviar / Editar / Descartar / "Enviar y no preguntar más para este tipo"
   ↓
Si envía: confirmación + estado (enviado → entregado → leído → volvió)
```

### 10.7 Flujo 6: alta de un café (onboarding)

Objetivo: **que el café tenga su primer QR funcionando en 15 minutos.**

| Paso | Qué hace | Tiempo objetivo |
| --- | --- | --- |
| 1 | Crear cuenta (email + magic link) | 1 min |
| 2 | Datos del café: nombre, sucursal, logo, link de Google Maps | 3 min |
| 3 | Elegir programa de sellos con plantillas (6, 8, 10) y definir premio | 3 min |
| 4 | Imprimir o mostrar el QR (PDF listo con diseño del café) | 2 min |
| 5 | Invitar a un barista por link | 1 min |
| 6 | Probar con su propio celular (visita de prueba) | 3 min |
| 7 | Elegir el modo de mensajes (manual por defecto) | 2 min |

Se acompaña con una **lista de pasos con progreso** y un botón de ayuda por WhatsApp en el panel.

### 10.8 Flujo 7: uso diario del staff

- Al empezar el turno: abrir el panel, el QR ya está visible.
- Durante el día: cuando llega un cliente conocido, la tarjeta de "Acaba de llegar" aparece sola (si escaneó) o se busca por nombre.
- Notas: un botón fijo "+ Nota" con sugerencias frecuentes ("sin azúcar", "con leche de almendras", "mesa de la ventana").
- Al final del turno: resumen de visitas y pendientes.

### 10.9 Estados límite y errores

| Situación | Comportamiento |
| --- | --- |
| Sin conexión del cliente | Mensaje claro; reintento automático al volver la red |
| Sin conexión del mostrador | Registrar en cola local y sincronizar (fase 2) |
| QR vencido | Pantalla amable: "Escaneá de nuevo el código del mostrador" |
| Teléfono ya registrado en otro dispositivo | Verificación por OTP y vinculación |
| Cliente borra su cuenta | Se anonimizan visitas y se eliminan datos personales |
| WhatsApp no entregado | Reintento y aviso al dueño; se ofrece alternativa |
| Plan vencido | Modo solo lectura 7 días y recordatorio; el QR sigue sumando sellos durante la gracia |

### 10.10 Contenido y estados vacíos

- Café nuevo sin clientes: "Cuando tus clientes escaneen el QR, vas a verlos acá" + botón para descargar el QR.
- Sin oportunidades: "Todo en orden. Hoy no hay clientes por recuperar."
- Sin premios: "Seguí sumando sellos para desbloquear tu primer premio."

### 10.11 Investigación y validación de UX

- **Antes de construir:** 8 a 10 entrevistas con dueños y 5 con baristas; observación de un turno completo.
- **Prototipo clickeable** del mostrador y la tarjeta para probar con 5 personas.
- **Pruebas de usabilidad** con tareas cronometradas: "registrar una visita", "canjear un premio".
- **Métricas de UX:** tiempo por tarea, tasa de error, SUS (escala de usabilidad) tras la prueba piloto.

---

## 11. Funcionalidades en detalle

Cada funcionalidad incluye descripción, criterios de aceptación y plan.

### 11.1 Núcleo (MVP)

#### F1. Tarjeta de sellos por QR

- **Descripción:** el cliente escanea un QR y suma un sello; la tarjeta se ve en el navegador.
- **Criterios de aceptación:**
  - Escaneo a sello visible en menos de 1,5 s en 4G.
  - Respeta el intervalo mínimo y el máximo diario.
  - Funciona en Chrome y Safari móvil actuales.
  - Si el QR venció, muestra instrucciones claras.
- **Plan:** Esencial, Crecimiento, Red.

#### F2. Ficha de cliente

- **Descripción:** perfil con visitas, pedido habitual, gustos y notas del equipo.
- **Criterios de aceptación:**
  - Editable por staff con permiso.
  - Muestra autor y fecha de cada nota.
  - Búsqueda por nombre o teléfono en menos de 300 ms.
  - Advertencia al escribir datos sensibles en notas.
- **Plan:** todos.

#### F3. Alertas de oportunidades

- **Descripción:** detecta cumpleaños, ausencias y premio cercano.
- **Reglas iniciales:**

| Tipo | Regla | Configurable |
| --- | --- | --- |
| Cumpleaños | Hoy es su cumpleaños (con dato y consentimiento) | Anticipación 0 a 3 días |
| Ausencia | Pasó más de X días sobre su frecuencia habitual | Umbral por café |
| Premio cercano | Le falta 1 o 2 sellos | Cantidad de sellos |

- **Criterios de aceptación:** sin duplicados por período; el dueño ve el motivo de cada alerta.
- **Plan:** todos.

#### F4. Mensajes por WhatsApp en un toque (mejora sobre Coffeefy)

- **Descripción:** el borrador sale por WhatsApp con un clic del dueño.
- **Criterios de aceptación:**
  - Solo a clientes con opt-in vigente.
  - Usa plantillas aprobadas por Meta.
  - Muestra estado de entrega.
  - Palabra clave de baja ("BAJA") que corta los envíos.
  - Límite de mensajes por cliente (por ejemplo, 1 cada 14 días por tipo).
- **Plan:** Crecimiento y Red. Esencial: copiar el mensaje para enviarlo a mano.

#### F5. Sellos extra por reseñas e historias, con verificación

- **Descripción:** incentivo a reseñar en Google Maps y publicar historias etiquetando al local.
- **Criterios de aceptación:**
  - El staff aprueba o rechaza con un toque.
  - Límite de un sello extra por tipo cada X días por cliente.
  - Registro de quién aprobó.
- **Plan:** Crecimiento y Red.

#### F6. Panel del dueño básico

- **Descripción:** inicio con "qué pasó hoy" y "qué hacer hoy", lista de clientes y configuración del programa.
- **Plan:** todos.

#### F7. Equipo y roles

- **Roles:** dueño (todo), encargado (operación y campañas), staff (mostrador).
- **Plan:** Esencial: hasta 2 usuarios; Crecimiento: hasta 10; Red: ilimitados.

### 11.2 Fase 2

#### F8. Panel de métricas y retención

| Métrica | Definición |
| --- | --- |
| Clientes activos | Con visita en los últimos 30 días |
| Retención a 30/60/90 días | Porcentaje de clientes nuevos que vuelven |
| Frecuencia media | Visitas por cliente activo por mes |
| Clientes en riesgo | Superaron su intervalo habitual |
| Recuperados | Volvieron dentro de N días de un mensaje |
| Tasa de canje | Premios canjeados sobre ganados |
| Reseñas e historias generadas | Total por mes |

Incluye cohortes por mes de ingreso y comparación entre sucursales.

#### F9. Ofertas de horas valle

- **Descripción:** el café define franjas flojas (por ejemplo, martes a jueves de 15 a 17) y una oferta; el sistema la ofrece a quienes suelen venir en otros horarios.
- **Criterios de aceptación:**
  - Cupo máximo de canjes por oferta.
  - Medición de ventas incrementales aproximadas (visitas en franja vs. promedio).
  - Vencimiento claro en el cupón del cliente.

#### F10. Referidos

- **Descripción:** el cliente comparte un link; cuando el amigo hace su primera visita, ambos suman sellos.
- **Antifraude:** el referido debe tener un teléfono nuevo y verificado; un máximo de referidos por mes.

#### F11. Tarjeta en Apple Wallet y Google Wallet

- **Descripción:** botón "Agregar a Wallet" en la tarjeta.
- **Criterios de aceptación:** se actualiza con cada sello; notificación de pantalla de bloqueo cuando faltan 1 o 2 sellos.

#### F12. Modo sin conexión en el mostrador

- Cola local de visitas manuales y canjes; sincronización al volver la conexión; indicador visible de "pendiente de sincronizar".

#### F13. Notas por voz y sugerencias inteligentes

- Dictado de notas con transcripción; sugerencias de gustos a partir del historial. Revisión humana antes de guardar.

#### F14. Resumen semanal con IA

- Un mensaje (en el panel y por email) con: qué mejoró, a quién recuperar, qué oferta probar. Se redacta a partir de datos reales del café y nunca inventa cifras.

### 11.3 Fase 3

#### F15. Multi-sucursal

- Programa compartido o por sucursal; métricas comparativas; permisos por sucursal; un cliente suma en cualquiera y ve su tarjeta unificada.

#### F16. Integración con POS y Mercado Pago

- Sellos por consumo (por ejemplo, 1 sello cada $X); ticket promedio por cliente; conciliación de visitas.

#### F17. Pedido anticipado y pago por QR de mesa

- Menú digital, carrito y pago con Mercado Pago; el pedido llega al panel del mostrador; suma sellos automáticamente.

#### F18. Pasaporte de cafés (red)

- El cliente colecciona "sellos de visita" de distintos cafés adheridos y desbloquea beneficios de red (por ejemplo, un descuento tras visitar 5 cafés distintos).
- Los cafés eligen participar, definen su aporte y ven las visitas que les llegan por la red.
- **Privacidad:** solo se comparte "visitó este café", nunca notas ni gustos.

#### F19. Programa de niveles y retos

- Niveles (Habitué, Estrella) y retos mensuales ("probá 3 bebidas distintas"). Cada café decide si los activa.

#### F20. API pública y webhooks

- Para que cadenas integren sus sistemas: eventos `visit.recorded`, `reward.redeemed`, `customer.created`.

### 11.4 Funcionalidades transversales

| Área | Detalle |
| --- | --- |
| Importación | Cargar clientes por CSV con consentimiento declarado |
| Exportación | CSV de clientes, visitas y campañas |
| Notificaciones al dueño | Email o WhatsApp para cobros y alertas importantes |
| Marca blanca | Colores, logo y nombre del café en la PWA (Crecimiento y Red) |
| Ayuda | Centro de ayuda y soporte por WhatsApp |
| Idioma | Español rioplatense primero; estructura lista para otros idiomas |

---

## 12. Diferenciales frente a Coffeefy

| Dimensión | Coffeefy (según su web pública) | Cafelink | Por qué importa |
| --- | --- | --- | --- |
| Envío de mensajes | Prepara invitaciones y las deja para revisar | Envío por WhatsApp en un toque, con modos manual y automático | Menos pasos, más acciones ejecutadas |
| Prueba de resultados | No muestra métricas de retención | Panel de retención y atribución de recuperaciones | El café ve el retorno de lo que paga |
| Verificación de reseñas | No detalla cómo evita abusos | Aprobación del staff y límites configurables | Menos fraude, más confianza |
| Planes | Un único plan de $70.000/mes | Tres planes según tamaño y necesidad | Accesible para cafés chicos, escalable para cadenas |
| Tarjeta | En el navegador | Navegador + Apple/Google Wallet | Más recordación, notificaciones de pantalla de bloqueo |
| Horas valle | No lo menciona | Ofertas automáticas en franjas flojas | Llena momentos muertos |
| Referidos | No lo menciona | Programa de referidos | Crecimiento orgánico |
| Resumen con IA | No lo menciona | Resumen semanal accionable | Ahorra tiempo al dueño |
| Pedido y pago por QR | No lo menciona | Pedido anticipado y pago por mesa | Más ticket y menos fila |
| Efecto red | Cada café es una isla | Pasaporte de cafés | Atrae clientes nuevos a todos los locales |
| Multi-sucursal | No lo detalla | Roles, métricas comparadas y programa compartido | Atrae cadenas |
| Integraciones | No lo detalla | POS, Mercado Pago, API y webhooks | Datos de consumo real |

**Posicionamiento propuesto:** *"El socio que convierte a tus clientes habituales en un negocio más estable, con acciones que ya salen listas."*

**Ventajas defendibles a mediano plazo:**

1. **Datos y atribución:** cuanto más tiempo use un café el producto, más historial y mejor medición.
2. **Red de cafés:** valor que crece con cada local adherido y no se copia rápido.
3. **Experiencia del mostrador:** un flujo de 5 segundos pulido con feedback real de baristas.

---

## 13. Planes y precios

> Los precios son **hipótesis** en pesos argentinos, tomando como referencia los $70.000/mes de Coffeefy. Validar con 5 a 10 cafés antes de fijarlos y revisar por inflación.

| Función | Esencial | Crecimiento | Red |
| --- | --- | --- | --- |
| Precio orientativo (ARS/mes) | 25.000 | 60.000 | 150.000 |
| Sucursales | 1 | 1 a 3 | Ilimitadas |
| Clientes activos | Hasta 500 | Ilimitados | Ilimitados |
| Usuarios del equipo | 2 | 10 | Ilimitados |
| Sellos por QR y ficha de cliente | Sí | Sí | Sí |
| Alertas de oportunidades | Sí | Sí | Sí |
| Mensaje por WhatsApp en un toque | No (copiar y pegar) | Sí | Sí |
| Sellos extra por reseña o historia | No | Sí | Sí |
| Ofertas en horas valle y referidos | No | Sí | Sí |
| Panel de métricas | Básico | Completo | Completo + comparativo |
| Tarjeta en Wallet | No | Sí | Sí |
| Marca blanca | No | Sí | Sí |
| Multi-sucursal y roles avanzados | No | No | Sí |
| Integración con POS y Mercado Pago | No | No | Sí |
| Pedido anticipado y pago por QR | No | No | Sí |
| Resumen semanal con IA | No | Sí | Sí |
| API y webhooks | No | No | Sí |
| Soporte | Centro de ayuda | WhatsApp | WhatsApp prioritario y onboarding guiado |

**Reglas comerciales:**

- 30 días gratis en Crecimiento; al terminar, el café elige plan sin perder datos.
- Descuento por pago anual (por ejemplo, 2 meses gratis).
- Pasaporte de cafés como add-on opcional.
- Los costos variables de WhatsApp (conversaciones de Meta) se definen como incluidos hasta un tope o pasan a un esquema de crédito prepago. **Calcular el margen con la tarifa vigente de Meta antes de lanzar.**
- Cobro con Mercado Pago, factura electrónica automática.

---

## 14. Métricas y analítica

### 14.1 Métricas del negocio (para vos)

| Métrica | Objetivo orientativo |
| --- | --- |
| Cafés en prueba por mes | Definir según capacidad de soporte |
| Conversión prueba a pago | Mayor al 40 % como meta inicial |
| MRR (ingreso mensual recurrente) | Seguimiento mensual |
| Churn mensual de cafés | Menor al 5 % |
| CAC y payback | Payback menor a 6 meses |
| NPS de dueños | Mayor a 40 |

### 14.2 Métricas de producto (por café)

| Métrica | Qué indica |
| --- | --- |
| Activación del café | Primer QR escaneado por un cliente real en los primeros 3 días |
| Visitas registradas por día | Uso real |
| Porcentaje de clientes con 2 o más visitas | Efecto de fidelización |
| Oportunidades accionadas | Uso del valor diferencial |
| Recuperación atribuida | Retorno comprobable |
| Tiempo de registro de visita | Calidad del mostrador |

### 14.3 Eventos de analítica a instrumentar

`cafe_created`, `qr_printed`, `customer_joined`, `visit_recorded`, `reward_earned`, `reward_redeemed`, `opportunity_detected`, `opportunity_approved`, `message_sent`, `message_delivered`, `customer_returned_after_message`, `claim_submitted`, `claim_approved`, `plan_changed`, `trial_started`, `trial_converted`.

Herramienta sugerida: PostHog (producto) más las métricas propias del panel. Privacidad: no enviar teléfonos ni notas a herramientas de terceros.

---

## 15. Plan de acción por fases

> **Supuestos:** equipo de 1 a 3 personas, sprints de 2 semanas. Las duraciones son estimaciones y se ajustan según el equipo real.

### Fase 0: Validación (semanas 1 a 3)

**Objetivo:** confirmar que hay dolor y disposición a pagar antes de escribir código serio.

| Tarea | Entregable |
| --- | --- |
| Entrevistar 8 a 10 dueños de café (distintos tamaños) | Notas y patrones |
| Observar 2 turnos completos en mostrador | Mapa del flujo real |
| Probar Coffeefy como cliente y, si es posible, como dueño en su prueba gratis | Lista de fortalezas y fallas reales |
| Prototipo clickeable (Figma) del cliente, mostrador y dueño | Prototipo validado con 5 personas |
| Pre-venta o lista de espera con 3 a 5 cafés piloto comprometidos | Cafés piloto |
| Consultar a un abogado sobre datos personales y a un contador sobre facturación | Lista de requisitos legales |
| Confirmar viabilidad de WhatsApp Cloud API (cuenta, plantillas) | Cuenta de Meta verificada en trámite |

**Gate de salida:** al menos 3 cafés piloto comprometidos y una hipótesis de precio con respuesta positiva.

### Fase 1: MVP (semanas 4 a 11, 4 sprints)

**Objetivo:** que un café pueda registrar visitas, reconocer clientes y accionar oportunidades.

| Sprint | Alcance | Resultado verificable |
| --- | --- | --- |
| 1 (sem. 4-5) | Monorepo, CI/CD, entornos, base de datos con RLS, autenticación staff y dueño, sistema de diseño base | Un usuario inicia sesión y ve un panel vacío en staging |
| 2 (sem. 6-7) | Alta de café y onboarding, programa de sellos, QR rotativo, PWA del cliente con OTP, registro de visita y tarjeta | Un cliente escanea y suma un sello de punta a punta |
| 3 (sem. 8-9) | Ficha de cliente, notas y gustos, panel de mostrador, canje de premios, antifraude básico | El staff reconoce al cliente y canjea un premio |
| 4 (sem. 10-11) | Motor de oportunidades, bandeja del dueño, WhatsApp en un toque, reclamos de reseña/historia con aprobación, facturación con Mercado Pago, landing | Un café piloto recibe y envía su primera invitación; se puede cobrar |

**Calidad en el MVP:**

- Tests unitarios del dominio (sellos, reglas de oportunidad).
- Tests de integración de los flujos críticos (visita, canje, envío).
- Test de aislamiento multi-tenant.
- Prueba de carga básica: 50 visitas por minuto sostenidas.
- Revisión de accesibilidad de pantallas clave.

**Gate de salida:** 3 a 5 cafés piloto usando el producto una semana completa sin ayuda técnica y con feedback recogido.

### Fase 2: Crecimiento (semanas 12 a 19, 4 sprints)

**Objetivo:** demostrar valor medible y reducir fricción.

| Sprint | Alcance |
| --- | --- |
| 5 | Panel de métricas (retención, frecuencia, cohortes), atribución de recuperaciones |
| 6 | Ofertas de horas valle y referidos |
| 7 | Apple y Google Wallet, marca blanca, modo sin conexión del mostrador |
| 8 | Resumen semanal con IA, notas por voz, planes y límites por plan, mejoras según feedback piloto |

**Lanzamiento comercial:** abrir la prueba gratis pública, activar planes Esencial y Crecimiento.

**Gate de salida:** cafés pagando el plan Crecimiento y retención de cafés estable durante 2 meses.

### Fase 3: Red (semanas 20 a 31, 6 sprints)

**Objetivo:** diferenciarse de forma defendible y atraer cadenas.

| Sprint | Alcance |
| --- | --- |
| 9-10 | Multi-sucursal, roles avanzados, métricas comparativas |
| 11-12 | Integración con POS y Mercado Pago, sellos por consumo |
| 13 | Pedido anticipado y pago por QR de mesa |
| 14 | Pasaporte de cafés, descubrimiento, add-on de red |
| (continuo) | API pública, webhooks, niveles y retos |

### Fase 4: Escala (desde el mes 8)

- Revisar métricas de infraestructura y aplicar los criterios de extracción de servicios (sección 3.3).
- Réplica de lectura o almacén analítico si el panel se ralentiza.
- Expansión a otras ciudades y países de la región (cambios de moneda, impuestos y proveedores locales).
- Programa de socios (agencias, proveedores de café) como canal de adquisición.

### 15.1 Plan de lanzamiento comercial (resumen)

| Etapa | Acción |
| --- | --- |
| Pre-lanzamiento | Lista de espera, 3 a 5 cafés piloto con descuento de fundador |
| Lanzamiento | Demos presenciales en cafés de una zona acotada; prueba de 30 días |
| Prueba social | Casos de éxito con cifras reales de los pilotos |
| Canales | Instagram de la marca, comunidades de cafeterías y barismo, proveedores de insumos y máquinas, cámaras gastronómicas |
| Soporte | WhatsApp de atención con respuesta en horario comercial |

### 15.2 Checklist de salida a producción

- [ ] Backups automáticos y restauración probada
- [ ] Alertas y paneles de monitoreo activos
- [ ] Términos, privacidad y política de cookies publicados
- [ ] Consentimientos y baja de mensajes funcionando
- [ ] Plantillas de WhatsApp aprobadas
- [ ] Cobros de prueba y factura electrónica verificados
- [ ] Test de aislamiento de datos entre cafés aprobado
- [ ] Prueba de carga superada
- [ ] Runbook de incidentes y responsable de guardia definido
- [ ] Revisión de seguridad básica (dependencias, secretos, permisos)

### 15.3 Equipo mínimo y roles

| Rol | Dedicación | Responsabilidad |
| --- | --- | --- |
| Producto y negocio (fundador/a) | Alta | Entrevistas, prioridades, ventas, soporte inicial |
| Desarrollo full-stack | 1 a 2 personas | API, PWA, paneles, integraciones |
| Diseño UI/UX | Parcial | Sistema de diseño, prototipos, pruebas de usabilidad |
| Legal y contable | Consultas puntuales | Datos personales, facturación, términos |

---

## 16. Riesgos y mitigaciones

| Riesgo | Probabilidad | Impacto | Mitigación |
| --- | --- | --- | --- |
| Coffeefy copia o mejora rápido | Media | Alto | Foco en lo defendible: atribución, red de cafés, multi-sucursal |
| Costos y reglas de WhatsApp cambian | Alta | Alto | Modelar el costo por mensaje, topes por plan, alternativa de email o SMS |
| Baja adopción del staff en mostrador | Media | Alto | Flujo de menos de 5 segundos, capacitación breve, pruebas con baristas |
| Fraude de sellos o reseñas | Media | Medio | Intervalos, QR rotativo, aprobación del staff, alertas |
| Reseñas e historias no verificables automáticamente | Alta | Medio | Diseñar para verificación humana y comunicarlo con transparencia |
| Incumplimiento de datos personales | Baja | Alto | Asesoría legal, consentimiento explícito, derechos del cliente, minimización |
| Cafés chicos no pagan por software | Media | Alto | Plan Esencial accesible, prueba gratis, demostrar retorno con métricas |
| Dependencia de terceros (Meta, Google) | Media | Medio | Capas de abstracción por proveedor, alternativas, monitoreo de cambios |
| Sobreingeniería (microservicios prematuros) | Media | Medio | Monolito modular y criterios explícitos de extracción |
| Falla de infraestructura en hora pico | Baja | Alto | Backups, monitoreo, modo sin conexión, pruebas de carga |
| Equipo chico con demasiado alcance | Alta | Alto | Respetar el MVP, recortar sin culpa, validar antes de construir |

---

## 17. Próximos pasos inmediatos

1. **Definir el nombre y la marca** (dominio, usuario de Instagram, disponibilidad).
2. **Armar la lista de 10 cafés** a entrevistar y agendar las primeras 5 conversaciones esta semana.
3. **Probar Coffeefy** (como cliente, y la prueba gratis si está disponible) para anotar fricciones reales.
4. **Crear el prototipo** de las tres pantallas centrales: Mi tarjeta, Panel de mostrador y Bandeja de oportunidades.
5. **Iniciar el trámite de WhatsApp Business** (cuenta de Meta, número, primeras plantillas).
6. **Confirmar el stack** con lo que el equipo ya domina y crear el monorepo con CI.
7. **Consultar a un abogado y a un contador** sobre datos personales y facturación.
8. **Decidir el público inicial:** cafés de barrio de una zona o cadenas pequeñas, para enfocar el piloto y el mensaje de venta.

---

### Anexo A: Decisiones de arquitectura (ADRs resumidos)

| # | Decisión | Estado | Motivo |
| --- | --- | --- | --- |
| 001 | Monolito modular en lugar de microservicios | Propuesta | Velocidad y simplicidad con equipo chico |
| 002 | PostgreSQL con RLS para multi-tenencia | Propuesta | Aislamiento barato y probado |
| 003 | PWA en lugar de app nativa | Propuesta | Sin descarga, un solo código |
| 004 | Identidad global del cliente con perfiles locales por café | Propuesta | Habilita el pasaporte respetando privacidad |
| 005 | Mensajes con aprobación del dueño por defecto | Propuesta | Confianza y cumplimiento |
| 006 | Verificación humana de reseñas e historias al inicio | Propuesta | No hay verificación automática confiable garantizada |
| 007 | Colas con reintentos e idempotencia | Propuesta | Tolerar fallas de terceros |

### Anexo B: Glosario

| Término | Significado |
| --- | --- |
| Tenant | Un café (o cadena) cuyos datos están aislados de los demás |
| RLS | Seguridad a nivel de fila en PostgreSQL |
| PWA | Aplicación web instalable que funciona desde el navegador |
| OTP | Código de un solo uso para verificar el teléfono |
| Oportunidad | Momento detectado para invitar a un cliente a volver |
| Hora valle | Franja horaria de baja demanda |
| Plantilla (WhatsApp) | Mensaje preaprobado por Meta para iniciar conversaciones |
| ADR | Registro de decisión de arquitectura |

### Anexo C: Lo que falta confirmar

- Cómo funciona **realmente** Coffeefy por dentro (solo se analizó su web pública).
- Tarifas vigentes de WhatsApp Business y límites de plantillas.
- Permisos y revisión de la app de Meta para detectar menciones en historias de Instagram.
- Requisitos de Apple y Google para pases de Wallet y sus costos de cuenta.
- Estado de inscripción de bases de datos y obligaciones ante la autoridad de datos personales.
- Disposición real a pagar de cafés chicos y medianos (se resuelve en la Fase 0).
