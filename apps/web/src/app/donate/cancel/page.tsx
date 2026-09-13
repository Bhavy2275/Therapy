'use client';

import Link from 'next/link';
import { IconHeart, IconShield } from '@/components/Icons';

export default function DonationCancelPage() {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        background: '#f8f9fa',
        padding: '2rem 1.5rem',
      }}
    >
      <div className="mesh-bg" />

      <div
        className="glass fade-in-up"
        style={{
          maxWidth: 500,
          width: '100%',
          borderRadius: '1.5rem',
          padding: '3rem 2.5rem',
          textAlign: 'center',
        }}
      >
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: '50%',
            background: 'rgba(59, 130, 246, 0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 1.5rem',
          }}
        >
          <IconHeart size={30} color="#3b82f6" />
        </div>

        <h1
          style={{
            fontSize: '1.85rem',
            fontWeight: 800,
            color: '#1e293b',
            marginBottom: '0.75rem',
          }}
        >
          No Problem At All
        </h1>

        <p
          style={{
            color: '#64748b',
            fontSize: '0.95rem',
            lineHeight: 1.6,
            marginBottom: '2rem',
          }}
        >
          Your checkout session was canceled and you were not charged. We deeply appreciate your presence on Jarwis Help Me! Whenever you are ready, our doors and community remain wide open.
        </p>

        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link
            href="/donate"
            className="btn-primary"
            style={{ padding: '0.75rem 1.75rem', fontSize: '0.95rem' }}
          >
            Try Again
          </Link>
          <Link
            href="/dashboard"
            className="btn-ghost"
            style={{ padding: '0.75rem 1.5rem', fontSize: '0.95rem' }}
          >
            Return to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
