import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Sign In — Jarwis Help Me!',
};

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        fontFamily: 'var(--font-body)',
      }}
    >
      {/* ── Left decorative panel ─────────────────────────────────────── */}
      <div
        style={{
          display: 'none',
          flex: '0 0 45%',
          background: 'hsl(var(--foreground))',
          position: 'relative',
          overflow: 'hidden',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '3rem',
        }}
        className="auth-left-panel"
      >
        {/* Subtle gradient orb */}
        <div
          style={{
            position: 'absolute',
            top: '-6rem',
            right: '-6rem',
            width: '28rem',
            height: '28rem',
            borderRadius: '50%',
            background: 'hsl(var(--accent) / 0.18)',
            filter: 'blur(64px)',
            pointerEvents: 'none',
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: '-4rem',
            left: '-4rem',
            width: '22rem',
            height: '22rem',
            borderRadius: '50%',
            background: 'hsl(var(--accent) / 0.1)',
            filter: 'blur(48px)',
            pointerEvents: 'none',
          }}
        />

        {/* Brand */}
        <div style={{ position: 'relative', zIndex: 1 }}>
          <span style={{ fontSize: '1.4rem', fontWeight: 800, color: '#ffffff', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <span style={{ color: 'hsl(var(--accent))', fontSize: '1.1rem' }}>✦</span>
            <span>Jarwis</span>
            <span style={{ opacity: 0.7 }}>Help Me!</span>
          </span>
        </div>

        {/* Hero copy */}
        <div style={{ position: 'relative', zIndex: 1 }}>
          <h2
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: '2.6rem',
              fontWeight: 400,
              color: '#ffffff',
              lineHeight: 1.15,
              marginBottom: '1.25rem',
              letterSpacing: '-0.02em',
            }}
          >
            HELP Available,{' '}
            <em style={{ fontStyle: 'italic', color: 'hsl(var(--accent) / 0.85)' }}>
              right when you need it
            </em>
          </h2>
          <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.95rem', lineHeight: 1.7, maxWidth: '32ch' }}>
            Connect with verified therapists for live voice, video, or chat sessions. Free to use — supported by your generosity.
          </p>
        </div>

        {/* Trust signals */}
        <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          {[
            { icon: '✦', text: '500+ verified therapists across India & globally' },
            { icon: '✦', text: '10,000+ sessions completed' },
            { icon: '✦', text: 'End-to-end encrypted & private' },
          ].map((item) => (
            <div key={item.text} style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <span style={{ color: 'hsl(var(--accent))', fontSize: '0.7rem', flexShrink: 0 }}>{item.icon}</span>
              <span style={{ color: 'rgba(255,255,255,0.65)', fontSize: '0.875rem' }}>{item.text}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Right form panel ──────────────────────────────────────────── */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '2rem 1.5rem',
          background: 'hsl(var(--secondary))',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Subtle background pattern */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage:
              'radial-gradient(hsl(var(--accent) / 0.04) 1px, transparent 1px)',
            backgroundSize: '28px 28px',
            pointerEvents: 'none',
          }}
        />
        <div style={{ position: 'relative', zIndex: 1, width: '100%', display: 'flex', justifyContent: 'center' }}>
          {children}
        </div>
      </div>

      {/* ── Responsive: show left panel on md+ ───────────────────────── */}
      <style>{`
        @media (min-width: 768px) {
          .auth-left-panel { display: flex !important; }
        }
      `}</style>
    </div>
  );
}
