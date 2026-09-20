import React from 'react';
import SessionGuard from '@/components/SessionGuard';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <SessionGuard />
      {children}
    </>
  );
}
