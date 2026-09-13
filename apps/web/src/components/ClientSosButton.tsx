'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { IconAlertCircle } from '@/components/Icons';

export default function ClientSosButton() {
  const [isOpen, setIsOpen] = useState(false);
  const router = useRouter();

  function handleConfirmSos() {
    setIsOpen(false);
    router.push('/dashboard/session/new?mode=sos');
  }

  return (
    <>
      {/* SOS Trigger Banner / Button */}
      <div
        style={{
          background: 'linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%)',
          border: '1.5px solid #f87171',
          borderRadius: '1rem',
          padding: '1.25rem 1.5rem',
          marginBottom: '2rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '1rem',
          boxShadow: '0 4px 20px rgba(239, 68, 68, 0.12)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: '50%',
              background: '#dc2626',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff',
              fontSize: '1.4rem',
              boxShadow: '0 0 15px rgba(220, 38, 38, 0.4)',
              flexShrink: 0,
            }}
          >
            🚨
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: '1.05rem', color: '#991b1b', marginBottom: '0.2rem' }}>
              Immediate Mental Health Crisis / SOS
            </div>
            <div style={{ fontSize: '0.85rem', color: '#7f1d1d', lineHeight: 1.4 }}>
              In acute distress? Broadcast an urgent SOS alert to all on-duty therapists immediately.
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setIsOpen(true)}
          style={{
            background: '#dc2626',
            color: '#ffffff',
            border: 'none',
            borderRadius: '0.75rem',
            padding: '0.75rem 1.5rem',
            fontSize: '0.95rem',
            fontWeight: 700,
            cursor: 'pointer',
            boxShadow: '0 4px 15px rgba(220, 38, 38, 0.35)',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem',
            transition: 'transform 0.15s ease, background 0.15s ease',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = '#b91c1c')}
          onMouseLeave={(e) => (e.currentTarget.style.background = '#dc2626')}
        >
          <span>Emergency SOS</span>
          <span>→</span>
        </button>
      </div>

      {/* Confirmation Modal */}
      {isOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 99999,
            background: 'rgba(15, 23, 42, 0.8)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1.5rem',
          }}
        >
          <div
            className="fade-in-up"
            style={{
              width: '100%',
              maxWidth: 480,
              background: '#ffffff',
              borderRadius: '1.5rem',
              padding: '2rem',
              border: '2px solid #ef4444',
              boxShadow: '0 25px 60px rgba(220, 38, 38, 0.25)',
              textAlign: 'center',
            }}
          >
            <div
              style={{
                width: 64,
                height: 64,
                borderRadius: '50%',
                background: '#fee2e2',
                color: '#dc2626',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '2rem',
                margin: '0 auto 1.25rem',
                border: '2px solid #fca5a5',
              }}
            >
              <IconAlertCircle size={32} color="#dc2626" />
            </div>

            <h3 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#991b1b', marginBottom: '0.5rem' }}>
              Confirm Emergency SOS Broadcast?
            </h3>

            <p style={{ color: '#475569', fontSize: '0.9rem', lineHeight: 1.6, marginBottom: '1.25rem' }}>
              This will immediately send a high-priority <strong>Emergency SOS</strong> notification to all on-call therapists. The first available therapist to accept will be connected with you immediately.
            </p>

            <div
              style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '0.75rem',
                padding: '0.85rem 1rem',
                marginBottom: '1.5rem',
                textAlign: 'left',
                fontSize: '0.8rem',
                color: '#64748b',
                lineHeight: 1.5,
              }}
            >
              <strong style={{ color: '#0f172a', display: 'block', marginBottom: '0.25rem' }}>
                National Crisis Helplines (India):
              </strong>
              <div>• Tele-MANAS: <strong>14416</strong> or <strong>1800-891-4416</strong> (24/7 Free)</div>
              <div>• Vandrevala Foundation: <strong>+91 9999 666 555</strong></div>
              <div>• Emergency Services: <strong>112</strong></div>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
              <button
                type="button"
                onClick={handleConfirmSos}
                style={{
                  flex: 2,
                  padding: '0.85rem 1rem',
                  fontSize: '0.95rem',
                  fontWeight: 700,
                  background: '#dc2626',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '0.75rem',
                  cursor: 'pointer',
                  boxShadow: '0 4px 15px rgba(220, 38, 38, 0.4)',
                }}
              >
                🚨 Yes, Alert Therapists Now
              </button>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="btn-ghost"
                style={{
                  flex: 1,
                  padding: '0.85rem 1rem',
                  fontSize: '0.9rem',
                  border: '1px solid #e2e8f0',
                  borderRadius: '0.75rem',
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
