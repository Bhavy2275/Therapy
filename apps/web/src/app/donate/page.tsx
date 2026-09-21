'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { IconHeart, IconShield, IconCheck, IconCopy } from '@/components/Icons';

interface PlatformSettings {
  upi_id: string;
  upi_name: string;
  upi_qr_url: string;
  donation_note: string;
}

const DEFAULT_SETTINGS: PlatformSettings = {
  upi_id: 'jarwishelpme@upi',
  upi_name: 'Jarwis Help Me Foundation',
  upi_qr_url: '',
  donation_note:
    'This platform is 100% free. Your voluntary UPI donation helps keep it running and supports therapists who give their time for free.',
};

export default function DonatePage() {
  const [settings, setSettings] = useState<PlatformSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch('/api/admin/platform-settings')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) {
          setSettings({
            upi_id: data.upi_id || DEFAULT_SETTINGS.upi_id,
            upi_name: data.upi_name || DEFAULT_SETTINGS.upi_name,
            upi_qr_url: data.upi_qr_url || '',
            donation_note: data.donation_note || DEFAULT_SETTINGS.donation_note,
          });
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  function copyUpiId() {
    navigator.clipboard.writeText(settings.upi_id).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div style={{ minHeight: '100vh', position: 'relative', background: '#f8f9fa' }}>
      <div className="mesh-bg" />

      {/* Navigation */}
      <nav style={{
        position: 'sticky', top: 0, zIndex: 50,
        borderBottom: '1px solid #e2e8f0',
        background: 'rgba(255, 255, 255, 0.95)',
        backdropFilter: 'blur(16px)',
      }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '3.75rem' }}>
          <Link href="/" style={{ textDecoration: 'none', flexShrink: 0 }}>
            <span style={{ fontSize: '1.15rem', fontWeight: 800 }}>
              <span className="gradient-text">Jarwis</span>{' '}
              <span style={{ color: '#1e293b' }}>Help Me!</span>
            </span>
          </Link>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Link href="/dashboard" className="btn-ghost" style={{ padding: '0.4rem 0.85rem', fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
              Dashboard
            </Link>
            <Link href="/dashboard/session/new" className="btn-primary" style={{ padding: '0.45rem 1rem', fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
              Find Help Now
            </Link>
          </div>
        </div>
      </nav>

      <main style={{ maxWidth: 720, margin: '0 auto', padding: '2.5rem 1.25rem 5rem' }}>
        {/* Header */}
        <div className="fade-in-up" style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: '0.45rem',
            background: 'rgba(99, 102, 241, 0.08)', border: '1px solid rgba(99, 102, 241, 0.2)',
            color: 'hsl(var(--accent))', padding: '0.35rem 0.9rem', borderRadius: '2rem',
            fontSize: '0.85rem', fontWeight: 600, marginBottom: '1.25rem',
          }}>
            <IconHeart size={16} color="hsl(var(--accent))" />
            <span>Voluntary Support — 100% Free Platform</span>
          </div>
          <h1 style={{ fontSize: 'clamp(1.75rem, 5vw, 2.5rem)', fontWeight: 800, color: '#0f172a', marginBottom: '0.75rem', letterSpacing: '-0.02em', lineHeight: 1.2 }}>
            Support Our <span className="gradient-text">Free Mission</span>
          </h1>
          <p style={{ color: '#64748b', fontSize: '0.975rem', maxWidth: 540, margin: '0 auto', lineHeight: 1.65 }}>
            {settings.donation_note}
          </p>
        </div>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem 0' }}>
            <div className="spinner" style={{ width: 36, height: 36 }} />
          </div>
        ) : (
          <div className="fade-in-up">
            {/* UPI Card */}
            <div style={{
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '1.25rem',
              padding: 'clamp(1.5rem, 4vw, 2.5rem)',
              textAlign: 'center',
              boxShadow: '0 10px 30px rgba(0,0,0,0.04)',
              marginBottom: '1.5rem',
            }}>
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
                background: '#f0fdf4', border: '1px solid #bbf7d0',
                color: '#15803d', padding: '0.3rem 0.8rem', borderRadius: '2rem',
                fontSize: '0.78rem', fontWeight: 700, marginBottom: '1.75rem',
                textTransform: 'uppercase', letterSpacing: '0.04em',
              }}>
                <IconCheck size={13} color="#15803d" />
                UPI Instant Payment · Zero Fees
              </div>

              {/* QR Code section */}
              {settings.upi_qr_url ? (
                <div style={{ marginBottom: '1.75rem' }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={settings.upi_qr_url}
                    alt="UPI QR Code"
                    style={{
                      width: 220,
                      height: 220,
                      objectFit: 'contain',
                      borderRadius: '1rem',
                      border: '1px solid #e2e8f0',
                      padding: '0.5rem',
                      background: '#fff',
                      margin: '0 auto',
                    }}
                  />
                  <p style={{ color: '#64748b', fontSize: '0.85rem', marginTop: '0.75rem' }}>
                    Scan with any UPI app — GPay, PhonePe, Paytm, BHIM
                  </p>
                </div>
              ) : (
                <div style={{
                  maxWidth: 240,
                  margin: '0 auto 1.75rem',
                  padding: '1.5rem 1rem',
                  borderRadius: '1rem',
                  border: '1.5px dashed #cbd5e1',
                  background: '#f8fafc',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.75rem',
                }}>
                  <div style={{
                    width: 56,
                    height: 56,
                    borderRadius: '50%',
                    background: '#e0e7ff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'hsl(var(--accent))',
                    fontSize: '1.5rem',
                  }}>
                    💳
                  </div>
                  <div style={{ fontWeight: 600, fontSize: '0.9rem', color: '#1e293b' }}>
                    Scan & Pay via UPI
                  </div>
                  <p style={{ fontSize: '0.78rem', color: '#64748b', margin: 0 }}>
                    Use the UPI ID below in any payment app
                  </p>
                </div>
              )}

              {/* UPI ID Copy Row */}
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '0.75rem',
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '0.75rem',
                padding: '0.75rem 1.15rem',
                marginBottom: '1.5rem',
                width: '100%',
                maxWidth: 420,
              }}>
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Official UPI ID
                  </div>
                  <div style={{ fontWeight: 700, fontSize: '1rem', color: '#0f172a', fontFamily: 'monospace' }}>
                    {settings.upi_id}
                  </div>
                  {settings.upi_name && (
                    <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.1rem' }}>
                      {settings.upi_name}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={copyUpiId}
                  style={{
                    background: copied ? '#f0fdf4' : '#eff6ff',
                    border: `1px solid ${copied ? '#bbf7d0' : '#bfdbfe'}`,
                    color: copied ? '#15803d' : '#1d4ed8',
                    borderRadius: '0.5rem',
                    padding: '0.45rem 0.85rem',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    flexShrink: 0,
                  }}
                  title="Copy UPI ID"
                >
                  {copied ? <IconCheck size={14} color="#15803d" /> : <IconCopy size={14} color="#1d4ed8" />}
                  {copied ? 'Copied!' : 'Copy'}
                </button>
              </div>

              {/* Step-by-step instructions */}
              <div style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '0.85rem',
                padding: '1.15rem 1.25rem',
                textAlign: 'left',
                maxWidth: 480,
                margin: '0 auto',
              }}>
                <div style={{ fontWeight: 600, fontSize: '0.875rem', color: '#1e293b', marginBottom: '0.75rem' }}>
                  How to send voluntary support:
                </div>
                {[
                  'Open Google Pay, PhonePe, Paytm, or BHIM',
                  `Enter or paste UPI ID: ${settings.upi_id}`,
                  'Enter any voluntary amount to support our free volunteers',
                  'Confirm and complete payment with zero fees',
                ].map((step, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.65rem', marginBottom: i < 3 ? '0.5rem' : 0 }}>
                    <div style={{
                      width: 20, height: 20, borderRadius: '50%',
                      background: '#eff6ff', border: '1px solid #bfdbfe',
                      color: '#1d4ed8', fontSize: '0.7rem', fontWeight: 700,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0, marginTop: '0.15rem',
                    }}>
                      {i + 1}
                    </div>
                    <span style={{ color: '#334155', fontSize: '0.825rem', lineHeight: 1.45 }}>{step}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Values */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
              {[
                { icon: '🔒', title: 'Zero Data Stored', desc: 'We never see or store any personal banking data.' },
                { icon: '💯', title: 'Fully Voluntary', desc: 'No paywalls. The platform will always remain free.' },
                { icon: '❤️', title: 'Direct Impact', desc: 'Every rupee helps sustain free help and counselling for all.' },
              ].map((v) => (
                <div
                  key={v.title}
                  className="glass"
                  style={{ borderRadius: '1rem', padding: '1.25rem', textAlign: 'center' }}
                >
                  <div style={{ fontSize: '1.5rem', marginBottom: '0.4rem' }}>{v.icon}</div>
                  <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#1e293b', marginBottom: '0.25rem' }}>{v.title}</div>
                  <div style={{ fontSize: '0.8rem', color: '#64748b', lineHeight: 1.45 }}>{v.desc}</div>
                </div>
              ))}
            </div>

            <div style={{ textAlign: 'center', marginTop: '2rem' }}>
              <Link href="/dashboard" className="btn-ghost" style={{ padding: '0.6rem 1.5rem', fontSize: '0.85rem' }}>
                ← Back to Dashboard
              </Link>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
