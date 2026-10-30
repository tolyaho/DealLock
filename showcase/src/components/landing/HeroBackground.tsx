const ID = "bg";

export default function HeroBackground() {
  return (
    <svg
      viewBox="0 0 1440 900"
      preserveAspectRatio="xMidYMid slice"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        display: "block",
        pointerEvents: "none",
        zIndex: 0,
      }}
    >
      <defs>
        {/* Horizontal brushed steel — zero X frequency = horizontal stripes */}
        <filter id={`${ID}-brush`} x="0%" y="0%" width="100%" height="100%">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0 0.062"
            numOctaves="3"
            seed="17"
            result="noise"
          />
          <feColorMatrix type="saturate" values="0" in="noise" result="gray" />
          <feColorMatrix
            type="matrix"
            values="0 0 0 0 0.78  0 0 0 0 0.80  0 0 0 0 0.82  0.22 0.22 0.22 0 0"
            in="gray"
          />
        </filter>

        {/* Faint metallic grain — non-directional finer noise */}
        <filter id={`${ID}-grain`} x="0%" y="0%" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed="9" />
          <feColorMatrix type="saturate" values="0" />
          <feColorMatrix
            type="matrix"
            values="0 0 0 0 0.62  0 0 0 0 0.64  0 0 0 0 0.66  0.06 0.06 0.06 0 0"
          />
        </filter>

        {/* Chrome bloom — soft luminous well behind the right-side vault */}
        <radialGradient id={`${ID}-bloom`} cx="72%" cy="48%" r="40%">
          <stop offset="0%"   stopColor="rgba(255,255,255,0.62)" />
          <stop offset="38%"  stopColor="rgba(232,238,238,0.26)" />
          <stop offset="100%" stopColor="rgba(220,226,228,0)"    />
        </radialGradient>

        {/* Chrome atmosphere haze — broader, upper-mid */}
        <radialGradient id={`${ID}-haze`} cx="58%" cy="32%" r="72%">
          <stop offset="0%"   stopColor="rgba(204,212,216,0.20)" />
          <stop offset="100%" stopColor="rgba(204,212,216,0)"    />
        </radialGradient>

        {/* Primary diagonal partition — cool silver plane */}
        <linearGradient id={`${ID}-diag1`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%"   stopColor="rgba(200,206,209,0)"    />
          <stop offset="40%"  stopColor="rgba(216,222,224,0.16)" />
          <stop offset="52%"  stopColor="rgba(232,238,240,0.26)" />
          <stop offset="63%"  stopColor="rgba(216,222,224,0.14)" />
          <stop offset="100%" stopColor="rgba(200,206,209,0)"    />
        </linearGradient>

        {/* Secondary diagonal partition — softer, opposite cant */}
        <linearGradient id={`${ID}-diag2`} x1="100%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%"   stopColor="rgba(204,210,213,0)"    />
          <stop offset="48%"  stopColor="rgba(220,226,228,0.10)" />
          <stop offset="56%"  stopColor="rgba(232,238,240,0.16)" />
          <stop offset="64%"  stopColor="rgba(220,226,228,0.08)" />
          <stop offset="100%" stopColor="rgba(204,210,213,0)"    />
        </linearGradient>

        {/* Horizontal reflective sweep — upper third */}
        <linearGradient id={`${ID}-sweep-top`} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%"   stopColor="rgba(255,255,255,0)"    />
          <stop offset="30%"  stopColor="rgba(255,255,255,0.10)" />
          <stop offset="55%"  stopColor="rgba(255,255,255,0.18)" />
          <stop offset="80%"  stopColor="rgba(255,255,255,0.08)" />
          <stop offset="100%" stopColor="rgba(255,255,255,0)"    />
        </linearGradient>

        {/* Lower reflective trough */}
        <linearGradient id={`${ID}-sweep-bot`} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%"   stopColor="rgba(184,192,196,0)"    />
          <stop offset="40%"  stopColor="rgba(184,192,196,0.08)" />
          <stop offset="60%"  stopColor="rgba(184,192,196,0.12)" />
          <stop offset="100%" stopColor="rgba(184,192,196,0)"    />
        </linearGradient>

        {/* Seam fades */}
        <linearGradient id={`${ID}-sf1`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%"   stopColor="rgba(128,136,140,0)"    />
          <stop offset="14%"  stopColor="rgba(128,136,140,0.22)" />
          <stop offset="86%"  stopColor="rgba(128,136,140,0.22)" />
          <stop offset="100%" stopColor="rgba(128,136,140,0)"    />
        </linearGradient>

        <linearGradient id={`${ID}-sf2`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%"   stopColor="rgba(128,136,140,0)"    />
          <stop offset="18%"  stopColor="rgba(128,136,140,0.12)" />
          <stop offset="82%"  stopColor="rgba(128,136,140,0.12)" />
          <stop offset="100%" stopColor="rgba(128,136,140,0)"    />
        </linearGradient>

        <linearGradient id={`${ID}-sf3`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%"   stopColor="rgba(128,136,140,0)"    />
          <stop offset="22%"  stopColor="rgba(128,136,140,0.08)" />
          <stop offset="78%"  stopColor="rgba(128,136,140,0.08)" />
          <stop offset="100%" stopColor="rgba(128,136,140,0)"    />
        </linearGradient>
      </defs>

      {/* Brushed steel texture */}
      <rect x="0" y="0" width="1440" height="900"
        filter={`url(#${ID}-brush)`}
        opacity="0.32"
      />

      {/* Fine metallic grain — barely visible, adds material */}
      <rect x="0" y="0" width="1440" height="900"
        filter={`url(#${ID}-grain)`}
        opacity="0.06"
      />

      {/* Secondary diagonal partition — softer counter-cant */}
      <polygon
        points="240,0 520,0 1040,900 760,900"
        fill={`url(#${ID}-diag2)`}
      />

      {/* Primary diagonal partition plane */}
      <polygon
        points="875,0 1155,0 715,900 435,900"
        fill={`url(#${ID}-diag1)`}
      />

      {/* Vertical panel seams */}
      <line x1="338"  y1="0" x2="338"  y2="900"
        stroke={`url(#${ID}-sf1)`} strokeWidth="0.5" />
      <line x1="1098" y1="0" x2="1098" y2="900"
        stroke={`url(#${ID}-sf2)`} strokeWidth="0.5" />
      <line x1="718"  y1="0" x2="718"  y2="900"
        stroke={`url(#${ID}-sf3)`} strokeWidth="0.4" />
      <line x1="208"  y1="0" x2="208"  y2="900"
        stroke="rgba(128,136,140,0.06)" strokeWidth="0.4" />
      <line x1="1232" y1="0" x2="1232" y2="900"
        stroke="rgba(128,136,140,0.06)" strokeWidth="0.4" />

      {/* Horizontal panel joints */}
      <line x1="0" y1="308" x2="1440" y2="308"
        stroke="rgba(128,136,140,0.08)" strokeWidth="0.4" />
      <line x1="0" y1="612" x2="1440" y2="612"
        stroke="rgba(128,136,140,0.06)" strokeWidth="0.4" />

      {/* Upper reflective sweep */}
      <rect x="0" y="124" width="1440" height="120"
        fill={`url(#${ID}-sweep-top)`}
      />

      {/* Lower reflective trough */}
      <rect x="0" y="668" width="1440" height="84"
        fill={`url(#${ID}-sweep-bot)`}
      />

      {/* Chrome atmosphere haze (over everything else) */}
      <rect x="0" y="0" width="1440" height="900"
        fill={`url(#${ID}-haze)`}
      />

      {/* Chrome bloom behind vault — last so it sits at the focal plane */}
      <rect x="0" y="0" width="1440" height="900"
        fill={`url(#${ID}-bloom)`}
      />

      {/* Architectural inset detail — top right, barely visible */}
      <rect x="1092" y="66" width="238" height="156" rx="2"
        fill="none"
        stroke="rgba(128,136,140,0.10)"
        strokeWidth="0.5"
      />
      <rect x="1110" y="84" width="202" height="120" rx="1"
        fill="rgba(208,213,216,0.05)"
        stroke="rgba(128,136,140,0.07)"
        strokeWidth="0.4"
      />
      <line x1="1110" y1="120" x2="1312" y2="120"
        stroke="rgba(128,136,140,0.06)" strokeWidth="0.4" />
    </svg>
  );
}
