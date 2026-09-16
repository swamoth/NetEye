/**
 * NetEye mark: a wire globe with an orbit sweeping past it to a spark. Drawn with strokes in
 * `currentColor` so it takes the ink of wherever it sits (the metal disc in the header, the
 * boot screen). The favicon in app/icon.svg is the same drawing on paper with a metal gradient.
 */
export function GlobeMark({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" aria-hidden>
      <g vectorEffect="non-scaling-stroke">
        {/* globe */}
        <circle cx="30" cy="34" r="21" />
        <path d="M11.4 25.5h37.2M9 34h42M11.4 42.5h37.2" />
        <path d="M21.5 15.4v37.2M30 13v42M38.5 15.4v37.2" />
        {/* orbit: loops under the globe, rises to the spark */}
        <path d="M13 44c-7 3-9 12 0 12 12 0 30-18 45-38" />
        {/* spark */}
        <path d="M55 6v12M49 12h12M50.8 7.8l8.4 8.4M59.2 7.8l-8.4 8.4" />
      </g>
    </svg>
  );
}
