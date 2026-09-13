/**
 * App-wide constants shared across all services and apps.
 */

export const USER_ROLES = {
  CLIENT: 'client',
  THERAPIST: 'therapist',
  ADMIN: 'admin',
} as const;

export type UserRole = (typeof USER_ROLES)[keyof typeof USER_ROLES];

export const THERAPIST_STATUS = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  SUSPENDED: 'suspended',
} as const;

export type TherapistStatus =
  (typeof THERAPIST_STATUS)[keyof typeof THERAPIST_STATUS];

export const SESSION_STATUS = {
  PENDING: 'pending',         // Client requested, awaiting therapist accept
  ACCEPTED: 'accepted',       // Therapist accepted, not yet started
  IN_PROGRESS: 'in_progress', // Active session
  COMPLETED: 'completed',     // Ended normally
  CANCELLED: 'cancelled',     // Cancelled before starting
  TIMED_OUT: 'timed_out',     // No therapist accepted in time
  NO_SHOW: 'no_show',         // Scheduled session not joined
} as const;

export type SessionStatus =
  (typeof SESSION_STATUS)[keyof typeof SESSION_STATUS];

export const SESSION_TYPE = {
  VOICE: 'voice',
  VIDEO: 'video',
  CHAT: 'chat',
} as const;

export type SessionType = (typeof SESSION_TYPE)[keyof typeof SESSION_TYPE];

export const SESSION_MODE = {
  INSTANT: 'instant',       // On-demand matching
  SCHEDULED: 'scheduled',   // Booked in advance
} as const;

export type SessionMode = (typeof SESSION_MODE)[keyof typeof SESSION_MODE];

/** How long (ms) the system waits for a therapist to accept before timing out */
export const MATCHING_TIMEOUT_MS = 60_000; // 60 seconds

/** Default LiveKit room config */
export const LIVEKIT_ROOM_CONFIG = {
  maxParticipants: 2, // client + therapist only
  emptyTimeout: 300,  // destroy room after 5 min empty
} as const;
