import { Copy, Download, Plus } from 'lucide-react'

import { Button, Segmented, SegmentedItem } from '#/components/ui'
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
  const permanent = created.kind === 'permanent'

  return (
    <div className="flex min-h-0 flex-col gap-3">
      {/* A single-use token is shown exactly once — say so loudly enough that
          nobody closes the dialog without saving the script. */}
      <p className="rounded-md border border-warn/40 bg-warn-soft px-3 py-2 text-text text-xs leading-relaxed">
        <strong className="font-semibold">
          {permanent
            ? m.enrollment_token_permanent_title()
            : m.enrollment_token_once_title()}
        </strong>{' '}
        {permanent
          ? m.enrollment_token_permanent_hint()
          : m.enrollment_token_once_hint()}
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <Segmented>
          {PLATFORMS.map((item) => (
            <SegmentedItem
              key={item.id}
              active={platform === item.id}
              onClick={() => onPlatform(item.id)}
            >
              {item.label}
            </SegmentedItem>
          ))}
        </Segmented>
        <span className="flex-1" />
        <Button onClick={onCopy}>
          <Copy /> {m.enrollment_copy_script()}
        </Button>
        <Button onClick={onDownload}>
          <Download /> {m.enrollment_download_script()}
        </Button>
      </div>

      <section
        aria-label={m.enrollment_script_label()}
        className="max-h-80 overflow-auto rounded-md border border-line bg-sunken"
      >
        <pre className="p-3 font-mono text-[11px] text-text leading-relaxed">
          <code>{currentScript}</code>
        </pre>
      </section>

      <p className="text-2xs text-faint">
        {platform === 'windows'
          ? m.enrollment_run_windows()
          : m.enrollment_run_unix()}
      </p>

      <Button variant="accent" className="self-start" onClick={onCreateAnother}>
        <Plus /> {m.enrollment_create_another()}
      </Button>
    </div>
  )
}
