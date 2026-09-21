'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { animate, stagger } from 'animejs';
import { Menu, X, Heart, User, Sparkles, Shield, ArrowRight } from 'lucide-react';

export default function MobileNavDrawer() {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const itemsRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  // Close menu on route navigation
  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  // Prevent background scrolling when menu is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // anime.js entrance animation when drawer opens
  useEffect(() => {
    if (isOpen && itemsRef.current) {
      const items = itemsRef.current.querySelectorAll('.drawer-animate-item');
      animate(items, {
        opacity: [0, 1],
        translateY: [18, 0],
        delay: stagger(45, { start: 60 }),
        duration: 380,
        ease: 'outQuad',
      });
    }
  }, [isOpen]);

  return (
    <div className="md:hidden">
      {/* Hamburger Toggle Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-label={isOpen ? 'Close menu' : 'Open menu'}
        className="w-10 h-10 rounded-full flex items-center justify-center bg-secondary/80 text-foreground hover:bg-secondary active:scale-95 transition-all border border-border"
      >
        {isOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
      </button>

      {/* Slide-down Drawer Overlay */}
      {isOpen && (
        <div
          ref={menuRef}
          className="fixed inset-0 z-50 flex flex-col bg-background/98 backdrop-blur-xl animate-in fade-in duration-200"
          style={{ height: '100dvh' }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-5 border-b border-border/60">
            <Link
              href="/"
              onClick={() => setIsOpen(false)}
              className="text-xl font-semibold tracking-tight text-foreground flex items-center gap-1.5"
            >
              <span className="text-accent text-lg">✦</span>
              <span className="text-foreground font-bold">Jarwis</span>
              <span className="text-muted-foreground font-medium">Help Me!</span>
            </Link>

            <button
              type="button"
              onClick={() => setIsOpen(false)}
              aria-label="Close menu"
              className="w-10 h-10 rounded-full flex items-center justify-center bg-secondary text-foreground hover:bg-secondary/80 active:scale-95 transition-all"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Nav Items with staggered anime.js animation */}
          <div
            ref={itemsRef}
            className="flex-1 overflow-y-auto px-6 py-6 flex flex-col justify-between"
          >
            <div className="flex flex-col gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1 px-3">
                Navigation
              </span>

              <Link
                href="/register?role=client"
                onClick={() => setIsOpen(false)}
                className="drawer-animate-item flex items-center justify-between p-3.5 rounded-xl bg-primary text-primary-foreground font-medium shadow-sm active:scale-[0.98] transition-transform"
              >
                <div className="flex items-center gap-3">
                  <Sparkles className="w-5 h-5 text-accent" />
                  <span>I need help (Instant Matching)</span>
                </div>
                <ArrowRight className="w-4 h-4 opacity-80" />
              </Link>

              <Link
                href="/register?role=therapist"
                onClick={() => setIsOpen(false)}
                className="drawer-animate-item flex items-center justify-between p-3.5 rounded-xl bg-secondary/80 border border-border text-foreground font-medium active:scale-[0.98] transition-transform"
              >
                <div className="flex items-center gap-3">
                  <Shield className="w-5 h-5 text-accent" />
                  <span>I&apos;m here to help (Therapist Signup)</span>
                </div>
                <ArrowRight className="w-4 h-4 opacity-60" />
              </Link>

              <div className="h-px bg-border/60 my-2" />

              <Link
                href="/donate"
                onClick={() => setIsOpen(false)}
                className="drawer-animate-item flex items-center gap-3 p-3.5 rounded-xl hover:bg-secondary text-foreground transition-colors font-medium"
              >
                <Heart className="w-5 h-5 text-rose-500" />
                <span>Support Mission (Donations)</span>
              </Link>

              <Link
                href="/login/client"
                onClick={() => setIsOpen(false)}
                className="drawer-animate-item flex items-center gap-3 p-3.5 rounded-xl hover:bg-secondary text-foreground transition-colors font-medium"
              >
                <User className="w-5 h-5 text-accent" />
                <span>Client Login</span>
              </Link>

              <Link
                href="/login/therapist"
                onClick={() => setIsOpen(false)}
                className="drawer-animate-item flex items-center gap-3 p-3.5 rounded-xl hover:bg-secondary text-accent transition-colors font-medium"
              >
                <Shield className="w-5 h-5 text-accent" />
                <span>Therapist Portal</span>
              </Link>
            </div>

            {/* Bottom info banner */}
            <div className="drawer-animate-item pt-6 border-t border-border/60 text-center">
              <div className="inline-flex items-center gap-2 rounded-full border border-border bg-secondary/50 px-3.5 py-1 text-xs text-muted-foreground mb-3">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <span>Verified therapists ready 24/7</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Jarwis Help Me! — Free to connect, powered by care.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
