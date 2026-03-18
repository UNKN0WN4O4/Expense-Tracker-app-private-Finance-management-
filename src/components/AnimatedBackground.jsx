/**
 * AnimatedBackground — Shared live background for ALL pages.
 * Renders: deep slate-950 base, violet/blue/purple animated orbs,
 * subtle grid, and slowly drifting particle dots.
 * Usage: <AnimatedBackground />   (place as first child of your page root)
 */
import React from 'react';

const PARTICLES = Array.from({ length: 20 }, (_, i) => ({
  id: i,
  left: `${(i * 17 + 5) % 100}%`,
  top: `${(i * 13 + 8) % 100}%`,
  size: i % 3 === 0 ? 'w-2 h-2' : 'w-1.5 h-1.5',
  color: i % 2 === 0 ? 'rgba(167,139,250,0.12)' : 'rgba(96,165,250,0.12)',
  duration: `${3 + (i % 4)}s`,
  delay: `${(i * 0.35).toFixed(1)}s`,
}));

export default function AnimatedBackground() {
  return (
    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
      {/* ── Base ── */}
      <div className="absolute inset-0 bg-slate-950" />

      {/* ── Primary orbs ── */}
      <div
        className="absolute rounded-full blur-[120px] animate-pulse"
        style={{ top: '-5%', left: '20%', width: '45%', height: '45%', background: 'radial-gradient(circle, rgba(124,58,237,0.25) 0%, transparent 70%)' }}
      />
      <div
        className="absolute rounded-full blur-[100px] animate-pulse"
        style={{ bottom: '-8%', right: '15%', width: '40%', height: '40%', background: 'radial-gradient(circle, rgba(59,130,246,0.2) 0%, transparent 70%)', animationDelay: '1.5s' }}
      />
      <div
        className="absolute rounded-full blur-[150px]"
        style={{ top: '35%', left: '40%', width: '55%', height: '55%', background: 'radial-gradient(circle, rgba(139,92,246,0.1) 0%, transparent 70%)', transform: 'translate(-50%,-50%)' }}
      />

      {/* ── Secondary accent orbs ── */}
      <div
        className="absolute rounded-full blur-[80px] animate-pulse"
        style={{ top: '60%', left: '5%', width: '25%', height: '25%', background: 'radial-gradient(circle, rgba(99,102,241,0.15) 0%, transparent 70%)', animationDelay: '2s', animationDuration: '4s' }}
      />
      <div
        className="absolute rounded-full blur-[80px] animate-pulse"
        style={{ top: '10%', right: '5%', width: '22%', height: '22%', background: 'radial-gradient(circle, rgba(167,139,250,0.12) 0%, transparent 70%)', animationDelay: '3s', animationDuration: '5s' }}
      />

      {/* ── Subtle grid overlay ── */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `linear-gradient(rgba(139,92,246,0.04) 1px, transparent 1px),
                            linear-gradient(90deg, rgba(139,92,246,0.04) 1px, transparent 1px)`,
          backgroundSize: '64px 64px',
        }}
      />

      {/* ── Floating particles ── */}
      {PARTICLES.map(p => (
        <div
          key={p.id}
          className={`absolute rounded-full animate-pulse ${p.size}`}
          style={{
            left: p.left,
            top: p.top,
            backgroundColor: p.color,
            animationDuration: p.duration,
            animationDelay: p.delay,
          }}
        />
      ))}

      {/* ── Moving diagonal gradient lines (SVG) ── */}
      <svg className="absolute inset-0 w-full h-full opacity-[0.06]" preserveAspectRatio="none">
        <defs>
          <linearGradient id="lineGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%"   stopColor="#8B5CF6" stopOpacity="0" />
            <stop offset="50%"  stopColor="#8B5CF6" stopOpacity="1" />
            <stop offset="100%" stopColor="#3B82F6" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d="M-200,400 Q300,100 600,450 T1400,300 T2000,450" fill="none" stroke="url(#lineGrad)" strokeWidth="1.5">
          <animate attributeName="d" dur="18s" repeatCount="indefinite"
            values="M-200,400 Q300,100 600,450 T1400,300 T2000,450;
                    M-200,300 Q300,500 600,200 T1400,450 T2000,300;
                    M-200,400 Q300,100 600,450 T1400,300 T2000,450" />
        </path>
        <path d="M-200,600 Q400,300 800,600 T1600,400" fill="none" stroke="url(#lineGrad)" strokeWidth="1" opacity="0.5">
          <animate attributeName="d" dur="22s" repeatCount="indefinite"
            values="M-200,600 Q400,300 800,600 T1600,400;
                    M-200,400 Q400,700 800,300 T1600,600;
                    M-200,600 Q400,300 800,600 T1600,400" />
        </path>
      </svg>
    </div>
  );
}
