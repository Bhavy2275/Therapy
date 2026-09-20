import type { Metadata } from 'next';
import Link from 'next/link';
import {
  IconBolt,
  IconVideo,
  IconCheck,
  IconCalendar,
  IconGlobe,
  IconShield,
} from '@/components/Icons';

export const metadata: Metadata = {
  title: 'Jarwis Help Me! — Connect With a Therapist Instantly',
};

const features = [
  {
    icon: <IconBolt size={26} color="#3b82f6" />,
    title: 'Instant Matching',
    desc: 'Request a session and get matched with an available therapist in under a minute.',
  },
  {
    icon: <IconVideo size={26} color="#3b82f6" />,
    title: 'Voice, Video & Chat',
    desc: 'Choose how you want to connect — private video, voice-only, or text chat.',
  },
  {
    icon: <IconCheck size={26} color="#84a98c" />,
    title: 'Verified Therapists',
    desc: 'Every therapist is manually reviewed and license-verified by our team.',
  },
  {
    icon: <IconCalendar size={26} color="#3b82f6" />,
    title: 'Schedule Ahead',
    desc: 'Book a session in advance when you prefer a specific therapist or time.',
  },
  {
    icon: <IconGlobe size={26} color="#3b82f6" />,
    title: 'India & Global',
    desc: 'Therapists and clients from India and across the world, multiple languages supported.',
  },
  {
    icon: <IconShield size={26} color="#3b82f6" />,
    title: 'Private & Secure',
    desc: 'End-to-end encrypted sessions. Your conversations stay between you and your therapist.',
  },
];

const stats = [
  { value: '500+', label: 'Verified Therapists' },
  { value: '10k+', label: 'Sessions Completed' },
  { value: '4.9 / 5', label: 'Client Satisfaction' },
  { value: '24/7', label: 'Real-Time Availability' },
];

