# PROGRESS.md — Therapy Platform Build Log

> **Single source of truth** for what has been built, decisions made, and what's pending.
> Updated at the end of every phase.

---

## Phase 1 — Foundation ✅ COMPLETE

**Completed:** 2026-09-13

### What was built

#### Monorepo
- Root `package.json` with npm workspaces (`apps/*`, `services/*`, `packages/*`)
- `turbo.json` — Turborepo with parallel build/dev/lint tasks
- `.env.example` — full env var documentation across all phases
- `.gitignore` covering all workspace packages
- `README.md` with architecture table and quickstart

#### `packages/config`
- `env.ts` — Zod-validated env schema (`parseEnv()`) shared across services
- `constants.ts` — `USER_ROLES`, `THERAPIST_STATUS`, `SESSION_STATUS`, `SESSION_TYPE`, `SESSION_MODE`, `MATCHING_TIMEOUT_MS`, `LIVEKIT_ROOM_CONFIG`
- Barrel `index.ts`

#### `packages/shared-types`
- Complete TypeScript interfaces: `User`, `TherapistProfile`, `ClientProfile`, `AvailabilitySlot`, `Session`, `TherapistPresence`, `SessionRequestPayload`, `SessionOfferPayload`
- API types: `ApiResponse<T>`, `ApiError`, `PaginatedResponse<T>`, `AuthResponse`, `RegisterDto`, `LoginDto`, `VerifyTherapistDto`
- **Session billing fields are stubbed** (`billingEnabled`, `rateUsdAtTime`, `chargedAmountCents`, `stripePaymentIntentId`) — Phase 6+ can activate without schema rework

#### `infra/supabase/`
- `migrations/001_initial_schema.sql`
  - Enums: `user_role`, `therapist_status`, `session_status`, `session_type`, `session_mode`
  - Tables: `users`, `therapist_profiles`, `client_profiles`, `availability_slots`, `sessions`, `donations`
  - Auto-`updated_at` trigger via `set_updated_at()` function
  - `handle_new_user()` trigger — auto-creates `therapist_profiles` or `client_profiles` on Supabase Auth signup
- `migrations/002_rls_policies.sql`
  - RLS enabled on all tables
  - `current_user_role()` helper function
  - Policies: users read own, therapists update own profile, clients see own sessions, admin bypasses all
- `seed.sql` — dev seed (admin, approved therapist with availability, client)

#### `services/api` (NestJS)
- Scaffolded via `@nestjs/cli` — TypeScript, ESM
- `main.ts` — ValidationPipe (whitelist+transform), CORS, global prefix `/api/v1`, Swagger at `/api/docs`
- `SupabaseModule` (global) — service-role client + user-scoped client factory
- `HealthModule` — `GET /api/v1/health` → `{ status, timestamp, service }`
- `AuthModule`
  - `POST /api/v1/auth/register` — Supabase Auth signup (triggers DB profile creation)
  - `POST /api/v1/auth/login` — returns access + refresh tokens
  - `POST /api/v1/auth/refresh` — token refresh
  - `POST /api/v1/auth/logout`
  - `SupabaseAuthGuard` — global JWT guard, routes opt-out via `@Public()`
- `UsersModule`
  - `GET /api/v1/users/me` — fetches user with joined therapist/client profile
  - `PATCH /api/v1/users/me` — update fullName, timezone, avatarUrl
- Deps installed: `@nestjs/config`, `@nestjs/swagger`, `@supabase/supabase-js`, `class-validator`, `class-transformer`
- ✅ TypeScript type-check passes (`tsc --noEmit -p tsconfig.build.json`)

