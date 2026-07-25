import { Download, ShieldOff, Trash2 } from 'lucide-react'

import { Badge, Button, EmptyState, SectionLabel } from '#/components/ui'
import { cn } from '#/lib/utils'
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
    <div className="mt-4 border-line border-t pt-3">
      <SectionLabel className="mb-2">{m.enrollment_existing()}</SectionLabel>

      {tokens.length === 0 ? (
        <EmptyState className="py-6">{m.enrollment_none()}</EmptyState>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {tokens.map((token) => {
            // Spent single-use tokens and revoked ones are kept for the record
            // but faded — they can no longer enroll anything.
            const inactive =
              Boolean(token.revokedAt) ||
              (token.kind === 'single' && token.useCount > 0)
            return (
              <li
                key={token.id}
                className={cn(
                  'flex items-center gap-2 rounded-md border border-line bg-sunken py-1.5 pr-1.5 pl-2.5',
                  inactive && 'opacity-60',
                )}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate font-medium text-text text-xs">
                      {token.name}
                    </span>
                    <Badge>
                      {token.kind === 'single'
                        ? m.enrollment_type_single_short()
                        : m.enrollment_type_permanent_short()}
                    </Badge>
                  </div>
                  <div className="truncate text-2xs text-faint">
                    <span className="font-mono">{token.tokenPrefix}</span> ·{' '}
                    {m.enrollment_uses({ count: token.useCount })}
                    {token.customer ? ` · ${token.customer}` : ''}
                    {inactive ? ` · ${m.enrollment_inactive()}` : ''}
                  </div>
                </div>

                {token.kind === 'permanent' && !token.revokedAt && (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    title={m.enrollment_download_again()}
                    aria-label={m.enrollment_download_again()}
                    disabled={scriptsPending}
                    onClick={() => onDownloadAgain(token.id)}
                  >
                    <Download />
                  </Button>
                )}
                {!token.revokedAt && (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    title={m.enrollment_revoke()}
                    aria-label={m.enrollment_revoke()}
                    className="hover:bg-warn-soft hover:text-warn"
                    onClick={() => onRevoke(token.id)}
                  >
                    <ShieldOff />
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon-sm"
                  title={m.enrollment_delete()}
                  aria-label={m.enrollment_delete()}
                  className="hover:bg-danger-soft hover:text-danger"
                  disabled={removePending}
                  onClick={() => onDelete(token)}
                >
                  <Trash2 />
                </Button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
