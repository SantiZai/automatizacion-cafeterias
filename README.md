# Cafelink

Fidelización y relación con clientes para cafeterías: sellos por QR, ficha de cada cliente y mensajes preparados para invitar a volver.

> Nombre de trabajo provisorio. La visión, el diseño y el plan completo están en `docs/arquitectura-y-plan.md`.

## Stack

| Capa | Tecnología |
| --- | --- |
| Front y servidor | Next.js 16 (App Router) + React 19 + TypeScript |
| UI | Tailwind CSS 4 + componentes estilo shadcn/ui (Radix) |
| Base de datos | Firestore |
| Autenticación | Firebase Auth (Google para dueños y equipo) |
| Validación | Zod |
| Tests | Vitest |

## Requisitos

- Node.js 22 o superior
- Java 21 o superior (lo necesita el emulador de Firestore)
- No hace falta un proyecto real de Firebase para desarrollar: se usan emuladores con el proyecto `demo-cafelink`.

## Primeros pasos (local)

```bash
npm install
cp .env.example .env.local      # los valores por defecto ya sirven para los emuladores

# Terminal 1: emuladores de Auth y Firestore (UI en http://localhost:4000)
npm run emulators

# Terminal 2: la app (http://localhost:3000)
npm run dev
```

Entrá a `http://localhost:3000/login`. No hay registro público: la primera cuenta la creás vos en Authentication (consola o emulador en `http://localhost:4000/auth`, método Email/Contraseña) con un mail de `ADMIN_EMAILS`. Después creá cafés y cuentas desde `/admin`.

Los datos de los emuladores se guardan en `.emulator-data/` al cerrar (`--export-on-exit`).

## Scripts

| Comando | Qué hace |
| --- | --- |
| `npm run dev` | Servidor de desarrollo |
| `npm run build` / `npm start` | Build y servidor de producción |
| `npm run lint` | ESLint |
| `npm run typecheck` | Chequeo de tipos |
| `npm test` | Tests unitarios (dominio) |
| `npm run emulators` | Emuladores de Auth y Firestore |
| `npm run deploy:rules` | Publica reglas e índices de Firestore |

## Estructura

```
src/
├─ app/
│  ├─ page.tsx                  Landing
│  ├─ login/                    Ingreso con mail y contraseña
│  ├─ (app)/                    Zona autenticada (layout con sesión obligatoria)
│  │  ├─ admin/                  Alta de cafés y cuentas (solo administrador)
│  │  ├─ onboarding/            Aviso (el alta la hace el administrador)
│  │  └─ dashboard/             Inicio del café (cuenta, programa, QR, etc.)
│  └─ api/auth/session/         Crea y borra la cookie de sesión
├─ components/
│  ├─ ui/                       Componentes base (estilo shadcn/ui)
│  ├─ auth/                     Botones de login y logout
│  └─ brand/                    Logo
├─ domain/                      Reglas de negocio puras y testeadas
│  ├─ stamps.ts                 Antifraude de sellos y progreso de tarjeta
│  └─ qr-token.ts               QR rotativo firmado (HMAC)
├─ lib/
│  ├─ firebase/                 SDK de cliente y Admin SDK (solo servidor)
│  ├─ auth/                     Sesión por cookie y helpers
│  └─ data/                     Lecturas de Firestore desde el servidor
└─ proxy.ts                     Primera barrera de rutas protegidas
```

## Cómo funciona la autenticación

1. El navegador inicia sesión con mail y contraseña (Firebase Auth, cuentas creadas por el administrador) y obtiene un ID token.
2. `POST /api/auth/session` verifica el token y que sea del proveedor `password` (Google y teléfono dan 403) y devuelve una **cookie de sesión** `HttpOnly` de 5 días.
3. Las páginas del servidor llaman a `requireSession()`, que verifica la cookie (incluida la revocación) en cada solicitud. Cada pantalla donde se entra genera su propia cookie: la misma cuenta sirve en varias a la vez.
4. `src/proxy.ts` solo comprueba que exista la cookie y redirige a `/login`; la verificación real está en el servidor.
5. Los clientes entran con teléfono a `/v` y `/tarjeta` sin cookie, con su token por pedido.

## Modelo de datos (Firestore)

Todo lo del café vive bajo su ruta, lo que da el aislamiento entre cafés:

