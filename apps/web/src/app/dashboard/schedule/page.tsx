'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import {
  IconCalendar,
  IconCheck,
  IconAlertCircle,
  IconClipboard,
  IconVideo,
  IconMic,
  IconMessageSquare,
  IconSearch,
  IconGlobe,
  IconCloudOff,
} from '@/components/Icons';



// ─── Types ───────────────────────────────────────────────────────────────────

interface TherapistListing {
  therapistId: string;
  fullName: string;
  avatarUrl: string | null;
  timezone: string;
  bio: string;
  specializations: string[];
  languages: string[];
  yearsOfExperience: number;
  hourlyRateUsd: number | null;
}

interface AvailabilitySlot {
  id: string;
  dayOfWeek: number;   // 0=Sun … 6=Sat
  startTime: string;  // 'HH:MM:SS'
  endTime: string;
}

interface BookedSlot {
  scheduledAt: string;
}

type BookingStep = 'browse' | 'slots' | 'confirm' | 'success';
type SessionType = 'video' | 'voice' | 'chat';

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAY_FULL  = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getMondayOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();          // 0=Sun
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function fmt24to12(time: string): string {
  const [h, m] = time.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, '0')} ${ampm}`;
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function SchedulePage() {
  const router = useRouter();

  // Step control
  const [step, setStep] = useState<BookingStep>('browse');

  // Browse state
  const [therapists, setTherapists] = useState<TherapistListing[]>([]);
  const [loadingTherapists, setLoadingTherapists] = useState(true);
  const [search, setSearch] = useState('');
  const [filterLanguage, setFilterLanguage] = useState('');
  const [filterSpec, setFilterSpec] = useState('');

  // Selected therapist
  const [selected, setSelected] = useState<TherapistListing | null>(null);

  // Week + slot state
  const [weekStart, setWeekStart] = useState<Date>(getMondayOfWeek(new Date()));
  const [slots, setSlots] = useState<AvailabilitySlot[]>([]);
  const [bookedSlots, setBookedSlots] = useState<BookedSlot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);

  // Booking state
  const [pickedSlot, setPickedSlot] = useState<{ date: Date; startTime: string } | null>(null);
  const [sessionType, setSessionType] = useState<SessionType>('video');
  const [booking, setBooking] = useState(false);
  const [bookingError, setBookingError] = useState<string | null>(null);
  const [bookedSessionId, setBookedSessionId] = useState<string | null>(null);

  // ─── Fetch therapists ───────────────────────────────────────────────────────

  const fetchTherapists = useCallback(async () => {
    setLoadingTherapists(true);
    const params = new URLSearchParams();
    if (search)         params.set('search', search);
    if (filterLanguage) params.set('language', filterLanguage);
    if (filterSpec)     params.set('specialization', filterSpec);

    try {
      const res = await fetch(`${API_BASE}/api/v1/scheduling/therapists?${params}`);
      if (res.ok) {
        const data = await res.json() as TherapistListing[];
        setTherapists(data);
      }
    } catch {
      // silently fail — therapists list stays empty
    } finally {
      setLoadingTherapists(false);
    }
  }, [search, filterLanguage, filterSpec]);

  useEffect(() => {
    fetchTherapists();
  }, [fetchTherapists]);

  // ─── Fetch slots for selected therapist + week ──────────────────────────────

  useEffect(() => {
    if (!selected) return;
    setLoadingSlots(true);

    const weekStartISO = weekStart.toISOString();

    Promise.all([
      fetch(`${API_BASE}/api/v1/scheduling/therapists/${selected.therapistId}/availability`).then((r) => r.json()),
      fetch(`${API_BASE}/api/v1/scheduling/therapists/${selected.therapistId}/booked?weekStart=${encodeURIComponent(weekStartISO)}`).then((r) => r.json()),
    ])
      .then(([avail, booked]) => {
        setSlots(avail as AvailabilitySlot[]);
        setBookedSlots(booked as BookedSlot[]);
      })
      .catch(() => {
        setSlots([]);
        setBookedSlots([]);
      })
      .finally(() => setLoadingSlots(false));
  }, [selected, weekStart]);

  // ─── Book the session ────────────────────────────────────────────────────────

  async function handleBook() {
    if (!selected || !pickedSlot) return;
    setBooking(true);
    setBookingError(null);

    try {
      const supabase = createClient();
      const { data: { session: authSession } } = await supabase.auth.getSession();
      const token = authSession?.access_token;
      if (!token) throw new Error('Not authenticated');

      // Build ISO datetime from picked date + startTime slot
      const [h, m] = pickedSlot.startTime.split(':').map(Number);
      const dt = new Date(pickedSlot.date);
      dt.setHours(h, m, 0, 0);

      const res = await fetch(`${API_BASE}/api/v1/scheduling/book`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          therapistId: selected.therapistId,
          scheduledAt: dt.toISOString(),
          sessionType,
        }),
      });

      const body = await res.json() as { sessionId?: string; message?: string };
      if (!res.ok) throw new Error((body as { message?: string }).message || 'Booking failed');

      setBookedSessionId(body.sessionId ?? null);
      setStep('success');
    } catch (err) {
      setBookingError(err instanceof Error ? err.message : 'Could not complete booking');
    } finally {
      setBooking(false);
    }
  }

  // ─── Build week day columns ──────────────────────────────────────────────────

  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return d;
  });

  const bookedISOs = new Set(bookedSlots.map((b) => new Date(b.scheduledAt).toISOString()));

  function isSlotBooked(date: Date, startTime: string): boolean {
    const [h, m] = startTime.split(':').map(Number);
    const dt = new Date(date);
    dt.setHours(h, m, 0, 0);
    return bookedISOs.has(dt.toISOString()) || dt <= new Date();
  }

  // Slots keyed by dayOfWeek
  const slotsByDay = slots.reduce<Record<number, AvailabilitySlot[]>>((acc, s) => {
    (acc[s.dayOfWeek] ??= []).push(s);
    return acc;
  }, {});

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div style={{ minHeight: '100vh', position: 'relative' }}>
      <div className="mesh-bg" />

      {/* Nav */}
      <nav style={{
        position: 'sticky', top: 0, zIndex: 50,
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        background: 'rgba(10, 15, 30, 0.85)',
        backdropFilter: 'blur(16px)',
      }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '4rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <Link href="/dashboard" className="btn-ghost" style={{ padding: '0.4rem 0.85rem', fontSize: '0.85rem' }}>
              ← Dashboard
            </Link>
            <span style={{ fontSize: '1.15rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
              <IconCalendar size={18} color="#3b82f6" />
              <span><span className="gradient-text">Schedule</span> a Session</span>
            </span>
          </div>


          {/* Step breadcrumb */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', color: '#6b7280' }}>
            {(['browse', 'slots', 'confirm'] as const).map((s, i) => (
              <span key={s} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                {i > 0 && <span>›</span>}
                <span style={{
                  color: step === s ? '#85a8ff' : step === 'success' || (['browse','slots','confirm'] as const).indexOf(step) > i ? '#34d399' : '#6b7280',
                  fontWeight: step === s ? 700 : 400,
                }}>
                  {s === 'browse' ? '1. Choose Therapist' : s === 'slots' ? '2. Pick a Time' : '3. Confirm'}
                </span>
              </span>
            ))}
          </div>
        </div>
      </nav>

      <main style={{ maxWidth: 1200, margin: '0 auto', padding: '2.5rem 1.5rem' }}>

        {/* ── STEP 1: BROWSE ───────────────────────────────────────────────── */}
        {step === 'browse' && (
          <div>
            <div style={{ marginBottom: '2rem' }}>
              <h1 style={{ fontSize: '1.75rem', fontWeight: 700, marginBottom: '0.35rem' }}>
                Find Your Therapist
              </h1>
              <p style={{ color: '#9ca3af', fontSize: '0.9rem' }}>
                Browse our verified therapists and schedule a 45-minute session at a time that works for you.
              </p>
            </div>

            {/* Filter bar */}
            <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '2rem', flexWrap: 'wrap' }}>
              <input
                type="text"
                placeholder="Search by name or specialty…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{
                  flex: '1 1 260px',
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '0.65rem',
                  padding: '0.6rem 1rem',
                  color: '#f9fafb',
                  fontSize: '0.875rem',
                  fontFamily: 'inherit',
                }}
              />
              <select
                value={filterLanguage}
                onChange={(e) => setFilterLanguage(e.target.value)}
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '0.65rem',
                  padding: '0.6rem 0.9rem',
                  color: filterLanguage ? '#f9fafb' : '#6b7280',
                  fontSize: '0.85rem',
                  fontFamily: 'inherit',
                  minWidth: 140,
                }}
              >
                <option value="">All Languages</option>
                {['English','Hindi','Spanish','French','Bengali','Tamil','Telugu'].map((l) => (
                  <option key={l} value={l}>{l}</option>
                ))}
              </select>
              <select
                value={filterSpec}
                onChange={(e) => setFilterSpec(e.target.value)}
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '0.65rem',
                  padding: '0.6rem 0.9rem',
                  color: filterSpec ? '#f9fafb' : '#6b7280',
                  fontSize: '0.85rem',
                  fontFamily: 'inherit',
                  minWidth: 170,
                }}
              >
                <option value="">All Specializations</option>
                {['Anxiety','Depression','Trauma','Relationships','Addiction','Grief','ADHD','OCD','Couples','Family','Career'].map((s) => (
                  <option key={s} value={s.toLowerCase()}>{s}</option>
                ))}
              </select>
            </div>

            {/* Therapist grid */}
            {loadingTherapists ? (
              <div className="glass" style={{ borderRadius: '1rem', padding: '4rem', textAlign: 'center', color: '#9ca3af' }}>
                <p>Loading therapists…</p>
              </div>
            ) : therapists.length === 0 ? (
              <div className="glass fade-in-up" style={{ borderRadius: '1.25rem', padding: '4rem', textAlign: 'center' }}>
                <div style={{ marginBottom: '0.75rem', color: '#6b7280' }}><IconSearch size={40} /></div>
                <h2 style={{ fontWeight: 700, marginBottom: '0.5rem' }}>No therapists found</h2>
                <p style={{ color: '#9ca3af', fontSize: '0.875rem' }}>Try adjusting your filters or check back later as more therapists join.</p>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.25rem' }}>
                {therapists.map((t) => (
                  <TherapistCard key={t.therapistId} therapist={t} onSelect={() => {
                    setSelected(t);
                    setPickedSlot(null);
                    setWeekStart(getMondayOfWeek(new Date()));
                    setStep('slots');
                  }} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── STEP 2: SLOTS ────────────────────────────────────────────────── */}
        {step === 'slots' && selected && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem', flexWrap: 'wrap' }}>
              <button type="button" onClick={() => setStep('browse')} className="btn-ghost" style={{ padding: '0.45rem 0.9rem', fontSize: '0.85rem' }}>
                ← Back
              </button>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                <div style={{
                  width: 48, height: 48, borderRadius: '50%',
                  background: '#3b82f6',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '1.25rem', fontWeight: 700, color: '#fdfbf7',
                  boxShadow: '0 4px 14px rgba(59, 130, 246, 0.3)',
                }}>
                  {selected.fullName.charAt(0)}
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '1.05rem' }}>{selected.fullName}</div>
                  <div style={{ color: '#9ca3af', fontSize: '0.8rem' }}>{selected.yearsOfExperience} yrs exp · {selected.languages.join(', ')}</div>
                </div>
              </div>
            </div>

            <h2 style={{ fontWeight: 700, fontSize: '1.35rem', marginBottom: '1.5rem' }}>
              Choose an Available Time Slot
            </h2>

            {/* Week navigation */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
              <button
                type="button"
                className="btn-ghost"
                style={{ padding: '0.4rem 0.85rem', fontSize: '0.85rem' }}
                onClick={() => {
                  const prev = new Date(weekStart);
                  prev.setDate(prev.getDate() - 7);
                  if (prev >= getMondayOfWeek(new Date())) setWeekStart(prev);
                }}
                disabled={weekStart <= getMondayOfWeek(new Date())}
              >
                ← Prev week
              </button>
              <span style={{ fontWeight: 600, fontSize: '0.9rem', color: '#d1d5db' }}>
                Week of {weekStart.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
              </span>
              <button
                type="button"
                className="btn-ghost"
                style={{ padding: '0.4rem 0.85rem', fontSize: '0.85rem' }}
                onClick={() => {
                  const next = new Date(weekStart);
                  next.setDate(next.getDate() + 7);
                  setWeekStart(next);
                }}
              >
                Next week →
              </button>
            </div>

            {loadingSlots ? (
              <div style={{ textAlign: 'center', padding: '3rem', color: '#9ca3af' }}>Loading availability…</div>
            ) : slots.length === 0 ? (
              <div className="glass" style={{ borderRadius: '1rem', padding: '3rem', textAlign: 'center' }}>
                <div style={{ marginBottom: '0.75rem', color: '#6b7280' }}><IconCloudOff size={36} /></div>
                <p style={{ color: '#9ca3af', fontSize: '0.9rem' }}>
                  {selected.fullName} has not set their weekly availability yet. Try another therapist or check back later.
                </p>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <div style={{ display: 'grid', gridTemplateColumns: `repeat(7, minmax(115px, 1fr))`, gap: '0.65rem', minWidth: 700 }}>
                  {weekDays.map((date, idx) => {
                    const dow = date.getDay();
                    const daySlots = slotsByDay[dow] ?? [];
                    const isToday = isoDate(date) === isoDate(new Date());
                    const isPast = date < new Date() && !isToday;

                    return (
                      <div key={idx}>
                        {/* Day header */}
                        <div style={{
                          textAlign: 'center',
                          marginBottom: '0.5rem',
                          padding: '0.5rem',
                          borderRadius: '0.65rem',
                          background: isToday ? 'rgba(58, 91, 239, 0.15)' : 'transparent',
                          border: isToday ? '1px solid rgba(58, 91, 239, 0.3)' : '1px solid transparent',
                        }}>
                          <div style={{ fontSize: '0.75rem', color: '#9ca3af', fontWeight: 600 }}>{DAY_NAMES[dow]}</div>
                          <div style={{ fontWeight: 700, fontSize: '1.05rem', color: isToday ? '#85a8ff' : '#f9fafb' }}>
                            {date.getDate()}
                          </div>
                        </div>

                        {/* Slots */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                          {daySlots.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '1.25rem 0', color: '#374151', fontSize: '0.75rem' }}>
                              —
                            </div>
                          ) : daySlots.map((slot) => {
                            const booked = isSlotBooked(date, slot.startTime);
                            const isActive = pickedSlot && isoDate(pickedSlot.date) === isoDate(date) && pickedSlot.startTime === slot.startTime;

                            return (
                              <button
                                key={slot.id + isoDate(date)}
                                type="button"
                                disabled={booked || isPast}
                                onClick={() => {
                                  setPickedSlot({ date, startTime: slot.startTime });
                                  setStep('confirm');
                                }}
                                style={{
                                  padding: '0.45rem',
                                  borderRadius: '0.5rem',
                                  fontSize: '0.75rem',
                                  fontWeight: 600,
                                  cursor: booked || isPast ? 'not-allowed' : 'pointer',
                                  background: isActive
                                    ? 'rgba(58, 91, 239, 0.3)'
                                    : booked || isPast
                                    ? 'rgba(255,255,255,0.02)'
                                    : 'rgba(16, 185, 129, 0.12)',
                                  border: `1px solid ${isActive ? 'rgba(58,91,239,0.5)' : booked || isPast ? 'rgba(255,255,255,0.05)' : 'rgba(16,185,129,0.3)'}`,
                                  color: booked || isPast ? '#374151' : isActive ? '#85a8ff' : '#34d399',
                                  textDecoration: booked ? 'line-through' : 'none',
                                  textAlign: 'center',
                                  transition: 'all 0.15s',
                                }}
                              >
                                {fmt24to12(slot.startTime)}
                                {booked && <span style={{ display: 'block', fontSize: '0.65rem', color: '#4b5563' }}>Booked</span>}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── STEP 3: CONFIRM ──────────────────────────────────────────────── */}
        {step === 'confirm' && selected && pickedSlot && (
          <div style={{ maxWidth: 560, margin: '0 auto' }}>
            <button type="button" onClick={() => setStep('slots')} className="btn-ghost" style={{ padding: '0.45rem 0.9rem', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
              ← Back to calendar
            </button>

            <div className="glass fade-in-up" style={{ borderRadius: '1.5rem', padding: '2rem' }}>
              <h2 style={{ fontWeight: 700, fontSize: '1.4rem', marginBottom: '1.5rem' }}>Confirm Your Booking</h2>

              {/* Summary */}
              <div style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '1rem',
                padding: '1.25rem',
                marginBottom: '1.5rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.75rem',
              }}>
                <SummaryRow label="Therapist" value={selected.fullName} />
                <SummaryRow
                  label="Date"
                  value={pickedSlot.date.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                />
                <SummaryRow label="Time" value={`${fmt24to12(pickedSlot.startTime)} (${Intl.DateTimeFormat().resolvedOptions().timeZone})`} />
                <SummaryRow label="Duration" value="45 minutes" />
                <SummaryRow label="Cost" value="Free (Donation welcome)" highlight />
              </div>

              {/* Session type */}
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', color: '#9ca3af', marginBottom: '0.5rem', fontWeight: 600 }}>
                  Session Modality
                </label>
                <div style={{ display: 'flex', gap: '0.65rem' }}>
                  {(['video', 'voice', 'chat'] as const).map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setSessionType(type)}
                      style={{
                        flex: 1,
                        padding: '0.65rem',
                        borderRadius: '0.65rem',
                        border: `1px solid ${sessionType === type ? 'rgba(58,91,239,0.5)' : 'rgba(255,255,255,0.08)'}`,
                        background: sessionType === type ? 'rgba(58, 91, 239, 0.2)' : 'transparent',
                        color: sessionType === type ? '#85a8ff' : '#9ca3af',
                        fontWeight: 600,
                        fontSize: '0.85rem',
                        cursor: 'pointer',
                        textTransform: 'capitalize',
                        transition: 'all 0.15s',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.4rem',
                      }}
                    >
                      {type === 'video' ? <IconVideo size={16} /> : type === 'voice' ? <IconMic size={16} /> : <IconMessageSquare size={16} />}
                      {type}
                    </button>
                  ))}
                </div>
              </div>

              {bookingError && (
                <div style={{
                  background: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  borderRadius: '0.65rem',
                  padding: '0.75rem 1rem',
                  color: '#dc2626',
                  fontSize: '0.875rem',
                  marginBottom: '1rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                }}>
                  <IconAlertCircle size={18} color="#dc2626" />
                  <span>{bookingError}</span>
                </div>
              )}

              <button
                type="button"
                onClick={handleBook}
                disabled={booking}
                className="btn-primary"
                style={{
                  width: '100%',
                  padding: '0.9rem',
                  fontSize: '1rem',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                }}
              >
                <IconCheck size={18} />
                {booking ? 'Booking...' : 'Confirm Booking'}
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 4: SUCCESS ──────────────────────────────────────────────── */}
        {step === 'success' && selected && pickedSlot && (
          <div style={{ maxWidth: 520, margin: '0 auto', textAlign: 'center' }} className="fade-in-up">
            <div style={{
              width: 72,
              height: 72,
              borderRadius: '50%',
              background: 'rgba(16, 185, 129, 0.12)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 1.5rem auto',
            }}>
              <IconCheck size={36} color="#059669" />
            </div>
            <h1 style={{ fontSize: '1.85rem', fontWeight: 700, marginBottom: '0.5rem', color: '#1e293b' }}>
              Session <span className="gradient-text">Booked!</span>
            </h1>
            <p style={{ color: '#64748b', fontSize: '0.95rem', marginBottom: '0.5rem' }}>
              Your {sessionType} session with <strong style={{ color: '#1e293b' }}>{selected.fullName}</strong> is confirmed.
            </p>
            <p style={{ color: '#64748b', fontSize: '0.875rem', marginBottom: '2.5rem' }}>
              {pickedSlot.date.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })} at {fmt24to12(pickedSlot.startTime)}
            </p>

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
              {bookedSessionId && (
                <Link
                  href={`/dashboard/session/${bookedSessionId}`}
                  className="btn-primary"
                  style={{ padding: '0.75rem 1.75rem', fontSize: '0.95rem' }}
                >
                  Join When Ready →
                </Link>
              )}
              <Link
                href="/dashboard/sessions"
                className="btn-ghost"
                style={{ padding: '0.75rem 1.5rem', fontSize: '0.95rem', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
              >
                <IconClipboard size={16} />
                <span>My Sessions</span>
              </Link>
            </div>
          </div>
        )}


      </main>
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function TherapistCard({ therapist, onSelect }: { therapist: TherapistListing; onSelect: () => void }) {
  return (
    <div
      className="glass"
      style={{
        borderRadius: '1.15rem',
        padding: '1.5rem',
        cursor: 'pointer',
        transition: 'all 0.2s',
        border: '1px solid rgba(255,255,255,0.07)',
      }}
      onClick={onSelect}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
        <div style={{
          width: 52, height: 52, borderRadius: '50%', flexShrink: 0,
          background: '#3b82f6',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '1.35rem', fontWeight: 700, color: '#fdfbf7',
          boxShadow: '0 4px 14px rgba(59, 130, 246, 0.3)',
        }}>
          {therapist.fullName.charAt(0)}
        </div>
        <div>
          <div style={{ fontWeight: 700, fontSize: '1rem', color: '#f9fafb' }}>{therapist.fullName}</div>
          <div style={{ fontSize: '0.8rem', color: '#9ca3af', marginTop: '0.1rem' }}>
            {therapist.yearsOfExperience} years experience
            {therapist.hourlyRateUsd === null && <span style={{ marginLeft: '0.5rem', color: '#34d399', fontWeight: 600 }}>· Free</span>}
          </div>
        </div>
      </div>

      {/* Bio */}
      {therapist.bio && (
        <p style={{ color: '#d1d5db', fontSize: '0.83rem', lineHeight: 1.6, marginBottom: '1rem',
          display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
          {therapist.bio}
        </p>
      )}

      {/* Specializations */}
      {therapist.specializations.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginBottom: '1rem' }}>
          {therapist.specializations.slice(0, 4).map((s) => (
            <span key={s} style={{
              background: 'rgba(58,91,239,0.1)', border: '1px solid rgba(58,91,239,0.2)',
              color: '#85a8ff', padding: '0.15rem 0.5rem', borderRadius: '0.35rem', fontSize: '0.72rem', fontWeight: 500,
            }}>
              {s}
            </span>
          ))}
          {therapist.specializations.length > 4 && (
            <span style={{ color: '#6b7280', fontSize: '0.72rem', padding: '0.15rem 0.3rem' }}>
              +{therapist.specializations.length - 4} more
            </span>
          )}
        </div>
      )}

      {/* Languages + CTA */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ color: '#9ca3af', fontSize: '0.78rem' }}>
          <IconGlobe size={13} style={{ marginRight: '0.25rem', verticalAlign: 'middle', flexShrink: 0 }} />{therapist.languages.slice(0, 2).join(', ')}{therapist.languages.length > 2 ? ` +${therapist.languages.length - 2}` : ''}
        </span>
        <span style={{
          background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.3)',
          color: '#34d399', padding: '0.25rem 0.75rem', borderRadius: '0.45rem',
          fontSize: '0.78rem', fontWeight: 700,
        }}>
          Book →
        </span>
      </div>
    </div>
  );
}

function SummaryRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span style={{ color: '#9ca3af', fontSize: '0.85rem' }}>{label}</span>
      <span style={{ fontWeight: 600, fontSize: '0.9rem', color: highlight ? '#34d399' : '#f9fafb' }}>{value}</span>
    </div>
  );
}
