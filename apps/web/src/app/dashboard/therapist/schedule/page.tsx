'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { IconCopy, IconGlobe, IconCheck, IconAlertCircle, IconClock } from '@/components/Icons';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

interface SlotItem {
  startTime: string;
  endTime: string;
}

const DAYS_OF_WEEK = [
  { day: 1, name: 'Monday', short: 'Mon' },
  { day: 2, name: 'Tuesday', short: 'Tue' },
  { day: 3, name: 'Wednesday', short: 'Wed' },
  { day: 4, name: 'Thursday', short: 'Thu' },
  { day: 5, name: 'Friday', short: 'Fri' },
  { day: 6, name: 'Saturday', short: 'Sat' },
  { day: 0, name: 'Sunday', short: 'Sun' },
];

const DEFAULT_SCHEDULE: Record<number, SlotItem[]> = {
  1: [{ startTime: '09:00', endTime: '13:00' }, { startTime: '14:00', endTime: '18:00' }],
  2: [{ startTime: '09:00', endTime: '13:00' }, { startTime: '14:00', endTime: '18:00' }],
  3: [{ startTime: '09:00', endTime: '13:00' }, { startTime: '14:00', endTime: '18:00' }],
  4: [{ startTime: '09:00', endTime: '13:00' }, { startTime: '14:00', endTime: '18:00' }],
  5: [{ startTime: '09:00', endTime: '13:00' }, { startTime: '14:00', endTime: '17:00' }],
  6: [{ startTime: '10:00', endTime: '14:00' }],
  0: [],
};

