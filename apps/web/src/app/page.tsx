'use client';

import React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  Play,
  Zap,
  Video,
  CheckCircle,
  Calendar,
  Globe,
  Shield,
  ArrowRight,
} from 'lucide-react';
import MobileNavDrawer from '@/components/MobileNavDrawer';


const stats = [
  { value: '500+', label: 'Verified Therapists' },
  { value: '10k+', label: 'Sessions Completed' },
  { value: '4.9 / 5', label: 'Client Satisfaction' },
  { value: '24/7', label: 'Real-Time Availability' },
];

const features = [
  {
    icon: <Zap className="w-6 h-6 text-accent" />,
    title: 'Instant Matching',
    desc: 'Request a session and get matched with an available verified therapist in under a minute.',
  },
  {
    icon: <Video className="w-6 h-6 text-accent" />,
    title: 'Voice, Video & Chat',
    desc: 'Choose how you want to connect — private video, voice-only, or secure text messaging.',
  },
  {
    icon: <CheckCircle className="w-6 h-6 text-emerald-600" />,
    title: 'Verified Therapists',
    desc: 'Every therapist is manually reviewed and license-verified by our clinical team.',
  },
  {
    icon: <Calendar className="w-6 h-6 text-accent" />,
    title: 'Schedule Ahead',
    desc: 'Book a session in advance when you prefer a specific practitioner or dedicated time slot.',
  },
  {
    icon: <Globe className="w-6 h-6 text-accent" />,
    title: 'India & Global',
    desc: 'Therapists and clients from India and worldwide, with multilingual consultations supported.',
  },
  {
    icon: <Shield className="w-6 h-6 text-accent" />,
    title: 'Private & Secure',
    desc: 'End-to-end encrypted sessions. Your conversations stay strictly between you and your therapist.',
  },
];

