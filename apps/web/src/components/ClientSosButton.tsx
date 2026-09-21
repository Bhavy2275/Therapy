'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { animate } from 'animejs';
import { IconAlertCircle } from '@/components/Icons';

export default function ClientSosButton() {
  const [isOpen, setIsOpen] = useState(false);
  const router = useRouter();
  const iconRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (iconRef.current) {
      animate(iconRef.current, {
        scale: [1, 1.14, 1],
        boxShadow: [
          '0 0 10px rgba(220, 38, 38, 0.4)',
          '0 0 24px rgba(220, 38, 38, 0.8)',
          '0 0 10px rgba(220, 38, 38, 0.4)',
        ],
        duration: 1400,
        loop: true,
        ease: 'inOutQuad',
      });
    }
  }, []);

  function handleConfirmSos() {
    setIsOpen(false);
    router.push('/dashboard/session/new?mode=sos');
  }

  return (
    <>
      {/* SOS Trigger Banner / Button */}
      <div
        className="p-4 sm:p-5 mb-6 sm:mb-8 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 border border-rose-400/80 shadow-[0_4px_20px_rgba(239,68,68,0.12)]"
        style={{
          background: 'linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%)',
        }}
      >
        <div className="flex items-center gap-3.5">
          <div
            ref={iconRef}
            className="w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-rose-600 flex items-center justify-center text-white text-xl sm:text-2xl shadow-md shrink-0"
          >
            🚨
          </div>
          <div>
            <div className="font-bold text-base sm:text-lg text-rose-900 mb-0.5 leading-tight">
              Immediate Mental Health Crisis / SOS
            </div>
            <div className="text-xs sm:text-sm text-rose-800 leading-snug">
              In acute distress? Broadcast an urgent SOS alert to all on-duty therapists immediately.
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="w-full sm:w-auto bg-rose-600 hover:bg-rose-700 text-white font-bold text-sm sm:text-base py-3 px-6 rounded-xl shadow-md active:scale-95 transition-all flex items-center justify-center gap-2"
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
