import { MonitorDot } from 'lucide-react'

/** Compact wordmark used on auth screens and in the app top bar. */
export function BrandMark({ size = 18 }: { size?: number }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 26,
          height: 26,
          borderRadius: 7,
          backgroundImage: 'var(--brand-gradient)',
          color: 'var(--brand-fg)',
        }}
      >
        <MonitorDot size={16} strokeWidth={1.9} />
      </span>
      <span
        style={{
          fontSize: size,
          fontWeight: 700,
          letterSpacing: '-0.02em',
          color: 'var(--fg-1)',
        }}
      >
        rustdesk<span style={{ color: 'var(--brand)' }}>·</span>book
      </span>
    </span>
  )
}