```
users/{uid}                                   defaultCafeId, email
cafes/{cafeId}                                name, slug, plan, timezone, settings
 ├─ members/{uid}                             role: owner | manager | staff
 ├─ locations/{locationId}
 ├─ programs/{programId}                      stampsRequired, reglas antifraude, rewards[]
 ├─ customers/{customerId}                    personUid, visitCount, lastVisitAt, status
 │   ├─ notes/{noteId}
 │   └─ cards/{programId}                     sellos acumulados
 ├─ visits/{visitId}
 └─ opportunities/{opportunityId}
```

**Regla de oro:** el navegador solo **lee** (ver `firestore.rules`). Toda escritura pasa por el servidor con el Admin SDK, para aplicar antifraude, límites y auditoría.

## Pasar a un proyecto real de Firebase

1. Crear el proyecto en la [consola de Firebase](https://console.firebase.google.com) y **Firestore** en modo producción, región `southamerica-east1` (São Paulo).
2. En **Authentication > Sign-in method**, habilitar **Email/Contraseña** y **Teléfono**. En **Settings > Authorized domains**, agregar tu dominio.
3. En **Configuración del proyecto > Tus apps**, registrar una app web y copiar la configuración a `NEXT_PUBLIC_FIREBASE_*`.
4. En **Cuentas de servicio**, generar una clave privada y completar `FIREBASE_ADMIN_CLIENT_EMAIL` y `FIREBASE_ADMIN_PRIVATE_KEY`.
5. Poner `NEXT_PUBLIC_USE_FIREBASE_EMULATORS=false` y borrar `FIRESTORE_EMULATOR_HOST` y `FIREBASE_AUTH_EMULATOR_HOST`.
6. Generar `QR_SIGNING_SECRET` (`openssl rand -base64 48`).
7. Cambiar el proyecto en `.firebaserc` y publicar reglas e índices con `npm run deploy:rules`.

## Estado actual

- [x] Base del proyecto, tema de café y componentes de UI
- [x] Login con mail y contraseña, cookie de sesión y rutas protegidas (sin registro público, cuentas del administrador)
- [x] Alta de café y cuentas desde `/admin` (café, miembro dueño, local, programa de sellos)
- [x] Reglas de sellos y QR rotativo con tests (18 pruebas)
- [x] QR del mostrador (`/dashboard/qr` + `/api/cafe/qr`, auto-renovación e imprimible)
- [x] PWA del cliente (`/v/[token]`): alta con teléfono + OTP y tarjeta de sellos
- [x] Portal `/tarjeta`: todas las tarjetas del teléfono con canje y sellos extra, sin re-escanear (paso previo a Wallet)
- [x] Registro de visita en el servidor (`POST /api/visits/scan`, antifraude e idempotencia)
- [x] Ficha de cliente (`/dashboard/clientes`): búsqueda, pedido, gustos, notas y visitas
- [x] Canje de premios (código temporal de 2 min + confirmación del staff en `/dashboard/canjear`)
- [x] Reglas de seguridad de Firestore (incluye `redemptions`)
- [x] Motor de oportunidades (`/dashboard/oportunidades`): ausencias, premio cercano y cumpleaños, con mensaje listo para copiar (modo Esencial)
- [x] Sellos extra (`/dashboard/aprobar`): reseña +2 / historia +1 con aprobación del staff y cooldown de 30 días
- [x] Configuración de la promo (`/dashboard/programa`): sellos, premio y antifraude con ajuste automático de tarjetas
- [ ] Probar reglas de Firestore con `@firebase/rules-unit-testing` (requiere emuladores)

## Próximo sprint

1. Envío automático por WhatsApp Cloud API (plantillas + estados) — hoy es con un clic vía `wa.me`.
2. Facturación con Mercado Pago.

## Notas

- Los componentes de `src/components/ui` están escritos a mano con el estilo de shadcn/ui porque el CLI no pudo acceder a su registro al crear el proyecto. Con acceso a internet podés correr `npx shadcn@latest add button card input` y sincronizarlos con el CLI.
- `npm audit` marca avisos en dependencias de desarrollo (`eslint-config-next`); no se incluyen en el build de producción.
- Se desactivó `cacheComponents` (activo por defecto en Next 16) porque casi todas las pantallas dependen de la sesión. Podés reactivarlo más adelante envolviendo los accesos a cookies en `<Suspense>`.
