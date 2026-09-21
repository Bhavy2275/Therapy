'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { useRef } from 'react';
import { animate } from 'animejs';
import {
  IconCalendar,
  IconClipboard,
  IconBolt,
  IconSettings,
} from '@/components/Icons';
import { Home } from 'lucide-react';

interface MobileBottomNavProps {
  role?: 'client' | 'therapist' | 'admin';
}

export default function MobileBottomNav({ role = 'client' }: MobileBottomNavProps) {
  const pathname = usePathname();
  const navRef = useRef<HTMLDivElement>(null);

  const scheduleHref =
    role === 'therapist' ? '/dashboard/therapist/schedule' : '/dashboard/schedule';

  const navItems = [
    {
      id: 'home',
      label: 'Home',
      href: '/dashboard',
      icon: (active: boolean) => (
        <Home
          className="w-5 h-5 transition-colors"
          color={active ? 'hsl(var(--accent))' : '#94a3b8'}
        />
      ),
      exact: true,
    },
    {
      id: 'instant',
      label: 'Instant',
      href: '/dashboard/session/new',
      icon: (active: boolean) => (
        <IconBolt
          size={20}
          color={active ? 'hsl(var(--accent))' : '#94a3b8'}
        />
      ),
      badge: 'LIVE',
    },
    {
      id: 'schedule',
      label: 'Schedule',
      href: scheduleHref,
      icon: (active: boolean) => (
        <IconCalendar
          size={20}
          color={active ? 'hsl(var(--accent))' : '#94a3b8'}
        />
      ),
    },
    {
      id: 'sessions',
      label: 'Sessions',
      href: '/dashboard/sessions',
      icon: (active: boolean) => (
        <IconClipboard
          size={20}
          color={active ? 'hsl(var(--accent))' : '#94a3b8'}
        />
      ),
    },
    {
      id: 'settings',
      label: 'Settings',
      href: '/dashboard/settings',
      icon: (active: boolean) => (
        <IconSettings
          size={20}
          color={active ? 'hsl(var(--accent))' : '#94a3b8'}
        />
      ),
    },
  ];

  function handleTabClick(e: React.MouseEvent<HTMLAnchorElement>) {
    const iconEl = e.currentTarget.querySelector('.nav-icon-container');
    if (iconEl) {
      animate(iconEl, {
        scale: [0.8, 1.2, 1],
        duration: 320,
        ease: 'outBack',
      });
    }
  }

  // Don't show bottom nav inside an active live call room so it doesn't obstruct call controls
  if (pathname.startsWith('/dashboard/session/') && pathname !== '/dashboard/session/new') {
    return null;
  }

  return (
    <nav
      ref={navRef}
      aria-label="Mobile Navigation"
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-background/95 backdrop-blur-xl border-t border-border shadow-[0_-4px_24px_rgba(0,0,0,0.06)]"
      style={{
        paddingBottom: 'max(0.6rem, env(safe-area-inset-bottom, 0.6rem))',
        paddingTop: '0.45rem',
      }}
    >
      <div className="flex items-center justify-around px-2 max-w-lg mx-auto">
        {navItems.map((item) => {
          const isActive = item.exact
            ? pathname === item.href
            : pathname.startsWith(item.href);

          return (
            <Link
              key={item.id}
              href={item.href}
              onClick={handleTabClick}
              className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition-all touch-callout-none relative ${
                isActive
                  ? 'text-foreground font-semibold'
                  : 'text-muted-foreground hover:text-foreground active:scale-95'
              }`}
              style={{ minWidth: 54, textDecoration: 'none' }}
            >
              {/* Active Indicator Dot */}
              {isActive && (
                <span
                  className="absolute -top-1 w-1.5 h-1.5 rounded-full"
                  style={{ background: 'hsl(var(--accent))' }}
                />
              )}

              {/* Icon with anime.js bounce */}
              <div className="nav-icon-container relative flex items-center justify-center mb-0.5">
                {item.icon(isActive)}
                {item.badge && (
                  <span className="absolute -top-1 -right-2 px-1 py-0.2 bg-rose-600 text-white font-bold text-[9px] rounded-full leading-tight">
                    {item.badge}
                  </span>
                )}
              </div>

              {/* Label */}
              <span
                className="text-[11px] tracking-tight leading-none"
                style={{
                  color: isActive ? 'hsl(var(--accent))' : undefined,
                }}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
