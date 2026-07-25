import { Download, ShieldOff, Trash2 } from 'lucide-react'

import { m } from '#/paraglide/messages'

export interface EnrollmentToken {
  id: string
  name: string
  kind: string
  tokenPrefix: string
  useCount: number
  customer: string | null
  revokedAt: string | null
}

export interface EnrollmentTokenListProps {
  tokens: EnrollmentToken[]
  scriptsPending: boolean
  removePending: boolean
  onDownloadAgain: (id: string) => void
  onRevoke: (id: string) => void
  onDelete: (token: EnrollmentToken) => void
}

/** The existing-tokens section of the enrollment dialog. */
export function EnrollmentTokenList({
  tokens,
  scriptsPending,
  removePending,
  onDownloadAgain,
  onRevoke,
  onDelete,
}: EnrollmentTokenListProps) {
  return (
    <div style={{ borderTop: '1px solid var(--bd-1)', paddingTop: 12 }}>
      <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>
        {m.enrollment_existing()}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {tokens.length === 0 && (
          <span style={{ fontSize: 12, color: 'var(--fg-4)' }}>
            {m.enrollment_none()}
          </span>
        )}
        {tokens.map((token) => {
          const inactive =
            Boolean(token.revokedAt) ||
            (token.kind === 'single' && token.useCount > 0)
          return (
            <div
              key={token.id}
              style={{
                display: 'flex',
                gap: 10,
                alignItems: 'center',
                padding: '8px 10px',
                border: '1px solid var(--bd-1)',
                borderRadius: 6,
                background: 'var(--bg-sunken)',
                opacity: inactive ? 0.65 : 1,
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    display: 'flex',
                    gap: 7,
                    alignItems: 'center',
                  }}
                >
                  <strong style={{ fontSize: 12.5 }}>{token.name}</strong>
                  <span className="tv-chip">
                    {token.kind === 'single'
                      ? m.enrollment_type_single_short()
                      : m.enrollment_type_permanent_short()}
                  </span>
                </div>
                <div
                  style={{
                    fontSize: 11,
                    color: 'var(--fg-4)',
                    marginTop: 2,
                  }}
                >
                  {token.tokenPrefix} ·{' '}
                  {m.enrollment_uses({ count: token.useCount })}
                  {token.customer ? ` · ${token.customer}` : ''}
                  {inactive ? ` · ${m.enrollment_inactive()}` : ''}
                </div>
              </div>
              {token.kind === 'permanent' && !token.revokedAt && (
                <button
                  type="button"
                  className="tv-btn tv-btn--ghost tv-btn--icon-xs"
                  title={m.enrollment_download_again()}
                  aria-label={m.enrollment_download_again()}
                  disabled={scriptsPending}
                  onClick={() => onDownloadAgain(token.id)}
                >
                  <Download size={14} />
                </button>
              )}
              {!token.revokedAt && (
                <button
                  type="button"
                  className="tv-btn tv-btn--ghost tv-btn--icon-xs"
                  title={m.enrollment_revoke()}
                  aria-label={m.enrollment_revoke()}
                  style={{ color: 'var(--s-err)' }}
                  onClick={() => onRevoke(token.id)}
                >
                  <ShieldOff size={14} />
                </button>
              )}
              <button
                type="button"
                className="tv-btn tv-btn--ghost tv-btn--icon-xs"
                title={m.enrollment_delete()}
                aria-label={m.enrollment_delete()}
                style={{ color: 'var(--s-err)' }}
                disabled={removePending}
                onClick={() => onDelete(token)}
              >
                <Trash2 size={14} />
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
