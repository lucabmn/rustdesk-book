import { describe, expect, it } from 'vitest'

import {
  ImportFormatError,
  parseDeviceImport,
  serializeDevices,
} from '#/lib/device-transfer'
import type { Device } from '#/orpc/schema'

describe('parseDeviceImport', () => {
  it('accepts an array of device objects', () => {
    const rows = parseDeviceImport(
      '[{"rustdeskId":"123456789","alias":"PC"},{"alias":"Other"}]',
    )
    expect(rows).toHaveLength(2)
    expect(rows[0].rustdeskId).toBe('123456789')
  })

  it('drops entries that are not objects rather than failing the import', () => {
    expect(parseDeviceImport('[1,"two",null,[],{"alias":"PC"}]')).toEqual([
      { alias: 'PC' },
    ])
  })

  it('rejects malformed JSON and non-array payloads', () => {
    expect(() => parseDeviceImport('not json')).toThrow(ImportFormatError)
    expect(() => parseDeviceImport('{"alias":"PC"}')).toThrow(ImportFormatError)
    expect(() => parseDeviceImport('42')).toThrow(ImportFormatError)
  })
})

describe('serializeDevices', () => {
  it('round-trips through the parser', () => {
    const devices = [
      { id: 'a', alias: 'PC', hasPassword: true },
    ] as unknown as Device[]
    const text = serializeDevices(devices)
    expect(parseDeviceImport(text)).toEqual([
      { id: 'a', alias: 'PC', hasPassword: true },
    ])
    // The projection carries no secret, so neither does the file.
    expect(text).not.toContain('password"')
  })
})
