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
  const [mobileDayIdx, setMobileDayIdx] = useState(0);
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
    return bookedISOs.has(dt.toISOString());
  }

  function isSlotPast(date: Date, startTime: string): boolean {
    const [h, m] = startTime.split(':').map(Number);
    const dt = new Date(date);
    dt.setHours(h, m, 0, 0);
    return dt.getTime() <= Date.now();
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
        borderBottom: '1px solid #e2e8f0',
        background: 'rgba(255, 255, 255, 0.95)',
        backdropFilter: 'blur(16px)',
      }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '3.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <Link href="/dashboard" className="btn-ghost" style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
              ← Dashboard
            </Link>
            <span style={{ fontSize: '1.05rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '0.4rem', color: '#0f172a' }}>
              <IconCalendar size={18} color="#3b82f6" />
              <span><span className="gradient-text">Schedule</span> a Session</span>
            </span>
          </div>

          {/* Step breadcrumb */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.78rem', color: '#94a3b8' }}>
            {(['browse', 'slots', 'confirm'] as const).map((s, i) => (
              <span key={s} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                {i > 0 && <span style={{ color: '#cbd5e1' }}>›</span>}
                <span style={{
                  color: step === s ? 'hsl(var(--accent))' : step === 'success' || (['browse','slots','confirm'] as const).indexOf(step) > i ? '#059669' : '#94a3b8',
                  fontWeight: step === s ? 700 : 500,
                }}>
                  {s === 'browse' ? '1. Helper' : s === 'slots' ? '2. Time' : '3. Confirm'}
                </span>
              </span>
            ))}
          </div>
        </div>
      </nav>

      <main style={{ maxWidth: 1200, margin: '0 auto', padding: '2rem 1rem 6rem' }}>

        {/* ── STEP 1: BROWSE ───────────────────────────────────────────────── */}
        {step === 'browse' && (
          <div>
            <div style={{ marginBottom: '1.75rem' }}>
              <h1 style={{ fontSize: 'clamp(1.5rem, 4vw, 2rem)', fontWeight: 800, color: '#0f172a', marginBottom: '0.35rem', letterSpacing: '-0.02em' }}>
                Find Your Counsellor or Helper
              </h1>
              <p style={{ color: '#64748b', fontSize: '0.9rem', margin: 0 }}>
                Browse our verified practitioners and schedule a 45-minute help session at a time that works for you.
              </p>
            </div>

            {/* Filter bar */}
            <div style={{ display: 'flex', gap: '0.65rem', marginBottom: '1.75rem', flexWrap: 'wrap' }}>
              <input
                type="text"
                placeholder="Search by name or specialty…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{
                  flex: '1 1 240px',
                  background: '#ffffff',
                  border: '1px solid #cbd5e1',
                  borderRadius: '0.65rem',
                  padding: '0.6rem 0.95rem',
                  color: '#0f172a',
                  fontSize: '0.875rem',
                  fontFamily: 'inherit',
                  outline: 'none',
                }}
              />
              <select
                value={filterLanguage}
                onChange={(e) => setFilterLanguage(e.target.value)}
                style={{
                  background: '#ffffff',
                  border: '1px solid #cbd5e1',
                  borderRadius: '0.65rem',
                  padding: '0.6rem 0.9rem',
                  color: filterLanguage ? '#0f172a' : '#64748b',
                  fontSize: '0.85rem',
                  fontFamily: 'inherit',
                  minWidth: 140,
                  outline: 'none',
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
                  background: '#ffffff',
                  border: '1px solid #cbd5e1',
                  borderRadius: '0.65rem',
                  padding: '0.6rem 0.9rem',
                  color: filterSpec ? '#0f172a' : '#64748b',
                  fontSize: '0.85rem',
                  fontFamily: 'inherit',
                  minWidth: 170,
                  outline: 'none',
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
              <span style={{ fontWeight: 700, fontSize: '0.95rem', color: '#1e293b' }}>
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
              <div style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>Loading availability…</div>
            ) : slots.length === 0 ? (
              <div className="glass" style={{ borderRadius: '1rem', padding: '3rem', textAlign: 'center', background: '#fff', border: '1px solid #e2e8f0' }}>
                <div style={{ marginBottom: '0.75rem', color: '#94a3b8' }}><IconCloudOff size={36} /></div>
                <p style={{ color: '#64748b', fontSize: '0.9rem', margin: 0 }}>
                  {selected.fullName} has not set their weekly availability yet. Try another helper or check back later.
                </p>
              </div>
            ) : (
              <>
                {/* Mobile Day Selector & Slots (<768px) */}
                <div className="block md:hidden mb-6">
                  <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
                    {weekDays.map((date, idx) => {
                      const dow = date.getDay();
                      const isSelected = mobileDayIdx === idx;
                      const isToday = isoDate(date) === isoDate(new Date());
                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setMobileDayIdx(idx)}
                          className={`flex-shrink-0 flex flex-col items-center py-2 px-3 rounded-xl border transition-all ${
                            isSelected
                              ? 'bg-blue-50 border-blue-500 text-blue-600 shadow-sm'
                              : 'bg-white border-slate-200 text-slate-600'
                          }`}
                          style={{ minWidth: 56 }}
                        >
                          <span className="text-[10px] font-semibold uppercase tracking-wider">{DAY_NAMES[dow]}</span>
                          <span className="text-base font-bold text-slate-900 mt-0.5">{date.getDate()}</span>
                          {isToday && <span className="w-1.5 h-1.5 rounded-full bg-blue-600 mt-1" />}
                        </button>
                      );
                    })}
                  </div>

                  {/* Vertical time slots for the selected day */}
                  <div className="mt-4 flex flex-col gap-2.5">
                    {(() => {
                      const selectedDate = weekDays[mobileDayIdx] || weekDays[0];
                      const dow = selectedDate.getDay();
                      const daySlots = slotsByDay[dow] ?? [];

                      if (daySlots.length === 0) {
                        return (
                          <div className="p-6 rounded-xl text-center text-slate-500 text-sm bg-white border border-slate-200">
                            No available slots on {DAY_FULL[dow]}.
                          </div>
                        );
                      }

                      return daySlots.map((slot) => {
                        const booked = isSlotBooked(selectedDate, slot.startTime);
                        const isPast = isSlotPast(selectedDate, slot.startTime);
                        const isAvailable = !booked && !isPast;
                        const isActive = pickedSlot && isoDate(pickedSlot.date) === isoDate(selectedDate) && pickedSlot.startTime === slot.startTime;

                        return (
                          <button
                            key={slot.id + isoDate(selectedDate)}
                            type="button"
                            disabled={!isAvailable}
                            onClick={() => {
                              setPickedSlot({ date: selectedDate, startTime: slot.startTime });
                              setStep('confirm');
                            }}
                            className="flex items-center justify-between p-3.5 rounded-xl border text-sm font-semibold transition-all active:scale-[0.99]"
                            style={{
                              background: isActive
                                ? '#3b82f6'
                                : booked
                                ? '#f1f5f9'
                                : isPast
                                ? '#f8fafc'
                                : '#f0fdf4',
                              borderColor: isActive
                                ? '#2563eb'
                                : booked
                                ? '#e2e8f0'
                                : isPast
                                ? '#f1f5f9'
                                : '#bbf7d0',
                              color: isActive
                                ? '#ffffff'
                                : booked
                                ? '#94a3b8'
                                : isPast
                                ? '#cbd5e1'
                                : '#15803d',
                              cursor: isAvailable ? 'pointer' : 'not-allowed',
                            }}
                          >
                            <span style={{ textDecoration: booked ? 'line-through' : 'none' }}>{fmt24to12(slot.startTime)}</span>
                            <span className="text-xs font-semibold">
                              {booked ? 'Booked' : isPast ? 'Past' : isActive ? 'Selected ✓' : 'Select Slot →'}
                            </span>
                          </button>
                        );
                      });
                    })()}
                  </div>
                </div>

                {/* Desktop 7-Column Grid (>=768px) */}
                <div className="hidden md:block overflow-x-auto">
                  <div style={{ display: 'grid', gridTemplateColumns: `repeat(7, minmax(115px, 1fr))`, gap: '0.65rem', minWidth: 700 }}>
                    {weekDays.map((date, idx) => {
                      const dow = date.getDay();
                      const daySlots = slotsByDay[dow] ?? [];
                      const isToday = isoDate(date) === isoDate(new Date());

                      return (
                        <div key={idx}>
                          {/* Day header */}
                          <div style={{
                            textAlign: 'center',
                            marginBottom: '0.5rem',
                            padding: '0.5rem',
                            borderRadius: '0.65rem',
                            background: isToday ? '#eff6ff' : '#ffffff',
                            border: isToday ? '1.5px solid #3b82f6' : '1px solid #e2e8f0',
                            boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
                          }}>
                            <div style={{ fontSize: '0.75rem', color: isToday ? '#2563eb' : '#64748b', fontWeight: 600 }}>{DAY_NAMES[dow]}</div>
                            <div style={{ fontWeight: 800, fontSize: '1.05rem', color: isToday ? '#1d4ed8' : '#1e293b' }}>
                              {date.getDate()}
                            </div>
                          </div>

                          {/* Slots */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                            {daySlots.length === 0 ? (
                              <div style={{ textAlign: 'center', padding: '1.25rem 0', color: '#cbd5e1', fontSize: '0.75rem' }}>
                                —
                              </div>
                            ) : daySlots.map((slot) => {
                              const booked = isSlotBooked(date, slot.startTime);
                              const isPast = isSlotPast(date, slot.startTime);
                              const isAvailable = !booked && !isPast;
                              const isActive = pickedSlot && isoDate(pickedSlot.date) === isoDate(date) && pickedSlot.startTime === slot.startTime;

                              return (
                                <button
                                  key={slot.id + isoDate(date)}
                                  type="button"
                                  disabled={!isAvailable}
                                  onClick={() => {
                                    setPickedSlot({ date, startTime: slot.startTime });
                                    setStep('confirm');
                                  }}
                                  style={{
                                    padding: '0.45rem 0.35rem',
                                    borderRadius: '0.5rem',
                                    fontSize: '0.75rem',
                                    fontWeight: 600,
                                    cursor: isAvailable ? 'pointer' : 'not-allowed',
                                    background: isActive
                                      ? '#3b82f6'
                                      : booked
                                      ? '#f1f5f9'
                                      : isPast
                                      ? '#f8fafc'
                                      : '#f0fdf4',
                                    border: `1px solid ${
                                      isActive
                                        ? '#2563eb'
                                        : booked
                                        ? '#e2e8f0'
                                        : isPast
                                        ? '#f1f5f9'
                                        : '#bbf7d0'
                                    }`,
                                    color: isActive
                                      ? '#ffffff'
                                      : booked
                                      ? '#94a3b8'
                                      : isPast
                                      ? '#cbd5e1'
                                      : '#15803d',
                                    textDecoration: booked ? 'line-through' : 'none',
                                    textAlign: 'center',
                                    transition: 'all 0.15s',
                                  }}
                                >
                                  <div>{fmt24to12(slot.startTime)}</div>
                                  {booked && <span style={{ display: 'block', fontSize: '0.62rem', color: '#94a3b8' }}>Booked</span>}
                                  {isPast && !booked && <span style={{ display: 'block', fontSize: '0.62rem', color: '#cbd5e1' }}>Past</span>}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* ── STEP 3: CONFIRM ──────────────────────────────────────────────── */}
        {step === 'confirm' && selected && pickedSlot && (
          <div style={{ maxWidth: 560, margin: '0 auto' }}>
            <button type="button" onClick={() => setStep('slots')} className="btn-ghost" style={{ padding: '0.45rem 0.9rem', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
              ← Back to calendar
            </button>

            <div className="glass fade-in-up" style={{ borderRadius: '1.25rem', padding: '2rem', background: '#ffffff', border: '1px solid #e2e8f0', boxShadow: '0 8px 24px rgba(0,0,0,0.04)' }}>
              <h2 style={{ fontWeight: 800, fontSize: '1.4rem', marginBottom: '1.5rem', color: '#0f172a' }}>Confirm Your Session</h2>

              {/* Summary */}
              <div style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '1rem',
                padding: '1.25rem',
                marginBottom: '1.5rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.75rem',
              }}>
                <SummaryRow label="Helper / Counsellor" value={selected.fullName} />
                <SummaryRow
                  label="Date"
                  value={pickedSlot.date.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                />
                <SummaryRow label="Time" value={`${fmt24to12(pickedSlot.startTime)} (${Intl.DateTimeFormat().resolvedOptions().timeZone})`} />
                <SummaryRow label="Duration" value="45 minutes" />
                <SummaryRow label="Cost" value="100% Free (Voluntary donation welcome)" highlight />
              </div>

              {/* Session type */}
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', color: '#475569', marginBottom: '0.5rem', fontWeight: 600 }}>
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
                        border: `1px solid ${sessionType === type ? '#2563eb' : '#cbd5e1'}`,
                        background: sessionType === type ? '#eff6ff' : '#ffffff',
                        color: sessionType === type ? '#1d4ed8' : '#64748b',
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
                  background: '#fef2f2',
                  border: '1px solid #fecaca',
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
                {booking ? 'Booking...' : 'Confirm Session'}
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
              background: '#f0fdf4',
              border: '1px solid #bbf7d0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 1.5rem auto',
            }}>
              <IconCheck size={36} color="#15803d" />
            </div>
            <h1 style={{ fontSize: '1.85rem', fontWeight: 800, marginBottom: '0.5rem', color: '#0f172a' }}>
              Session <span className="gradient-text">Booked!</span>
            </h1>
            <p style={{ color: '#64748b', fontSize: '0.95rem', marginBottom: '0.5rem' }}>
              Your {sessionType} session with <strong style={{ color: '#0f172a' }}>{selected.fullName}</strong> is confirmed.
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
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
      }}
      onClick={onSelect}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
        <div style={{
          width: 50, height: 50, borderRadius: '50%', flexShrink: 0,
          background: 'hsl(var(--accent))',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '1.3rem', fontWeight: 700, color: '#ffffff',
          boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)',
        }}>
          {therapist.fullName.charAt(0)}
        </div>
        <div>
          <div style={{ fontWeight: 700, fontSize: '1rem', color: '#0f172a' }}>{therapist.fullName}</div>
          <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.1rem' }}>
            {therapist.yearsOfExperience} years experience
            {therapist.hourlyRateUsd === null && <span style={{ marginLeft: '0.5rem', color: '#15803d', fontWeight: 700 }}>· Free</span>}
          </div>
        </div>
      </div>

      {/* Bio */}
      {therapist.bio && (
        <p style={{ color: '#475569', fontSize: '0.83rem', lineHeight: 1.6, marginBottom: '1rem',
          display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
          {therapist.bio}
        </p>
      )}

      {/* Specializations */}
      {therapist.specializations.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginBottom: '1rem' }}>
          {therapist.specializations.slice(0, 4).map((s) => (
            <span key={s} style={{
              background: '#eff6ff', border: '1px solid #bfdbfe',
              color: '#1d4ed8', padding: '0.15rem 0.5rem', borderRadius: '0.35rem', fontSize: '0.72rem', fontWeight: 600,
            }}>
              {s}
            </span>
          ))}
          {therapist.specializations.length > 4 && (
            <span style={{ color: '#94a3b8', fontSize: '0.72rem', padding: '0.15rem 0.3rem' }}>
              +{therapist.specializations.length - 4} more
            </span>
          )}
        </div>
      )}

      {/* Languages + CTA */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '0.5rem', borderTop: '1px solid #f1f5f9' }}>
        <span style={{ color: '#64748b', fontSize: '0.78rem' }}>
          <IconGlobe size={13} style={{ marginRight: '0.25rem', verticalAlign: 'middle', flexShrink: 0 }} />{therapist.languages.slice(0, 2).join(', ')}{therapist.languages.length > 2 ? ` +${therapist.languages.length - 2}` : ''}
        </span>
        <span style={{
          background: '#f0fdf4', border: '1px solid #bbf7d0',
          color: '#15803d', padding: '0.25rem 0.75rem', borderRadius: '0.45rem',
          fontSize: '0.78rem', fontWeight: 700,
        }}>
          Book Slot →
        </span>
      </div>
    </div>
  );
}

function SummaryRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span style={{ color: '#64748b', fontSize: '0.85rem' }}>{label}</span>
      <span style={{ fontWeight: 600, fontSize: '0.9rem', color: highlight ? '#15803d' : '#0f172a' }}>{value}</span>
    </div>
  );
}
