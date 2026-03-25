'use client';

interface LogoProps {
  size?: number;
  collapsed?: boolean;
  showText?: boolean;
}

export default function Logo({ size = 32, collapsed = false, showText = true }: LogoProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: collapsed ? 0 : 10 }}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 64 64"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Outer hexagon - shield shape */}
        <path
          d="M32 2L58 16V48L32 62L6 48V16L32 2Z"
          fill="url(#gradient-bg)"
          stroke="url(#gradient-border)"
          strokeWidth="2"
        />

        {/* K8s wheel - center hub */}
        <circle cx="32" cy="32" r="6" fill="white" opacity="0.95" />
        <circle cx="32" cy="32" r="3.5" fill="url(#gradient-center)" />

        {/* K8s wheel - 7 spokes (pre-computed static coordinates) */}
        <line x1="40" y1="32" x2="51" y2="32" stroke="white" strokeWidth="2.2" strokeLinecap="round" opacity="0.9" />
        <circle cx="54" cy="32" r="3.2" fill="white" opacity="0.9" />
        <line x1="37" y1="25.7" x2="43.9" y2="17.1" stroke="white" strokeWidth="2.2" strokeLinecap="round" opacity="0.9" />
        <circle cx="45.9" cy="14.8" r="3.2" fill="white" opacity="0.9" />
        <line x1="30.2" y1="24.2" x2="22.3" y2="14.8" stroke="white" strokeWidth="2.2" strokeLinecap="round" opacity="0.9" />
        <circle cx="20.3" cy="12.4" r="3.2" fill="white" opacity="0.9" />
        <line x1="26" y1="28.5" x2="14.8" y2="22.8" stroke="white" strokeWidth="2.2" strokeLinecap="round" opacity="0.9" />
        <circle cx="12.4" cy="21.6" r="3.2" fill="white" opacity="0.9" />
        <line x1="26" y1="35.5" x2="14.8" y2="41.2" stroke="white" strokeWidth="2.2" strokeLinecap="round" opacity="0.9" />
        <circle cx="12.4" cy="42.4" r="3.2" fill="white" opacity="0.9" />
        <line x1="30.2" y1="39.8" x2="22.3" y2="49.2" stroke="white" strokeWidth="2.2" strokeLinecap="round" opacity="0.9" />
        <circle cx="20.3" cy="51.6" r="3.2" fill="white" opacity="0.9" />
        <line x1="37" y1="38.3" x2="43.9" y2="46.9" stroke="white" strokeWidth="2.2" strokeLinecap="round" opacity="0.9" />
        <circle cx="45.9" cy="49.2" r="3.2" fill="white" opacity="0.9" />

        {/* Gradients */}
        <defs>
          <linearGradient id="gradient-bg" x1="6" y1="2" x2="58" y2="62">
            <stop offset="0%" stopColor="#326CE5" />
            <stop offset="100%" stopColor="#1A3F8B" />
          </linearGradient>
          <linearGradient id="gradient-border" x1="6" y1="2" x2="58" y2="62">
            <stop offset="0%" stopColor="#5B8DEF" />
            <stop offset="100%" stopColor="#2855B8" />
          </linearGradient>
          <linearGradient id="gradient-center" x1="28" y1="28" x2="36" y2="36">
            <stop offset="0%" stopColor="#326CE5" />
            <stop offset="100%" stopColor="#1A3F8B" />
          </linearGradient>
        </defs>
      </svg>
      {showText && !collapsed && (
        <span style={{
          fontSize: size * 0.5,
          fontWeight: 700,
          letterSpacing: '-0.02em',
          background: 'linear-gradient(135deg, #326CE5, #1A3F8B)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          whiteSpace: 'nowrap',
        }}>
          K8s Admin
        </span>
      )}
    </div>
  );
}
