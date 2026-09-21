import React from 'react';
import SessionGuard from '@/components/SessionGuard';
import MobileBottomNav from '@/components/MobileBottomNav';
import { createClient } from '@/lib/supabase/server';

import DashboardContent from '@/components/DashboardContent';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let role: 'client' | 'therapist' | 'admin' = 'client';
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: userRow } = await supabase
        .from('users')
        .select('role')
        .eq('id', user.id)
        .single();
      if (userRow?.role) {
        role = userRow.role as 'client' | 'therapist' | 'admin';
      }
    }
  } catch {
    // default to client
  }

  return (
    <>
      <SessionGuard />
      <DashboardContent>
        {children}
      </DashboardContent>
      <MobileBottomNav role={role} />
    </>
  );
}
