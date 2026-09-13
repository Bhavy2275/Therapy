import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import TherapistPresenceBar from '@/components/TherapistPresenceBar';
import IncomingOfferModal from '@/components/IncomingOfferModal';
import {
  IconBolt,
  IconCalendar,
  IconClipboard,
  IconClock,
  IconAlertCircle,
  IconCheck,
  IconIdCard,
  IconRadio,
  IconSettings,
  IconVideo,
  IconMic,
  IconMessageSquare,
} from '@/components/Icons';

export const metadata: Metadata = { title: 'Dashboard — Jarwis Help Me!' };

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatCountdown(scheduledAt: string): string {
  const diff = new Date(scheduledAt).getTime() - Date.now();
  if (diff <= 0) return 'Starting now';
  const h = Math.floor(diff / 3_600_000);
  const m = Math.floor((diff % 3_600_000) / 60_000);
  if (h > 0) return `in ${h}h ${m}m`;
  return `in ${m} min`;
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  // Fetch role from public.users
  const { data: existingUser } = await supabase
    .from('users')
    .select('role, full_name')
    .eq('id', user.id)
    .single();

  let userRow = existingUser;
  if (!userRow) {
    const metaRole = (user.user_metadata?.role as 'client' | 'therapist' | 'admin') || 'client';
    const metaName = user.user_metadata?.full_name || user.email || 'User';
    const metaTz = user.user_metadata?.timezone || 'UTC';

    const { data: createdUser } = await supabase
      .from('users')
      .upsert({
        id: user.id,
        email: user.email!,
        role: metaRole,
        full_name: metaName,
        timezone: metaTz,
      })
      .select('role, full_name')
      .single();

    if (metaRole === 'therapist') {
      await supabase.from('therapist_profiles').upsert({ user_id: user.id });
    } else if (metaRole === 'client') {
      await supabase.from('client_profiles').upsert({ user_id: user.id });
    }
    userRow = createdUser ?? { role: metaRole, full_name: metaName };
  }

  const role = userRow?.role ?? 'client';
  const name = userRow?.full_name ?? user.email ?? 'User';

  let therapistStatus: 'pending' | 'approved' | 'rejected' | 'suspended' = 'pending';
  let therapistNote: string | null = null;

  if (role === 'therapist') {
    const { data: tp } = await supabase
      .from('therapist_profiles')
      .select('status, admin_note')
      .eq('user_id', user.id)
      .single();
    if (tp) {
      therapistStatus = tp.status ?? 'pending';
      therapistNote = tp.admin_note ?? null;
    }
  }

  // Fetch the next upcoming session for client
  let nextSession: {
    id: string;
    scheduled_at: string;
    type: string;
    therapist: { full_name: string } | null;
  } | null = null;

  if (role === 'client') {
    const { data: upcoming } = await supabase
      .from('sessions')
      .select('id, scheduled_at, type, therapist:therapist_id(full_name)')
      .eq('client_id', user.id)
      .in('status', ['accepted', 'pending'])
      .gt('scheduled_at', new Date().toISOString())
      .order('scheduled_at', { ascending: true })
      .limit(1)
      .single();

    if (upcoming) {
      const therapistData = upcoming.therapist;
      const therapistObj = Array.isArray(therapistData)
        ? (therapistData[0] as { full_name: string } | null)
        : (therapistData as { full_name: string } | null);
      nextSession = {
        id: upcoming.id,
        scheduled_at: upcoming.scheduled_at,
        type: upcoming.type as string,
        therapist: therapistObj,
      };
    }
  }

  return (
    <div style={{ minHeight: '100vh', position: 'relative', background: '#f8f9fa' }}>
      <div className="mesh-bg" />

      {/* Nav */}
      <nav style={{
        position: 'sticky', top: 0, zIndex: 50,
        borderBottom: '1px solid #e2e8f0',
        background: 'rgba(255, 255, 255, 0.92)',
        backdropFilter: 'blur(16px)',
      }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '4rem' }}>
          <span style={{ fontSize: '1.25rem', fontWeight: 800 }}>
            <span className="gradient-text">Jarwis</span>{' '}
            <span style={{ color: '#1e293b' }}>Help Me!</span>
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            {role === 'admin' && (
              <Link
                href="/admin"
                style={{
                  padding: '0.45rem 1rem',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  background: '#eff6ff',
                  color: '#1d4ed8',
                  border: '1px solid #bfdbfe',
                  borderRadius: '0.5rem',
                  textDecoration: 'none',
                }}
              >
                Admin Portal
              </Link>
            )}
            <Link href="/donate" className="btn-secondary" style={{ padding: '0.45rem 1rem', fontSize: '0.85rem' }}>
              Support Mission
            </Link>
            <Link
              href="/dashboard/settings"
              className="btn-ghost"
              style={{ padding: '0.45rem 0.65rem', display: 'flex', alignItems: 'center' }}
              title="Account Settings"
            >
              <IconSettings size={18} color="#64748b" />
            </Link>
            <form action="/api/auth/logout" method="POST">
              <button type="submit" className="btn-ghost" style={{ padding: '0.45rem 1.1rem', fontSize: '0.875rem' }}>
                Sign Out
              </button>
            </form>
          </div>
        </div>
      </nav>

      <main style={{ maxWidth: 1200, margin: '0 auto', padding: '3rem 1.5rem' }}>
        {/* Welcome */}
        <div className="fade-in-up" style={{ marginBottom: '2rem' }}>
          <h1 style={{ fontSize: '2rem', fontWeight: 700, marginBottom: '0.5rem', color: '#1e293b' }}>
            Welcome, <span className="gradient-text">{name}</span>
          </h1>
          <p style={{ color: '#64748b' }}>
            You are signed in as a{' '}
            <span style={{
              background: 'rgba(132, 169, 140, 0.15)', color: '#2d5a3c',
              padding: '0.2rem 0.6rem', borderRadius: '0.35rem', fontSize: '0.85rem',
              border: '1px solid rgba(132, 169, 140, 0.35)', fontWeight: 600,
            }}>
              {role}
            </span>
          </p>
        </div>

        {/* Dashboards */}
        {role === 'client' && <ClientDashboard nextSession={nextSession} />}
        {role === 'therapist' && (
          <TherapistDashboard status={therapistStatus} note={therapistNote} />
        )}
        {role === 'admin' && <AdminDashboard />}
      </main>
    </div>
  );
}

