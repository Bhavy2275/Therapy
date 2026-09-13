'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { IconCopy, IconGlobe } from '@/components/Icons';


interface SlotItem {
  id?: string;
  dayOfWeek: number;
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

export default function TherapistSchedulePage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [userTimezone, setUserTimezone] = useState('UTC');
  const [userId, setUserId] = useState<string | null>(null);

  // Slots map: dayOfWeek -> SlotItem[]
  const [schedule, setSchedule] = useState<Record<number, { startTime: string; endTime: string }[]>>({
    1: [{ startTime: '09:00', endTime: '13:00' }, { startTime: '14:00', endTime: '18:00' }],
    2: [{ startTime: '09:00', endTime: '13:00' }, { startTime: '14:00', endTime: '18:00' }],
    3: [{ startTime: '09:00', endTime: '13:00' }, { startTime: '14:00', endTime: '18:00' }],
    4: [{ startTime: '09:00', endTime: '13:00' }, { startTime: '14:00', endTime: '18:00' }],
    5: [{ startTime: '09:00', endTime: '13:00' }, { startTime: '14:00', endTime: '17:00' }],
    6: [{ startTime: '10:00', endTime: '14:00' }],
    0: [],
  });

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
          const map: Record<number, { startTime: string; endTime: string }[]> = {
            0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [],
          };
          for (const s of slots) {
            map[s.day_of_week].push({
              startTime: s.start_time.slice(0, 5),
              endTime: s.end_time.slice(0, 5),
            });
          }
          setSchedule(map);
        }
      }
    } catch {
      // Dev default schedule already initialized
    } finally {
      setLoading(false);
    }
  }

  function addSlot(day: number) {
    setSchedule((prev) => {
      const existing = prev[day] || [];
      const lastSlot = existing[existing.length - 1];
      const newStart = lastSlot ? lastSlot.endTime : '09:00';
      const [h, m] = newStart.split(':').map(Number);
      const newEndH = Math.min(23, h + 2);
      const newEnd = `${String(newEndH).padStart(2, '0')}:${String(m).padStart(2, '0')}`;

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
      2: [...mondaySlots.map((s) => ({ ...s }))],
      3: [...mondaySlots.map((s) => ({ ...s }))],
      4: [...mondaySlots.map((s) => ({ ...s }))],
      5: [...mondaySlots.map((s) => ({ ...s }))],
    }));
    setMessage({ type: 'success', text: 'Copied Monday schedule to Tue, Wed, Thu, and Fri!' });
  }

  function clearDay(day: number) {
    setSchedule((prev) => ({
      ...prev,
      [day]: [],
    }));
  }

  async function handleSave() {
    // Validate slots
    for (const [dayStr, slots] of Object.entries(schedule)) {
      const day = Number(dayStr);
      for (const slot of slots) {
        if (slot.endTime <= slot.startTime) {
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
      const supabase = createClient();
      if (userId && userId !== 'demo-therapist-id') {
        // Flatten slots
        const allSlots: { therapist_id: string; day_of_week: number; start_time: string; end_time: string }[] = [];
        for (const [dayStr, slots] of Object.entries(schedule)) {
          const day = Number(dayStr);
          for (const s of slots) {
            allSlots.push({
              therapist_id: userId,
              day_of_week: day,
              start_time: s.startTime,
              end_time: s.endTime,
            });
          }
        }

        // Delete existing
        await supabase.from('availability_slots').delete().eq('therapist_id', userId);

        // Insert new
        if (allSlots.length > 0) {
          const { error } = await supabase.from('availability_slots').insert(allSlots);
          if (error) throw error;
        }
      }

      setMessage({
        type: 'success',
        text: 'Weekly availability schedule saved successfully! Clients can book these slots in advance.',
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error saving schedule';
      setMessage({ type: 'error', text: msg });
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="spinner" style={{ width: 36, height: 36 }} />
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', position: 'relative' }}>
      <div className="mesh-bg" />

      {/* Nav */}
      <nav style={{
        position: 'sticky', top: 0, zIndex: 50,
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        background: 'rgba(10, 15, 30, 0.8)',
        backdropFilter: 'blur(16px)',
      }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '4rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <Link href="/dashboard" style={{ color: '#9ca3af', fontSize: '0.875rem', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              ← Dashboard
            </Link>
            <span style={{ color: 'rgba(255,255,255,0.2)' }}>/</span>
            <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>Weekly Schedule</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <button
              onClick={copyMondayToWeekdays}
              className="btn-ghost"
              style={{
                padding: '0.45rem 1rem',
                fontSize: '0.825rem',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
              }}
              title="Copy Monday hours to Tuesday through Friday"
            >
              <IconCopy size={15} />
              <span>Copy Mon → Fri</span>
            </button>

            <button
              onClick={handleSave}
              disabled={saving}
              className="btn-primary"
              style={{ padding: '0.45rem 1.25rem', fontSize: '0.85rem' }}
            >
              {saving ? 'Saving...' : 'Save Schedule'}
            </button>
          </div>
        </div>
      </nav>

      <main style={{ maxWidth: 1100, margin: '0 auto', padding: '2.5rem 1.5rem 5rem' }}>
        {/* Title */}
        <div className="fade-in-up" style={{ marginBottom: '2rem' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <h1 style={{ fontSize: '2rem', fontWeight: 700, marginBottom: '0.5rem' }}>
                Weekly <span className="gradient-text">Availability Schedule</span>
              </h1>
              <p style={{ color: '#9ca3af', fontSize: '0.95rem' }}>
                Set recurring weekly hours when clients can book therapy sessions with you in advance.
              </p>
            </div>

            <div style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '0.5rem',
              padding: '0.4rem 0.85rem',
              fontSize: '0.825rem',
              color: '#9ca3af',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
            }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}><IconGlobe size={13} /> Timezone:</span>
              <strong style={{ color: '#f3f4f6' }}>{userTimezone}</strong>
            </div>
          </div>
        </div>

        {/* Feedback message */}
        {message && (
          <div style={{
            padding: '0.85rem 1.25rem',
            borderRadius: '0.65rem',
            marginBottom: '1.5rem',
            fontSize: '0.875rem',
            background: message.type === 'success' ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
            border: `1px solid ${message.type === 'success' ? 'rgba(16,185,129,0.35)' : 'rgba(239,68,68,0.35)'}`,
            color: message.type === 'success' ? '#34d399' : '#f87171',
          }}>
            {message.text}
          </div>
        )}

        {/* Schedule Grid */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {DAYS_OF_WEEK.map(({ day, name }) => {
            const slots = schedule[day] || [];
            const isOff = slots.length === 0;

            return (
              <div
                key={day}
                className="glass"
                style={{
                  borderRadius: '0.85rem',
                  padding: '1.25rem 1.5rem',
                  display: 'grid',
                  gridTemplateColumns: '160px 1fr auto',
                  alignItems: 'center',
                  gap: '1.5rem',
                }}
              >
                {/* Day title & status */}
                <div>
                  <div style={{ fontWeight: 600, fontSize: '1rem', color: isOff ? '#6b7280' : '#f9fafb' }}>
                    {name}
                  </div>
                  <div style={{ fontSize: '0.775rem', color: isOff ? '#4b5563' : '#10b981', marginTop: '0.15rem' }}>
                    {isOff ? 'Unavailable' : `${slots.length} time slot${slots.length > 1 ? 's' : ''}`}
                  </div>
                </div>

                {/* Slot inputs */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center' }}>
                  {isOff ? (
                    <span style={{ fontSize: '0.85rem', color: '#4b5563', fontStyle: 'italic' }}>
                      No hours scheduled. Click &ldquo;Add Slot&rdquo; to enable this day.
                    </span>
                  ) : (
                    slots.map((slot, idx) => (
                      <div
                        key={idx}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.4rem',
                          background: 'rgba(255,255,255,0.04)',
                          border: '1px solid rgba(255,255,255,0.08)',
                          borderRadius: '0.5rem',
                          padding: '0.3rem 0.6rem',
                        }}
                      >
                        <input
                          type="time"
                          value={slot.startTime}
                          onChange={(e) => updateSlotTime(day, idx, 'startTime', e.target.value)}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: '#f9fafb',
                            fontSize: '0.85rem',
                            outline: 'none',
                          }}
                        />
                        <span style={{ color: '#6b7280', fontSize: '0.8rem' }}>to</span>
                        <input
                          type="time"
                          value={slot.endTime}
                          onChange={(e) => updateSlotTime(day, idx, 'endTime', e.target.value)}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: '#f9fafb',
                            fontSize: '0.85rem',
                            outline: 'none',
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => removeSlot(day, idx)}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: '#ef4444',
                            cursor: 'pointer',
                            fontSize: '1rem',
                            marginLeft: '0.2rem',
                            lineHeight: 1,
                          }}
                          title="Remove slot"
                        >
                          ×
                        </button>
                      </div>
                    ))
                  )}
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <button
                    type="button"
                    onClick={() => addSlot(day)}
                    style={{
                      padding: '0.35rem 0.75rem',
                      borderRadius: '0.4rem',
                      fontSize: '0.785rem',
                      fontWeight: 500,
                      background: 'rgba(58, 91, 239, 0.15)',
                      border: '1px solid rgba(58, 91, 239, 0.3)',
                      color: '#93c5fd',
                      cursor: 'pointer',
                    }}
                  >
                    + Add Slot
                  </button>
                  {!isOff && (
                    <button
                      type="button"
                      onClick={() => clearDay(day)}
                      style={{
                        padding: '0.35rem 0.6rem',
                        borderRadius: '0.4rem',
                        fontSize: '0.785rem',
                        background: 'transparent',
                        border: '1px solid rgba(255,255,255,0.08)',
                        color: '#6b7280',
                        cursor: 'pointer',
                      }}
                      title="Clear day hours"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Bottom Save Bar */}
        <div style={{ marginTop: '2.5rem', display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
          <Link href="/dashboard" className="btn-ghost" style={{ padding: '0.75rem 1.75rem' }}>
            Back to Dashboard
          </Link>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="btn-primary"
            style={{ padding: '0.75rem 2.25rem', fontSize: '0.95rem', fontWeight: 600 }}
          >
            {saving ? 'Saving Schedule...' : 'Save Availability Schedule'}
          </button>
        </div>
      </main>
    </div>
  );
}
