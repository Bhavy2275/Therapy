# Therapy Platform

A therapy marketplace connecting clients with verified therapists via live voice, video, and chat sessions.

## Architecture

| Layer | Technology |
|---|---|
| Web Frontend | Next.js (App Router) |
| Mobile | Flutter |
| Backend API | NestJS |
| Database | PostgreSQL via Supabase |
| Cache / Presence | Redis via Upstash |
| Real-time Matching | Socket.io |
| Voice / Video | LiveKit |
| Auth | Supabase Auth |
| File Storage | Supabase Storage |
| Donations | Stripe |

## Monorepo Structure

```
therapy-platform/
├── apps/
│   ├── web/          # Next.js — client + therapist web app
│   ├── mobile/       # Flutter — client + therapist mobile app
│   └── admin/        # Admin dashboard (embedded in web as /admin route)
├── services/
│   ├── api/          # NestJS core backend
│   ├── matching/     # Socket.io matching service (Phase 3)
│   └── calling/      # LiveKit room management (Phase 4)
├── packages/
│   ├── shared-types/ # Shared TypeScript types
│   └── config/       # Shared env schema + constants
└── infra/
    ├── docker/        # Docker Compose for local dev
    └── supabase/      # Migrations, RLS, seed data
```

## Quick Start

```bash
# 1. Clone and install
git clone <repo>
cd therapy-platform
npm install

# 2. Set up env vars
cp .env.example .env
# Fill in your Supabase URL, anon key, etc.

# 3. Apply database migrations
# Paste contents of infra/supabase/migrations/*.sql into Supabase SQL editor

# 4. Start local dev
npm run dev
# → API: http://localhost:3001
# → Web: http://localhost:3000
```

## Build Phases

- **Phase 1** ✅ Foundation (this phase)
- **Phase 2** Therapist Onboarding & Verification
- **Phase 3** Matching Engine
- **Phase 4** Calling & Chat
- **Phase 5** Scheduling
- **Phase 6** Donations
- **Phase 7** Polish & Launch Readiness

See `PROGRESS.md` for current build status.
