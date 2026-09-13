'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import {
  IconClock,
  IconCheck,
  IconAlertCircle,
  IconUser,
  IconIdCard,
  IconSearch,
  IconFile,
  IconX,
  IconQrCode,
} from '@/components/Icons';

type TherapistStatus = 'pending' | 'approved' | 'rejected' | 'suspended';

interface TherapistItem {
  userId: string;
  fullName: string;
  email: string;
  timezone: string;
  bio: string;
  licenseNumber: string;
  licenseDocumentUrl?: string | null;
  licenseDocumentDownloadUrl?: string | null;
  yearsOfExperience: number;
  hourlyRateUsd?: number | null;
  specializations: string[];
  languages: string[];
  status: TherapistStatus;
  adminNote?: string | null;
  createdAt: string;
}

const DEMO_THERAPISTS: TherapistItem[] = [
  {
    userId: 'demo-1',
    fullName: 'Dr. Ananya Sharma',
    email: 'dr.ananya@mindbridge.com',
    timezone: 'Asia/Kolkata',
    bio: 'Licensed clinical psychologist with 9+ years experience specializing in CBT, chronic anxiety, and work-related burnout.',
    licenseNumber: 'RCI-CR-2018-98421',
    licenseDocumentUrl: 'licenses/ananya-license.pdf',
    licenseDocumentDownloadUrl: 'https://example.com/license-ananya.pdf',
    yearsOfExperience: 9,
    hourlyRateUsd: 65,
    specializations: ['Anxiety & Panic', 'Depression', 'CBT', 'Stress & Burnout'],
    languages: ['English', 'Hindi'],
    status: 'pending',
    adminNote: null,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 4).toISOString(), // 4h ago
  },
  {
    userId: 'demo-2',
    fullName: 'Marcus Vance, LMFT',
    email: 'marcus.vance@mindbridge.com',
    timezone: 'America/New_York',
    bio: 'Licensed Marriage and Family Therapist. Passionate about couples communication, emotional regulation, and family systems therapy.',
    licenseNumber: 'NY-LMFT-0081294',
    licenseDocumentUrl: 'licenses/marcus-credentials.pdf',
    licenseDocumentDownloadUrl: 'https://example.com/license-marcus.pdf',
    yearsOfExperience: 6,
    hourlyRateUsd: 80,
    specializations: ['Couples & Marriage', 'Family Dynamics', 'Trauma & PTSD'],
    languages: ['English', 'Spanish'],
    status: 'pending',
    adminNote: null,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 18).toISOString(), // 18h ago
  },
  {
    userId: 'demo-3',
    fullName: 'Dr. Priya Nair',
    email: 'priya.nair@mindbridge.com',
    timezone: 'Asia/Kolkata',
    bio: 'Consultant Clinical Psychologist with specialization in adolescent mental health, ADHD neurodivergence, and mindfulness-based interventions.',
    licenseNumber: 'RCI-CR-2015-44120',
    licenseDocumentUrl: 'licenses/priya-rci.pdf',
    licenseDocumentDownloadUrl: 'https://example.com/license-priya.pdf',
    yearsOfExperience: 12,
    hourlyRateUsd: 90,
    specializations: ['ADHD & Neurodivergence', 'Mindfulness & Somatics', 'Depression'],
    languages: ['English', 'Hindi', 'Malayalam'],
    status: 'approved',
    adminNote: 'License verified via RCI registry.',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 72).toISOString(),
  },
  {
    userId: 'demo-4',
    fullName: 'Alex Chen',
    email: 'alex.chen@mindbridge.com',
    timezone: 'Europe/London',
    bio: 'Integrative counselor focusing on life transitions and grief support.',
    licenseNumber: 'BACP-PENDING-99',
    licenseDocumentUrl: null,
    yearsOfExperience: 2,
    hourlyRateUsd: 50,
    specializations: ['Grief & Bereavement', 'Life Transitions'],
    languages: ['English'],
    status: 'rejected',
    adminNote: 'Submitted document was unreadable. Please upload an official BACP certificate with visible registration number.',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 96).toISOString(),
  },
];

interface PlatformSettings {
  upi_id: string;
  upi_name: string;
  upi_qr_url: string;
  donation_note: string;
}

