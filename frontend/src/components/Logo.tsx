interface LogoProps {
  /** Show the wordmark next to the icon */
  wordmark?: boolean
  /** Icon size in px (square) */
  size?: number
  className?: string
}

export function Logo({ wordmark = false, size = 28, className }: LogoProps) {
  const r = size / 40 // scale ratio relative to 40px design grid

  const bars = [
    { x: 6,  y: 28, w: 5, h: 7,  opacity: 0.35 },
    { x: 13, y: 22, w: 5, h: 13, opacity: 0.55 },
    { x: 20, y: 16, w: 5, h: 19, opacity: 0.85 },
    { x: 27, y: 10, w: 5, h: 25, opacity: 1,   accent: true },
  ]

  const icon = (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <rect width="40" height="40" rx="10" fill="hsl(215,30%,30%)" />
      {bars.map((b, i) => (
        <rect
          key={i}
          x={b.x}
          y={b.y}
          width={b.w}
          height={b.h}
          rx="1.5"
          fill={b.accent ? 'hsl(38,85%,56%)' : 'white'}
          opacity={b.opacity}
        />
      ))}
    </svg>
  )

  if (!wordmark) return <span className={className}>{icon}</span>

  return (
    <span className={`inline-flex items-center gap-2 ${className ?? ''}`}>
      {icon}
      <span
        style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 700, fontSize: size * 0.7, lineHeight: 1, letterSpacing: '-0.01em', color: 'hsl(215,25%,14%)' }}
      >
        cadim
      </span>
    </span>
  )
}
