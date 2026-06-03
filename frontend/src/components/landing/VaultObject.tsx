/*
 * VaultObject — a single monolithic metallic sculpture.
 * Silver / graphite / chrome spectrum, light environment.
 * Composition: chrome cap → main brushed-steel body (integrated indicator
 * strip + machined seal) → graphite plinth. One cohesive silhouette.
 */

const ID = "vault";

function sealTick(
  index: number,
  cx: number,
  cy: number,
  r1: number,
  r2: number,
) {
  const angle = (index * 30 - 90) * (Math.PI / 180);
  return {
    x1: cx + r1 * Math.cos(angle),
    y1: cy + r1 * Math.sin(angle),
    x2: cx + r2 * Math.cos(angle),
    y2: cy + r2 * Math.sin(angle),
  };
}

export default function VaultObject() {
  return (
    <svg
      viewBox="0 0 480 720"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      style={{ width: "100%", height: "auto", display: "block" }}
    >
      <defs>
        {/* Horizontal brushed-steel — fractal noise varying in Y only */}
        <filter id={`${ID}-brush`} x="0%" y="0%" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0 0.16" numOctaves="4" seed="5" result="noise" />
          <feColorMatrix type="saturate" values="0" in="noise" result="gray" />
          <feColorMatrix
            type="matrix"
            values="0 0 0 0 0.62  0 0 0 0 0.65  0 0 0 0 0.67  0.28 0.28 0.28 0 0"
            in="gray"
          />
        </filter>

        {/* Vertical micro-brush for the chrome cap */}
        <filter id={`${ID}-brush-v`} x="0%" y="0%" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0.22 0" numOctaves="3" seed="9" />
          <feColorMatrix type="saturate" values="0" />
          <feColorMatrix
            type="matrix"
            values="0 0 0 0 0.78  0 0 0 0 0.80  0 0 0 0 0.82  0.20 0.20 0.20 0 0"
          />
        </filter>

        {/* Atmospheric halo — soft silver bloom behind the sculpture */}
        <radialGradient id={`${ID}-halo`} cx="50%" cy="44%" r="56%">
          <stop offset="0%"   stopColor="rgba(255, 255, 255, 0.62)" />
          <stop offset="48%"  stopColor="rgba(232, 238, 240, 0.18)" />
          <stop offset="100%" stopColor="rgba(220, 226, 228, 0)"    />
        </radialGradient>

        {/* Ground reflection beneath the sculpture */}
        <radialGradient id={`${ID}-ground`} cx="50%" cy="50%" r="50%">
          <stop offset="0%"   stopColor="rgba(17, 19, 21, 0.16)" />
          <stop offset="58%"  stopColor="rgba(17, 19, 21, 0.04)" />
          <stop offset="100%" stopColor="rgba(17, 19, 21, 0)"    />
        </radialGradient>

        {/* Chrome cap — bright polished horizontal sweep */}
        <linearGradient id={`${ID}-cap`} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%"   stopColor="#8c969a" />
          <stop offset="18%"  stopColor="#dfe6e8" />
          <stop offset="42%"  stopColor="#ffffff" />
          <stop offset="58%"  stopColor="#f2f6f7" />
          <stop offset="82%"  stopColor="#aab2b6" />
          <stop offset="100%" stopColor="#6e7578" />
        </linearGradient>

        {/* Main brushed-steel body — full 11-stop chrome */}
        <linearGradient id={`${ID}-steel`} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%"   stopColor="#2a3034" stopOpacity="0.36" />
          <stop offset="9%"   stopColor="#94a0a8" stopOpacity="0.94" />
          <stop offset="20%"  stopColor="#ced8de" stopOpacity="0.96" />
          <stop offset="33%"  stopColor="#eef4f7" stopOpacity="0.98" />
          <stop offset="43%"  stopColor="#ffffff" stopOpacity="1"    />
          <stop offset="52%"  stopColor="#e4eef2" stopOpacity="0.96" />
          <stop offset="62%"  stopColor="#bccad2" stopOpacity="0.92" />
          <stop offset="72%"  stopColor="#dae8ed" stopOpacity="0.86" />
          <stop offset="82%"  stopColor="#8ba0a8" stopOpacity="0.78" />
          <stop offset="92%"  stopColor="#465a64" stopOpacity="0.52" />
          <stop offset="100%" stopColor="#222a30" stopOpacity="0.30" />
        </linearGradient>

        {/* Top-left specular catch for main body */}
        <radialGradient id={`${ID}-spec`} cx="28%" cy="8%" r="58%">
          <stop offset="0%"   stopColor="rgba(255, 255, 255, 0.86)" />
          <stop offset="52%"  stopColor="rgba(255, 255, 255, 0.22)" />
          <stop offset="100%" stopColor="rgba(255, 255, 255, 0)"    />
        </radialGradient>

        {/* Vertical sweep highlight on main body */}
        <linearGradient id={`${ID}-sweep`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%"   stopColor="rgba(255, 255, 255, 0)"    />
          <stop offset="35%"  stopColor="rgba(255, 255, 255, 0.42)" />
          <stop offset="55%"  stopColor="rgba(255, 255, 255, 0.58)" />
          <stop offset="80%"  stopColor="rgba(255, 255, 255, 0.18)" />
          <stop offset="100%" stopColor="rgba(255, 255, 255, 0)"    />
        </linearGradient>

        {/* Plinth — slightly darker brushed steel for the base */}
        <linearGradient id={`${ID}-plinth`} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%"   stopColor="#3a4046" />
          <stop offset="22%"  stopColor="#7a848a" />
          <stop offset="50%"  stopColor="#a8b2b8" />
          <stop offset="78%"  stopColor="#6b757a" />
          <stop offset="100%" stopColor="#252b30" />
        </linearGradient>

        {/* Graphite vertical sheen — for the recessed indicator strip */}
        <linearGradient id={`${ID}-graphite-v`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%"   stopColor="rgba(0, 0, 0, 0.34)"    />
          <stop offset="50%"  stopColor="rgba(20, 24, 26, 0.18)" />
          <stop offset="100%" stopColor="rgba(255, 255, 255, 0.10)" />
        </linearGradient>

        {/* Seal recess — slight darkening at center of machined seal */}
        <radialGradient id={`${ID}-well`} cx="50%" cy="50%" r="50%">
          <stop offset="0%"   stopColor="rgba(17, 19, 21, 0.14)" />
          <stop offset="100%" stopColor="rgba(17, 19, 21, 0.02)" />
        </radialGradient>

        {/* Status dot — tiny chrome bead */}
        <radialGradient id={`${ID}-dot`} cx="38%" cy="32%" r="62%">
          <stop offset="0%"   stopColor="#f4f7f8" />
          <stop offset="55%"  stopColor="#c8d2d6" />
          <stop offset="100%" stopColor="#6a7378" />
        </radialGradient>

        {/* Clip for the main brushed body — keeps interior details inside */}
        <clipPath id={`${ID}-main-clip`}>
          <rect x="100" y="140" width="240" height="440" rx="12" />
        </clipPath>
      </defs>

      {/* ── Atmospheric halo behind the sculpture ── */}
      <rect x="0" y="0" width="480" height="720" fill={`url(#${ID}-halo)`} />

      {/* ── Ground reflection beneath sculpture ── */}
      <ellipse cx="220" cy="678" rx="190" ry="13" fill={`url(#${ID}-ground)`} />

      {/* ── Chrome cap (top finish) ── */}
      <g>
        <rect x="140" y="110" width="160" height="26" rx="5" fill={`url(#${ID}-cap)`} />
        <rect x="140" y="110" width="160" height="26" rx="5"
          filter={`url(#${ID}-brush-v)`} opacity="0.26" />
        {/* Top edge bright catch */}
        <line x1="148" y1="110" x2="292" y2="110"
          stroke="rgba(255, 255, 255, 0.94)" strokeWidth="1" strokeLinecap="round" />
        {/* Bottom edge shadow seam against the body */}
        <line x1="142" y1="136" x2="298" y2="136"
          stroke="rgba(17, 19, 21, 0.18)" strokeWidth="0.6" />
      </g>

      {/* ── Main brushed-steel body (dominant mass) ── */}
      <g>
        {/* Body fill */}
        <rect x="100" y="140" width="240" height="440" rx="12" fill={`url(#${ID}-steel)`} />
        <rect x="100" y="140" width="240" height="440" rx="12" fill={`url(#${ID}-spec)`} />

        {/* Brushed texture clipped inside the body */}
        <g clipPath={`url(#${ID}-main-clip)`}>
          <rect x="100" y="140" width="240" height="440"
            filter={`url(#${ID}-brush)`} opacity="0.74" />
          {/* Vertical chrome highlight band */}
          <rect x="158" y="140" width="6" height="440"
            fill={`url(#${ID}-sweep)`} opacity="0.60" />
          {/* Right-shoulder mirror reflection */}
          <rect x="288" y="140" width="3" height="440"
            fill={`url(#${ID}-sweep)`} opacity="0.28" />
        </g>

        {/* Edge catches — define the silhouette */}
        <line x1="116" y1="140" x2="324" y2="140"
          stroke="rgba(255, 255, 255, 0.94)" strokeWidth="1.1" strokeLinecap="round" />
        <line x1="100" y1="160" x2="100" y2="560"
          stroke="rgba(255, 255, 255, 0.50)" strokeWidth="0.8" />
        <line x1="340" y1="160" x2="340" y2="560"
          stroke="rgba(17, 19, 21, 0.22)" strokeWidth="0.8" />

        {/* Integrated indicator strip — recessed near the top of the body */}
        <g clipPath={`url(#${ID}-main-clip)`}>
          <rect x="124" y="160" width="192" height="12" rx="3"
            fill={`url(#${ID}-graphite-v)`} />
          <rect x="124" y="160" width="192" height="12" rx="3"
            fill="none" stroke="rgba(17, 19, 21, 0.34)" strokeWidth="0.5" />
          {/* Status bead */}
          <circle cx="135" cy="166" r="2.8" fill={`url(#${ID}-dot)`} />
          {/* Faint chrome label dashes to the right of the bead */}
          <rect x="146" y="165" width="22" height="2" rx="1"
            fill="rgba(220, 226, 228, 0.42)" />
          <rect x="146" y="165" width="14" height="2" rx="1"
            fill="rgba(244, 247, 248, 0.62)" />
          {/* Right-aligned micro-label */}
          <rect x="278" y="165" width="28" height="2" rx="1"
            fill="rgba(220, 226, 228, 0.32)" />
        </g>

        {/* Subtle horizontal panel seams — quiet architecture */}
        <line x1="100" y1="240" x2="340" y2="240"
          stroke="rgba(17, 19, 21, 0.06)" strokeWidth="0.4" />
        <line x1="100" y1="500" x2="340" y2="500"
          stroke="rgba(17, 19, 21, 0.06)" strokeWidth="0.4" />

        {/* ── Machined circular seal — focal detail ── */}
        {/* Outer groove rings */}
        <circle cx="220" cy="362" r="68" fill="none"
          stroke="rgba(17, 19, 21, 0.10)" strokeWidth="0.6" />
        <circle cx="220" cy="362" r="60" fill="none"
          stroke="rgba(17, 19, 21, 0.14)" strokeWidth="0.5" />
        <circle cx="220" cy="362" r="54" fill="none"
          stroke="rgba(17, 19, 21, 0.08)" strokeWidth="0.4" />

        {/* Recessed well */}
        <circle cx="220" cy="362" r="44" fill={`url(#${ID}-well)`} />
        <circle cx="220" cy="362" r="44" fill="none"
          stroke="rgba(17, 19, 21, 0.22)" strokeWidth="0.9" />
        <circle cx="220" cy="362" r="36" fill="none"
          stroke="rgba(17, 19, 21, 0.10)" strokeWidth="0.4" />

        {/* Inner boss */}
        <circle cx="220" cy="362" r="22" fill="rgba(17, 19, 21, 0.10)" />
        <circle cx="220" cy="362" r="22" fill="none"
          stroke="rgba(17, 19, 21, 0.26)" strokeWidth="1" />

        {/* 12 radial tick marks */}
        {Array.from({ length: 12 }, (_, i) => {
          const t = sealTick(i, 220, 362, 56, 64);
          return (
            <line
              key={i}
              x1={t.x1} y1={t.y1}
              x2={t.x2} y2={t.y2}
              stroke="rgba(17, 19, 21, 0.20)"
              strokeWidth={i % 3 === 0 ? 1 : 0.5}
            />
          );
        })}

        {/* Center boss + reflection catch */}
        <circle cx="220" cy="362" r="4.5" fill="rgba(17, 19, 21, 0.32)" />
        <circle cx="220" cy="362" r="1.6" fill="rgba(255, 255, 255, 0.66)" />

        {/* DL monogram engraving */}
        <text
          x="220" y="367"
          textAnchor="middle"
          className="dl-vault-monogram"
          fontSize="11"
          fontWeight="500"
          letterSpacing="0.12em"
          fill="rgba(17, 19, 21, 0.26)"
        >
          DL
        </text>

        {/* Lower inscription — barely visible */}
        <rect x="148" y="528" width="80"  height="0.8" rx="0.4" fill="rgba(17, 19, 21, 0.08)" />
        <rect x="148" y="538" width="124" height="0.8" rx="0.4" fill="rgba(17, 19, 21, 0.06)" />
        <rect x="148" y="548" width="62"  height="0.8" rx="0.4" fill="rgba(17, 19, 21, 0.05)" />
      </g>

      {/* ── Graphite plinth (base) ── */}
      <g>
        <rect x="90" y="588" width="260" height="72" rx="10" fill={`url(#${ID}-plinth)`} />
        {/* Vertical sheen */}
        <rect x="90" y="588" width="260" height="72" rx="10"
          fill={`url(#${ID}-graphite-v)`} opacity="0.40" />
        {/* Top edge highlight */}
        <line x1="100" y1="588" x2="340" y2="588"
          stroke="rgba(255, 255, 255, 0.44)" strokeWidth="0.8" />
        {/* Bottom edge shadow */}
        <line x1="100" y1="660" x2="340" y2="660"
          stroke="rgba(0, 0, 0, 0.32)" strokeWidth="0.8" />
        {/* Center recessed slot */}
        <rect x="184" y="620" width="72" height="6" rx="2" fill="rgba(17, 19, 21, 0.30)" />
        <line x1="184" y1="620" x2="256" y2="620"
          stroke="rgba(0, 0, 0, 0.44)" strokeWidth="0.4" />
        <line x1="184" y1="626" x2="256" y2="626"
          stroke="rgba(255, 255, 255, 0.18)" strokeWidth="0.4" />
      </g>
    </svg>
  );
}
