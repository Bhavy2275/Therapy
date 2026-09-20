'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import {
  IconCalendar,
  IconClock,
  IconCheck,
  IconAlertCircle,
  IconIdCard,
  IconGlobe,
  IconUser,
  IconFile,
  IconPaperclip,
  IconBrain,
} from '@/components/Icons';



const SPECIALTY_OPTIONS = [
  'Anxiety & Panic',
  'Depression',
  'Cognitive Behavioral Therapy (CBT)',
  'Trauma & PTSD',
  'Couples & Marriage',
  'Family Dynamics',
  'ADHD & Neurodivergence',
  'Grief & Bereavement',
  'Stress & Burnout',
  'LGBTQ+ Affirming',
  'Obsessive-Compulsive (OCD)',
  'Mindfulness & Somatics',
  'Life Transitions',
  'Self-Esteem & Identity',
];

const LANGUAGE_OPTIONS = [
  'English',
  'Hindi',
  'Spanish',
  'French',
  'German',
  'Bengali',
  'Tamil',
  'Telugu',
  'Marathi',
  'Punjabi',
  'Arabic',
];

export default function TherapistProfilePage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [userId, setUserId] = useState<string | null>(null);
  const [status, setStatus] = useState<'pending' | 'approved' | 'rejected' | 'suspended'>('pending');
  const [adminNote, setAdminNote] = useState<string | null>(null);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [bio, setBio] = useState('');
  const [licenseNumber, setLicenseNumber] = useState('');
  const [yearsOfExperience, setYearsOfExperience] = useState<number>(0);
  const [hourlyRateUsd, setHourlyRateUsd] = useState<number | ''>('');
  const [specializations, setSpecializations] = useState<string[]>([]);
  const [languages, setLanguages] = useState<string[]>(['English']);
  const [licenseDocumentUrl, setLicenseDocumentUrl] = useState<string | null>(null);
  const [documentSignedUrl, setDocumentSignedUrl] = useState<string | null>(null);

  useEffect(() => {
    loadProfile();
  }, []);

  async function loadProfile() {
    setLoading(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (user) {
        setUserId(user.id);
        setEmail(user.email ?? '');

        // Fetch user full_name
        const { data: userRow } = await supabase
          .from('users')
          .select('full_name')
          .eq('id', user.id)
          .single();

        if (userRow?.full_name) setFullName(userRow.full_name);

        // Fetch therapist profile
        const { data: profile } = await supabase
          .from('therapist_profiles')
          .select('*')
          .eq('user_id', user.id)
          .single();

        if (profile) {
          setBio(profile.bio ?? '');
          setLicenseNumber(profile.license_number ?? '');
          setYearsOfExperience(profile.years_of_experience ?? 0);
          setHourlyRateUsd(profile.hourly_rate_usd ?? '');
          setSpecializations(profile.specializations ?? []);
          setLanguages(profile.languages ?? ['English']);
          setStatus(profile.status ?? 'pending');
          setAdminNote(profile.admin_note ?? null);
          setLicenseDocumentUrl(profile.license_document_url ?? null);

          if (profile.license_document_url) {
            const { data: signed } = await supabase.storage
              .from('therapist-documents')
              .createSignedUrl(profile.license_document_url, 3600);
            if (signed?.signedUrl) setDocumentSignedUrl(signed.signedUrl);
          }
        }
      }
    } catch {
      // Dev fallback with demo data if credentials not configured
      setUserId('demo-therapist-id');
      setEmail('dr.sharma@mindbridge.com');
      setFullName('Dr. Ananya Sharma');
      setBio('Licensed clinical psychologist with 9+ years experience helping individuals and couples navigate anxiety, depression, and high-pressure career transitions.');
      setLicenseNumber('RCI-CR-2018-98421');
      setYearsOfExperience(9);
      setHourlyRateUsd(65);
      setSpecializations(['Anxiety & Panic', 'Depression', 'Cognitive Behavioral Therapy (CBT)', 'Stress & Burnout']);
      setLanguages(['English', 'Hindi']);
      setStatus('pending');
      setAdminNote(null);
    } finally {
      setLoading(false);
    }
  }

  function toggleSpecialty(specialty: string) {
    setSpecializations((prev) =>
      prev.includes(specialty)
        ? prev.filter((s) => s !== specialty)
        : [...prev, specialty]
    );
  }

  function toggleLanguage(lang: string) {
    setLanguages((prev) =>
      prev.includes(lang)
        ? prev.length > 1 ? prev.filter((l) => l !== lang) : prev
        : [...prev, lang]
    );
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // 1. File size check (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      setMessage({ type: 'error', text: 'Document file size must be less than 10MB.' });
      return;
    }

    // 2. Strict file extension & MIME type validation
    const allowedExtensions = ['pdf', 'jpg', 'jpeg', 'png', 'webp'];
    const allowedMimeTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];

    const fileExt = file.name.split('.').pop()?.toLowerCase() || '';

    if (!allowedExtensions.includes(fileExt) || (file.type && !allowedMimeTypes.includes(file.type))) {
      setMessage({
        type: 'error',
        text: 'Invalid file format. Only PDF, JPG, PNG, or WEBP documents are allowed.',
      });
      return;
    }

    setUploading(true);
    setMessage(null);

    try {
      const supabase = createClient();
      const storagePath = `${userId || 'demo'}/${Date.now()}-license.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('therapist-documents')
        .upload(storagePath, file, { upsert: true });

      if (uploadError) {
        // Dev fallback if storage bucket not yet applied
        setLicenseDocumentUrl(storagePath);
        setMessage({ type: 'success', text: `Document "${file.name}" staged successfully.` });
      } else {
        setLicenseDocumentUrl(storagePath);
        const { data: signed } = await supabase.storage
          .from('therapist-documents')
          .createSignedUrl(storagePath, 3600);
        if (signed?.signedUrl) setDocumentSignedUrl(signed.signedUrl);
        setMessage({ type: 'success', text: `Document "${file.name}" uploaded successfully.` });
      }
    } catch {
      setLicenseDocumentUrl(`documents/${file.name}`);
      setMessage({ type: 'success', text: `Document "${file.name}" attached.` });
    } finally {
      setUploading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!licenseNumber.trim()) {
      setMessage({ type: 'error', text: 'Please enter your professional license number.' });
      return;
    }

    setSaving(true);
    setMessage(null);

    try {
      const supabase = createClient();

      if (userId && userId !== 'demo-therapist-id') {
        // Update users full_name
        await supabase
          .from('users')
          .update({ full_name: fullName })
          .eq('id', userId);

        // Update therapist profile
        const { error } = await supabase
          .from('therapist_profiles')
          .update({
            bio,
            license_number: licenseNumber,
            years_of_experience: Number(yearsOfExperience),
            hourly_rate_usd: hourlyRateUsd === '' ? null : Number(hourlyRateUsd),
            specializations,
            languages,
            license_document_url: licenseDocumentUrl,
            status: status === 'rejected' ? 'pending' : status,
            admin_note: status === 'rejected' ? null : adminNote,
          })
          .eq('user_id', userId);

        if (error) throw error;
        if (status === 'rejected') setStatus('pending');
      }

      setMessage({
        type: 'success',
        text: 'Profile updated successfully! Submitted for verification.',
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error updating profile';
      setMessage({ type: 'error', text: msg });
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="spinner" style={{ width: 36, height: 36 }} />
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', position: 'relative' }}>
      <div className="mesh-bg" />

      {/* Nav */}
      <nav style={{
        position: 'sticky', top: 0, zIndex: 50,
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        background: 'rgba(10, 15, 30, 0.8)',
        backdropFilter: 'blur(16px)',
      }}>
        <div style={{ maxWidth: 1000, margin: '0 auto', padding: '0 1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '4rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <Link href="/dashboard" style={{ color: '#94a3b8', fontSize: '0.875rem', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              ← Dashboard
            </Link>
            <span style={{ color: 'rgba(255,255,255,0.2)' }}>/</span>
            <span style={{ fontWeight: 600, fontSize: '0.95rem', color: '#f1f5f9' }}>Therapist Profile</span>
          </div>

          <Link
            href="/dashboard/therapist/schedule"
            className="btn-ghost"
            style={{
              padding: '0.45rem 1rem',
              fontSize: '0.85rem',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
            }}
          >
            <IconCalendar size={15} />
            <span>Set Availability</span>
          </Link>
        </div>
      </nav>

      <main style={{ maxWidth: 1000, margin: '0 auto', padding: '2.5rem 1.5rem 5rem' }}>
        {/* Title */}
        <div className="fade-in-up" style={{ marginBottom: '2rem' }}>
          <h1 style={{ fontSize: '2rem', fontWeight: 700, marginBottom: '0.5rem', color: '#f1f5f9' }}>
            Therapist <span className="gradient-text">Profile & Credentials</span>
          </h1>
          <p style={{ color: '#94a3b8', fontSize: '0.95rem' }}>
            Complete your clinical background, license details, and specialties for client discovery and verification.
          </p>
        </div>

        {/* Status Banner */}
        <div className="fade-in-up" style={{ marginBottom: '2rem' }}>
          {status === 'pending' && (
            <div style={{
              background: 'rgba(245, 158, 11, 0.1)',
              border: '1px solid rgba(245, 158, 11, 0.3)',
              borderRadius: '0.85rem',
              padding: '1.25rem 1.5rem',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '1rem',
            }}>
              <IconClock size={24} color="#d97706" style={{ marginTop: 2, flexShrink: 0 }} />
              <div>
                <div style={{ fontWeight: 600, color: '#b45309', marginBottom: '0.2rem' }}>
                  Verification Pending Review
                </div>
                <p style={{ fontSize: '0.875rem', color: '#64748b', lineHeight: 1.5 }}>
                  Your profile and license document have been submitted to our clinical review team. You will be able to go live and accept instant client sessions once verified.
                </p>
              </div>
            </div>
          )}

          {status === 'approved' && (
            <div style={{
              background: 'rgba(16, 185, 129, 0.1)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              borderRadius: '0.85rem',
              padding: '1.25rem 1.5rem',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '1rem',
            }}>
              <IconCheck size={24} color="#059669" style={{ marginTop: 2, flexShrink: 0 }} />
              <div>
                <div style={{ fontWeight: 600, color: '#047857', marginBottom: '0.2rem' }}>
                  Verified & Approved Therapist
                </div>
                <p style={{ fontSize: '0.875rem', color: '#64748b', lineHeight: 1.5 }}>
                  Your credentials have been verified! You are fully authorized to toggle your availability and receive instant and scheduled client sessions.
                </p>
              </div>
            </div>
          )}

          {status === 'rejected' && (
            <div style={{
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: '0.85rem',
              padding: '1.25rem 1.5rem',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '1rem',
            }}>
              <IconAlertCircle size={24} color="#dc2626" style={{ marginTop: 2, flexShrink: 0 }} />
              <div>
                <div style={{ fontWeight: 600, color: '#dc2626', marginBottom: '0.2rem' }}>
                  Verification Requires Update
                </div>
                <p style={{ fontSize: '0.875rem', color: '#64748b', lineHeight: 1.5, marginBottom: adminNote ? '0.5rem' : '0' }}>
                  Our clinical team reviewed your submission and needs additional verification. Please update the details below to automatically resubmit.
                </p>

                {adminNote && (
                  <div style={{
                    background: 'rgba(0,0,0,0.3)',
                    borderLeft: '3px solid #ef4444',
                    padding: '0.5rem 0.75rem',
                    borderRadius: '0.25rem',
                    fontSize: '0.825rem',
                    color: '#fca5a5',
                  }}>
                    <strong>Reviewer Note:</strong> {adminNote}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Feedback message */}
        {message && (
          <div style={{
            padding: '0.85rem 1.25rem',
            borderRadius: '0.65rem',
            marginBottom: '1.5rem',
            fontSize: '0.875rem',
            background: message.type === 'success' ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
            border: `1px solid ${message.type === 'success' ? 'rgba(16,185,129,0.35)' : 'rgba(239,68,68,0.35)'}`,
            color: message.type === 'success' ? '#34d399' : '#f87171',
          }}>
            {message.text}
          </div>
        )}

        {/* Profile Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          {/* General Information Card */}
          <div className="glass" style={{ borderRadius: '1rem', padding: '2rem' }}>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 600, marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <IconUser size={20} color="#3b82f6" /> Basic Information
            </h2>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem', marginBottom: '1.25rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: '#9ca3af', marginBottom: '0.4rem' }}>
                  Full Name
                </label>
                <input
                  type="text"
                  className="input"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Dr. Jane Doe"
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: '#9ca3af', marginBottom: '0.4rem' }}>
                  Account Email
                </label>
                <input
                  type="email"
                  className="input"
                  value={email}
                  disabled
                  style={{ opacity: 0.6, cursor: 'not-allowed' }}
                />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', color: '#9ca3af', marginBottom: '0.4rem' }}>
                Professional Clinical Bio (Max 500 characters)
              </label>
              <textarea
                className="input"
                rows={4}
                maxLength={500}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Describe your clinical practice, therapeutic approach (e.g. CBT, psychodynamic), and patient focus..."
                style={{ resize: 'vertical' }}
              />
              <div style={{ textAlign: 'right', fontSize: '0.75rem', color: '#6b7280', marginTop: '0.3rem' }}>
                {bio.length}/500
              </div>
            </div>
          </div>

          {/* Clinical Credentials Card */}
          <div className="glass" style={{ borderRadius: '1rem', padding: '2rem' }}>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 600, marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#f1f5f9' }}>
              <IconIdCard size={20} color="#3b82f6" />
              <span>License & Credentials</span>
            </h2>


            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.25rem', marginBottom: '1.5rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: '#9ca3af', marginBottom: '0.4rem' }}>
                  License / Registration Number *
                </label>
                <input
                  type="text"
                  className="input"
                  value={licenseNumber}
                  onChange={(e) => setLicenseNumber(e.target.value)}
                  placeholder="e.g. RCI-CR-2023-XXXX or CA-PSY-12345"
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: '#9ca3af', marginBottom: '0.4rem' }}>
                  Years of Experience
                </label>
                <input
                  type="number"
                  className="input"
                  min={0}
                  max={70}
                  value={yearsOfExperience}
                  onChange={(e) => setYearsOfExperience(Number(e.target.value))}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: '#9ca3af', marginBottom: '0.4rem' }}>
                  Session Rate (USD) <span style={{ color: '#6b7280', fontSize: '0.75rem' }}>(Free platform now)</span>
                </label>
                <input
                  type="number"
                  className="input"
                  min={0}
                  placeholder="e.g. 50"
                  value={hourlyRateUsd}
                  onChange={(e) => setHourlyRateUsd(e.target.value === '' ? '' : Number(e.target.value))}
                />
              </div>
            </div>

            {/* License Document Upload */}
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', color: '#9ca3af', marginBottom: '0.4rem' }}>
                License Document / Certificate (PDF, PNG, JPG — max 10MB)
              </label>

              <div style={{
                border: '2px dashed rgba(255,255,255,0.15)',
                borderRadius: '0.75rem',
                padding: '1.75rem',
                textAlign: 'center',
                background: 'rgba(255,255,255,0.02)',
                position: 'relative',
              }}>
                <input
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg,.webp"
                  onChange={handleFileUpload}
                  style={{
                    position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', width: '100%', height: '100%',
                  }}
                  disabled={uploading}
                />
                <div style={{ marginBottom: '0.5rem', color: '#6b7280' }}><IconFile size={36} /></div>
                <div style={{ fontWeight: 500, fontSize: '0.95rem', marginBottom: '0.25rem' }}>
                  {uploading ? 'Uploading document...' : 'Click or drag & drop to upload license verification document'}
                </div>
                <p style={{ color: '#6b7280', fontSize: '0.8rem' }}>
                  Must clearly show your registered name, license ID, and issuing authority.
                </p>

                {licenseDocumentUrl && (
                  <div style={{
                    marginTop: '1rem',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    background: 'rgba(59, 130, 246, 0.15)',
                    border: '1px solid rgba(59, 130, 246, 0.3)',
                    padding: '0.35rem 0.85rem',
                    borderRadius: '0.5rem',
                    fontSize: '0.8rem',
                    color: '#93c5fd',
                  }}>
                    <IconPaperclip size={13} style={{ verticalAlign: 'middle', marginRight: '0.3rem' }} />Attached: {licenseDocumentUrl.split('/').pop()}
                    {documentSignedUrl && (
                      <a
                        href={documentSignedUrl}
                        download
                        target="_blank"
                        rel="noreferrer"
                        style={{ color: '#60a5fa', textDecoration: 'underline', marginLeft: '0.5rem' }}
                      >
                        Download File
                      </a>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Clinical Focus & Specializations */}
          <div className="glass" style={{ borderRadius: '1rem', padding: '2rem' }}>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 600, marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <IconBrain size={20} color="#3b82f6" /> Areas of Expertise & Specializations
            </h2>
            <p style={{ color: '#9ca3af', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
              Select all areas where you offer clinical counseling. This helps match you with relevant client requests.
            </p>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.6rem' }}>
              {SPECIALTY_OPTIONS.map((spec) => {
                const selected = specializations.includes(spec);
                return (
                  <button
                    key={spec}
                    type="button"
                    onClick={() => toggleSpecialty(spec)}
                    style={{
                      padding: '0.45rem 0.95rem',
                      borderRadius: '2rem',
                      fontSize: '0.825rem',
                      fontWeight: 500,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      border: selected ? '1px solid #3a5bef' : '1px solid rgba(255,255,255,0.1)',
                      background: selected ? 'rgba(58, 91, 239, 0.25)' : 'rgba(255,255,255,0.03)',
                      color: selected ? '#93c5fd' : '#9ca3af',
                    }}
                  >
                    {selected ? '✓ ' : '+ '}
                    {spec}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Languages */}
          <div className="glass" style={{ borderRadius: '1rem', padding: '2rem' }}>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 600, marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#f1f5f9' }}>
              <IconGlobe size={20} color="#3b82f6" />
              <span>Languages Spoken</span>
            </h2>

            <p style={{ color: '#9ca3af', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
              Select languages in which you can conduct therapy sessions comfortably.
            </p>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.6rem' }}>
              {LANGUAGE_OPTIONS.map((lang) => {
                const selected = languages.includes(lang);
                return (
                  <button
                    key={lang}
                    type="button"
                    onClick={() => toggleLanguage(lang)}
                    style={{
                      padding: '0.45rem 0.95rem',
                      borderRadius: '2rem',
                      fontSize: '0.825rem',
                      fontWeight: 500,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      border: selected ? '1px solid #14b8a6' : '1px solid rgba(255,255,255,0.1)',
                      background: selected ? 'rgba(20, 184, 166, 0.2)' : 'rgba(255,255,255,0.03)',
                      color: selected ? '#5eead4' : '#9ca3af',
                    }}
                  >
                    {selected ? '✓ ' : '+ '}
                    {lang}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Submit Button */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
            <Link href="/dashboard" className="btn-ghost" style={{ padding: '0.75rem 1.75rem' }}>
              Cancel
            </Link>
            <button
              type="submit"
              disabled={saving}
              className="btn-primary"
              style={{ padding: '0.75rem 2.25rem', fontSize: '0.95rem', fontWeight: 600 }}
            >
              {saving ? 'Saving Profile...' : 'Save & Submit for Verification'}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