// ─── Next Session Widget ───────────────────────────────────────────────────────

function NextSessionWidget({
  session,
}: {
  session: { id: string; scheduled_at: string; type: string; therapist: { full_name: string } | null };
}) {
  const modalityIcon =
    session.type === 'video' ? <IconVideo size={18} color="#3b82f6" /> :
    session.type === 'voice' ? <IconMic size={18} color="#3b82f6" /> :
    <IconMessageSquare size={18} color="#3b82f6" />;

  const countdown = formatCountdown(session.scheduled_at);
  const isImminent = new Date(session.scheduled_at).getTime() - Date.now() < 60 * 60 * 1000;

  return (
    <div
      className="fade-in-up"
      style={{
        background: '#ffffff',
        border: `1px solid ${isImminent ? 'rgba(59,130,246,0.4)' : '#e2e8f0'}`,
        boxShadow: isImminent
          ? '0 0 0 3px rgba(59,130,246,0.08), 0 4px 16px rgba(59,130,246,0.1)'
          : '0 2px 12px -2px rgba(100,116,139,0.07)',
        borderRadius: '1rem',
        padding: '1.25rem 1.5rem',
        marginBottom: '2rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '1rem',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <div style={{
          width: 44, height: 44, borderRadius: '50%',
          background: 'rgba(59,130,246,0.1)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          {modalityIcon}
        </div>
        <div>
          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#3b82f6', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.2rem' }}>
            Next Scheduled Session
          </div>
          <div style={{ fontWeight: 600, color: '#1e293b', fontSize: '0.95rem' }}>
            {session.therapist?.full_name ?? 'Your Therapist'}
            <span style={{ marginLeft: '0.5rem', fontWeight: 400, color: '#64748b', fontSize: '0.875rem' }}>
              · {formatDateTime(session.scheduled_at)}
            </span>
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <span style={{
          background: isImminent ? 'rgba(59,130,246,0.12)' : '#f1f5f9',
          color: isImminent ? '#1d4ed8' : '#64748b',
          border: `1px solid ${isImminent ? 'rgba(59,130,246,0.25)' : '#e2e8f0'}`,
          borderRadius: '0.45rem', padding: '0.25rem 0.75rem',
          fontSize: '0.8rem', fontWeight: 600,
        }}>
          <IconClock size={12} style={{ verticalAlign: 'middle', marginRight: '0.3rem' }} />
          {countdown}
        </span>
        <Link
          href={`/dashboard/session/${session.id}`}
          className="btn-primary"
          style={{ padding: '0.5rem 1.25rem', fontSize: '0.85rem' }}
        >
          Enter Room →
        </Link>
      </div>
    </div>
  );
}

// ─── Client Dashboard ─────────────────────────────────────────────────────────

function ClientDashboard({
  nextSession,
}: {
  nextSession: { id: string; scheduled_at: string; type: string; therapist: { full_name: string } | null } | null;
}) {
  return (
    <div>
      {nextSession && <NextSessionWidget session={nextSession} />}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem' }}>
        <DashCard
          icon={<IconBolt size={26} color="#3b82f6" />}
          title="Instant Session"
          desc="Connect with a verified, active therapist right now via our live matching radar."
          badge="Live Matching"
          href="/dashboard/session/new"
          badgeColor="#10b981"
        />
        <DashCard
          icon={<IconCalendar size={26} color="#3b82f6" />}
          title="Schedule Session"
          desc="Browse verified therapists and book a 45-minute session at a reserved calendar slot."
          badge="Active"
          href="/dashboard/schedule"
          badgeColor="#8b5cf6"
        />
        <DashCard
          icon={<IconClipboard size={26} color="#3b82f6" />}
          title="My Sessions"
          desc="View your upcoming consultations, past session history, and therapist notes."
          badge="Active"
          href="/dashboard/sessions"
          badgeColor="#3b82f6"
        />
        <DashCard
          icon={<IconSettings size={26} color="#64748b" />}
          title="Account Settings"
          desc="Update your display name, timezone, and sign out of your account."
          badge="Settings"
          href="/dashboard/settings"
          badgeColor="#64748b"
        />
      </div>
    </div>
  );
}

// ─── Therapist Dashboard ──────────────────────────────────────────────────────

function TherapistDashboard({
  status,
  note,
}: {
  status: 'pending' | 'approved' | 'rejected' | 'suspended';
  note: string | null;
}) {
  return (
    <div>
      {/* Onboarding / Verification Banner */}
      <div style={{ marginBottom: '1.75rem' }}>
        {status === 'pending' && (
          <div style={{
            background: 'rgba(245, 158, 11, 0.1)',
            border: '1px solid rgba(245, 158, 11, 0.25)',
            borderRadius: '0.85rem',
            padding: '1.25rem 1.5rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '1rem',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
              <IconClock size={28} color="#d97706" />
              <div>
                <div style={{ fontWeight: 600, color: '#b45309' }}>Profile Verification in Review</div>
                <div style={{ fontSize: '0.85rem', color: '#64748b' }}>
                  Our team is verifying your license. You can complete your weekly schedule in the meantime.
                </div>
              </div>
            </div>
            <Link href="/dashboard/therapist/profile" className="btn-primary" style={{ padding: '0.45rem 1rem', fontSize: '0.85rem' }}>
              Edit Credentials
            </Link>
          </div>
        )}

        {status === 'rejected' && (
          <div style={{
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.25)',
            borderRadius: '0.85rem',
            padding: '1.25rem 1.5rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '1rem',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
              <IconAlertCircle size={28} color="#dc2626" />
              <div>
                <div style={{ fontWeight: 600, color: '#dc2626' }}>Action Required: Update Verification Info</div>
                <div style={{ fontSize: '0.85rem', color: '#64748b' }}>
                  {note || 'Additional information or a clearer license document is required to approve your account.'}
                </div>
              </div>
            </div>
            <Link href="/dashboard/therapist/profile" className="btn-primary" style={{ padding: '0.45rem 1rem', fontSize: '0.85rem' }}>
              Update Profile
            </Link>
          </div>
        )}

        {status === 'approved' && (
          <div style={{
            background: 'rgba(16, 185, 129, 0.1)',
            border: '1px solid rgba(16, 185, 129, 0.25)',
            borderRadius: '0.85rem',
            padding: '1rem 1.25rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
          }}>
            <IconCheck size={22} color="#059669" />
            <span style={{ fontSize: '0.875rem', color: '#047857', fontWeight: 500 }}>
              Verified Therapist — Your profile is active and ready for client matching.
            </span>
          </div>
        )}
      </div>

      <IncomingOfferModal />
      {status === 'approved' && <TherapistPresenceBar />}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem' }}>
        <DashCard
          icon={<IconIdCard size={26} color="#3b82f6" />}
          title="My Profile & Credentials"
          desc="Update your professional bio, clinical specialties, and uploaded license documentation."
          badge="Active"
          href="/dashboard/therapist/profile"
          badgeColor="#3b82f6"
        />
        <DashCard
          icon={<IconCalendar size={26} color="#3b82f6" />}
          title="Weekly Availability"
          desc="Configure recurring weekly working hours and time slots for advance client bookings."
          badge="Active"
          href="/dashboard/therapist/schedule"
          badgeColor="#10b981"
        />
        <DashCard
          icon={<IconRadio size={26} color="#10b981" />}
          title="Live Presence Radar"
          desc="Toggle your real-time status in the control bar above to receive instant client session requests."
          badge={status === 'approved' ? 'Online Ready' : 'Pending Verification'}
          badgeColor={status === 'approved' ? '#10b981' : '#f59e0b'}
        />
        <DashCard
          icon={<IconClipboard size={26} color="#3b82f6" />}
          title="My Sessions"
          desc="Review active consultations, upcoming bookings, past sessions, and clinical notes."
          badge="Active"
          href="/dashboard/sessions"
          badgeColor="#3b82f6"
        />
        <DashCard
          icon={<IconSettings size={26} color="#64748b" />}
          title="Account Settings"
          desc="Update your display name, timezone, and sign out of your account."
          badge="Settings"
          href="/dashboard/settings"
          badgeColor="#64748b"
        />
      </div>
    </div>
  );
}

function AdminDashboard() {
  return (
    <div className="fade-in-up">
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
        <div
          style={{
            borderRadius: '1rem',
            padding: '2rem',
            border: '2px solid #3b82f6',
            background: '#ffffff',
            boxShadow: '0 4px 14px rgba(59, 130, 246, 0.08)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
            <IconIdCard size={28} color="#3b82f6" />
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, color: '#1e293b' }}>
              Therapist Verification Portal
            </h2>
          </div>
          <p style={{ color: '#64748b', fontSize: '0.9rem', lineHeight: 1.6, marginBottom: '1.5rem' }}>
            Review pending therapist applicants, inspect submitted medical licenses, and approve or reject clinical credentials.
          </p>
          <Link
            href="/admin"
            className="btn-primary"
            style={{
              padding: '0.65rem 1.5rem',
              fontSize: '0.9rem',
              fontWeight: 600,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              background: '#3b82f6',
              color: '#ffffff',
              borderRadius: '0.5rem',
              textDecoration: 'none',
            }}
          >
            <span>Open Admin Portal</span>
            <span>→</span>
          </Link>
        </div>

        <DashCard
          icon={<IconClipboard size={26} color="#3b82f6" />}
          title="All Platform Sessions"
          desc="Monitor live video/audio/chat consultations and session history across all users."
          badge="Active"
          href="/dashboard/sessions"
          badgeColor="#3b82f6"
        />

        <DashCard
          icon={<IconSettings size={26} color="#64748b" />}
          title="Platform & Account Settings"
          desc="Manage your admin account details, timezone, and security configurations."
          badge="Settings"
          href="/dashboard/settings"
          badgeColor="#64748b"
        />
      </div>
    </div>
  );
}

// ─── DashCard ─────────────────────────────────────────────────────────────────

function DashCard({
  icon,
  title,
  desc,
  badge,
  href,
  badgeColor = '#4b5563',
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  badge: string;
  href?: string;
  badgeColor?: string;
}) {
  const content = (
    <div className="glass" style={{
      borderRadius: '1rem', padding: '1.75rem',
      opacity: href ? 1 : 0.75,
      transition: 'all 0.2s',
      height: '100%',
      cursor: href ? 'pointer' : 'default',
    }}>
      <div style={{ marginBottom: '0.75rem' }}>{icon}</div>
      <h2 style={{ fontWeight: 600, marginBottom: '0.4rem', fontSize: '1rem', color: '#1e293b' }}>{title}</h2>
      <p style={{ color: '#64748b', fontSize: '0.875rem', lineHeight: 1.6, marginBottom: '1rem' }}>{desc}</p>
      <span style={{
        display: 'inline-block',
        background: href ? `${badgeColor}15` : '#f1f5f9',
        border: `1px solid ${href ? `${badgeColor}40` : '#e2e8f0'}`,
        borderRadius: '0.35rem', padding: '0.2rem 0.6rem',
        fontSize: '0.75rem', color: href ? badgeColor : '#64748b',
        fontWeight: href ? 600 : 400,
      }}>
        {badge}
      </span>
    </div>
  );

  if (href) {
    return (
      <Link href={href} style={{ textDecoration: 'none' }}>
        {content}
      </Link>
    );
  }

  return content;
}
