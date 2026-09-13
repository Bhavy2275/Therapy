import type {
  UserRole,
  TherapistStatus,
  SessionStatus,
  SessionType,
  SessionMode,
} from '@therapy/config';

// ─── Re-export config types ───────────────────────────────────────────────────
export type { UserRole, TherapistStatus, SessionStatus, SessionType, SessionMode };

// ─── User ─────────────────────────────────────────────────────────────────────

export interface User {
  id: string;              // Supabase auth.users UUID
  email: string;
  role: UserRole;
  fullName: string;
  avatarUrl?: string;
  timezone: string;        // IANA timezone string e.g. 'Asia/Kolkata'
  createdAt: string;       // ISO 8601
  updatedAt: string;
}

// ─── Therapist ────────────────────────────────────────────────────────────────

export interface TherapistProfile {
  userId: string;
  bio: string;
  licenseNumber: string;
  licenseDocumentUrl?: string;   // Supabase Storage URL
  specializations: string[];     // e.g. ['anxiety', 'depression', 'couples']
  languages: string[];           // e.g. ['English', 'Hindi']
  yearsOfExperience: number;
  status: TherapistStatus;
  adminNote?: string;            // Rejection/approval note from admin
  isAvailableNow: boolean;       // Live presence flag (managed by matching service)
  /** Hourly rate stored for future billing; null = not set yet */
  hourlyRateUsd: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface AvailabilitySlot {
  id: string;
  therapistId: string;
  dayOfWeek: 0 | 1 | 2 | 3 | 4 | 5 | 6; // 0=Sun … 6=Sat
  startTime: string; // 'HH:MM' in therapist's local timezone
  endTime: string;
}

// ─── Client ───────────────────────────────────────────────────────────────────

export interface ClientProfile {
  userId: string;
  preferredLanguages: string[];
  preferredTherapistGender?: 'male' | 'female' | 'no_preference';
  createdAt: string;
  updatedAt: string;
}

// ─── Session ──────────────────────────────────────────────────────────────────

export interface Session {
  id: string;
  clientId: string;
  therapistId: string | null;        // null until matched
  type: SessionType;
  mode: SessionMode;
  status: SessionStatus;
  scheduledAt: string | null;        // null for instant sessions
  startedAt: string | null;
  endedAt: string | null;
  durationMinutes: number | null;    // computed on session end
  livekitRoomName: string | null;    // set when session accepted
  notes: string | null;              // therapist post-session notes

  // ── Future billing fields (not active yet) ─────────────────────────────────
  billingEnabled: boolean;           // false = free / donation model
  /** Snapshot of therapist's rate at session time — for future billing */
  rateUsdAtTime: number | null;
  /** Charged amount in USD cents — populated by Phase 6+ billing */
  chargedAmountCents: number | null;
  stripePaymentIntentId: string | null;

  createdAt: string;
  updatedAt: string;
}

// ─── Matching / Presence ──────────────────────────────────────────────────────

/** Shape stored for each online therapist */
export interface TherapistPresence {
  therapistId: string;
  userId: string;
  socketId: string;
  isAvailable: boolean;    // false when in a session or toggled off
  lastSeenAt: string;      // ISO 8601
}

/** Client payload to request an instant session */
export interface ClientSessionRequestPayload {
  type: SessionType;
  languagePreference?: string;
  topic?: string;
}

/** Broadcast payload sent to available therapists */
export interface TherapistOfferPayload {
  sessionId: string;
  clientId: string;
  clientName: string;
  type: SessionType;
  languagePreference?: string;
  topic?: string;
  expiresAt: string;       // ISO 8601 — 30s deadline
}

/** Payload sent to client and accepted therapist upon match */
export interface SessionMatchedPayload {
  sessionId: string;
  therapistId: string;
  therapistName: string;
  therapistAvatarUrl?: string;
  therapistBio?: string;
  specializations?: string[];
  livekitRoomName: string;
  type: SessionType;
}

export interface TherapistPresencePayload {
  isAvailable: boolean;
}

// ─── API Response Shapes ──────────────────────────────────────────────────────

export interface ApiResponse<T> {
  data: T;
  message?: string;
}

export interface ApiError {
  statusCode: number;
  message: string;
  error?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

// ─── Auth ────────────────────────────────────────────────────────────────────

export interface RegisterDto {
  email: string;
  password: string;
  fullName: string;
  role: Extract<UserRole, 'client' | 'therapist'>; // admin created manually
  timezone: string;
}

export interface LoginDto {
  email: string;
  password: string;
}

export interface AuthResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
}

// ─── Therapist Profile & Onboarding ──────────────────────────────────────────

export interface UpdateTherapistProfileDto {
  bio?: string;
  licenseNumber?: string;
  licenseDocumentUrl?: string;
  specializations?: string[];
  languages?: string[];
  yearsOfExperience?: number;
  hourlyRateUsd?: number | null;
}

export interface AvailabilitySlotDto {
  dayOfWeek: 0 | 1 | 2 | 3 | 4 | 5 | 6; // 0=Sun … 6=Sat
  startTime: string; // 'HH:MM'
  endTime: string;   // 'HH:MM'
}

export interface SetAvailabilityDto {
  slots: AvailabilitySlotDto[];
}

export interface TherapistWithUser extends TherapistProfile {
  user: {
    id: string;
    email: string;
    fullName: string;
    avatarUrl?: string;
    timezone: string;
  };
  licenseDocumentDownloadUrl?: string | null;
}

// ─── Admin ────────────────────────────────────────────────────────────────────

export interface VerifyTherapistDto {
  status: Extract<TherapistStatus, 'approved' | 'rejected' | 'suspended'>;
  adminNote?: string;
}

export interface AdminTherapistFilterDto {
  status?: TherapistStatus;
  page?: number;
  limit?: number;
}