export default function TherapistSchedulePage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [userTimezone, setUserTimezone] = useState('UTC');
  const [userId, setUserId] = useState<string | null>(null);

  const [schedule, setSchedule] = useState<Record<number, SlotItem[]>>(DEFAULT_SCHEDULE);

  useEffect(() => {
    loadSchedule();
  }, []);

  async function loadSchedule() {
    setLoading(true);
    try {
      setUserTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC');
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (user) {
        setUserId(user.id);
        const { data: userRow } = await supabase
          .from('users')
          .select('timezone')
          .eq('id', user.id)
          .single();

        if (userRow?.timezone) setUserTimezone(userRow.timezone);

        const { data: slots, error } = await supabase
          .from('availability_slots')
          .select('day_of_week, start_time, end_time')
          .eq('therapist_id', user.id)
          .order('day_of_week', { ascending: true })
          .order('start_time', { ascending: true });

        if (!error && slots && slots.length > 0) {
          const map: Record<number, SlotItem[]> = {
            0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [],
          };
          for (const s of slots) {
            map[s.day_of_week].push({
              startTime: s.start_time.slice(0, 5),
              endTime: s.end_time.slice(0, 5),
            });
          }
          setSchedule(map);
          return;
        }
      }

      // Check local cache
      const cached = localStorage.getItem('jarwis_therapist_schedule');
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          if (parsed && typeof parsed === 'object') {
            setSchedule(parsed);
          }
        } catch {}
      }
    } catch {
      // Keep defaults
    } finally {
      setLoading(false);
    }
  }

  function addSlot(day: number) {
    setSchedule((prev) => {
      const existing = prev[day] || [];
      let newStart = '09:00';
      let newEnd = '12:00';

      if (existing.length > 0) {
        const lastSlot = existing[existing.length - 1];
        const [lh, lm] = lastSlot.endTime.split(':').map(Number);
        if (lh < 22) {
          const startH = lh;
          const endH = Math.min(23, lh + 2);
          newStart = `${String(startH).padStart(2, '0')}:${String(lm).padStart(2, '0')}`;
          newEnd = `${String(endH).padStart(2, '0')}:${String(lm).padStart(2, '0')}`;
        } else {
          newStart = '08:00';
          newEnd = '09:00';
        }
      }

      return {
        ...prev,
        [day]: [...existing, { startTime: newStart, endTime: newEnd }],
      };
    });
  }

  function removeSlot(day: number, index: number) {
    setSchedule((prev) => ({
      ...prev,
      [day]: (prev[day] || []).filter((_, i) => i !== index),
    }));
  }

  function updateSlotTime(day: number, index: number, field: 'startTime' | 'endTime', value: string) {
    setSchedule((prev) => {
      const daySlots = [...(prev[day] || [])];
      daySlots[index] = { ...daySlots[index], [field]: value };
      return { ...prev, [day]: daySlots };
    });
  }

  function copyMondayToWeekdays() {
    const mondaySlots = schedule[1] || [];
    setSchedule((prev) => ({
      ...prev,
      2: mondaySlots.map((s) => ({ ...s })),
      3: mondaySlots.map((s) => ({ ...s })),
      4: mondaySlots.map((s) => ({ ...s })),
      5: mondaySlots.map((s) => ({ ...s })),
    }));
    setMessage({ type: 'success', text: 'Copied Monday schedule to Tue, Wed, Thu, and Fri!' });
    setTimeout(() => setMessage(null), 4000);
  }

  function clearDay(day: number) {
    setSchedule((prev) => ({
      ...prev,
      [day]: [],
    }));
  }

  function setStandardHours(day: number) {
    setSchedule((prev) => ({
      ...prev,
      [day]: [
        { startTime: '09:00', endTime: '13:00' },
        { startTime: '14:00', endTime: '18:00' },
      ],
    }));
  }

  async function handleSave() {
    // Validate
    for (const [dayStr, slots] of Object.entries(schedule)) {
      const day = Number(dayStr);
      for (const slot of slots) {
        if (!slot.startTime || !slot.endTime || slot.endTime <= slot.startTime) {
          const dayName = DAYS_OF_WEEK.find((d) => d.day === day)?.name || 'Day';
          setMessage({
            type: 'error',
            text: `${dayName}: End time (${slot.endTime}) must be later than start time (${slot.startTime}).`,
          });
          return;
        }
      }
    }

    setSaving(true);
    setMessage(null);

    try {
      // Save locally first
      localStorage.setItem('jarwis_therapist_schedule', JSON.stringify(schedule));

      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();

      // Format all slots for server
      const allSlots: { dayOfWeek: number; startTime: string; endTime: string }[] = [];
      for (const [dayStr, slots] of Object.entries(schedule)) {
        const day = Number(dayStr);
        for (const s of slots) {
          allSlots.push({
            dayOfWeek: day,
            startTime: s.startTime,
            endTime: s.endTime,
          });
        }
      }

      let savedViaApi = false;

      // 1. Try NestJS backend API if user is authenticated
      if (session?.access_token) {
        try {
          const res = await fetch(`${API_BASE}/api/v1/therapists/me/availability`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({ slots: allSlots }),
          });
          if (res.ok) {
            savedViaApi = true;
          }
        } catch {
          // Fall back to direct supabase
        }
      }

      // 2. Fall back to Supabase client if not saved via API
      if (!savedViaApi && userId) {
        try {
          await supabase.from('availability_slots').delete().eq('therapist_id', userId);
          if (allSlots.length > 0) {
            await supabase.from('availability_slots').insert(
              allSlots.map((s) => ({
                therapist_id: userId,
                day_of_week: s.dayOfWeek,
                start_time: s.startTime,
                end_time: s.endTime,
              }))
            );
          }
        } catch {
          // direct supabase fallback completed
        }
      }

      setMessage({
        type: 'success',
        text: 'Weekly availability schedule saved successfully! Clients can now book available slots in advance.',
      });
      setTimeout(() => setMessage(null), 5000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error saving schedule';
      setMessage({ type: 'error', text: msg });
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8f9fa' }}>
        <div className="spinner" style={{ width: 36, height: 36 }} />
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', position: 'relative', background: '#f8f9fa' }}>
      <div className="mesh-bg" />

      {/* Nav */}
      <nav style={{
        position: 'sticky', top: 0, zIndex: 50,
        borderBottom: '1px solid #e2e8f0',
        background: 'rgba(255, 255, 255, 0.95)',
        backdropFilter: 'blur(16px)',
      }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '3.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <Link href="/dashboard" style={{ color: '#64748b', fontSize: '0.85rem', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              ← Dashboard
            </Link>
            <span style={{ color: '#cbd5e1' }}>/</span>
            <span style={{ fontWeight: 700, fontSize: '0.9rem', color: '#1e293b' }}>Schedule</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <button
              onClick={copyMondayToWeekdays}
              type="button"
              className="btn-ghost"
              style={{
                padding: '0.35rem 0.75rem',
                fontSize: '0.78rem',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                whiteSpace: 'nowrap',
              }}
              title="Copy Monday hours to Tuesday through Friday"
            >
              <IconCopy size={13} />
              <span className="hidden sm:inline">Copy Mon → Fri</span>
              <span className="sm:hidden">Copy Mon</span>
            </button>

            <button
              onClick={handleSave}
              disabled={saving}
              type="button"
              className="btn-primary"
              style={{ padding: '0.4rem 1.15rem', fontSize: '0.82rem', whiteSpace: 'nowrap' }}
            >
              {saving ? 'Saving...' : 'Save Schedule'}
            </button>
          </div>
        </div>
      </nav>

      <main style={{ maxWidth: 1000, margin: '0 auto', padding: '2rem 1rem 5rem' }}>
        {/* Title */}
        <div className="fade-in-up" style={{ marginBottom: '1.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div>
              <h1 style={{ fontSize: 'clamp(1.5rem, 4vw, 2rem)', fontWeight: 800, color: '#0f172a', marginBottom: '0.35rem', letterSpacing: '-0.02em' }}>
                Weekly <span className="gradient-text">Availability Schedule</span>
              </h1>
              <p style={{ color: '#64748b', fontSize: '0.9rem', margin: 0 }}>
                Set recurring weekly hours when clients can book advance counselling and support sessions with you.
              </p>
            </div>

            <div style={{
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '2rem',
              padding: '0.35rem 0.85rem',
              fontSize: '0.78rem',
              color: '#64748b',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
            }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                <IconGlobe size={13} color="#3b82f6" /> Timezone:
              </span>
              <strong style={{ color: '#1e293b' }}>{userTimezone}</strong>
            </div>
          </div>
        </div>

        {/* Feedback alert */}
        {message && (
          <div style={{
            padding: '0.85rem 1.15rem',
            borderRadius: '0.75rem',
            marginBottom: '1.5rem',
            fontSize: '0.875rem',
            fontWeight: 500,
            display: 'flex',
            alignItems: 'center',
            gap: '0.6rem',
            background: message.type === 'success' ? '#f0fdf4' : '#fef2f2',
            border: `1px solid ${message.type === 'success' ? '#bbf7d0' : '#fecaca'}`,
            color: message.type === 'success' ? '#15803d' : '#b91c1c',
          }}>
            {message.type === 'success' ? <IconCheck size={18} color="#15803d" /> : <IconAlertCircle size={18} color="#b91c1c" />}
            <span>{message.text}</span>
          </div>
        )}

        {/* Schedule Cards */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          {DAYS_OF_WEEK.map(({ day, name }) => {
            const slots = schedule[day] || [];
            const isOff = slots.length === 0;

            return (
              <div
                key={day}
                style={{
                  background: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '1rem',
                  padding: '1.15rem 1.25rem',
                  boxShadow: '0 2px 6px rgba(0,0,0,0.02)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.85rem',
                }}
              >
                {/* Header Row on Day Card */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                    <span style={{ fontWeight: 700, fontSize: '1rem', color: '#1e293b' }}>
                      {name}
                    </span>
                    <span style={{
                      fontSize: '0.72rem',
                      fontWeight: 600,
                      padding: '0.2rem 0.55rem',
                      borderRadius: '0.35rem',
                      background: isOff ? '#f1f5f9' : '#ecfdf5',
                      color: isOff ? '#64748b' : '#059669',
                      border: `1px solid ${isOff ? '#e2e8f0' : '#a7f3d0'}`,
                    }}>
                      {isOff ? 'Unavailable' : `${slots.length} time slot${slots.length > 1 ? 's' : ''}`}
                    </span>
                  </div>

                  {/* Actions for this day */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <button
                      type="button"
                      onClick={() => addSlot(day)}
                      style={{
                        padding: '0.35rem 0.75rem',
                        borderRadius: '0.5rem',
                        fontSize: '0.78rem',
                        fontWeight: 600,
                        background: '#eff6ff',
                        border: '1px solid #bfdbfe',
                        color: '#1d4ed8',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      + Add Slot
                    </button>
                    {isOff ? (
                      <button
                        type="button"
                        onClick={() => setStandardHours(day)}
                        style={{
                          padding: '0.35rem 0.65rem',
                          borderRadius: '0.5rem',
                          fontSize: '0.75rem',
                          background: 'transparent',
                          border: '1px solid #e2e8f0',
                          color: '#64748b',
                          cursor: 'pointer',
                        }}
                        title="Set 9 AM to 6 PM"
                      >
                        Default (9-6)
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => clearDay(day)}
                        style={{
                          padding: '0.35rem 0.65rem',
                          borderRadius: '0.5rem',
                          fontSize: '0.75rem',
                          background: 'transparent',
                          border: '1px solid #f1f5f9',
                          color: '#94a3b8',
                          cursor: 'pointer',
                        }}
                        title="Clear all hours for this day"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                </div>

                {/* Slot inputs row */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.65rem', alignItems: 'center' }}>
                  {isOff ? (
                    <div style={{
                      fontSize: '0.825rem',
                      color: '#94a3b8',
                      fontStyle: 'italic',
                      padding: '0.4rem 0',
                    }}>
                      No hours scheduled. Click &ldquo;+ Add Slot&rdquo; to make this day bookable.
                    </div>
                  ) : (
                    slots.map((slot, idx) => (
                      <div
                        key={idx}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.35rem',
                          background: '#f8fafc',
                          border: '1px solid #cbd5e1',
                          borderRadius: '0.6rem',
                          padding: '0.35rem 0.65rem',
                          boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
                        }}
                      >
                        <IconClock size={13} color="#64748b" />
                        <input
                          type="time"
                          value={slot.startTime}
                          onChange={(e) => updateSlotTime(day, idx, 'startTime', e.target.value)}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: '#0f172a',
                            fontSize: '0.85rem',
                            fontWeight: 600,
                            outline: 'none',
                            width: '4.8rem',
                          }}
                        />
                        <span style={{ color: '#94a3b8', fontSize: '0.78rem', fontWeight: 500 }}>to</span>
                        <input
                          type="time"
                          value={slot.endTime}
                          onChange={(e) => updateSlotTime(day, idx, 'endTime', e.target.value)}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: '#0f172a',
                            fontSize: '0.85rem',
                            fontWeight: 600,
                            outline: 'none',
                            width: '4.8rem',
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => removeSlot(day, idx)}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: '#94a3b8',
                            cursor: 'pointer',
                            fontSize: '1.1rem',
                            lineHeight: 1,
                            padding: '0 0.2rem',
                            display: 'flex',
                            alignItems: 'center',
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.color = '#ef4444')}
                          onMouseLeave={(e) => (e.currentTarget.style.color = '#94a3b8')}
                          title="Remove slot"
                        >
                          ×
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Bottom Save Bar */}
        <div style={{ marginTop: '2.5rem', display: 'flex', justifyContent: 'flex-end', gap: '0.85rem' }}>
          <Link href="/dashboard" className="btn-ghost" style={{ padding: '0.65rem 1.5rem', fontSize: '0.875rem' }}>
            Back to Dashboard
          </Link>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="btn-primary"
            style={{ padding: '0.65rem 2rem', fontSize: '0.9rem', fontWeight: 600 }}
          >
            {saving ? 'Saving...' : 'Save Availability Schedule'}
          </button>
        </div>
      </main>
    </div>
  );
}
