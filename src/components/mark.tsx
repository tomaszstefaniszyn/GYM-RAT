export function Logo({ size = 40 }: { size?: number }) {
  return (
    // Static SVG mark; next/image does not buy anything for a tiny local file.
    // eslint-disable-next-line @next/next/no-img-element
    <img className="logo" src="/logo.svg" width={size} height={size} alt="" />
  )
}

export function ArrowIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 12h14M13 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function BackIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M15 5L8 12l7 7" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function PlusIcon() {
  return (
    <span className="plus" aria-hidden="true">
      +
    </span>
  )
}

export function GreenX() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">
      <path d="M3.2 3.2l9.6 9.6M12.8 3.2l-9.6 9.6" fill="none" stroke="var(--green)" strokeWidth="2.1" strokeLinecap="round" />
    </svg>
  )
}

export function PersonGlyph() {
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true">
      <circle cx="32" cy="24" r="10" fill="#8d8d8d" />
      <path d="M12 56c2.2-12 10-18 20-18s17.8 6 20 18" fill="#8d8d8d" />
    </svg>
  )
}