export default function AdminPage() {
  const [loading, setLoading] = useState(true);
  const [therapists, setTherapists] = useState<TherapistItem[]>([]);
  const [activeTab, setActiveTab] = useState<'all' | TherapistStatus>('pending');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTherapist, setSelectedTherapist] = useState<TherapistItem | null>(null);
  const [modalAction, setModalAction] = useState<'approve' | 'reject' | 'suspend' | null>(null);
  const [adminNoteInput, setAdminNoteInput] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [toast, setToast] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // UPI Settings state
  const [upiSettings, setUpiSettings] = useState<PlatformSettings>({
    upi_id: '',
    upi_name: '',
    upi_qr_url: '',
    donation_note: '',
  });
  const [upiLoading, setUpiLoading] = useState(true);
  const [upiSaving, setUpiSaving] = useState(false);

  useEffect(() => {
    loadTherapists();
    loadUpiSettings();
  }, []);

  async function loadUpiSettings() {
    try {
      const res = await fetch('/api/admin/platform-settings');
      if (res.ok) {
        const data = await res.json();
        setUpiSettings({
          upi_id: data.upi_id || '',
          upi_name: data.upi_name || '',
          upi_qr_url: data.upi_qr_url || '',
          donation_note: data.donation_note || '',
        });
      }
    } catch {
      // use defaults
    } finally {
      setUpiLoading(false);
    }
  }

  async function saveUpiSettings() {
    setUpiSaving(true);
    try {
      const res = await fetch('/api/admin/platform-settings/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings: upiSettings }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'Failed to save');
      }
      setToast({ text: 'UPI settings saved successfully!', type: 'success' });
      setTimeout(() => setToast(null), 3500);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Save failed';
      setToast({ text: msg, type: 'error' });
      setTimeout(() => setToast(null), 4000);
    } finally {
      setUpiSaving(false);
    }
  }

  async function loadTherapists() {
    setLoading(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('therapist_profiles')
        .select(`
          user_id,
          bio,
          license_number,
          license_document_url,
          specializations,
          languages,
          years_of_experience,
          status,
          admin_note,
          hourly_rate_usd,
          created_at,
          users!inner (
            full_name,
            email,
            timezone
          )
        `)
        .order('created_at', { ascending: false });

      if (error || !data || data.length === 0) {
        setTherapists(DEMO_THERAPISTS);
      } else {
        const mapped: TherapistItem[] = await Promise.all(
          data.map(async (row: any) => {
            const userObj = Array.isArray(row.users) ? row.users[0] : row.users;
            let licenseDocumentDownloadUrl: string | null = null;
            if (row.license_document_url) {
              const { data: signed } = await supabase.storage
                .from('therapist-documents')
                .createSignedUrl(row.license_document_url, 3600);
              licenseDocumentDownloadUrl = signed?.signedUrl ?? null;
            }

            return {
              userId: row.user_id,
              fullName: (userObj as { full_name?: string })?.full_name || 'Therapist',
              email: (userObj as { email?: string })?.email || '',
              timezone: (userObj as { timezone?: string })?.timezone || 'UTC',
              bio: row.bio || '',
              licenseNumber: row.license_number || '',
              licenseDocumentUrl: row.license_document_url,
              licenseDocumentDownloadUrl,
              yearsOfExperience: row.years_of_experience || 0,
              hourlyRateUsd: row.hourly_rate_usd,
              specializations: row.specializations || [],
              languages: row.languages || [],
              status: row.status as TherapistStatus,
              adminNote: row.admin_note,
              createdAt: row.created_at,
            };
          }),
        );
        setTherapists(mapped);
      }
    } catch {
      setTherapists(DEMO_THERAPISTS);
    } finally {
      setLoading(false);
    }
  }

  const counts = useMemo(() => {
    return {
      all: therapists.length,
      pending: therapists.filter((t) => t.status === 'pending').length,
      approved: therapists.filter((t) => t.status === 'approved').length,
      rejected: therapists.filter((t) => t.status === 'rejected').length,
      suspended: therapists.filter((t) => t.status === 'suspended').length,
    };
  }, [therapists]);

  const filteredTherapists = useMemo(() => {
    return therapists.filter((t) => {
      const matchesTab = activeTab === 'all' || t.status === activeTab;
      const q = searchQuery.toLowerCase();
      const matchesSearch =
        !q ||
        t.fullName.toLowerCase().includes(q) ||
        t.email.toLowerCase().includes(q) ||
        t.licenseNumber.toLowerCase().includes(q) ||
        t.specializations.some((s) => s.toLowerCase().includes(q));
      return matchesTab && matchesSearch;
    });
  }, [therapists, activeTab, searchQuery]);

  function openActionModal(therapist: TherapistItem, action: 'approve' | 'reject' | 'suspend') {
    setSelectedTherapist(therapist);
    setModalAction(action);
    setAdminNoteInput(
      action === 'approve'
        ? 'Credentials verified and approved for clinical practice.'
        : action === 'reject'
        ? 'Please provide an updated, unexpired official license document.'
        : 'Account temporarily suspended pending review.',
    );
  }

  async function handleConfirmVerification() {
    if (!selectedTherapist || !modalAction) return;

    if (modalAction === 'reject' && !adminNoteInput.trim()) {
      setToast({ text: 'Please enter a note explaining the rejection reason to the therapist.', type: 'error' });
      return;
    }

    setActionLoading(true);
    const newStatus: TherapistStatus =
      modalAction === 'approve' ? 'approved' : modalAction === 'reject' ? 'rejected' : 'suspended';

    try {
      if (!selectedTherapist.userId.startsWith('demo-')) {
        const res = await fetch('/api/admin/therapist-status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: selectedTherapist.userId,
            status: newStatus,
            adminNote: adminNoteInput,
          }),
        });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error ?? 'Failed to update therapist status');
        }
      }

      setTherapists((prev) =>
        prev.map((t) =>
          t.userId === selectedTherapist.userId
            ? { ...t, status: newStatus, adminNote: adminNoteInput }
            : t,
        ),
      );

      setToast({
        text: `Therapist ${selectedTherapist.fullName} status updated to ${newStatus}.`,
        type: 'success',
      });
      setSelectedTherapist(null);
      setModalAction(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Action failed';
      setToast({ text: msg, type: 'error' });
    } finally {
      setActionLoading(false);
      setTimeout(() => setToast(null), 4000);
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f8f9fa', color: '#1e293b' }}>
      {/* Nav */}
      <nav
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 50,
          borderBottom: '1px solid #e2e8f0',
          background: 'rgba(255, 255, 255, 0.95)',
          backdropFilter: 'blur(16px)',
        }}
      >
        <div
          style={{
            maxWidth: 1200,
            margin: '0 auto',
            padding: '0 1.5rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            height: '4rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <span style={{ fontSize: '1.25rem', fontWeight: 800 }}>
              <span style={{ color: '#3b82f6' }}>Jarwis</span>{' '}
              <span style={{ color: '#1e293b' }}>Help Me!</span>
            </span>
            <span
              style={{
                background: '#eff6ff',
                border: '1px solid #bfdbfe',
                color: '#1d4ed8',
                fontSize: '0.75rem',
                fontWeight: 600,
                padding: '0.15rem 0.6rem',
                borderRadius: '0.35rem',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
              }}
            >
              Admin Portal
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <Link
              href="/dashboard"
              className="btn-ghost"
              style={{ padding: '0.45rem 1rem', fontSize: '0.85rem', color: '#64748b' }}
            >
              Dashboard View
            </Link>
            <form action="/api/auth/logout" method="POST">
              <button
                type="submit"
                className="btn-ghost"
                style={{ padding: '0.45rem 1rem', fontSize: '0.85rem', color: '#64748b' }}
              >
                Sign Out
              </button>
            </form>
          </div>
        </div>
      </nav>

      <main style={{ maxWidth: 1200, margin: '0 auto', padding: '2.5rem 1.5rem 5rem' }}>
        {/* Header */}
        <div style={{ marginBottom: '2rem' }}>
          <h1 style={{ fontSize: '2rem', fontWeight: 700, marginBottom: '0.4rem', color: '#1e293b' }}>
            Admin <span style={{ color: '#3b82f6' }}>Control Centre</span>
          </h1>
          <p style={{ color: '#64748b', fontSize: '0.95rem' }}>
            Manage therapist verification, platform donation settings, and real-time configuration.
          </p>
        </div>

        {/* UPI / Donation Settings Panel */}
        <div style={{
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '1rem',
          padding: '1.75rem 2rem',
          marginBottom: '2.5rem',
          boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
            <IconQrCode size={22} color="#7c3aed" />
            <div>
              <h2 style={{ fontWeight: 700, fontSize: '1.1rem', color: '#1e293b', margin: 0 }}>Donation UPI Settings</h2>
              <p style={{ margin: 0, fontSize: '0.825rem', color: '#64748b', marginTop: '0.1rem' }}>Changes here instantly update the /donate page for all users.</p>
            </div>
          </div>

          {upiLoading ? (
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', color: '#94a3b8', fontSize: '0.9rem' }}>
              <div className="spinner" style={{ width: 20, height: 20 }} />
              Loading settings...
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.25rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#374151', marginBottom: '0.4rem' }}>
                  UPI ID <span style={{ color: '#dc2626' }}>*</span>
                </label>
                <input
                  type="text"
                  className="input"
                  value={upiSettings.upi_id}
                  onChange={(e) => setUpiSettings((s) => ({ ...s, upi_id: e.target.value }))}
                  placeholder="yourname@upi"
                  style={{ fontFamily: 'monospace', fontSize: '0.95rem' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#374151', marginBottom: '0.4rem' }}>
                  UPI Account Name
                </label>
                <input
                  type="text"
                  className="input"
                  value={upiSettings.upi_name}
                  onChange={(e) => setUpiSettings((s) => ({ ...s, upi_name: e.target.value }))}
                  placeholder="Foundation or personal name shown on UPI"
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#374151', marginBottom: '0.4rem' }}>
                  QR Code Image URL
                </label>
                <input
                  type="url"
                  className="input"
                  value={upiSettings.upi_qr_url}
                  onChange={(e) => setUpiSettings((s) => ({ ...s, upi_qr_url: e.target.value }))}
                  placeholder="https://... (paste a public image link)"
                />
                <p style={{ margin: '0.3rem 0 0', fontSize: '0.76rem', color: '#94a3b8' }}>
                  Upload your QR to Supabase Storage or any CDN and paste the public URL here.
                </p>
              </div>

              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#374151', marginBottom: '0.4rem' }}>
                  Donation Page Message
                </label>
                <textarea
                  className="input"
                  rows={2}
                  value={upiSettings.donation_note}
                  onChange={(e) => setUpiSettings((s) => ({ ...s, donation_note: e.target.value }))}
                  placeholder="Short message displayed on the /donate page..."
                />
              </div>

              <div style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={saveUpiSettings}
                  disabled={upiSaving}
                  className="btn-primary"
                  style={{ padding: '0.65rem 1.75rem', fontWeight: 600 }}
                >
                  {upiSaving ? 'Saving...' : '💾 Save UPI Settings'}
                </button>
                {upiSettings.upi_qr_url && (
                  <a
                    href={upiSettings.upi_qr_url}
                    target="_blank"
                    rel="noreferrer"
                    style={{ color: '#7c3aed', fontSize: '0.85rem', fontWeight: 500 }}
                  >
                    Preview QR ↗
                  </a>
                )}
                <a
                  href="/donate"
                  target="_blank"
                  rel="noreferrer"
                  style={{ color: '#2563eb', fontSize: '0.85rem', fontWeight: 500 }}
                >
                  Preview Donate Page ↗
                </a>
              </div>
            </div>
          )}
        </div>

        {/* Therapist Verification Header */}
        <div style={{ marginBottom: '1.5rem' }}>
          <h2 style={{ fontSize: '1.35rem', fontWeight: 700, marginBottom: '0.3rem', color: '#1e293b' }}>
            Therapist <span style={{ color: '#3b82f6' }}>Verification Queue</span>
          </h2>
          <p style={{ color: '#64748b', fontSize: '0.875rem' }}>
            Review submitted credentials, verify active professional clinical licenses, and manage therapist admission.
          </p>
        </div>

        {/* Toast Alert */}
        {toast && (
          <div
            style={{
              position: 'fixed',
              bottom: '2rem',
              right: '2rem',
              zIndex: 100,
              padding: '1rem 1.5rem',
              borderRadius: '0.75rem',
              background: toast.type === 'success' ? '#065f46' : '#991b1b',
              border: `1px solid ${toast.type === 'success' ? '#059669' : '#dc2626'}`,
              color: '#ffffff',
              fontSize: '0.9rem',
              fontWeight: 500,
              boxShadow: '0 10px 25px -5px rgba(0,0,0,0.15)',
            }}
          >
            {toast.text}
          </div>
        )}

        {/* Stat Cards */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '1rem',
            marginBottom: '2rem',
          }}
        >
          <StatCard
            label="Pending Review"
            count={counts.pending}
            color="#b45309"
            bg="#fef3c7"
            border="#fde68a"
            icon={<IconClock size={24} color="#b45309" />}
          />
          <StatCard
            label="Approved & Active"
            count={counts.approved}
            color="#15803d"
            bg="#dcfce7"
            border="#bbf7d0"
            icon={<IconCheck size={24} color="#15803d" />}
          />
          <StatCard
            label="Changes Requested"
            count={counts.rejected}
            color="#dc2626"
            bg="#fee2e2"
            border="#fecaca"
            icon={<IconAlertCircle size={24} color="#dc2626" />}
          />
          <StatCard
            label="Total Applicants"
            count={counts.all}
            color="#1d4ed8"
            bg="#eff6ff"
            border="#bfdbfe"
            icon={<IconUser size={24} color="#1d4ed8" />}
          />
        </div>

        {/* Filter Controls Bar */}
        <div
          style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '0.85rem',
            padding: '1rem 1.25rem',
            marginBottom: '1.5rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '1rem',
            boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
          }}
        >
          {/* Tabs */}
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {(['pending', 'approved', 'rejected', 'all'] as const).map((tab) => {
              const active = activeTab === tab;
              const count = tab === 'all' ? counts.all : counts[tab];
              return (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  style={{
                    padding: '0.45rem 1rem',
                    borderRadius: '0.5rem',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    background: active ? '#3b82f6' : '#f1f5f9',
                    border: active ? '1px solid #3b82f6' : '1px solid #e2e8f0',
                    color: active ? '#ffffff' : '#64748b',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.45rem',
                  }}
                >
                  <span style={{ textTransform: 'capitalize' }}>{tab}</span>
                  <span
                    style={{
                      background: active ? 'rgba(255,255,255,0.25)' : '#e2e8f0',
                      color: active ? '#ffffff' : '#475569',
                      borderRadius: '1rem',
                      padding: '0.05rem 0.45rem',
                      fontSize: '0.725rem',
                      fontWeight: 700,
                    }}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Search box */}
          <div style={{ minWidth: 260 }}>
            <input
              type="text"
              className="input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name, email, license, specialty..."
              style={{ padding: '0.45rem 0.9rem', fontSize: '0.85rem' }}
            />
          </div>
        </div>

        {/* Therapist Queue Table / Cards */}
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem 0' }}>
            <div className="spinner" style={{ width: 36, height: 36 }} />
          </div>
        ) : filteredTherapists.length === 0 ? (
          <div
            style={{
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '0.85rem',
              padding: '3.5rem 2rem',
              textAlign: 'center',
            }}
          >
            <div style={{ marginBottom: '0.5rem', color: '#64748b', display: 'flex', justifyContent: 'center' }}>
              <IconSearch size={40} color="#94a3b8" />
            </div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '0.25rem', color: '#1e293b' }}>
              No therapists found
            </h3>
            <p style={{ color: '#64748b', fontSize: '0.875rem' }}>
              No applicants match the current filter or search criteria.
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {filteredTherapists.map((therapist) => (
              <TherapistQueueCard
                key={therapist.userId}
                therapist={therapist}
                onApprove={() => openActionModal(therapist, 'approve')}
                onReject={() => openActionModal(therapist, 'reject')}
                onSuspend={() => openActionModal(therapist, 'suspend')}
              />
            ))}
          </div>
        )}

        {/* Verification Action Modal */}
        {modalAction && selectedTherapist && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 100,
              background: 'rgba(0,0,0,0.5)',
              backdropFilter: 'blur(4px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '1.5rem',
            }}
          >
            <div
              style={{
                maxWidth: 540,
                width: '100%',
                borderRadius: '1.25rem',
                padding: '2rem',
                border: '1px solid #e2e8f0',
                background: '#ffffff',
                boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '1.25rem',
                }}
              >
                <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#1e293b', margin: 0 }}>
                  {modalAction === 'approve' && 'Approve Therapist'}
                  {modalAction === 'reject' && 'Request Changes / Decline'}
                  {modalAction === 'suspend' && 'Suspend Account'}
                </h3>

                <button
                  type="button"
                  onClick={() => {
                    setSelectedTherapist(null);
                    setModalAction(null);
                  }}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#64748b',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                  }}
                >
                  <IconX size={20} color="#64748b" />
                </button>
              </div>

              <div
                style={{
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '0.75rem',
                  padding: '1rem',
                  marginBottom: '1.25rem',
                }}
              >
                <div style={{ fontWeight: 600, color: '#1e293b' }}>{selectedTherapist.fullName}</div>
                <div style={{ fontSize: '0.85rem', color: '#64748b' }}>{selectedTherapist.email}</div>
                <div style={{ fontSize: '0.825rem', color: '#3b82f6', marginTop: '0.35rem', fontWeight: 500 }}>
                  License: {selectedTherapist.licenseNumber || 'Not submitted'}
                </div>
              </div>

              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', color: '#64748b', marginBottom: '0.5rem', fontWeight: 500 }}>
                  {modalAction === 'reject' ? 'Rejection Reason (Visible to Therapist) *' : 'Reviewer Note (Optional)'}
                </label>
                <textarea
                  className="input"
                  rows={3}
                  value={adminNoteInput}
                  onChange={(e) => setAdminNoteInput(e.target.value)}
                  placeholder="Enter notes on credential verification or requested changes..."
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedTherapist(null);
                    setModalAction(null);
                  }}
                  className="btn-ghost"
                  style={{ padding: '0.6rem 1.25rem', fontSize: '0.875rem' }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmVerification}
                  disabled={actionLoading}
                  style={{
                    padding: '0.6rem 1.5rem',
                    borderRadius: '0.6rem',
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    border: 'none',
                    color: '#ffffff',
                    background:
                      modalAction === 'approve'
                        ? '#059669'
                        : modalAction === 'reject'
                        ? '#dc2626'
                        : '#64748b',
                  }}
                >
                  {actionLoading
                    ? 'Processing...'
                    : modalAction === 'approve'
                    ? 'Confirm Approval'
                    : modalAction === 'reject'
                    ? 'Confirm Rejection'
                    : 'Confirm Suspension'}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function StatCard({
  label,
  count,
  color,
  bg,
  border,
  icon,
}: {
  label: string;
  count: number;
  color: string;
  bg: string;
  border: string;
  icon: React.ReactNode;
}) {
  return (
    <div
      style={{
        borderRadius: '0.85rem',
        padding: '1.25rem 1.5rem',
        background: bg,
        border: `1px solid ${border}`,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>{icon}</div>
        <span style={{ fontSize: '1.75rem', fontWeight: 700, color }}>{count}</span>
      </div>
      <div style={{ fontSize: '0.825rem', color: '#64748b', marginTop: '0.5rem', fontWeight: 500 }}>
        {label}
      </div>
    </div>
  );
}

function TherapistQueueCard({
  therapist,
  onApprove,
  onReject,
  onSuspend,
}: {
  therapist: TherapistItem;
  onApprove: () => void;
  onReject: () => void;
  onSuspend: () => void;
}) {
  const statusBadge = {
    pending: { label: 'Pending Verification', bg: '#fef3c7', text: '#b45309', border: '#fde68a' },
    approved: { label: 'Approved Therapist', bg: '#dcfce7', text: '#15803d', border: '#bbf7d0' },
    rejected: { label: 'Action Required', bg: '#fee2e2', text: '#dc2626', border: '#fecaca' },
    suspended: { label: 'Suspended', bg: '#f1f5f9', text: '#64748b', border: '#e2e8f0' },
  }[therapist.status];

  return (
    <div
      style={{
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '1rem',
        padding: '1.5rem',
        display: 'grid',
        gridTemplateColumns: '1fr auto',
        gap: '1.5rem',
        alignItems: 'start',
        boxShadow: '0 2px 6px rgba(0,0,0,0.02)',
      }}
    >
      <div>
        {/* Header line */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '0.4rem' }}>
          <span style={{ fontSize: '1.15rem', fontWeight: 700, color: '#1e293b' }}>
            {therapist.fullName}
          </span>
          <span
            style={{
              background: statusBadge.bg,
              color: statusBadge.text,
              border: `1px solid ${statusBadge.border}`,
              padding: '0.15rem 0.55rem',
              borderRadius: '1rem',
              fontSize: '0.75rem',
              fontWeight: 600,
            }}
          >
            {statusBadge.label}
          </span>
          <span style={{ color: '#64748b', fontSize: '0.8rem' }}>• {therapist.email}</span>
          <span style={{ color: '#64748b', fontSize: '0.8rem' }}>• {therapist.timezone}</span>
        </div>

        {/* License & Experience info */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', fontSize: '0.85rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
          <span style={{ color: '#3b82f6', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
            <IconIdCard size={15} color="#3b82f6" />
            <span>License: <strong>{therapist.licenseNumber || 'None'}</strong></span>
          </span>
          <span style={{ color: '#64748b', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
            <IconClock size={15} color="#64748b" />
            <span>Experience: <strong>{therapist.yearsOfExperience} yrs</strong></span>
          </span>
          {therapist.hourlyRateUsd && (
            <span style={{ color: '#64748b' }}>
              Rate: <strong>${therapist.hourlyRateUsd}/hr</strong>
            </span>
          )}
          {therapist.languages.length > 0 && (
            <span style={{ color: '#64748b' }}>
              Languages: {therapist.languages.join(', ')}
            </span>
          )}
        </div>

        {/* Bio */}
        {therapist.bio && (
          <p style={{ color: '#334155', fontSize: '0.875rem', lineHeight: 1.55, marginBottom: '0.75rem' }}>
            {therapist.bio}
          </p>
        )}

        {/* Specializations */}
        {therapist.specializations.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '0.75rem' }}>
            {therapist.specializations.map((spec) => (
              <span
                key={spec}
                style={{
                  background: '#f1f5f9',
                  border: '1px solid #e2e8f0',
                  padding: '0.15rem 0.55rem',
                  borderRadius: '0.35rem',
                  fontSize: '0.75rem',
                  color: '#475569',
                  fontWeight: 500,
                }}
              >
                {spec}
              </span>
            ))}
          </div>
        )}

        {/* Attached Document & Admin Note */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap', fontSize: '0.8rem' }}>
          {therapist.licenseDocumentUrl ? (
            <a
              href={therapist.licenseDocumentDownloadUrl || '#'}
              target="_blank"
              rel="noreferrer"
              style={{
                color: '#2563eb',
                textDecoration: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                background: '#eff6ff',
                padding: '0.25rem 0.65rem',
                borderRadius: '0.35rem',
                border: '1px solid #bfdbfe',
                fontWeight: 500,
              }}
            >
              <IconFile size={14} color="#2563eb" style={{ verticalAlign: 'middle' }} />
              <span>View License Document</span>
              <span>↗</span>
            </a>
          ) : (
            <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>No document uploaded</span>
          )}

          {therapist.adminNote && (
            <span style={{ color: '#b91c1c' }}>
              <strong>Admin Note:</strong> {therapist.adminNote}
            </span>
          )}
        </div>
      </div>

      {/* Action Buttons */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', minWidth: 130 }}>
        {therapist.status !== 'approved' && (
          <button
            type="button"
            onClick={onApprove}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: '0.5rem',
              fontSize: '0.825rem',
              fontWeight: 600,
              background: '#059669',
              color: '#ffffff',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.35rem',
            }}
          >
            <IconCheck size={14} color="#ffffff" />
            <span>Approve</span>
          </button>
        )}

        {therapist.status !== 'rejected' && (
          <button
            type="button"
            onClick={onReject}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: '0.5rem',
              fontSize: '0.825rem',
              fontWeight: 600,
              background: '#fef2f2',
              border: '1px solid #fecaca',
              color: '#dc2626',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.35rem',
            }}
          >
            <IconX size={14} color="#dc2626" />
            <span>Reject</span>
          </button>
        )}

        {therapist.status === 'approved' && (
          <button
            type="button"
            onClick={onSuspend}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: '0.5rem',
              fontSize: '0.825rem',
              fontWeight: 500,
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              color: '#64748b',
              cursor: 'pointer',
            }}
          >
            Suspend
          </button>
        )}
      </div>
    </div>
  );
}
