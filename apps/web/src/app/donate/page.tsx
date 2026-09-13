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
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '4rem' }}>
          <Link href="/" style={{ textDecoration: 'none' }}>
            <span style={{ fontSize: '1.25rem', fontWeight: 800 }}>
              <span className="gradient-text">Jarwis</span>{' '}
              <span style={{ color: '#1e293b' }}>Help Me!</span>
            </span>
          </Link>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <Link href="/dashboard" className="btn-ghost" style={{ padding: '0.45rem 1rem', fontSize: '0.85rem' }}>
              Dashboard
            </Link>
            <Link href="/dashboard/session/new" className="btn-primary" style={{ padding: '0.45rem 1.15rem', fontSize: '0.85rem' }}>
              Find Help Now
            </Link>
          </div>
        </div>
      </nav>

      <main style={{ maxWidth: 720, margin: '0 auto', padding: '3.5rem 1.5rem 6rem' }}>
        {/* Header */}
        <div className="fade-in-up" style={{ textAlign: 'center', marginBottom: '3rem' }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: '0.45rem',
            background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.25)',
            color: '#dc2626', padding: '0.35rem 0.9rem', borderRadius: '2rem',
            fontSize: '0.85rem', fontWeight: 600, marginBottom: '1.25rem',
          }}>
            <IconHeart size={16} color="#dc2626" />
            <span>Voluntary Support — 100% Free Platform</span>
          </div>
          <h1 style={{ fontSize: '2.25rem', fontWeight: 800, color: '#1e293b', marginBottom: '0.75rem', letterSpacing: '-0.02em' }}>
            Support Our <span className="gradient-text">Free Mission</span>
          </h1>
          <p style={{ color: '#64748b', fontSize: '1rem', maxWidth: 540, margin: '0 auto', lineHeight: 1.65 }}>
            {settings.donation_note}
          </p>
        </div>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem 0' }}>
            <div className="spinner" style={{ width: 36, height: 36 }} />
          </div>
        ) : (
          <div className="fade-in-up">
            {/* UPI QR Card */}
            <div style={{
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '1.5rem',
              padding: '2.5rem',
              textAlign: 'center',
              boxShadow: '0 10px 30px rgba(0,0,0,0.05)',
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

              {/* QR Code */}
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
                    }}
                  />
                  <p style={{ color: '#64748b', fontSize: '0.85rem', marginTop: '0.75rem' }}>
                    Scan with any UPI app — GPay, PhonePe, Paytm, BHIM
                  </p>
                </div>
              ) : (
                <div style={{
                  width: 220,
                  height: 220,
                  margin: '0 auto 1.75rem',
                  borderRadius: '1rem',
                  border: '2px dashed #e2e8f0',
                  background: '#f8fafc',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#94a3b8',
                  fontSize: '0.85rem',
                  gap: '0.5rem',
                }}>
                  <span style={{ fontSize: '2rem' }}>📱</span>
                  <span>QR Code coming soon</span>
                </div>
              )}

              {/* UPI ID Copy Row */}
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.75rem',
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '0.75rem',
                padding: '0.85rem 1.25rem',
                marginBottom: '1.5rem',
              }}>
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontSize: '0.72rem', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    UPI ID
                  </div>
                  <div style={{ fontWeight: 700, fontSize: '1.05rem', color: '#0f172a', fontFamily: 'monospace' }}>
                    {settings.upi_id}
                  </div>
                  {settings.upi_name && (
                    <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '0.15rem' }}>
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
                    padding: '0.5rem 0.85rem',
                    fontSize: '0.825rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    display: 'flex',
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
                borderRadius: '1rem',
                padding: '1.25rem 1.5rem',
                textAlign: 'left',
              }}>
                <div style={{ fontWeight: 600, fontSize: '0.9rem', color: '#1e293b', marginBottom: '0.85rem' }}>
                  How to donate via UPI:
                </div>
                {[
                  'Open any UPI app — Google Pay, PhonePe, Paytm, or BHIM',
                  `Scan the QR code above, or search UPI ID: ${settings.upi_id}`,
                  'Enter any amount you wish to contribute',
                  'Add a note (optional) and complete the payment',
                ].map((step, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', marginBottom: i < 3 ? '0.65rem' : 0 }}>
                    <div style={{
                      width: 22, height: 22, borderRadius: '50%',
                      background: '#eff6ff', border: '1px solid #bfdbfe',
                      color: '#1d4ed8', fontSize: '0.72rem', fontWeight: 700,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0, marginTop: '0.1rem',
                    }}>
                      {i + 1}
                    </div>
                    <span style={{ color: '#334155', fontSize: '0.875rem', lineHeight: 1.5 }}>{step}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Values */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
              {[
                { icon: '🔒', title: 'Zero Data Stored', desc: 'We never see your UPI transaction details.' },
                { icon: '💯', title: 'Fully Voluntary', desc: 'No pressure. The platform is always free.' },
                { icon: '❤️', title: 'Direct Impact', desc: 'Every rupee supports free therapy access in India.' },
              ].map((v) => (
                <div
                  key={v.title}
                  className="glass"
                  style={{ borderRadius: '1rem', padding: '1.5rem', textAlign: 'center' }}
                >
                  <div style={{ fontSize: '1.75rem', marginBottom: '0.5rem' }}>{v.icon}</div>
                  <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#1e293b', marginBottom: '0.35rem' }}>{v.title}</div>
                  <div style={{ fontSize: '0.825rem', color: '#64748b', lineHeight: 1.5 }}>{v.desc}</div>
                </div>
              ))}
            </div>

            <div style={{ textAlign: 'center', marginTop: '2.5rem' }}>
              <Link href="/dashboard" className="btn-ghost" style={{ padding: '0.65rem 1.75rem', fontSize: '0.9rem' }}>
                ← Back to Dashboard
              </Link>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
