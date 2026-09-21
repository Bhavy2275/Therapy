'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import type { SessionType, SessionStatus } from '@therapy/shared-types';
import {
  IconBolt,
  IconClock,
  IconCalendar,
  IconVideo,
  IconMic,
  IconMessageSquare,
  IconArrowLeft,
  IconX,
} from '@/components/Icons';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

interface SessionItem {
  id: string;
  client_id: string;
  therapist_id: string | null;
  type: SessionType;
  mode: 'instant' | 'scheduled';
  status: SessionStatus;
  scheduled_at: string | null;
  started_at: string | null;
  ended_at: string | null;
  duration_minutes: number | null;
  livekit_room_name: string | null;
  notes: string | null;
  created_at: string;
  client?: {
    id: string;
    full_name: string;
    email: string;
    avatar_url?: string;
  };
  therapist?: {
    id: string;
    full_name: string;
    email: string;
    avatar_url?: string;
  };
}

export default function SessionsPage() {
  const [loading, setLoading] = useState(true);
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [filter, setFilter] = useState<'all' | 'active' | 'completed' | 'cancelled'>('all');
  const [userRole, setUserRole] = useState<'client' | 'therapist' | 'admin'>('client');
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [endingId, setEndingId] = useState<string | null>(null);
  const [cancelMessage, setCancelMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const loadSessions = useCallback(async () => {
    setLoading(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }
      setCurrentUserId(user.id);

      const { data: userRow } = await supabase
        .from('users')
        .select('role')
        .eq('id', user.id)
        .single();

      const role = userRow?.role ?? 'client';
      setUserRole(role);

      // Query sessions where user is either client or therapist
      let query = supabase
        .from('sessions')
        .select(`
          *,
          client:client_id(id, full_name, email, avatar_url),
          therapist:therapist_id(id, full_name, email, avatar_url)
        `)
        .order('created_at', { ascending: false });

      if (role === 'therapist') {
        query = query.eq('therapist_id', user.id);
      } else {
        query = query.eq('client_id', user.id);
      }

      const { data, error } = await query;
      if (!error && data) {
        setSessions(data as unknown as SessionItem[]);
      }
    } catch (err) {
      console.error('Error fetching sessions:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  const handleCancelBooking = async (sessionId: string) => {
    if (!confirm('Are you sure you want to cancel this scheduled consultation?')) {
      return;
    }

    setCancellingId(sessionId);
    setCancelMessage(null);
    try {
      const supabase = createClient();
      const { data: { session: authSession } } = await supabase.auth.getSession();
      const token = authSession?.access_token;

      const res = await fetch(`${API_BASE}/api/v1/scheduling/bookings/${sessionId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ message: 'Failed to cancel booking' }));
        throw new Error(errorData.message || 'Failed to cancel booking');
      }

      setCancelMessage({ type: 'success', text: 'Booking cancelled successfully.' });
      // Update local state to reflect cancellation immediately
      setSessions((prev) =>
        prev.map((s) => (s.id === sessionId ? { ...s, status: 'cancelled' as SessionStatus } : s))
      );
    } catch (err: any) {
      setCancelMessage({ type: 'error', text: err?.message || 'Error cancelling booking' });
    } finally {
      setCancellingId(null);
    }
  };

  const handleEndSession = async (sessionId: string) => {
    if (!confirm('End this live session? Both you and the other participant will be disconnected.')) return;

    setEndingId(sessionId);
    try {
      const supabase = createClient();
      const { data: { session: authSession } } = await supabase.auth.getSession();
      const token = authSession?.access_token;

      const res = await fetch(`/api/sessions/${sessionId}/end`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token || ''}` },
      });

      if (!res.ok) throw new Error('Failed to end session');

      setCancelMessage({ type: 'success', text: 'Session ended successfully.' });
      setSessions((prev) =>
        prev.map((s) => (s.id === sessionId ? { ...s, status: 'completed' as SessionStatus } : s))
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error ending session';
      setCancelMessage({ type: 'error', text: msg });
    } finally {
      setEndingId(null);
    }
  };

  const filteredSessions = sessions.filter((s) => {
    if (filter === 'active') {
      return s.status === 'accepted' || s.status === 'in_progress' || s.status === 'pending';
    }
    if (filter === 'completed') {
      return s.status === 'completed';
    }
    if (filter === 'cancelled') {
      return s.status === 'cancelled' || s.status === 'timed_out' || s.status === 'no_show';
    }
    return true;
  });

  return (
    <div style={{ minHeight: '100vh', background: 'hsl(var(--secondary))', color: 'hsl(var(--foreground))' }}>
      {/* Nav */}
      <nav
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 50,
          borderBottom: '1px solid hsl(var(--border))',
          background: 'hsl(var(--background) / 0.92)',
          backdropFilter: 'blur(16px)',
        }}
      >
        <div
          style={{
            maxWidth: 1100,
            margin: '0 auto',
            padding: '0 1.5rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            height: '4rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <Link
              href="/dashboard"
              className="btn-ghost"
              style={{
                padding: '0.4rem 0.85rem',
                fontSize: '0.85rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                color: '#64748b',
              }}
            >
              <IconArrowLeft size={16} />
              <span>Dashboard</span>
            </Link>
            <span style={{ fontSize: '1.15rem', fontWeight: 700, color: '#1e293b' }}>
              My <span style={{ color: '#3b82f6' }}>Sessions</span>
            </span>
          </div>

          {userRole === 'client' && (
            <Link
              href="/dashboard/session/new"
              className="btn-primary"
              style={{
                padding: '0.45rem 1.15rem',
                fontSize: '0.85rem',
                fontWeight: 600,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                background: '#3b82f6',
                color: '#ffffff',
                borderRadius: '0.5rem',
              }}
            >
              <IconBolt size={15} />
              <span>Instant Session</span>
            </Link>
          )}
        </div>
      </nav>

      <main style={{ maxWidth: 1100, margin: '0 auto', padding: '2.5rem 1.5rem' }}>
        {/* Banner notification if cancellation attempted */}
        {cancelMessage && (
          <div
            style={{
              padding: '0.85rem 1.25rem',
              borderRadius: '0.75rem',
              marginBottom: '1.5rem',
              fontSize: '0.875rem',
              fontWeight: 500,
              background: cancelMessage.type === 'success' ? '#ecfdf5' : '#fef2f2',
              border: `1px solid ${cancelMessage.type === 'success' ? '#a7f3d0' : '#fecaca'}`,
              color: cancelMessage.type === 'success' ? '#065f46' : '#991b1b',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <span>{cancelMessage.text}</span>
            <button
              type="button"
              onClick={() => setCancelMessage(null)}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'inherit',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <IconX size={16} />
            </button>
          </div>
        )}

        {/* Header & Tabs */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '1rem',
            marginBottom: '2rem',
          }}
        >
          <div>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 700, marginBottom: '0.35rem', color: '#1e293b' }}>
              {userRole === 'therapist' ? 'Counselling Session History' : 'Rescue/ Prevention History'}
            </h1>
            <p style={{ color: '#64748b', fontSize: '0.9rem' }}>
              {userRole === 'therapist'
                ? 'Track your upcoming consultations, completed counselling sessions, and notes.'
                : 'Track your support history, consultations, and help provided.'}
            </p>
          </div>

          {/* Filter Pills */}
          <div
            style={{
              display: 'flex',
              background: '#f1f5f9',
              border: '1px solid #e2e8f0',
              borderRadius: '0.75rem',
              padding: '0.25rem',
              gap: '0.25rem',
            }}
          >
            {(['all', 'active', 'completed', 'cancelled'] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setFilter(tab)}
                style={{
                  padding: '0.4rem 0.9rem',
                  fontSize: '0.825rem',
                  fontWeight: 600,
                  borderRadius: '0.5rem',
                  border: 'none',
                  cursor: 'pointer',
                  background: filter === tab ? '#3b82f6' : 'transparent',
                  color: filter === tab ? '#ffffff' : '#64748b',
                  transition: 'all 0.15s ease',
                  textTransform: 'capitalize',
                }}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        {/* Loading State */}
        {loading && (
          <div
            style={{
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '1rem',
              padding: '4rem 2rem',
              textAlign: 'center',
              color: '#64748b',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '0.75rem' }}>
              <IconClock size={32} color="#3b82f6" />
            </div>
            <p>Loading your sessions...</p>
          </div>
        )}

        {/* Empty State */}
        {!loading && filteredSessions.length === 0 && (
          <div
            style={{
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '1.25rem',
              padding: '4rem 2rem',
              textAlign: 'center',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1rem' }}>
              <IconCalendar size={48} color="#64748b" />
            </div>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: '0.5rem', color: '#1e293b' }}>
              No sessions found
            </h2>
            <p
              style={{
                color: '#64748b',
                fontSize: '0.9rem',
                maxWidth: 420,
                margin: '0 auto 1.75rem',
                lineHeight: 1.5,
              }}
            >
              {filter === 'all'
                ? userRole === 'client'
                  ? 'You have not requested any help sessions yet. Connect with a verified helper or counsellor whenever you need support.'
                  : 'You have no recorded sessions yet. Go available on your dashboard to accept incoming requests.'
                : `No sessions matched the "${filter}" filter.`}
            </p>

            {userRole === 'client' && (
              <Link
                href="/dashboard/session/new"
                className="btn-primary"
                style={{
                  padding: '0.75rem 2rem',
                  fontSize: '0.95rem',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  background: '#3b82f6',
                  color: '#ffffff',
                  borderRadius: '0.5rem',
                }}
              >
                <IconBolt size={18} />
                <span>Start Instant Session</span>
              </Link>
            )}
          </div>
        )}

        {/* Sessions List */}
        {!loading && filteredSessions.length > 0 && (
          <div style={{ display: 'grid', gap: '1.25rem' }}>
            {filteredSessions.map((session) => {
              const otherPerson =
                userRole === 'client' ? session.therapist : session.client;
              const otherRole = userRole === 'client' ? 'Therapist' : 'Client';
              const isLive =
                session.status === 'accepted' || session.status === 'in_progress';

              const modalityIcon =
                session.type === 'video' ? (
                  <IconVideo size={18} color="#3b82f6" />
                ) : session.type === 'voice' ? (
                  <IconMic size={18} color="#3b82f6" />
                ) : (
                  <IconMessageSquare size={18} color="#3b82f6" />
                );

              const canCancel =
                userRole === 'client' &&
                session.mode === 'scheduled' &&
                ['pending', 'accepted'].includes(session.status) &&
                session.scheduled_at &&
                new Date(session.scheduled_at).getTime() > Date.now() + 2 * 60 * 60 * 1000;

              return (
                <div
                  key={session.id}
                  style={{
                    background: '#ffffff',
                    borderRadius: '1.15rem',
                    padding: '1.5rem',
                    border: isLive ? '1px solid #10b981' : '1px solid #e2e8f0',
                    boxShadow: isLive
                      ? '0 4px 14px rgba(16, 185, 129, 0.08)'
                      : '0 2px 8px rgba(0, 0, 0, 0.03)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '1rem',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: '0.75rem',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                      <div
                        style={{
                          width: 48,
                          height: 48,
                          borderRadius: '50%',
                          background: '#eff6ff',
                          border: '1px solid #dbeafe',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                        }}
                      >
                        {modalityIcon}
                      </div>

                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                          <h2
                            style={{
                              fontSize: '1.1rem',
                              fontWeight: 700,
                              color: '#1e293b',
                              margin: 0,
                            }}
                          >
                            {otherPerson?.full_name || (session.therapist_id ? 'Therapist' : 'Matching in progress...')}
                          </h2>
                          <span
                            style={{
                              fontSize: '0.75rem',
                              color: '#64748b',
                              background: '#f1f5f9',
                              padding: '0.15rem 0.5rem',
                              borderRadius: '0.35rem',
                              fontWeight: 500,
                            }}
                          >
                            {otherRole}
                          </span>
                        </div>

                        {/* Scheduled time info (highlighted) */}
                        {session.mode === 'scheduled' && session.scheduled_at ? (
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.35rem',
                              fontSize: '0.85rem',
                              color: '#1e293b',
                              fontWeight: 600,
                              marginTop: '0.25rem',
                            }}
                          >
                            <IconCalendar size={14} color="#3b82f6" />
                            <span>
                              Scheduled for:{' '}
                              {new Date(session.scheduled_at).toLocaleString(undefined, {
                                dateStyle: 'medium',
                                timeStyle: 'short',
                              })}
                            </span>
                          </div>
                        ) : (
                          <p
                            style={{
                              margin: 0,
                              fontSize: '0.825rem',
                              color: '#64748b',
                              marginTop: '0.2rem',
                            }}
                          >
                            {new Date(session.created_at).toLocaleString(undefined, {
                              dateStyle: 'medium',
                              timeStyle: 'short',
                            })}{' '}
                            • <span style={{ textTransform: 'capitalize' }}>{session.mode}</span> Session
                          </p>
                        )}
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <StatusBadge status={session.status} />
                    </div>
                  </div>

                  {/* Notes / Clinical summary if any */}
                  {session.notes && (
                    <div
                      style={{
                        background: '#f8fafc',
                        border: '1px solid #e2e8f0',
                        borderRadius: '0.75rem',
                        padding: '0.85rem 1rem',
                        fontSize: '0.85rem',
                        color: '#334155',
                      }}
                    >
                      <strong
                        style={{
                          color: '#64748b',
                          fontSize: '0.75rem',
                          textTransform: 'uppercase',
                          display: 'block',
                          marginBottom: '0.25rem',
                          letterSpacing: '0.05em',
                        }}
                      >
                        Clinical Notes
                      </strong>
                      {session.notes}
                    </div>
                  )}

                  {/* Bottom Actions Bar */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: '0.75rem',
                      paddingTop: '0.75rem',
                      borderTop: '1px solid #f1f5f9',
                    }}
                  >
                    <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                      Session ID: <code style={{ color: '#1e293b' }}>{session.id.slice(0, 8)}...</code>
                      {session.duration_minutes ? ` • ${session.duration_minutes} mins` : ''}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                      {canCancel && (
                        <button
                          type="button"
                          disabled={cancellingId === session.id}
                          onClick={() => handleCancelBooking(session.id)}
                          style={{
                            padding: '0.45rem 0.9rem',
                            fontSize: '0.825rem',
                            fontWeight: 600,
                            borderRadius: '0.5rem',
                            border: '1px solid #fecaca',
                            background: '#fef2f2',
                            color: '#dc2626',
                            cursor: cancellingId === session.id ? 'not-allowed' : 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.35rem',
                            opacity: cancellingId === session.id ? 0.6 : 1,
                          }}
                        >
                          <IconX size={14} color="#dc2626" />
                          <span>{cancellingId === session.id ? 'Cancelling...' : 'Cancel Booking'}</span>
                        </button>
                      )}

                      {isLive && (
                        <>
                          <button
                            type="button"
                            disabled={endingId === session.id}
                            onClick={() => handleEndSession(session.id)}
                            style={{
                              padding: '0.45rem 0.9rem',
                              fontSize: '0.825rem',
                              fontWeight: 600,
                              borderRadius: '0.5rem',
                              border: '1px solid #fecaca',
                              background: '#fef2f2',
                              color: '#dc2626',
                              cursor: endingId === session.id ? 'not-allowed' : 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.35rem',
                              opacity: endingId === session.id ? 0.6 : 1,
                            }}
                          >
                            <IconX size={14} color="#dc2626" />
                            <span>{endingId === session.id ? 'Ending...' : 'End Session'}</span>
                          </button>
                          <Link
                            href={`/dashboard/session/${session.id}`}
                            style={{ padding: '0.45rem 1.25rem', fontSize: '0.85rem', fontWeight: 600, background: '#10b981', color: '#ffffff', borderRadius: '0.5rem', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
                          >
                            <span>Enter Live Room</span>
                            <span>→</span>
                          </Link>
                        </>
                      )}

                      {!isLive && session.status === 'completed' && (
                        <span
                          style={{
                            fontSize: '0.825rem',
                            color: '#64748b',
                            padding: '0.4rem 0.8rem',
                            background: '#f1f5f9',
                            borderRadius: '0.45rem',
                            fontWeight: 500,
                          }}
                        >
                          Completed
                        </span>
                      )}

                      {!isLive && session.status === 'cancelled' && (
                        <span
                          style={{
                            fontSize: '0.825rem',
                            color: '#dc2626',
                            padding: '0.4rem 0.8rem',
                            background: '#fef2f2',
                            borderRadius: '0.45rem',
                            fontWeight: 500,
                          }}
                        >
                          Cancelled
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}

function StatusBadge({ status }: { status: SessionStatus }) {
  const styles: Record<
    SessionStatus,
    { bg: string; color: string; border: string; label: string; pulse?: boolean }
  > = {
    pending: {
      bg: '#fef3c7',
      color: '#b45309',
      border: '#fde68a',
      label: 'Searching / Pending',
      pulse: true,
    },
    accepted: {
      bg: '#dcfce7',
      color: '#15803d',
      border: '#bbf7d0',
      label: 'Ready to Join',
      pulse: true,
    },
    in_progress: {
      bg: '#dbeafe',
      color: '#1d4ed8',
      border: '#bfdbfe',
      label: 'Live Now',
      pulse: true,
    },
    completed: {
      bg: '#f1f5f9',
      color: '#475569',
      border: '#e2e8f0',
      label: 'Completed',
    },
    cancelled: {
      bg: '#fee2e2',
      color: '#dc2626',
      border: '#fecaca',
      label: 'Cancelled',
    },
    timed_out: {
      bg: '#f1f5f9',
      color: '#64748b',
      border: '#e2e8f0',
      label: 'Timed Out',
    },
    no_show: {
      bg: '#fee2e2',
      color: '#dc2626',
      border: '#fecaca',
      label: 'No Show',
    },
  };

  const item = styles[status] || styles.completed;

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.35rem',
        background: item.bg,
        color: item.color,
        border: `1px solid ${item.border}`,
        borderRadius: '0.45rem',
        padding: '0.2rem 0.65rem',
        fontSize: '0.75rem',
        fontWeight: 600,
      }}
    >
      {item.pulse && (
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: item.color,
          }}
        />
      )}
      {item.label}
    </span>
  );
}
