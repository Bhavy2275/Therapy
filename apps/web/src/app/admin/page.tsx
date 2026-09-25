'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import SignOutButton from '@/components/SignOutButton';
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
  IconTrash,
  IconShield,
  IconCopy,
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

interface AdminUserItem {
  id: string;
  email: string;
  fullName: string;
  role: 'client' | 'therapist' | 'admin';
  avatarUrl?: string | null;
  timezone: string;
  createdAt: string;
  therapistStatus?: string | null;
  licenseNumber?: string | null;
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
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 4).toISOString(),
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
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 18).toISOString(),
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
  const [mainSection, setMainSection] = useState<'therapists' | 'users' | 'upi'>('therapists');

  // Therapists state
  const [loading, setLoading] = useState(true);
  const [therapists, setTherapists] = useState<TherapistItem[]>([]);
  const [activeTab, setActiveTab] = useState<'all' | TherapistStatus>('pending');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTherapist, setSelectedTherapist] = useState<TherapistItem | null>(null);
  const [modalAction, setModalAction] = useState<'approve' | 'reject' | 'suspend' | null>(null);
  const [adminNoteInput, setAdminNoteInput] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [toast, setToast] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Users state
  const [usersList, setUsersList] = useState<AdminUserItem[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState<'all' | 'client' | 'therapist' | 'admin'>('all');

  // Delete user state
  const [userToDelete, setUserToDelete] = useState<{
    id: string;
    fullName: string;
    email: string;
    role?: string;
  } | null>(null);
  const [isDeletingUser, setIsDeletingUser] = useState(false);

  // UPI Settings state
  const [upiSettings, setUpiSettings] = useState<PlatformSettings>({
    upi_id: '',
    upi_name: '',
    upi_qr_url: '',
    donation_note: '',
  });
  const [upiLoading, setUpiLoading] = useState(true);
  const [upiSaving, setUpiSaving] = useState(false);
  const [qrUploading, setQrUploading] = useState(false);
  const [copiedUpi, setCopiedUpi] = useState(false);
  const qrFileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadTherapists();
    loadUsers();
    loadUpiSettings();
  }, []);

  async function loadUsers() {
    setUsersLoading(true);
    try {
      const res = await fetch('/api/admin/users');
      if (res.ok) {
        const data = await res.json();
        setUsersList(data.users || []);
      }
    } catch {
      // fallback
    } finally {
      setUsersLoading(false);
    }
  }

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

  async function handleQrUpload(file: File) {
    if (!file) return;

    const allowed = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/svg+xml'];
    if (!allowed.includes(file.type.toLowerCase())) {
      setToast({ text: 'Please select a valid image (PNG, JPG, JPEG, WEBP, or SVG).', type: 'error' });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setToast({ text: 'File size exceeds limit of 5MB.', type: 'error' });
      return;
    }

    setQrUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/admin/platform-settings/upload-qr', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || 'Failed to upload QR code.');
      }

      setUpiSettings((s) => ({ ...s, upi_qr_url: data.url }));
      setToast({ text: 'QR code uploaded and saved successfully!', type: 'success' });
      setTimeout(() => setToast(null), 3500);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'QR upload failed';
      setToast({ text: msg, type: 'error' });
      setTimeout(() => setToast(null), 4000);
    } finally {
      setQrUploading(false);
      if (qrFileInputRef.current) {
        qrFileInputRef.current.value = '';
      }
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

  const filteredUsers = useMemo(() => {
    return usersList.filter((u) => {
      const matchesRole = userRoleFilter === 'all' || u.role === userRoleFilter;
      const q = userSearchQuery.toLowerCase();
      const matchesSearch =
        !q ||
        u.fullName.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        (u.licenseNumber && u.licenseNumber.toLowerCase().includes(q));
      return matchesRole && matchesSearch;
    });
  }, [usersList, userRoleFilter, userSearchQuery]);

  const userCounts = useMemo(() => {
    return {
      all: usersList.length,
      clients: usersList.filter((u) => u.role === 'client').length,
      therapists: usersList.filter((u) => u.role === 'therapist').length,
      admins: usersList.filter((u) => u.role === 'admin').length,
    };
  }, [usersList]);

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
      setToast({ text: 'Please enter a note explaining the rejection reason.', type: 'error' });
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
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || 'Failed to update therapist status');
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
        text: `Therapist ${selectedTherapist.fullName} has been ${newStatus}.`,
        type: 'success',
      });
      setTimeout(() => setToast(null), 3500);
      setSelectedTherapist(null);
      setModalAction(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error updating status';
      setToast({ text: msg, type: 'error' });
      setTimeout(() => setToast(null), 4000);
    } finally {
      setActionLoading(false);
    }
  }

  async function handleConfirmDeleteUser() {
    if (!userToDelete) return;
    setIsDeletingUser(true);
    try {
      const res = await fetch('/api/admin/users/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: userToDelete.id }),
      });

      const data = await res.json().catch(() => ({}));

      if (data.partialDelete) {
        // Profile data deleted but auth record persists — show warning and still remove from UI
        setToast({
          text: `⚠️ ${userToDelete.fullName || userToDelete.email} profile data deleted, but auth record could not be removed. Delete manually from Supabase Auth dashboard.`,
          type: 'error',
        });
        setTimeout(() => setToast(null), 8000);
        setUsersList((prev) => prev.filter((u) => u.id !== userToDelete.id));
        setTherapists((prev) => prev.filter((t) => t.userId !== userToDelete.id));
        setUserToDelete(null);
        return;
      }

      if (!res.ok) {
        throw new Error(data.error || 'Failed to delete user.');
      }

      setToast({
        text: `User ${userToDelete.fullName || userToDelete.email} was permanently deleted.`,
        type: 'success',
      });
      setTimeout(() => setToast(null), 3500);

      // Remove from both lists
      setUsersList((prev) => prev.filter((u) => u.id !== userToDelete.id));
      setTherapists((prev) => prev.filter((t) => t.userId !== userToDelete.id));
      setUserToDelete(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Deletion failed';
      setToast({ text: msg, type: 'error' });
      setTimeout(() => setToast(null), 4000);
    } finally {
      setIsDeletingUser(false);
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: 'hsl(var(--secondary))' }}>
      {/* Toast Alert - mobile safe */}
      {toast && (
        <div
          style={{
            position: 'fixed',
            top: '1rem',
            left: '1rem',
            right: '1rem',
            zIndex: 9999,
            background: toast.type === 'success' ? '#059669' : '#dc2626',
            color: '#ffffff',
            padding: '0.75rem 1rem',
            borderRadius: '0.65rem',
            boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
            fontSize: '0.875rem',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            maxWidth: 500,
            margin: '0 auto',
          }}
        >
          {toast.type === 'success' ? <IconCheck size={18} /> : <IconAlertCircle size={18} />}
          <span style={{ flex: 1 }}>{toast.text}</span>
        </div>
      )}

      {/* Admin Navbar - mobile responsive */}
      <nav
        style={{
          borderBottom: '1px solid hsl(var(--border))',
          background: 'hsl(var(--background) / 0.95)',
          backdropFilter: 'blur(16px)',
          position: 'sticky',
          top: 0,
          zIndex: 50,
        }}
      >
        <div
          style={{
            maxWidth: 1200,
            margin: '0 auto',
            padding: '0 1rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            height: '3.5rem',
            gap: '0.5rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 0 }}>
            <span style={{ fontSize: '1.1rem', fontWeight: 800, fontFamily: 'var(--font-body)', whiteSpace: 'nowrap' }}>
              <span className="gradient-text">Jarwis</span>
            </span>
            <span
              style={{
                background: 'hsl(var(--accent) / 0.1)',
                border: '1px solid hsl(var(--accent) / 0.25)',
                color: 'hsl(var(--accent))',
                fontSize: '0.65rem',
                fontWeight: 700,
                padding: '0.1rem 0.45rem',
                borderRadius: '0.3rem',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                flexShrink: 0,
              }}
            >
              Admin
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Link
              href="/dashboard"
              className="btn-ghost"
              style={{ padding: '0.4rem 0.75rem', fontSize: '0.8rem', color: '#64748b', whiteSpace: 'nowrap' }}
            >
              Dashboard
            </Link>
            <SignOutButton
              className="btn-ghost"
              style={{ padding: '0.4rem 0.75rem', fontSize: '0.8rem', color: '#64748b' }}
            />
          </div>
        </div>
      </nav>

      <main style={{ maxWidth: 1200, margin: '0 auto', padding: '1.25rem 0.85rem 5rem' }}>
        {/* Header */}
        <div style={{ marginBottom: '1.5rem' }}>
          <h1 style={{ fontSize: 'clamp(1.4rem, 5vw, 2rem)', fontWeight: 700, marginBottom: '0.35rem', color: 'hsl(var(--foreground))', fontFamily: 'var(--font-display)', letterSpacing: '-0.02em' }}>
            Admin <span style={{ color: 'hsl(var(--accent))' }}>Control Centre</span>
          </h1>
          <p style={{ color: '#64748b', fontSize: '0.875rem' }}>
            Manage therapist applications, users, and donation settings.
          </p>
        </div>

        {/* Top-Level Section Tabs - mobile scrollable pill row */}
        <div
          style={{
            display: 'flex',
            gap: '0.5rem',
            marginBottom: '1.5rem',
            borderBottom: '1px solid #e2e8f0',
            paddingBottom: '0.75rem',
            overflowX: 'auto',
            WebkitOverflowScrolling: 'touch',
            scrollbarWidth: 'none',
          }}
        >
          <button
            type="button"
            onClick={() => setMainSection('therapists')}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: '0.55rem',
              fontSize: '0.82rem',
              fontWeight: 600,
              cursor: 'pointer',
              border: mainSection === 'therapists' ? 'none' : '1px solid #e2e8f0',
              background: mainSection === 'therapists' ? '#2563eb' : '#ffffff',
              color: mainSection === 'therapists' ? '#ffffff' : '#64748b',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              whiteSpace: 'nowrap',
              flexShrink: 0,
              boxShadow: mainSection === 'therapists' ? '0 2px 8px rgba(37, 99, 235, 0.2)' : 'none',
            }}
          >
            <span>Therapists</span>
            {counts.pending > 0 && (
              <span
                style={{
                  background: mainSection === 'therapists' ? '#ffffff' : '#ef4444',
                  color: mainSection === 'therapists' ? '#2563eb' : '#ffffff',
                  borderRadius: '1rem',
                  padding: '0.05rem 0.45rem',
                  fontSize: '0.72rem',
                  fontWeight: 700,
                }}
              >
                {counts.pending}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => {
              setMainSection('users');
              loadUsers();
            }}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: '0.55rem',
              fontSize: '0.82rem',
              fontWeight: 600,
              cursor: 'pointer',
              border: mainSection === 'users' ? 'none' : '1px solid #e2e8f0',
              background: mainSection === 'users' ? '#2563eb' : '#ffffff',
              color: mainSection === 'users' ? '#ffffff' : '#64748b',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              whiteSpace: 'nowrap',
              flexShrink: 0,
              boxShadow: mainSection === 'users' ? '0 2px 8px rgba(37, 99, 235, 0.2)' : 'none',
            }}
          >
            <IconUser size={14} />
            <span>All Users</span>
            {usersList.length > 0 && (
              <span
                style={{
                  background: mainSection === 'users' ? 'rgba(255,255,255,0.25)' : '#f1f5f9',
                  color: mainSection === 'users' ? '#ffffff' : '#475569',
                  borderRadius: '1rem',
                  padding: '0.05rem 0.45rem',
                  fontSize: '0.72rem',
                  fontWeight: 600,
                }}
              >
                {usersList.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setMainSection('upi')}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: '0.55rem',
              fontSize: '0.82rem',
              fontWeight: 600,
              cursor: 'pointer',
              border: mainSection === 'upi' ? 'none' : '1px solid #e2e8f0',
              background: mainSection === 'upi' ? '#2563eb' : '#ffffff',
              color: mainSection === 'upi' ? '#ffffff' : '#64748b',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              whiteSpace: 'nowrap',
              flexShrink: 0,
              boxShadow: mainSection === 'upi' ? '0 2px 8px rgba(37, 99, 235, 0.2)' : 'none',
            }}
          >
            <IconQrCode size={14} />
            <span>UPI / Donate</span>
          </button>
        </div>

        {/* ── SECTION 1: THERAPIST VERIFICATION ────────────────────────── */}
        {mainSection === 'therapists' && (
          <div>
            {/* Stat Cards */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '1.25rem',
                marginBottom: '2rem',
              }}
            >
              <StatCard
                label="Pending Review"
                count={counts.pending}
                color="#b45309"
                bg="#fef3c7"
                border="#fde68a"
                icon={<IconClock size={20} color="#b45309" />}
              />
              <StatCard
                label="Approved"
                count={counts.approved}
                color="#15803d"
                bg="#dcfce7"
                border="#bbf7d0"
                icon={<IconCheck size={20} color="#15803d" />}
              />
              <StatCard
                label="Rejected"
                count={counts.rejected}
                color="#dc2626"
                bg="#fee2e2"
                border="#fecaca"
                icon={<IconAlertCircle size={20} color="#dc2626" />}
              />
              <StatCard
                label="Suspended"
                count={counts.suspended}
                color="#64748b"
                bg="#f1f5f9"
                border="#e2e8f0"
                icon={<IconUser size={20} color="#64748b" />}
              />
            </div>

            {/* Filter Tabs & Search - mobile stacked */}
            <div style={{ marginBottom: '1.25rem' }}>
              {/* Scrollable filter pill row */}
              <div
                style={{
                  display: 'flex',
                  gap: '0.4rem',
                  overflowX: 'auto',
                  WebkitOverflowScrolling: 'touch',
                  scrollbarWidth: 'none',
                  paddingBottom: '0.5rem',
                  marginBottom: '0.75rem',
                }}
              >
                {(['pending', 'approved', 'rejected', 'suspended', 'all'] as const).map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setActiveTab(tab)}
                    style={{
                      padding: '0.4rem 0.9rem',
                      borderRadius: '0.5rem',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      border: activeTab === tab ? '1px solid #3b82f6' : '1px solid #e2e8f0',
                      background: activeTab === tab ? '#eff6ff' : '#ffffff',
                      color: activeTab === tab ? '#2563eb' : '#64748b',
                      textTransform: 'capitalize',
                      transition: 'all 0.15s',
                      whiteSpace: 'nowrap',
                      flexShrink: 0,
                    }}
                  >
                    {tab === 'all' ? 'All' : tab}
                  </button>
                ))}
              </div>

              {/* Full-width search */}
              <div style={{ position: 'relative', width: '100%' }}>
                <input
                  type="text"
                  placeholder="Search by name, email, license..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="input"
                  style={{
                    paddingLeft: '2.25rem',
                    fontSize: '0.85rem',
                    borderRadius: '0.5rem',
                    width: '100%',
                  }}
                />
                <span
                  style={{
                    position: 'absolute',
                    left: '0.75rem',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: '#94a3b8',
                    pointerEvents: 'none',
                  }}
                >
                  <IconSearch size={16} />
                </span>
              </div>
            </div>

            {/* Therapists Queue */}
            {loading ? (
              <div style={{ padding: '4rem', textAlign: 'center' }}>
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
                    onDelete={() =>
                      setUserToDelete({
                        id: therapist.userId,
                        fullName: therapist.fullName,
                        email: therapist.email,
                        role: 'therapist',
                      })
                    }
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── SECTION 2: ALL USERS & DELETION ─────────────────────────── */}
        {mainSection === 'users' && (
          <div>
            {/* User Stat Cards */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '1.25rem',
                marginBottom: '2rem',
              }}
            >
              <StatCard
                label="Total Registered Users"
                count={userCounts.all}
                color="#2563eb"
                bg="#eff6ff"
                border="#bfdbfe"
                icon={<IconUser size={20} color="#2563eb" />}
              />
              <StatCard
                label="Clients (Seeking Help)"
                count={userCounts.clients}
                color="#059669"
                bg="#ecfdf5"
                border="#a7f3d0"
                icon={<IconCheck size={20} color="#059669" />}
              />
              <StatCard
                label="Therapists (Clinicians)"
                count={userCounts.therapists}
                color="#7c3aed"
                bg="#f5f3ff"
                border="#ddd6fe"
                icon={<IconIdCard size={20} color="#7c3aed" />}
              />
              <StatCard
                label="Platform Admins"
                count={userCounts.admins}
                color="#d97706"
                bg="#fef3c7"
                border="#fde68a"
                icon={<IconShield size={20} color="#d97706" />}
              />
            </div>

            {/* Filter and Search Bar - mobile stacked */}
            <div style={{ marginBottom: '1.25rem' }}>
              <div
                style={{
                  display: 'flex',
                  gap: '0.4rem',
                  overflowX: 'auto',
                  WebkitOverflowScrolling: 'touch',
                  scrollbarWidth: 'none',
                  paddingBottom: '0.5rem',
                  marginBottom: '0.75rem',
                }}
              >
                {(['all', 'client', 'therapist', 'admin'] as const).map((role) => (
                  <button
                    key={role}
                    type="button"
                    onClick={() => setUserRoleFilter(role)}
                    style={{
                      padding: '0.4rem 0.9rem',
                      borderRadius: '0.5rem',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      border: userRoleFilter === role ? '1px solid #3b82f6' : '1px solid #e2e8f0',
                      background: userRoleFilter === role ? '#eff6ff' : '#ffffff',
                      color: userRoleFilter === role ? '#2563eb' : '#64748b',
                      textTransform: 'capitalize',
                      transition: 'all 0.15s',
                      whiteSpace: 'nowrap',
                      flexShrink: 0,
                    }}
                  >
                    {role === 'all' ? 'All' : `${role}s`}
                  </button>
                ))}
              </div>

              <div style={{ position: 'relative', width: '100%' }}>
                <input
                  type="text"
                  placeholder="Search by name or email..."
                  value={userSearchQuery}
                  onChange={(e) => setUserSearchQuery(e.target.value)}
                  className="input"
                  style={{
                    paddingLeft: '2.25rem',
                    fontSize: '0.85rem',
                    borderRadius: '0.5rem',
                    width: '100%',
                  }}
                />
                <span
                  style={{
                    position: 'absolute',
                    left: '0.75rem',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: '#94a3b8',
                    pointerEvents: 'none',
                  }}
                >
                  <IconSearch size={16} />
                </span>
              </div>
            </div>

            {/* Users Table */}
            {usersLoading ? (
              <div style={{ padding: '4rem', textAlign: 'center' }}>
                <div className="spinner" style={{ width: 36, height: 36 }} />
              </div>
            ) : filteredUsers.length === 0 ? (
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
                  <IconUser size={40} color="#94a3b8" />
                </div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '0.25rem', color: '#1e293b' }}>
                  No users found
                </h3>
                <p style={{ color: '#64748b', fontSize: '0.875rem' }}>
                  No accounts matched your search or role filter.
                </p>
              </div>
            ) : (
              /* Mobile-first card list instead of table */
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {filteredUsers.map((u) => {
                  const roleColor = {
                    client: { bg: '#eff6ff', text: '#1d4ed8', border: '#bfdbfe' },
                    therapist: { bg: '#f5f3ff', text: '#6d28d9', border: '#ddd6fe' },
                    admin: { bg: '#fef3c7', text: '#b45309', border: '#fde68a' },
                  }[u.role] || { bg: '#f1f5f9', text: '#475569', border: '#e2e8f0' };

                  return (
                    <div
                      key={u.id}
                      style={{
                        background: '#ffffff',
                        border: '1px solid #e2e8f0',
                        borderRadius: '0.85rem',
                        padding: '1rem',
                        boxShadow: '0 1px 4px rgba(0,0,0,0.03)',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.75rem' }}>
                        {/* Avatar + Info */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0 }}>
                          <div
                            style={{
                              width: 40,
                              height: 40,
                              borderRadius: '50%',
                              background: '#e0e7ff',
                              color: '#4338ca',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontWeight: 700,
                              fontSize: '1rem',
                              flexShrink: 0,
                            }}
                          >
                            {u.fullName.charAt(0).toUpperCase() || 'U'}
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontWeight: 600, color: '#1e293b', fontSize: '0.9rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {u.fullName}
                            </div>
                            <div style={{ color: '#64748b', fontSize: '0.75rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {u.email}
                            </div>
                          </div>
                        </div>

                        {/* Delete button */}
                        <button
                          type="button"
                          onClick={() =>
                            setUserToDelete({
                              id: u.id,
                              fullName: u.fullName,
                              email: u.email,
                              role: u.role,
                            })
                          }
                          style={{
                            padding: '0.35rem 0.7rem',
                            borderRadius: '0.45rem',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            background: '#fef2f2',
                            border: '1px solid #fecaca',
                            color: '#dc2626',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.3rem',
                            flexShrink: 0,
                          }}
                        >
                          <IconTrash size={13} color="#dc2626" />
                          <span style={{ display: 'none' }}>Delete</span>
                        </button>
                      </div>

                      {/* Meta row */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap', marginTop: '0.65rem' }}>
                        <span
                          style={{
                            background: roleColor.bg,
                            color: roleColor.text,
                            border: `1px solid ${roleColor.border}`,
                            padding: '0.15rem 0.55rem',
                            borderRadius: '1rem',
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            textTransform: 'capitalize',
                          }}
                        >
                          {u.role}
                        </span>
                        {u.therapistStatus && (
                          <span
                            style={{
                              fontSize: '0.7rem',
                              padding: '0.12rem 0.4rem',
                              borderRadius: '0.35rem',
                              background: u.therapistStatus === 'approved' ? '#ecfdf5' : '#fff7ed',
                              color: u.therapistStatus === 'approved' ? '#059669' : '#c2410c',
                              fontWeight: 600,
                              textTransform: 'capitalize',
                            }}
                          >
                            {u.therapistStatus}
                          </span>
                        )}
                        <span style={{ fontSize: '0.72rem', color: '#94a3b8', marginLeft: 'auto' }}>
                          {new Date(u.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── SECTION 3: UPI / DONATION SETTINGS ───────────────────────── */}
        {mainSection === 'upi' && (
          <div
            style={{
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '1.25rem',
              padding: '2rem',
              boxShadow: '0 4px 20px rgba(0,0,0,0.03)',
            }}
          >
            {/* Section Header */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '1rem',
                borderBottom: '1px solid #f1f5f9',
                paddingBottom: '1.5rem',
                marginBottom: '2rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: '0.75rem',
                    background: '#f5f3ff',
                    border: '1px solid #ddd6fe',
                    color: '#7c3aed',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <IconQrCode size={24} color="#7c3aed" />
                </div>
                <div>
                  <h2 style={{ fontWeight: 800, fontSize: '1.25rem', color: '#1e293b', margin: 0 }}>
                    Donation UPI &amp; QR Code Management
                  </h2>
                  <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b', marginTop: '0.2rem' }}>
                    Upload your custom UPI QR code and configure the UPI ID displayed on the public <code style={{ background: '#f1f5f9', padding: '0.1rem 0.4rem', borderRadius: '0.25rem', color: '#2563eb' }}>/donate</code> page.
                  </p>
                </div>
              </div>

              <Link
                href="/donate"
                target="_blank"
                rel="noreferrer"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  padding: '0.5rem 1rem',
                  borderRadius: '0.5rem',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  color: '#2563eb',
                  background: '#eff6ff',
                  border: '1px solid #bfdbfe',
                  textDecoration: 'none',
                  transition: 'all 0.15s',
                }}
              >
                <span>View Public /donate Page</span>
                <span>↗</span>
              </Link>
            </div>

            {upiLoading ? (
              <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', color: '#94a3b8', fontSize: '0.9rem', padding: '3rem 0', justifyContent: 'center' }}>
                <div className="spinner" style={{ width: 24, height: 24 }} />
                <span>Loading current donation settings...</span>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 340px), 1fr))', gap: '2rem', alignItems: 'start' }}>
                {/* Left Column: Form & Upload Controls */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                  {/* UPI ID */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 700, color: '#1e293b', marginBottom: '0.4rem' }}>
                      UPI ID (VPA) <span style={{ color: '#dc2626' }}>*</span>
                    </label>
                    <input
                      type="text"
                      className="input"
                      value={upiSettings.upi_id}
                      onChange={(e) => setUpiSettings((s) => ({ ...s, upi_id: e.target.value.trim() }))}
                      placeholder="e.g. yourname@upi or merchant@oksbi"
                      style={{ fontFamily: 'monospace', fontSize: '0.95rem', width: '100%' }}
                    />
                    <p style={{ margin: '0.35rem 0 0', fontSize: '0.78rem', color: '#64748b' }}>
                      Donors will copy this identifier to pay directly inside GPay, PhonePe, Paytm, or BHIM.
                    </p>
                  </div>

                  {/* UPI Account Name */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 700, color: '#1e293b', marginBottom: '0.4rem' }}>
                      Beneficiary Account Name
                    </label>
                    <input
                      type="text"
                      className="input"
                      value={upiSettings.upi_name}
                      onChange={(e) => setUpiSettings((s) => ({ ...s, upi_name: e.target.value }))}
                      placeholder="e.g. Jarwis Foundation or Bhavy Soni"
                      style={{ width: '100%' }}
                    />
                    <p style={{ margin: '0.35rem 0 0', fontSize: '0.78rem', color: '#64748b' }}>
                      Official name linked to your bank account or merchant VPA.
                    </p>
                  </div>

                  {/* QR Code Upload Zone */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                      <label style={{ fontSize: '0.875rem', fontWeight: 700, color: '#1e293b' }}>
                        Donation QR Code Image
                      </label>
                      {upiSettings.upi_qr_url && (
                        <button
                          type="button"
                          onClick={() => setUpiSettings((s) => ({ ...s, upi_qr_url: '' }))}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: '#dc2626',
                            fontSize: '0.78rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.25rem',
                          }}
                        >
                          <IconTrash size={12} color="#dc2626" />
                          <span>Remove QR</span>
                        </button>
                      )}
                    </div>

                    {/* Hidden file input */}
                    <input
                      ref={qrFileInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/jpg,image/webp,image/svg+xml"
                      style={{ display: 'none' }}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleQrUpload(file);
                      }}
                    />

                    {/* Upload Card / Dropzone */}
                    <div
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => {
                        e.preventDefault();
                        const file = e.dataTransfer.files?.[0];
                        if (file) handleQrUpload(file);
                      }}
                      style={{
                        border: upiSettings.upi_qr_url ? '1px solid #e2e8f0' : '2px dashed #cbd5e1',
                        borderRadius: '0.85rem',
                        padding: '1.5rem',
                        background: upiSettings.upi_qr_url ? '#f8fafc' : '#fcfdff',
                        textAlign: 'center',
                        transition: 'all 0.2s ease',
                      }}
                    >
                      {qrUploading ? (
                        <div style={{ padding: '1.5rem 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
                          <div className="spinner" style={{ width: 32, height: 32 }} />
                          <span style={{ fontSize: '0.875rem', color: '#4338ca', fontWeight: 600 }}>
                            Uploading and securing QR code...
                          </span>
                        </div>
                      ) : upiSettings.upi_qr_url ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', textAlign: 'left' }}>
                          <div
                            style={{
                              width: 100,
                              height: 100,
                              borderRadius: '0.65rem',
                              border: '1px solid #e2e8f0',
                              background: '#ffffff',
                              padding: '0.35rem',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0,
                            }}
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={upiSettings.upi_qr_url}
                              alt="Uploaded UPI QR"
                              style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                            />
                          </div>

                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: '#15803d', fontSize: '0.8rem', fontWeight: 700 }}>
                              <IconCheck size={14} color="#15803d" />
                              <span>Custom QR Code Active</span>
                            </div>
                            <p style={{ margin: 0, fontSize: '0.78rem', color: '#64748b' }}>
                              Your uploaded QR code is linked to the donation gateway.
                            </p>
                            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.25rem' }}>
                              <button
                                type="button"
                                onClick={() => qrFileInputRef.current?.click()}
                                style={{
                                  padding: '0.35rem 0.85rem',
                                  borderRadius: '0.45rem',
                                  fontSize: '0.8rem',
                                  fontWeight: 600,
                                  background: '#eff6ff',
                                  border: '1px solid #bfdbfe',
                                  color: '#1d4ed8',
                                  cursor: 'pointer',
                                }}
                              >
                                Replace QR Image
                              </button>
                              <a
                                href={upiSettings.upi_qr_url}
                                target="_blank"
                                rel="noreferrer"
                                style={{
                                  padding: '0.35rem 0.85rem',
                                  borderRadius: '0.45rem',
                                  fontSize: '0.8rem',
                                  fontWeight: 600,
                                  background: '#ffffff',
                                  border: '1px solid #e2e8f0',
                                  color: '#475569',
                                  textDecoration: 'none',
                                }}
                              >
                                View Full Size ↗
                              </a>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div
                          onClick={() => qrFileInputRef.current?.click()}
                          style={{ cursor: 'pointer', padding: '1rem 0' }}
                        >
                          <div
                            style={{
                              width: 50,
                              height: 50,
                              borderRadius: '50%',
                              background: '#eff6ff',
                              color: '#2563eb',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              margin: '0 auto 0.85rem',
                            }}
                          >
                            <IconQrCode size={26} color="#2563eb" />
                          </div>
                          <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#1e293b', marginBottom: '0.25rem' }}>
                            Click to browse or drag &amp; drop QR Code
                          </div>
                          <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748b', maxWidth: 300, marginInline: 'auto' }}>
                            Upload an image of your GPay, PhonePe, Paytm, or BHIM QR code (PNG, JPG, WEBP, up to 5MB).
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Secondary Direct URL Option */}
                    <div style={{ marginTop: '0.75rem' }}>
                      <details style={{ fontSize: '0.8rem', color: '#64748b' }}>
                        <summary style={{ cursor: 'pointer', color: '#4f46e5', fontWeight: 600 }}>
                          Or enter direct image URL instead
                        </summary>
                        <div style={{ marginTop: '0.5rem' }}>
                          <input
                            type="url"
                            className="input"
                            value={upiSettings.upi_qr_url}
                            onChange={(e) => setUpiSettings((s) => ({ ...s, upi_qr_url: e.target.value.trim() }))}
                            placeholder="https://example.com/qr-code.png"
                            style={{ width: '100%', fontSize: '0.85rem' }}
                          />
                        </div>
                      </details>
                    </div>
                  </div>

                  {/* Donation Page Note */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 700, color: '#1e293b', marginBottom: '0.4rem' }}>
                      Donation Page Note
                    </label>
                    <textarea
                      className="input"
                      rows={3}
                      value={upiSettings.donation_note}
                      onChange={(e) => setUpiSettings((s) => ({ ...s, donation_note: e.target.value }))}
                      placeholder="Message displayed to donors explaining how voluntary contributions support free therapy..."
                      style={{ width: '100%', fontSize: '0.85rem' }}
                    />
                  </div>

                  {/* Save Button */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', paddingTop: '0.5rem' }}>
                    <button
                      type="button"
                      onClick={saveUpiSettings}
                      disabled={upiSaving}
                      className="btn-primary"
                      style={{
                        padding: '0.75rem 2rem',
                        fontWeight: 700,
                        fontSize: '0.95rem',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                      }}
                    >
                      {upiSaving ? (
                        <>
                          <div className="spinner" style={{ width: 16, height: 16 }} />
                          <span>Saving Changes...</span>
                        </>
                      ) : (
                        <>
                          <span>💾 Save UPI Settings</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Right Column: Live Visitor Preview */}
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.85rem' }}>
                    <div style={{ fontWeight: 700, fontSize: '0.875rem', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      Live /donate Page Preview
                    </div>
                    <span
                      style={{
                        background: '#ecfdf5',
                        border: '1px solid #bbf7d0',
                        color: '#166534',
                        padding: '0.15rem 0.5rem',
                        borderRadius: '0.35rem',
                        fontSize: '0.72rem',
                        fontWeight: 700,
                      }}
                    >
                      Real-time
                    </span>
                  </div>

                  {/* Simulated Card from /donate */}
                  <div
                    style={{
                      background: '#ffffff',
                      border: '1px solid #e2e8f0',
                      borderRadius: '1.25rem',
                      padding: '2rem',
                      textAlign: 'center',
                      boxShadow: '0 10px 25px rgba(0,0,0,0.06)',
                    }}
                  >
                    <div
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.35rem',
                        background: '#f0fdf4',
                        border: '1px solid #bbf7d0',
                        color: '#15803d',
                        padding: '0.25rem 0.75rem',
                        borderRadius: '2rem',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        marginBottom: '1.5rem',
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em',
                      }}
                    >
                      <IconCheck size={12} color="#15803d" />
                      UPI Instant Payment · Zero Fees
                    </div>

                    {/* QR Code Container */}
                    <div style={{ marginBottom: '1.5rem' }}>
                      {upiSettings.upi_qr_url ? (
                        <div>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={upiSettings.upi_qr_url}
                            alt="Donation QR Code Preview"
                            style={{
                              width: 200,
                              height: 200,
                              objectFit: 'contain',
                              borderRadius: '0.85rem',
                              border: '1px solid #e2e8f0',
                              padding: '0.5rem',
                              background: '#ffffff',
                              boxShadow: '0 4px 12px rgba(0,0,0,0.04)',
                            }}
                          />
                          <p style={{ color: '#64748b', fontSize: '0.8rem', marginTop: '0.65rem' }}>
                            Scan with any UPI app — GPay, PhonePe, Paytm, BHIM
                          </p>
                        </div>
                      ) : (
                        <div
                          style={{
                            width: 200,
                            height: 200,
                            margin: '0 auto',
                            borderRadius: '0.85rem',
                            border: '2px dashed #cbd5e1',
                            background: '#f8fafc',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#94a3b8',
                            fontSize: '0.825rem',
                            gap: '0.5rem',
                          }}
                        >
                          <IconQrCode size={36} color="#cbd5e1" />
                          <span>No QR uploaded yet</span>
                        </div>
                      )}
                    </div>

                    {/* UPI ID Pill */}
                    <div
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.75rem',
                        background: '#f8fafc',
                        border: '1px solid #e2e8f0',
                        borderRadius: '0.75rem',
                        padding: '0.75rem 1.15rem',
                        marginBottom: '1.25rem',
                        maxWidth: '100%',
                      }}
                    >
                      <div style={{ textAlign: 'left' }}>
                        <div style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                          UPI ID
                        </div>
                        <div style={{ fontWeight: 700, fontSize: '1rem', color: '#0f172a', fontFamily: 'monospace', wordBreak: 'break-all' }}>
                          {upiSettings.upi_id || 'yourname@upi'}
                        </div>
                        {upiSettings.upi_name && (
                          <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.1rem' }}>
                            {upiSettings.upi_name}
                          </div>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          if (upiSettings.upi_id) {
                            navigator.clipboard.writeText(upiSettings.upi_id).catch(() => {});
                            setCopiedUpi(true);
                            setTimeout(() => setCopiedUpi(false), 2000);
                          }
                        }}
                        style={{
                          background: copiedUpi ? '#f0fdf4' : '#eff6ff',
                          border: `1px solid ${copiedUpi ? '#bbf7d0' : '#bfdbfe'}`,
                          color: copiedUpi ? '#15803d' : '#1d4ed8',
                          borderRadius: '0.45rem',
                          padding: '0.4rem 0.75rem',
                          fontSize: '0.78rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.3rem',
                          flexShrink: 0,
                        }}
                      >
                        {copiedUpi ? <IconCheck size={13} color="#15803d" /> : <IconCopy size={13} color="#1d4ed8" />}
                        <span>{copiedUpi ? 'Copied' : 'Copy'}</span>
                      </button>
                    </div>

                    {/* Note Preview */}
                    {upiSettings.donation_note && (
                      <div
                        style={{
                          background: '#f8fafc',
                          border: '1px solid #e2e8f0',
                          borderRadius: '0.65rem',
                          padding: '0.85rem 1rem',
                          fontSize: '0.8rem',
                          color: '#475569',
                          lineHeight: 1.5,
                          textAlign: 'left',
                        }}
                      >
                        <strong>Note shown to donors:</strong>
                        <p style={{ margin: '0.25rem 0 0' }}>{upiSettings.donation_note}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── MODAL: VERIFY / REJECT / SUSPEND THERAPIST ───────────────── */}
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
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}
                >
                  <IconX size={20} />
                </button>
              </div>

              <p style={{ color: '#64748b', fontSize: '0.9rem', marginBottom: '1.25rem', lineHeight: 1.5 }}>
                {modalAction === 'approve' && (
                  <>
                    Approve <strong>{selectedTherapist.fullName}</strong>. They will immediately appear
                    available for client matching.
                  </>
                )}
                {modalAction === 'reject' && (
                  <>
                    Decline <strong>{selectedTherapist.fullName}</strong>&apos;s application. Provide a
                    reason below so they can correct it.
                  </>
                )}
                {modalAction === 'suspend' && (
                  <>
                    Temporarily suspend <strong>{selectedTherapist.fullName}</strong>. They will be taken
                    offline from the matching pool.
                  </>
                )}
              </p>

              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#374151', marginBottom: '0.4rem' }}>
                  {modalAction === 'reject' ? 'Reason for Rejection *' : 'Internal Admin Note'}
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

        {/* ── MODAL: PERMANENTLY DELETE USER ──────────────────────────── */}
        {userToDelete && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 1000,
              background: 'rgba(0,0,0,0.6)',
              backdropFilter: 'blur(4px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '1.5rem',
            }}
          >
            <div
              className="fade-in-up"
              style={{
                maxWidth: 480,
                width: '100%',
                borderRadius: '1.25rem',
                padding: '2rem',
                border: '1px solid #fecaca',
                background: '#ffffff',
                boxShadow: '0 20px 40px rgba(0,0,0,0.15)',
                textAlign: 'center',
              }}
            >
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: '50%',
                  background: '#fee2e2',
                  color: '#dc2626',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 1.25rem',
                }}
              >
                <IconTrash size={28} color="#dc2626" />
              </div>
              <h3 style={{ fontSize: '1.3rem', fontWeight: 700, color: '#1e293b', marginBottom: '0.5rem' }}>
                Permanently Delete User?
              </h3>
              <p style={{ color: '#64748b', fontSize: '0.9rem', lineHeight: 1.5, marginBottom: '1.5rem' }}>
                Are you sure you want to delete <strong>{userToDelete.fullName}</strong> (
                <code>{userToDelete.email}</code>)? This will immediately wipe their account, profiles, and
                consultation history from the database and authentication system. This action{' '}
                <strong>cannot be undone</strong>.
              </p>
              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
                <button
                  type="button"
                  onClick={() => setUserToDelete(null)}
                  disabled={isDeletingUser}
                  className="btn-ghost"
                  style={{ padding: '0.65rem 1.5rem' }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDeleteUser}
                  disabled={isDeletingUser}
                  style={{
                    padding: '0.65rem 1.75rem',
                    borderRadius: '0.6rem',
                    fontWeight: 600,
                    background: '#dc2626',
                    color: '#fff',
                    border: 'none',
                    cursor: isDeletingUser ? 'not-allowed' : 'pointer',
                    opacity: isDeletingUser ? 0.7 : 1,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                  }}
                >
                  {isDeletingUser ? (
                    <span className="spinner" style={{ width: 16, height: 16 }} />
                  ) : (
                    <IconTrash size={16} color="#fff" />
                  )}
                  <span>{isDeletingUser ? 'Deleting...' : 'Yes, Delete User'}</span>
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
  onDelete,
}: {
  therapist: TherapistItem;
  onApprove: () => void;
  onReject: () => void;
  onSuspend: () => void;
  onDelete: () => void;
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
        padding: '1rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
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

      {/* Action Buttons - horizontal row on mobile */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
        {therapist.status !== 'approved' && (
          <button
            type="button"
            onClick={onApprove}
            style={{
              padding: '0.45rem 1rem',
              borderRadius: '0.5rem',
              fontSize: '0.8rem',
              fontWeight: 600,
              background: '#059669',
              color: '#ffffff',
              border: 'none',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
              flex: '1 1 auto',
              justifyContent: 'center',
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
              padding: '0.45rem 1rem',
              borderRadius: '0.5rem',
              fontSize: '0.8rem',
              fontWeight: 600,
              background: '#fef2f2',
              border: '1px solid #fecaca',
              color: '#dc2626',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
              flex: '1 1 auto',
              justifyContent: 'center',
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
              padding: '0.45rem 1rem',
              borderRadius: '0.5rem',
              fontSize: '0.8rem',
              fontWeight: 500,
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              color: '#64748b',
              cursor: 'pointer',
              flex: '1 1 auto',
            }}
          >
            Suspend
          </button>
        )}

        <button
          type="button"
          onClick={onDelete}
          style={{
            padding: '0.45rem 0.85rem',
            borderRadius: '0.5rem',
            fontSize: '0.8rem',
            fontWeight: 500,
            background: '#ffffff',
            border: '1px solid #fecaca',
            color: '#dc2626',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.3rem',
          }}
          title="Delete account"
        >
          <IconTrash size={13} color="#dc2626" />
          <span>Delete</span>
        </button>
      </div>
    </div>
  );
}
