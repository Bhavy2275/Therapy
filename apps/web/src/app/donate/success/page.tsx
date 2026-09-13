'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { IconCheck, IconHeart } from '@/components/Icons';

function SuccessContent() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('session_id') || 'Completed';
  const amountCents = parseInt(searchParams.get('amount') || '0', 10);
  const formattedAmount = amountCents > 0 ? `$${(amountCents / 100).toFixed(2)}` : null;

  return (
    <div
      className="glass fade-in-up"
      style={{
        maxWidth: 520,
        width: '100%',
        borderRadius: '1.5rem',
        padding: '3rem 2.5rem',
        textAlign: 'center',
        margin: '0 auto',
      }}
    >
      <div
        style={{
          width: 72,
          height: 72,
          borderRadius: '50%',
          background: 'rgba(16, 185, 129, 0.12)',
          border: '1px solid rgba(16, 185, 129, 0.3)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 1.5rem',
        }}
      >
        <IconCheck size={36} color="#059669" />
      </div>

      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.4rem',
          background: 'rgba(59, 130, 246, 0.1)',
          color: '#2563eb',
          padding: '0.3rem 0.8rem',
          borderRadius: '1rem',
          fontSize: '0.85rem',
          fontWeight: 600,
          marginBottom: '1rem',
        }}
      >
        <IconHeart size={15} color="#2563eb" />
        <span>Thank You for Your Kindness</span>
      </div>

      <h1
        style={{
          fontSize: '2rem',
          fontWeight: 800,
          color: '#1e293b',
          marginBottom: '0.75rem',
        }}
      >
        Your Support Has Been Received
      </h1>

      <p
        style={{
          color: '#64748b',
          fontSize: '0.95rem',
          lineHeight: 1.6,
          marginBottom: '2rem',
        }}
      >
        {formattedAmount ? `Your contribution of ${formattedAmount} ` : 'Your voluntary contribution '}
        directly ensures that someone in acute distress has access to an active, verified therapist today on Jarwis Help Me!
      </p>

      <div
        style={{
          background: '#f8f9fa',
          border: '1px solid #e2e8f0',
          borderRadius: '0.75rem',
          padding: '1rem',
          fontSize: '0.825rem',
          color: '#64748b',
          marginBottom: '2rem',
          textAlign: 'left',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
          <span>Transaction Reference</span>
          <code style={{ color: '#1e293b' }}>{sessionId.slice(0, 18)}...</code>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>Status</span>
          <span style={{ color: '#059669', fontWeight: 600 }}>Verified & Confirmed</span>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
        <Link
          href="/dashboard"
          className="btn-primary"
          style={{ padding: '0.75rem 1.75rem', fontSize: '0.95rem' }}
        >
          Go to Dashboard
        </Link>
        <Link
          href="/"
          className="btn-ghost"
          style={{ padding: '0.75rem 1.5rem', fontSize: '0.95rem' }}
        >
          Home Page
        </Link>
      </div>
    </div>
  );
}

export default function DonationSuccessPage() {
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
      <Suspense fallback={<div style={{ textAlign: 'center', color: '#64748b' }}>Confirming donation...</div>}>
        <SuccessContent />
      </Suspense>
    </div>
  );
}