export default function LandingPage() {
  const vid1Ref = React.useRef<HTMLVideoElement>(null);
  const vid2Ref = React.useRef<HTMLVideoElement>(null);

  // Seek video2 to the midpoint of the clip so the two copies are out of phase.
  // When video1 fades out at its end, video2 is at the midpoint — no hard cut visible.
  React.useEffect(() => {
    const vid2 = vid2Ref.current;
    if (!vid2) return;
    const onMeta = () => {
      if (vid2.duration && isFinite(vid2.duration)) {
        vid2.currentTime = vid2.duration / 2;
      }
    };
    if (vid2.readyState >= 1) {
      onMeta();
    } else {
      vid2.addEventListener('loadedmetadata', onMeta, { once: true });
    }
  }, []);
  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground font-body selection:bg-accent/20">
      {/* ── Top Hero Section with Fullscreen Video Background ──────────────── */}
      <div className="relative min-h-screen flex flex-col overflow-hidden">
        {/* Background Video – two staggered videos crossfade so the loop cut is invisible */}
        <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
          <video
            ref={vid1Ref}
            autoPlay
            loop
            muted
            playsInline
            style={{ animation: 'videoFade1 var(--vid-dur, 16s) linear infinite' }}
            className="absolute inset-0 w-full h-full object-cover will-change-[opacity]"
          >
            <source
              src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260319_015952_e1deeb12-8fb7-4071-a42a-60779fc64ab6.mp4"
              type="video/mp4"
            />
          </video>
          <video
            ref={vid2Ref}
            autoPlay
            loop
            muted
            playsInline
            style={{ animation: 'videoFade2 var(--vid-dur, 16s) linear infinite', animationDelay: '-8s' }}
            className="absolute inset-0 w-full h-full object-cover will-change-[opacity]"
          >
            <source
              src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260319_015952_e1deeb12-8fb7-4071-a42a-60779fc64ab6.mp4"
              type="video/mp4"
            />
          </video>
        </div>

        {/* ── Navbar ──────────────────────────────────────────────────────── */}
        <header className="relative z-20 flex items-center justify-between px-4 sm:px-6 md:px-12 lg:px-20 py-4 sm:py-5 font-body">
          {/* Left: Brand Logo */}
          <Link href="/" className="text-lg sm:text-xl font-semibold tracking-tight text-foreground flex items-center gap-1.5">
            <span className="text-accent text-base sm:text-lg">✦</span>
            <span className="text-foreground font-bold">Jarwis</span>
            <span className="text-muted-foreground font-medium">Help Me!</span>
          </Link>

          {/* Right: Nav links + Portal Actions + Mobile Drawer */}
          <div className="flex items-center gap-3 sm:gap-6 md:gap-8">
            <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-muted-foreground">
              <Link href="/donate" className="hover:text-foreground transition-colors">
                Support Mission
              </Link>
              <Link href="/login/client" className="hover:text-foreground transition-colors">
                Client Login
              </Link>
              <Link href="/login/therapist" className="text-accent hover:opacity-80 transition-colors">
                Therapist Portal
              </Link>
            </nav>

            <Link
              href="/register"
              className="hidden sm:inline-flex rounded-full px-5 py-2 text-sm font-medium bg-primary text-primary-foreground hover:opacity-90 transition-all shadow-sm items-center justify-center"
            >
              Get Started
            </Link>

            {/* Mobile Hamburger Drawer */}
            <MobileNavDrawer />
          </div>
        </header>

        {/* ── Hero Main Content ────────────────────────────────────────────── */}
        <main className="relative z-10 flex flex-col items-center w-full px-4 sm:px-6 flex-1 pt-6 md:pt-8 pb-12">
          {/* 1. Badge */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="mb-4 sm:mb-5"
          >
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-background/95 backdrop-blur-sm px-3.5 py-1 sm:px-4 sm:py-1.5 text-xs sm:text-sm text-muted-foreground font-body shadow-sm">
              <span className="w-2 h-2 rounded-full bg-accent animate-pulse"></span>
              <span>Now available in India &amp; internationally</span>
            </div>
          </motion.div>

          {/* 2. Headline with Instrument Serif */}
          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="text-center font-display text-3xl sm:text-5xl md:text-6xl lg:text-[4.75rem] leading-[1.08] sm:leading-[1.0] tracking-tight text-foreground max-w-2xl px-2"
          >
            HELP Available, <span className="italic">right when you need it</span>
          </motion.h1>

          {/* 3. Subheadline */}
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="mt-3 sm:mt-4 text-center text-sm sm:text-base md:text-lg text-muted-foreground max-w-[640px] leading-relaxed font-body px-2"
          >
            Connect instantly with verified therapists for live voice, video, or chat sessions.
            Free to use — supported by your generosity.
          </motion.p>

          {/* 4. Action Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="mt-6 flex flex-col sm:flex-row items-center gap-3 sm:gap-3.5 w-full sm:w-auto max-w-sm sm:max-w-none justify-center px-4 sm:px-0"
          >
            <Link
              href="/register?role=client"
              className="w-full sm:w-auto rounded-full px-6 py-3 text-sm font-medium font-body bg-primary text-primary-foreground hover:opacity-90 active:scale-[0.98] transition-all shadow-md inline-flex items-center justify-center h-12 sm:h-11"
            >
              I need help
            </Link>
            <Link
              href="/register?role=therapist"
              className="w-full sm:w-auto rounded-full px-6 py-3 text-sm font-medium font-body bg-background/95 backdrop-blur-sm border border-border text-foreground hover:bg-secondary active:scale-[0.98] transition-all shadow-sm inline-flex items-center justify-center h-12 sm:h-11"
            >
              I&apos;m here to help
            </Link>
            <div className="flex items-center justify-center mt-1 sm:mt-0">
              <button
                type="button"
                aria-label="Play video demo"
                className="h-11 w-11 rounded-full border-0 bg-background shadow-[0_2px_12px_rgba(0,0,0,0.08)] hover:bg-background/80 active:scale-95 flex items-center justify-center transition-transform hover:scale-105"
              >
                <Play className="h-4 w-4 fill-foreground text-foreground translate-x-0.5" />
              </button>
            </div>
          </motion.div>

        </main>
      </div>

      {/* ── Stats Section ─────────────────────────────────────────────────── */}
      <section className="relative z-10 py-16 px-6 bg-secondary/40 border-y border-border">
        <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          {stats.map((s) => (
            <div key={s.label} className="flex flex-col items-center">
              <div className="font-display text-4xl md:text-5xl font-bold tracking-tight text-foreground">
                {s.value}
              </div>
              <div className="text-sm text-muted-foreground mt-1.5 font-medium">
                {s.label}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Features Section ──────────────────────────────────────────────── */}
      <section className="relative z-10 py-24 px-6 md:px-12 lg:px-20 max-w-6xl mx-auto w-full">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <h2 className="font-display text-4xl md:text-5xl font-bold tracking-tight text-foreground mb-3">
            Everything you need to feel better
          </h2>
          <p className="text-base md:text-lg text-muted-foreground">
            Built for both clients and therapists, with care and human touch.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((f) => (
            <div
              key={f.title}
              className="rounded-2xl p-7 bg-background border border-border hover:border-accent/50 hover:shadow-lg transition-all duration-200 flex flex-col justify-between"
            >
              <div>
                <div className="w-12 h-12 rounded-xl bg-secondary/80 flex items-center justify-center mb-5">
                  {f.icon}
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2">
                  {f.title}
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {f.desc}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Call to Action ────────────────────────────────────────────────── */}
      <section className="relative z-10 py-20 px-6">
        <div className="max-w-4xl mx-auto rounded-3xl p-10 md:p-16 text-center bg-gradient-to-b from-secondary/60 to-secondary/20 border border-border shadow-xl backdrop-blur-sm">
          <h2 className="font-display text-4xl md:text-5xl font-bold tracking-tight text-foreground mb-4">
            Ready to start your journey?
          </h2>
          <p className="text-base md:text-lg text-muted-foreground max-w-md mx-auto mb-8 leading-relaxed">
            No subscriptions. No commitments. Just connect with someone who cares.
          </p>
          <Link
            href="/register"
            className="rounded-full px-8 py-4 text-base font-medium bg-primary text-primary-foreground hover:opacity-90 transition-all shadow-lg inline-flex items-center gap-2"
          >
            <span>Start for Free</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      {/* ── Footer ────────────────────────────────────────────────────────── */}
      <footer className="relative z-10 border-t border-border py-12 px-6 text-center bg-background">
        <div className="max-w-5xl mx-auto flex flex-col items-center gap-6">
          <div className="flex items-center gap-2">
            <span className="text-accent text-lg">✦</span>
            <span className="font-semibold text-foreground tracking-tight">Jarwis Help Me!</span>
          </div>

          <div className="flex items-center gap-6 flex-wrap justify-center text-sm text-muted-foreground">
            <Link href="/donate" className="hover:text-foreground text-accent transition-colors font-medium">
              Support Mission
            </Link>
            <span>•</span>
            <Link href="/login/client" className="hover:text-foreground transition-colors">
              Client Login
            </Link>
            <span>•</span>
            <Link href="/login/therapist" className="hover:text-foreground transition-colors">
              Therapist Portal
            </Link>
            <span>•</span>
            <Link href="/register" className="hover:text-foreground transition-colors">
              Get Started
            </Link>
          </div>

          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} Jarwis Help Me!. Built with care.
          </p>
        </div>
      </footer>
    </div>
  );
}
