/**
 * Import/export of the address book as JSON. Kept pure so the parsing rules —
 * the part that has to reject hostile or hand-edited files — are testable.
 *
 * Export is metadata-only: the device list handed to it never contains
 * passwords, and nothing here reads a secret.
 */
import type { Device } from '#/orpc/schema'

export class ImportFormatError extends Error {
  constructor(message = 'Invalid import format.') {
    super(message)
    this.name = 'ImportFormatError'
  }
}

/** Records accepted by the import procedure (validated again server-side). */
export type ImportedDevice = Record<string, unknown>

/**
 * Parse an exported address book. Anything that is not a JSON array of objects
 * is rejected outright rather than partially imported.
 */
export function parseDeviceImport(text: string): ImportedDevice[] {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new ImportFormatError()
  }
  if (!Array.isArray(parsed)) throw new ImportFormatError()
  return parsed.filter(
    (entry): entry is ImportedDevice =>
      typeof entry === 'object' && entry !== null && !Array.isArray(entry),
  )
}

/** Serialize the current list for download. */
export function serializeDevices(devices: readonly Device[]): string {
  return JSON.stringify(devices, null, 2)
}

export const EXPORT_FILENAME = 'rustdesk-adressbuch.json'
