'use client';

import React, { useRef, useState } from 'react';
import Link from 'next/link';
import { animate } from 'animejs';

interface DashCardProps {
  icon: React.ReactNode;
  title: string;
  desc: string;
  badge: string;
  href?: string;
  badgeColor?: string;
}

interface Ripple {
  x: number;
  y: number;
  size: number;
  id: number;
}

export default function DashCardClient({
  icon,
  title,
  desc,
  badge,
  href,
  badgeColor = '#4b5563',
}: DashCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const badgeRef = useRef<HTMLSpanElement>(null);
  const buttonRef = useRef<HTMLSpanElement>(null);
  const [ripples, setRipples] = useState<Ripple[]>([]);

  const isInstant = title.toLowerCase().includes('instant');

  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height) * 1.5;
    const x = e.clientX - rect.left - size / 2;
    const y = e.clientY - rect.top - size / 2;
    const newRipple: Ripple = { x, y, size, id: Date.now() };

    setRipples((prev) => [...prev.slice(-2), newRipple]);
    setTimeout(() => {
      setRipples((prev) => prev.filter((r) => r.id !== newRipple.id));
    }, 600);

    animate(cardRef.current, {
      scale: 0.96,
      duration: 120,
      ease: 'outQuad',
    });

    if (badgeRef.current) {
      animate(badgeRef.current, {
        scale: 0.92,
        duration: 120,
        ease: 'outQuad',
      });
    }

    if (buttonRef.current) {
      animate(buttonRef.current, {
        scale: 0.94,
        duration: 120,
        ease: 'outQuad',
      });
    }
  }

  function handlePointerUp() {
    if (cardRef.current) {
      animate(cardRef.current, {
        scale: [0.96, 1.02, 1],
        duration: 340,
        ease: 'outElastic(1, .6)',
      });
    }
    if (badgeRef.current) {
      animate(badgeRef.current, {
        scale: [0.92, 1.12, 1],
        duration: 320,
        ease: 'outBack',
      });
    }
    if (buttonRef.current) {
      animate(buttonRef.current, {
        scale: [0.94, 1.08, 1],
        duration: 320,
        ease: 'outBack',
      });
    }
  }

  const card = (
    <div
      ref={cardRef}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      className="feature-card select-none"
      style={{
        borderRadius: '1.25rem',
        padding: '1.75rem',
        opacity: href ? 1 : 0.75,
        height: '100%',
        cursor: href ? 'pointer' : 'default',
        position: 'relative',
        overflow: 'hidden',
        background: isInstant ? 'linear-gradient(135deg, #ffffff 0%, #f8faff 100%)' : '#ffffff',
        border: isInstant ? '2px solid rgba(59, 130, 246, 0.45)' : '1px solid #e2e8f0',
        boxShadow: isInstant
          ? '0 10px 30px rgba(59, 130, 246, 0.12), 0 2px 8px rgba(59, 130, 246, 0.08)'
          : '0 2px 8px rgba(0,0,0,0.03)',
        transition: 'box-shadow 0.2s ease, border-color 0.2s ease',
        touchAction: 'manipulation',
        WebkitTapHighlightColor: 'transparent',
      }}
    >
      {/* Visual Ripple elements */}
      {ripples.map((r) => (
        <span
          key={r.id}
          style={{
            position: 'absolute',
            left: r.x,
            top: r.y,
            width: r.size,
            height: r.size,
            borderRadius: '50%',
            background: isInstant ? 'rgba(59, 130, 246, 0.22)' : 'rgba(148, 163, 184, 0.2)',
            pointerEvents: 'none',
            transform: 'scale(0)',
            animation: 'cardRipple 0.6s cubic-bezier(0, 0, 0.2, 1) forwards',
            zIndex: 1,
          }}
        />
      ))}

      {isInstant && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            right: 0,
            width: 120,
            height: 120,
            background: 'radial-gradient(circle at top right, rgba(59, 130, 246, 0.18), transparent 70%)',
            pointerEvents: 'none',
          }}
        />
      )}

      <div style={{ position: 'relative', zIndex: 2 }}>
        <div style={{ marginBottom: '0.85rem' }}>{icon}</div>
        <h2 style={{ fontWeight: 700, marginBottom: '0.4rem', fontSize: '1.1rem', color: '#0f172a' }}>
          {title}
        </h2>
        <p style={{ color: '#64748b', fontSize: '0.875rem', lineHeight: 1.6, marginBottom: '1.25rem' }}>
          {desc}
        </p>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap' }}>
          <span
            ref={badgeRef}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              background: href ? `${badgeColor}15` : '#f1f5f9',
              border: `1px solid ${href ? `${badgeColor}40` : '#e2e8f0'}`,
              borderRadius: '0.5rem',
              padding: '0.35rem 0.8rem',
              fontSize: '0.78rem',
              color: href ? badgeColor : '#64748b',
              fontWeight: 700,
              boxShadow: isInstant ? '0 2px 8px rgba(16, 185, 129, 0.15)' : 'none',
              transition: 'transform 0.15s ease',
            }}
          >
            {isInstant && (
              <span
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: '50%',
                  background: badgeColor,
                  display: 'inline-block',
                  boxShadow: `0 0 6px ${badgeColor}`,
                  animation: 'pulse 2s infinite',
                }}
              />
            )}
            {badge}
          </span>

          {href && (
            <span
              ref={buttonRef}
              style={{
                fontSize: '0.85rem',
                fontWeight: 700,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                padding: isInstant ? '0.45rem 1rem' : '0.3rem 0.6rem',
                borderRadius: '0.6rem',
                background: isInstant ? '#2563eb' : 'transparent',
                color: isInstant ? '#ffffff' : badgeColor,
                boxShadow: isInstant ? '0 4px 12px rgba(37, 99, 235, 0.25)' : 'none',
                transition: 'all 0.15s ease',
              }}
            >
              <span>{isInstant ? 'Start Live Matching' : 'Open'}</span>
              <span>→</span>
            </span>
          )}
        </div>
      </div>
    </div>
  );

  if (href) {
    return (
      <Link href={href} style={{ textDecoration: 'none', display: 'block', height: '100%' }}>
        {card}
      </Link>
    );
  }

  return card;
}
