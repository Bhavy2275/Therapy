# Therapy Platform — Architecture

## Overview

This document describes the architecture of the Therapy Platform — a marketplace connecting clients with verified therapists for live voice, video, and chat sessions.

## System Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                           Clients                                 │
│     ┌─────────────────┐          ┌───────────────────────┐       │
│     │  Next.js Web    │          │   Flutter Mobile App  │       │
│     │  (Vercel)       │          │   (iOS + Android)     │       │
│     └────────┬────────┘          └──────────┬────────────┘       │
└──────────────┼───────────────────────────────┼────────────────────┘
               │  HTTPS / WSS                  │
               ▼                               ▼
┌──────────────────────────────────────────────────────────────────┐
│                         services/api                              │
│              NestJS (Railway)  — port 3001                        │
│   ┌──────────┐  ┌──────────┐  ┌───────────┐  ┌──────────────┐   │
│   │  Auth    │  │  Users   │  │ Sessions  │  │  Donations   │   │
│   │  Module  │  │  Module  │  │  Module   │  │  Module(P6)  │   │
│   └──────────┘  └──────────┘  └───────────┘  └──────────────┘   │
└───────────────────────────────────────────────────────────────────
               │                    │                │
               ▼                    ▼                ▼
    ┌──────────────────┐  ┌─────────────────┐  ┌──────────┐
    │  Supabase Auth   │  │  Supabase       │  │  Stripe  │
    │  + PostgreSQL    │  │  Storage        │  │  (P6)    │
    └──────────────────┘  └─────────────────┘  └──────────┘
               │
               ▼
┌──────────────────────────────────────────────────────────────────┐
│                    services/matching (Phase 3)                     │
│             Socket.io service — presence + matching               │
│                    ┌───────────────┐                              │
│                    │ Upstash Redis │                              │
│                    │ (presence)    │                              │
│                    └───────────────┘                              │
└──────────────────────────────────────────────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────────────────────────────┐
│                    services/calling (Phase 4)                      │
│             LiveKit — voice/video room management                 │
│   Therapist ◄──── LiveKit Room ────► Client                       │
└──────────────────────────────────────────────────────────────────┘
```

## Data Flow — Instant Session Matching (Phase 3)

```
Client               API                  Matching Service          Therapist(s)
  │                   │                        │                        │
  │── Request Session ──►                      │                        │
  │                   │── Create session(DB) ──►                        │
  │                   │                        │── Broadcast offer ─────►
  │                   │                        │                        │ (first to accept)
  │                   │                        │◄── Accept ─────────────│
  │                   │◄── Notify match ───────│                        │
  │◄── Session ready ─│                        │── Notify others (taken)►
  │                   │── Create LiveKit room ──►                       │
  │◄── LK Token ──────│                        │───── LK Token ─────────►
  │                   │                        │                        │
  │◄══════════════ LiveKit Room (voice/video) ═══════════════════════════►
```

## Database Schema (simplified)

```
auth.users (Supabase managed)
    │
    ├── public.users (role, full_name, timezone)
    │       ├── therapist_profiles (bio, license, specializations, status)
    │       │       └── availability_slots (recurring weekly schedule)
    │       └── client_profiles (preferences)
    │
    └── sessions (client_id, therapist_id, type, status, billing_fields)
            └── donations (optional, platform-wide, not session-linked)
```

## Key Design Decisions

| Decision | Choice | Reason |
|---|---|---|
| Monorepo tooling | Turborepo | Parallel builds, caching, simpler than Nx |
| Auth | Supabase Auth | Free tier, handles JWTs, magic links, OAuth |
| Auto-profile creation | Postgres trigger | Zero latency, no API roundtrip on signup |
| Session billing fields | Stubbed in schema | Future billing without schema migration |
| Donations vs. billing | Fully separate table | Billing is session-scoped; donations are platform-wide |
| Admin | Route group in web app | Avoids separate Vercel deploy with no Phase 1 benefit |
| RLS | Enabled on all tables | Defense-in-depth; API service role can bypass |
