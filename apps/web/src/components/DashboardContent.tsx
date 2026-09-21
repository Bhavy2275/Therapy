'use client';

import React from 'react';
import { usePathname } from 'next/navigation';

export default function DashboardContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // On active live call room, do not add bottom padding so video call fits 100vh perfectly without white space
  const isCallRoom = pathname.startsWith('/dashboard/session/') && pathname !== '/dashboard/session/new';

  return (
    <div className={isCallRoom ? 'w-full min-h-screen' : 'pb-16 md:pb-0 w-full min-h-screen'}>
      {children}
    </div>
  );
}
