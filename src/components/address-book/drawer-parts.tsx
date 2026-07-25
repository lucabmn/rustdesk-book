/** Layout primitives used by the device detail drawer. */

export function Meta({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <>
      <span style={{ color: 'var(--fg-3)' }}>{label}</span>
      <span style={{ color: 'var(--fg-1)', textAlign: 'right' }}>
        {children}
      </span>
    </>
  )
}

export function Section({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <div>
      <div
        style={{
          fontSize: 11,
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '.05em',
          color: 'var(--fg-4)',
          marginBottom: 7,
        }}
      >
        {title}
      </div>
      {children}
    </div>
  )
}
