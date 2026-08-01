import { describe, expect, it, vi } from 'vitest'

import { classifySyncError, syncQueue } from '#/lib/offline-sync'
import { appendEntry, newQueueEntry } from '#/lib/offline-queue'
import type { DeviceInput } from '#/orpc/schema'

const ONE = '11111111-2222-4333-8444-555555555555'
const TWO = '22222222-2222-4333-8444-555555555555'
const EXISTING = '33333333-2222-4333-8444-555555555555'

const input: DeviceInput = {
  rustdeskId: '123456789',
  alias: 'Reception PC',
  customer: 'Acme',
  osKey: 'win11',
  tags: [],
  status: 'offline',
  notes: '',
  password: '',
}

/** Two entries, oldest first. */
const queue = () =>
  appendEntry(
    appendEntry([], newQueueEntry(ONE, input, '2026-01-02T03:00:00.000Z')),
    newQueueEntry(
      TWO,
      { ...input, rustdeskId: '987654321', alias: 'Warehouse' },
      '2026-01-02T04:00:00.000Z',
    ),
  )

const orpcError = (code: string, status: number, data?: unknown) =>
  Object.assign(new Error(code), { code, status, data })

describe('classifySyncError', () => {
  it('knows a session that has expired', () => {
    expect(classifySyncError(orpcError('UNAUTHORIZED', 401))).toBe(
      'unauthorized',
    )
  })

  it('knows a RustDesk id that is already taken', () => {
    expect(classifySyncError(orpcError('CONFLICT', 409))).toBe('conflict')
  })

  it('knows a server that is unwell from one that refused', () => {
    expect(classifySyncError(orpcError('INTERNAL_SERVER_ERROR', 500))).toBe(
      'unreachable',
    )
    expect(classifySyncError(orpcError('BAD_REQUEST', 400))).toBe('rejected')
  })

  // A fetch that never reached a server has no status to read.
  it('treats an unanswered request as being offline again', () => {
    expect(classifySyncError(new TypeError('Failed to fetch'))).toBe(
      'unreachable',
    )
    expect(classifySyncError('something else entirely')).toBe('unreachable')
  })
})

describe('syncQueue', () => {
  it('sends the entries in the order they were created', async () => {
    const sent: string[] = []
    const create = vi.fn(async (device: DeviceInput) => {
      sent.push(device.id ?? '')
    })

    const result = await syncQueue(queue(), create)

    expect(sent).toEqual([ONE, TWO])
    expect(result.transferred).toEqual([ONE, TWO])
    expect(result.queue).toEqual([])
    expect(result.stoppedBy).toBeUndefined()
  })

  it('empties the queue only of what actually arrived', async () => {
    const create = vi.fn(async (device: DeviceInput) => {
      if (device.id === ONE) throw orpcError('BAD_REQUEST', 400)
    })

    const result = await syncQueue(queue(), create)

    expect(result.transferred).toEqual([TWO])
    expect(result.failed).toEqual([ONE])
    expect(result.queue).toHaveLength(1)
    expect(result.queue[0]).toMatchObject({ id: ONE, state: 'failed' })
    expect(result.queue[0].error).toBeTruthy()
  })

  // The queue has to survive the session, or a login would cost the user the
  // devices they filled in while away.
  it('stops at an expired session and keeps every entry', async () => {
    const create = vi.fn(async () => {
      throw orpcError('UNAUTHORIZED', 401)
    })

    const result = await syncQueue(queue(), create)

    expect(create).toHaveBeenCalledTimes(1)
    expect(result.stoppedBy).toBe('unauthorized')
    expect(result.queue).toHaveLength(2)
    expect(result.queue.every((entry) => entry.state === 'pending')).toBe(true)
  })

  it('stops when the connection drops again, without blaming the entry', async () => {
    const create = vi.fn(async () => {
      throw new TypeError('Failed to fetch')
    })

    const result = await syncQueue(queue(), create)

    expect(create).toHaveBeenCalledTimes(1)
    expect(result.stoppedBy).toBe('unreachable')
    expect(result.queue).toHaveLength(2)
    expect(result.queue[0].state).toBe('pending')
  })

  it('keeps a conflicting entry and carries on with the rest', async () => {
    const create = vi.fn(async (device: DeviceInput) => {
      if (device.id === ONE) {
        throw orpcError('CONFLICT', 409, {
          existing: { id: EXISTING, alias: 'Already here' },
        })
      }
    })

    const result = await syncQueue(queue(), create)

    expect(result.transferred).toEqual([TWO])
    expect(result.conflicts).toEqual([ONE])
    expect(result.queue).toHaveLength(1)
    expect(result.queue[0]).toMatchObject({
      id: ONE,
      state: 'conflict',
      conflictId: EXISTING,
    })
  })

  it('does not send an entry that is waiting on a decision', async () => {
    const create = vi.fn(async (device: DeviceInput) => {
      if (device.id === ONE) {
        throw orpcError('CONFLICT', 409, { existing: { id: EXISTING } })
      }
    })
    const first = await syncQueue(queue(), create)
    create.mockClear()

    const second = await syncQueue(first.queue, create)

    expect(create).not.toHaveBeenCalled()
    expect(second.queue).toHaveLength(1)
  })

  it('retries an entry that failed before', async () => {
    const create = vi.fn(async () => {})
    const failed = [
      { ...newQueueEntry(ONE, input, '2026-01-02T03:00:00.000Z') },
    ].map((entry) => ({ ...entry, state: 'failed' as const, error: 'boom' }))

    const result = await syncQueue(failed, create)

    expect(create).toHaveBeenCalledTimes(1)
    expect(result.transferred).toEqual([ONE])
  })

  it('has nothing to do for an empty queue', async () => {
    const create = vi.fn(async () => {})
    const result = await syncQueue([], create)
    expect(create).not.toHaveBeenCalled()
    expect(result.transferred).toEqual([])
  })
})