export default function LandingPage() {
  return (
    <div style={{ minHeight: '100vh', position: 'relative', overflow: 'hidden', background: '#f8f9fa' }}>
      {/* ── Nav ──────────────────────────────────────────────────────────── */}
      <nav style={{
        position: 'sticky', top: 0, zIndex: 50,
        borderBottom: '1px solid #e2e8f0',
        background: 'rgba(255, 255, 255, 0.92)',
        backdropFilter: 'blur(16px)',
      }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '4rem' }}>
          <span style={{ fontSize: '1.35rem', fontWeight: 800, letterSpacing: '-0.02em' }}>
            <span className="gradient-text">Jarwis</span>{' '}
            <span style={{ color: '#1e293b' }}>Help Me!</span>
          </span>
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <Link href="/donate" className="btn-secondary" style={{ padding: '0.45rem 1rem', fontSize: '0.85rem' }}>
              Support Mission
            </Link>
            <Link href="/login/client" className="btn-ghost" style={{ padding: '0.45rem 1rem', fontSize: '0.85rem' }}>
              Client Login
            </Link>
            <Link href="/login/therapist" className="btn-ghost" style={{ padding: '0.45rem 1rem', fontSize: '0.85rem', color: '#6366f1' }}>
              Therapist Portal
            </Link>
            <Link href="/register" className="btn-primary" style={{ padding: '0.45rem 1.15rem', fontSize: '0.85rem' }}>
              Get Started
            </Link>
          </div>

        </div>
      </nav>

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section style={{ maxWidth: 1200, margin: '0 auto', padding: '6rem 1.5rem 5rem', textAlign: 'center' }}>
        <div className="fade-in-up">
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
            background: '#ffffff', border: '1px solid #e2e8f0',
            borderRadius: '2rem', padding: '0.4rem 1.1rem', marginBottom: '2rem',
            fontSize: '0.875rem', color: '#64748b',
            boxShadow: '0 2px 8px rgba(100, 116, 139, 0.06)',
          }}>
            <span style={{ color: '#3b82f6', fontSize: '0.75rem' }}>●</span>
            <span>Now available in India &amp; internationally</span>
          </div>
        </div>

        <h1 className="fade-in-up delay-1" style={{ fontSize: 'clamp(2.5rem, 6vw, 4.5rem)', fontWeight: 800, lineHeight: 1.15, letterSpacing: '-0.03em', marginBottom: '1.5rem', color: '#1e293b' }}>
          Professional therapy,{' '}
          <span className="gradient-text">right when you need it</span>
        </h1>

        <p className="fade-in-up delay-2" style={{ fontSize: 'clamp(1rem, 2vw, 1.2rem)', color: '#64748b', maxWidth: 620, margin: '0 auto 2.5rem', lineHeight: 1.7 }}>
          Connect instantly with verified therapists for live voice, video, or chat sessions.
          Free to use — supported by your generosity.
        </p>

        <div className="fade-in-up delay-3" style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link href="/register?role=client" className="btn-primary" style={{ fontSize: '1rem', padding: '0.875rem 2.25rem' }}>
            I need help
          </Link>
          <Link href="/register?role=therapist" className="btn-ghost" style={{ fontSize: '1rem', padding: '0.875rem 2.25rem' }}>
            I&apos;m here to help
          </Link>
        </div>

        {/* Stats */}
        <div className="fade-in-up delay-4" style={{
          display: 'flex', justifyContent: 'center', flexWrap: 'wrap',
          gap: '2.5rem', marginTop: '4rem',
        }}>
          {stats.map((s) => (
            <div key={s.label} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '2.25rem', fontWeight: 800, letterSpacing: '-0.02em', color: '#3b82f6' }}>
                {s.value}
              </div>
              <div style={{ fontSize: '0.875rem', color: '#64748b', marginTop: '0.25rem', fontWeight: 500 }}>
                {s.label}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Features ─────────────────────────────────────────────────────── */}
      <section style={{ maxWidth: 1200, margin: '0 auto', padding: '4rem 1.5rem' }}>
        <h2 style={{ textAlign: 'center', fontSize: 'clamp(1.75rem, 4vw, 2.5rem)', fontWeight: 700, marginBottom: '0.75rem', letterSpacing: '-0.02em', color: '#1e293b' }}>
          Everything you need to feel better
        </h2>
        <p style={{ textAlign: 'center', color: '#64748b', marginBottom: '3rem', fontSize: '1.05rem' }}>
          Built for both clients and therapists, with care.
        </p>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: '1.25rem',
        }}>
          {features.map((f, i) => (
            <div key={f.title} className="feature-card fade-in-up" style={{
              borderRadius: '1rem', padding: '1.75rem',
              animationDelay: `${i * 0.07}s`,
            }}>
              <div style={{ marginBottom: '1rem' }}>{f.icon}</div>
              <h3 style={{ fontWeight: 600, marginBottom: '0.5rem', fontSize: '1.05rem', color: '#1e293b' }}>{f.title}</h3>
              <p style={{ color: '#64748b', fontSize: '0.9rem', lineHeight: 1.6 }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────────────────────── */}
      <section style={{ padding: '5rem 1.5rem' }}>
        <div style={{
          maxWidth: 720, margin: '0 auto', textAlign: 'center',
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '1.5rem', padding: '3.5rem 2rem',
          boxShadow: '0 4px 24px -2px rgba(100, 116, 139, 0.08)',
        }}>
          <h2 style={{ fontSize: 'clamp(1.75rem, 4vw, 2.25rem)', fontWeight: 700, marginBottom: '1rem', color: '#1e293b' }}>
            Ready to start your journey?
          </h2>
          <p style={{ color: '#64748b', marginBottom: '2rem', fontSize: '1.05rem' }}>
            No subscriptions. No commitments. Just connect.
          </p>
          <Link href="/register" className="btn-primary" style={{ fontSize: '1rem', padding: '0.875rem 2.5rem' }}>
            Start for Free →
          </Link>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────────────────── */}
      <footer style={{
        borderTop: '1px solid #e2e8f0',
        padding: '2.5rem 1.5rem',
        textAlign: 'center',
        color: '#64748b',
        fontSize: '0.875rem',
        background: '#ffffff',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '0.75rem',
      }}>
        <div style={{ display: 'flex', gap: '1.25rem', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center' }}>
          <Link href="/donate" style={{ color: '#3b82f6', textDecoration: 'none', fontWeight: 600 }}>
            Support Mission
          </Link>
          <span>•</span>
          <Link href="/login/client" style={{ color: '#64748b', textDecoration: 'none' }}>
            Client Login
          </Link>
          <span>•</span>
          <Link href="/login/therapist" style={{ color: '#64748b', textDecoration: 'none' }}>
            Therapist Portal
          </Link>
          <span>•</span>
          <Link href="/register" style={{ color: '#64748b', textDecoration: 'none' }}>
            Get Started
          </Link>
        </div>
        <div>
          © {new Date().getFullYear()} Jarwis Help Me!. Built with care.
        </div>
      </footer>
    </div>
  );
}