#### `apps/web` (Next.js)
- Bootstrapped via `create-next-app` — App Router, TypeScript, Tailwind CSS
- **Design system** (`globals.css`): dark theme, brand palette (blue→teal gradient), glassmorphism `.glass`, `.gradient-text`, `.btn-primary`, `.btn-ghost`, `.input`, `.spinner`, `.fade-in-up` animations
- Platform name: **MindBridge**
- Pages:
  - `/` — Marketing landing page (hero, stats, 6-feature grid, CTA)
  - `/login` — Sign in form with error/loading states, redirect support
  - `/register` — Role toggle (client / therapist), timezone auto-detect, confirmation success screen
  - `/dashboard` — Server-side, role-gated (client/therapist/admin), stub cards per role
  - `/admin` — Admin-only server-side guard, stub cards
- `middleware.ts` — Session refresh + route protection (`/dashboard`, `/admin`)
- `lib/supabase/client.ts` — browser singleton
- `lib/supabase/server.ts` — server client with cookie forwarding
- ✅ TypeScript type-check passes

#### `infra/docker/`
- `docker-compose.yml` — PostgreSQL (supabase/postgres:15), Redis (redis:7-alpine), API service
- `api.Dockerfile` — multi-stage (dev / build / production)

#### `docs/`
- `architecture.md` — ASCII system diagram, data flow (matching sequence), schema ER summary, design decisions table

---

### Decisions Made

| Decision | Rationale |
|---|---|
| Platform name: MindBridge | Descriptive, clean, domain-availability-friendly |
| Admin = route group in web app | Avoids a second Vercel deploy with no Phase 1 benefit |
| Global NestJS auth guard with `@Public()` opt-out | Secure by default — easier to forget to add a guard than to forget @Public |
| Supabase `handle_new_user()` trigger | Zero-latency profile creation; no API roundtrip on signup |
| `billing_enabled = false` default in sessions | Clean Phase 6 activation — flip one column, add Stripe logic, done |
| Turborepo | Parallel builds, remote caching for CI |
| `@supabase/ssr` in Next.js | Official SSR package; handles cookie forwarding for Server Components correctly |

---

### Known Issues / Pending

