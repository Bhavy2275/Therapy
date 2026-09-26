import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import AuthRecoveryListener from '@/components/AuthRecoveryListener';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  viewportFit: 'cover',
  themeColor: '#0f172a',
};

export const metadata: Metadata = {
  title: {
    template: '%s | Jarwis Help Me!',
    default: 'Jarwis Help Me! — Connect With a Therapist Instantly',
  },
  description:
    'Jarwis Help Me! connects you with verified therapists for live voice, video, or chat sessions — on demand or scheduled. Start healing today.',
  keywords: ['therapy', 'therapist', 'mental health', 'counseling', 'online therapy', 'jarwis help me'],
  openGraph: {
    type: 'website',
    locale: 'en_US',
    title: 'Jarwis Help Me! — Therapy Marketplace',
    description: 'Connect with verified therapists instantly with Jarwis Help Me!.',
    siteName: 'Jarwis Help Me!',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.variable} data-scroll-behavior="smooth">
      <body className="antialiased min-h-screen overscroll-none overflow-x-hidden">
        <AuthRecoveryListener />
        {children}
      </body>
    </html>
  );
}
