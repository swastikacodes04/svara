import React from 'react';

export const WaveformVisual: React.FC = () => {
  // Subtle pitch-contour inspired harmonic curves representing Svara movement around Sa (0)
  return (
    <div
      className="relative w-full overflow-hidden rounded-xl border border-[#E5E7EB] bg-white p-6 md:p-8"
      aria-label="Acoustic pitch contour illustration"
    >
      <div className="mb-4 flex items-center justify-between border-b border-[#E5E7EB] pb-3">
        <span className="font-mono text-xs text-[#34495E] tabular-nums">
          p(t) = 12 log2( f(t) / f_tonic )
        </span>
        <span className="text-xs text-[#87998C]">
          Tonic-Normalised Contour
        </span>
      </div>

      <svg
        viewBox="0 0 640 240"
        className="h-auto w-full"
        role="img"
        aria-label="Stylised pitch contour with Gamaka glide and Swara reference lines"
      >
        {/* Horizontal Swara reference grid */}
        {[
          { y: 40, label: "Sa' (+12)" },
          { y: 80, label: 'Pa (+7)' },
          { y: 120, label: 'Ga (+4)' },
          { y: 160, label: 'Re (+2)' },
          { y: 200, label: 'Sa (0)' },
        ].map((line) => (
          <g key={line.label}>
            <line
              x1="64"
              y1={line.y}
              x2="620"
              y2={line.y}
              stroke="#E5E7EB"
              strokeWidth="1"
              strokeDasharray={line.y === 200 ? undefined : '4 4'}
            />
            <text
              x="8"
              y={line.y + 4}
              fill="#6B7280"
              fontSize="10"
              fontFamily="JetBrains Mono, monospace"
            >
              {line.label}
            </text>
          </g>
        ))}

        {/* Subtle harmonic envelope shadow */}
        <path
          d="M 68 200 C 110 200, 125 162, 165 158 C 205 154, 215 118, 255 120 C 280 122, 290 105, 315 84 C 345 60, 365 92, 395 78 C 425 64, 445 42, 485 42 C 515 42, 535 112, 565 124 C 585 132, 600 185, 616 198 L 616 200 L 68 200 Z"
          fill="#87998C"
          fillOpacity="0.08"
        />

        {/* Secondary harmonic trace */}
        <path
          d="M 68 196 Q 130 176, 175 154 T 275 122 T 375 88 T 485 52 T 616 192"
          fill="none"
          stroke="#B89B62"
          strokeWidth="1.4"
          strokeOpacity="0.55"
          strokeDasharray="3 4"
        />

        {/* Primary F0 pitch contour with meend glides and kampita oscillation */}
        <path
          d="M 68 200 C 110 200, 125 162, 165 158 C 185 156, 195 164, 210 144 C 228 120, 238 118, 255 120 C 272 122, 282 112, 295 98 C 312 80, 326 84, 344 74 C 362 64, 376 86, 395 78 C 422 66, 445 42, 485 42 C 515 42, 535 112, 565 124 C 585 132, 600 185, 616 198"
          fill="none"
          stroke="#34495E"
          strokeWidth="2.5"
          strokeLinecap="round"
        />

        {/* Key inflection markers (Vadi / Samvadi / Meend nodes) */}
        {[
          { cx: 165, cy: 158, r: 4, fill: '#34495E' },
          { cx: 255, cy: 120, r: 5, fill: '#B89B62' },
          { cx: 395, cy: 78, r: 4, fill: '#34495E' },
          { cx: 485, cy: 42, r: 5, fill: '#B89B62' },
          { cx: 616, cy: 198, r: 4, fill: '#34495E' },
        ].map((pt, i) => (
          <circle
            key={i}
            cx={pt.cx}
            cy={pt.cy}
            r={pt.r}
            fill={pt.fill}
            stroke="#FFFFFF"
            strokeWidth="1.5"
          />
        ))}
      </svg>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[#E5E7EB] pt-3 text-xs text-[#4B5563]">
        <span>Meend glide &amp; Andolan inflection envelope</span>
        <span className="font-mono tabular-nums text-[#34495E]">
          Semitone domain · Zero-padded unvoiced gaps
        </span>
      </div>
    </div>
  );
};