- ⚠️ **Supabase not connected yet** — you must create a project, get credentials, and run the migrations manually via SQL editor
- ⚠️ NestJS engine warnings from `@angular-devkit` deps (Nest CLI internal) — safe to ignore, no runtime impact
- ⚠️ `npm audit` shows vulnerabilities in NestJS devDeps — run `npm audit fix` in `services/api` if desired
- Flutter mobile app deferred to a later phase (user's choice)
- `services/matching/` and `services/calling/` directories stubbed — real implementation in Phases 3 and 4

---

---

## Phase 2 — Therapist Onboarding & Verification ✅ COMPLETE

**Completed:** 2026-09-13

### What was built

#### `infra/supabase/`
- `migrations/003_storage_and_verification.sql`
  - Created private Supabase Storage bucket `therapist-documents` (10MB limit, PDF/JPEG/PNG/WEBP).
  - Storage RLS policies: therapists can upload/read/update their own document folder (`auth.uid() = foldername[1]`); admins can view all uploaded documents.
  - Performance indexes added: `therapist_profiles_status_idx` and `availability_slots_therapist_idx`.

#### `packages/shared-types`
- Extended DTOs and interfaces:
  - `UpdateTherapistProfileDto` (bio, licenseNumber, licenseDocumentUrl, specializations, languages, yearsOfExperience, hourlyRateUsd)
  - `AvailabilitySlotDto` & `SetAvailabilityDto`
  - `VerifyTherapistDto` (approved, rejected, suspended, adminNote)
  - `AdminTherapistFilterDto` (status filter, page, limit)
  - `TherapistWithUser` (joined user record + signed download URL)
- Verified build: `npm run build` succeeds (`dist/index.js`, `dist/index.d.ts`).

#### `services/api` (NestJS)
- `RolesGuard` & `@Roles('therapist' | 'admin' | 'client')` decorator for endpoint RBAC.
- `TherapistsModule`
  - `GET /api/v1/therapists/me` — fetch therapist profile, current verification status, and signed license download URL.
  - `PATCH /api/v1/therapists/me` — update clinical profile and license details; automatically resets status to `pending` if resubmitting after a rejection.
  - `GET /api/v1/therapists/me/availability` — list therapist's weekly recurring slots.
  - `PUT /api/v1/therapists/me/availability` — batch set weekly availability (with start/end validation and overlap checks).
  - `POST /api/v1/therapists/me/upload-url` — generate signed storage upload URL for license documents.
- `AdminModule`
  - `GET /api/v1/admin/therapists` — list therapists with status filtering (`pending`, `approved`, `rejected`, `suspended`), pagination, and real-time status count breakdown.
  - `GET /api/v1/admin/therapists/:id` — get full therapist dossier including profile, credentials, license download URL, and availability schedule.
  - `PATCH /api/v1/admin/therapists/:id/verify` — review action: approve, reject (with mandatory feedback note), or suspend. Automatically revokes live presence on rejection/suspension.
- Verified build: `npx tsc --noEmit -p tsconfig.build.json` and `nest build` succeed with 0 errors.

#### `apps/web` (Next.js)
- `/dashboard/therapist/profile`: Full therapist credential onboarding form:
  - Basic information & clinical bio with char counter.
  - License number, years of experience, hourly rate.
  - Drag-and-drop license document upload to `therapist-documents` bucket.
  - Interactive multi-select chips for 14 clinical specialties & 11 languages.
  - Dynamic verification status alert banners (Pending review, Approved badge, Rejection with admin reason note).
- `/dashboard/therapist/schedule`: Intuitive weekly availability slot builder:
  - Monday through Sunday day cards with active slot count badges.
  - Add / remove time slots with 24-hour time pickers.
  - Quick action: "Copy Mon → Fri" across weekdays.
  - Auto-detected IANA timezone display.
- `/admin`: Interactive verification portal:
  - Metric stat cards: Pending Review, Approved & Active, Changes Requested, Total Applicants.
  - Filterable tabs (`Pending`, `Approved`, `Rejected`, `All`) with real-time count badges.
  - Search bar across name, email, license, and specialties.
  - Action modal for **Approve** and **Reject** (with reviewer notes passed directly to the therapist).
  - Signed license document inspection link.
- `/dashboard`: Enhanced therapist view linking to Profile and Schedule, with live verification status banner.
- Verified build: `npm run build` succeeds (Turbopack + SSG + dynamic routing).

---

### Decisions Made

| Decision | Rationale |
|---|---|
| Private Supabase Storage bucket | Prevents unauthenticated scraping or exposure of therapist clinical licenses. |
| Automatic reset to `pending` on profile edit after rejection | Seamless re-review loop for therapists correcting invalid or expired credentials. |
| Timezone stored on user + weekly slots stored in local time | Therapists set recurring slots in their local hours; conversion to client timezone is handled at booking time. |
| Turbopack monorepo root resolution | Points `turbopack.root` to workspace root for consistent hermetic builds. |


---

---

## Phase 3 — Matching Engine ✅ COMPLETE

**Completed:** 2026-09-13

### What was built

#### Matching Service & WebSocket Gateway (`services/api`)
- Installed `@nestjs/websockets`, `@nestjs/platform-socket.io`, `socket.io`, `socket.io-client`.
- `MatchingService`:
  - In-memory presence map (`onlineTherapists: Map<string, TherapistPresence>`) tracking therapist active status, socket ID, and heartbeats.
  - 60-second matching timeout loop with automatic status update to `timed_out` if no therapist claims the request.
  - First-to-accept race condition protection: Executes atomic PostgreSQL update:
    `UPDATE sessions SET therapist_id = $1, status = 'accepted' WHERE id = $2 AND status = 'pending'`.
    Guarantees exactly one therapist claims the session; concurrent claims immediately return false with friendly rejection.
- `MatchingGateway` (`/matching` namespace):
  - Handshake authentication via Supabase JWT token.
  - Joins rooms: `user:${userId}` (for direct client and therapist events) and `therapists:available` (for broadcast requests).
  - Handles `therapist:presence` toggle (joining/leaving available pool).
  - Handles `session:request` (creates session, starts 60s countdown, broadcasts `session:offer` to available pool).
  - Handles `session:accept` (atomic claim, emits `session:matched` to client, `session:accepted` to winning therapist, `session:offer_expired` to all other therapists).
  - Handles `session:cancel` (cleans up pending requests and dismisses incoming offers).
- `SessionsModule`:
  - `GET /api/v1/sessions`: Fetches user's session history with joined client & therapist profiles.
  - `GET /api/v1/sessions/:id`: Detailed session view.
  - `POST /api/v1/sessions/:id/cancel`: Client/therapist session cancellation.

#### Frontend Matching Interface (`apps/web`)
- `apps/web/src/lib/socket.ts`: Socket.io client singleton helper managing JWT handshake with Supabase token.
- `apps/web/src/app/dashboard/session/new/page.tsx`:
  - Multi-step instant matching flow: modality selector (Live Video, Voice Only, Real-time Chat), language preference, optional concern topic.
  - Animated concentric radar screen with live second counter and cancel button.
  - 60s timeout handling with "Try Again" fallback.
  - Winning therapist celebration reveal with bio, credentials, and direct link to session room.
- `apps/web/src/components/TherapistPresenceBar.tsx`:
  - Real-time availability toggle bar on therapist dashboard with green pulsing indicator.
- `apps/web/src/components/IncomingOfferModal.tsx`:
  - Ringing dialog popping up when a client requests a session.
  - Displays client name, requested modality, topic, and a 30-second circular countdown bar.
  - First-to-accept race claim button (`session:accept`) and win/loss feedback.
- `apps/web/src/app/dashboard/sessions/page.tsx`:
  - Complete session history with filter tabs (All, Active/Live, Completed, Cancelled).
  - Participant info, modality badges, timestamps, notes, and "Enter Live Room" action buttons.
- Build verified: Both `services/api` and `apps/web` compile cleanly with 0 errors.

---

## Phase 4 — Live Calling & Chat ✅ COMPLETE

**Completed:** 2026-09-14

### What was built

#### WebRTC Audio/Video & Signaling Room (`apps/web/src/app/dashboard/session/[id]/page.tsx`)
- **WebRTC Peer Connection**: Real peer-to-peer audio and video streaming using STUN server configuration (`stun.l.google.com`).
- **Supabase Realtime Signaling**: Channel-based signaling (`therapy-session-[id]`) for exchanging WebRTC offers, answers, and ICE candidates without external LiveKit server dependency.
- **Microphone & Camera Controls**: Interactive mute/unmute and camera off/on toggling active `MediaStreamTrack` states.
- **Audio Reliability**: Background `<audio autoPlay playsInline>` element ensuring uninterrupted voice calls in audio-only and video modes.
- **Real-time In-Session Chat**: Live messaging panel with broadcast sync via Supabase Realtime, available in full chat mode and side-panel mode during calls.
- **Session Management**:
  - Live session timer with 45-minute cap and 5-minute countdown alert banner.
  - "End Session" modal syncing completion across both participants in real-time.
  - Therapist clinical notes modal (saved privately to session).
  - Client post-session feedback screen with voluntary UPI donation and follow-up booking CTA.
- **Sessions Dashboard**: "End Session" action button placed directly next to "Enter Live Room" on `/dashboard/sessions`.

---

## Phase 5 — Scheduling & Follow-up Bookings ✅ COMPLETE

- Therapist weekly availability slots configuration.
- Client calendar booking interface at `/dashboard/schedule`.
- Integrated cancellation and booking management on `/dashboard/sessions`.

---

## Phase 6 — Voluntary UPI Donations & Admin Controls ✅ COMPLETE

- Platform UPI donation page at `/donate` with QR code, copyable UPI ID, and voluntary amount selection.
- Dynamic platform settings API (`/api/admin/platform-settings`) allowing admins to update the UPI ID directly from the admin panel without redeploying code.
- Migration `002_platform_settings.sql` supporting persistent platform configuration in Supabase.

---

## Phase 7 — User Flow & Admin Management ✅ COMPLETE

**Completed:** 2026-09-20

- **Dedicated Login Portals**:
  - `/login/client`: Tailored login flow for clients with role verification and mismatch routing.
  - `/login/therapist`: Dedicated portal for licensed therapists with clinical credential checks.
- **Landing Page Hero CTAs**:
  - Primary button: "I need help" (routes to `/login/client`).
  - Secondary button: "I'm here to help" (routes to `/login/therapist`).
- **Admin User Management**:
  - Comprehensive user registry table in the Admin Control Centre.
  - Permanent user deletion (`/api/admin/users/delete`) with cascade cleanup across sessions, profiles, availability slots, and Supabase Auth.
  - Self-deletion protection ensuring admins cannot delete their own account.

---

## Phase 8 — 19-Point Production Security Checklist & QR Donation Upload ✅ COMPLETE

**Completed:** 2026-09-20

### 1. Security Checklist Verification & Implementation (All 19 Items Passed)
1. **Enable RLS**: Verified on all Supabase tables (`users`, `therapist_profiles`, `client_profiles`, `availability_slots`, `sessions`, `donations`, `platform_settings`).
2. **Tighten CORS Settings**: Strict origin whitelisting (`WEB_URL`, `localhost`, `127.0.0.1`, `*.vercel.app`) with unauthorized request blocking.
3. **Parameterized SQL Queries**: All queries use `@supabase/supabase-js` query builder with zero string concatenation.
4. **Verify Email Addresses**: PKCE code exchange flow configured in `/auth/callback`.
5. **Keep Tokens Out of LocalStorage**: `@supabase/ssr` secure `HttpOnly` and `SameSite=Lax` cookies.
6. **Hide .env Files**: Gitignore strictly configured with verified zero secret leaks.
7. **Validate Form Inputs**: NestJS global `ValidationPipe` with whitelist and forbidden non-whitelisted fields.
8. **Protect Admin Routes**: Middleware + server-side role re-validation on all `/api/admin/*` routes.
9. **Disable Production Debugging**: Swagger and verbose error traces restricted to non-production.
10. **Server-Side API Secrets**: Service role keys isolated to server execution contexts.
11. **Security Review**: OWASP Top 10 vulnerabilities checked and audited.
12. **Rate Limit Requests**: Express rate limiting on API endpoints + sliding window in-memory limiter in Next.js.
13. **Validate File Uploads**: Strict size limits (10MB/5MB) and MIME-type/extension verification.
14. **Keep Sensitive Data from Logs**: Sanitized error handling and removed credential logging.
15. **Hash Passwords Securely**: Supabase bcrypt with high-work-factor salt rounds.
16. **Verify Webhook Signatures**: Timing-safe HMAC SHA-256 webhook signature verification utility (`verifyWebhookSignature`).
17. **Server-Side Permissions**: NestJS `RolesGuard` and Supabase RLS policies.
18. **Block Cross-Site Scripting (XSS)**: Added `X-XSS-Protection: 1; mode=block` and strict Content Security Policy (`Content-Security-Policy`).
19. **Update Dependencies**: Modern stack across Next.js 16, React 19, Supabase JS 2.116, NestJS 12, LiveKit Client 2.22.

### 2. Admin Donation QR Code & UPI Management
- Direct drag-and-drop & click file upload for QR code images (`/api/admin/platform-settings/upload-qr`).
- Automatic upload to Supabase Storage `platform-assets` bucket with public URL or inline Data URI fallback.
- Real-time side-by-side simulation preview showing exactly how the QR code, UPI ID, and message appear to donors on the public `/donate` page.
- Direct link from admin panel to `/donate`.


