import { Copy, Download, Plus } from 'lucide-react'

import { m } from '#/paraglide/messages'

export type Platform = 'windows' | 'linux' | 'macos'

export const PLATFORMS: Array<{
  id: Platform
  label: string
  extension: string
}> = [
  { id: 'windows', label: 'Windows', extension: 'ps1' },
  { id: 'linux', label: 'Linux', extension: 'sh' },
  { id: 'macos', label: 'macOS', extension: 'sh' },
]

export interface CreatedEnrollment {
  id: string
  kind: 'single' | 'permanent'
  token?: string
  rotated?: boolean
  scripts: Record<Platform, string>
}

export interface EnrollmentScriptPanelProps {
  created: CreatedEnrollment
  platform: Platform
  onPlatform: (platform: Platform) => void
  onCopy: () => void
  onDownload: () => void
  onCreateAnother: () => void
}

/**
 * Shown right after a token was issued: the one-time warning, the per-platform
 * script and the copy/download actions that mark it as saved.
 */
export function EnrollmentScriptPanel({
  created,
  platform,
  onPlatform,
  onCopy,
  onDownload,
  onCreateAnother,
}: EnrollmentScriptPanelProps) {
  const currentScript = created.scripts[platform] ?? ''
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        minHeight: 0,
      }}
    >
      <div
        style={{
          padding: '10px 12px',
          borderRadius: 6,
          border: '1px solid var(--s-warn)',
          background: 'color-mix(in srgb, var(--s-warn) 10%, transparent)',
          fontSize: 12,
        }}
      >
        <strong>
          {created.kind === 'permanent'
            ? m.enrollment_token_permanent_title()
            : m.enrollment_token_once_title()}
        </strong>{' '}
        {created.kind === 'permanent'
          ? m.enrollment_token_permanent_hint()
          : m.enrollment_token_once_hint()}
      </div>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {PLATFORMS.map((item) => (
          <button
            type="button"
            key={item.id}
            className={`tv-btn tv-btn--sm ${platform === item.id ? 'tv-btn--default' : 'tv-btn--ghost'}`}
            onClick={() => onPlatform(item.id)}
          >
            {item.label}
          </button>
        ))}
        <span style={{ flex: 1 }} />
        <button
          type="button"
          className="tv-btn tv-btn--ghost tv-btn--sm"
          onClick={onCopy}
        >
          <Copy size={13} /> {m.enrollment_copy_script()}
        </button>
        <button
          type="button"
          className="tv-btn tv-btn--ghost tv-btn--sm"
          onClick={onDownload}
        >
          <Download size={13} /> {m.enrollment_download_script()}
        </button>
      </div>

      <textarea
        className="tv-input"
        readOnly
        value={currentScript}
        aria-label={m.enrollment_script_label()}
        style={{
          minHeight: 300,
          resize: 'vertical',
          fontFamily: 'var(--font-mono, monospace)',
          fontSize: 11,
          lineHeight: 1.45,
          whiteSpace: 'pre',
        }}
      />
      <div style={{ fontSize: 11.5, color: 'var(--fg-4)' }}>
        {platform === 'windows'
          ? m.enrollment_run_windows()
          : m.enrollment_run_unix()}
      </div>
      <button
        type="button"
        className="tv-btn tv-btn--default tv-btn--sm"
        onClick={onCreateAnother}
      >
        <Plus size={13} /> {m.enrollment_create_another()}
      </button>
    </div>
  )
}
