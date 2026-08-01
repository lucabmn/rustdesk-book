import { describe, expect, it } from 'vitest'

import { displayStatus } from '#/lib/offline-cache'
import {
  appendEntry,
  conflictEntries,
  markEntry,
  newQueueEntry,
  pendingCount,
  queuedDevices,
  readQueue,
  removeEntry,
  sendableEntries,
  stuckEntries,
  toCreateInput,
} from '#/lib/offline-queue'
import type { DeviceInput } from '#/orpc/schema'

const ID = '11111111-2222-4333-8444-555555555555'
const OTHER = '22222222-2222-4333-8444-555555555555'
const AT = '2026-01-02T03:04:05.000Z'
const LATER = '2026-01-02T04:04:05.000Z'

const input: DeviceInput = {
  rustdeskId: '123456789',
  alias: 'Reception PC',
  customer: 'Acme',
  osKey: 'win11',
  tags: ['office'],
  status: 'online',
  notes: 'front desk',
  password: '',
}

const entry = () => newQueueEntry(ID, input, AT)

describe('newQueueEntry', () => {
  it('keeps the form as the user filled it in', () => {
    const queued = entry()
    expect(queued.id).toBe(ID)
    expect(queued.createdAt).toBe(AT)
    expect(queued.state).toBe('pending')
    expect(queued.input.alias).toBe('Reception PC')
  })

  // The form disables the password field offline; this is the guarantee behind
  // that, so a queue file on disk cannot hold a cleartext secret even if some
  // caller passes one.
  it('refuses to carry a password into the queue', () => {
    const queued = newQueueEntry(ID, { ...input, password: 's3cret' }, AT)
    expect(queued.input).not.toHaveProperty('password')
    expect(JSON.stringify(queued)).not.toContain('s3cret')
  })
})

describe('toCreateInput', () => {
  it('sends the entry under its own id and says when it was written', () => {
    expect(toCreateInput(entry())).toMatchObject({
      id: ID,
      offlineCreatedAt: AT,
      rustdeskId: '123456789',
      alias: 'Reception PC',
    })
  })

  it('never sends a password', () => {
    expect(toCreateInput(entry()).password).toBe('')
  })
})

describe('the queue as a list', () => {
  it('keeps entries in the order they were created', () => {
    const queue = appendEntry(
      appendEntry([], entry()),
      newQueueEntry(OTHER, { ...input, alias: 'Second' }, LATER),
    )
    expect(queue.map((e) => e.id)).toEqual([ID, OTHER])
  })

  it('replaces an entry that is sent again rather than duplicating it', () => {
    const queue = appendEntry(appendEntry([], entry()), entry())
    expect(queue).toHaveLength(1)
  })

  it('counts what is still waiting, not what is stuck', () => {
    const queue = markEntry(
      appendEntry(appendEntry([], entry()), newQueueEntry(OTHER, input, LATER)),
      OTHER,
      { state: 'failed', error: 'Server error' },
    )
    expect(pendingCount(queue)).toBe(1)
    expect(queue).toHaveLength(2)
  })

  it('finds the entries waiting for a decision', () => {
    const queue = markEntry(appendEntry([], entry()), ID, {
      state: 'conflict',
      conflictId: OTHER,
    })
    expect(conflictEntries(queue).map((e) => e.id)).toEqual([ID])
  })

  it('leaves the queue alone when the id is unknown', () => {
    const queue = appendEntry([], entry())
    expect(markEntry(queue, OTHER, { state: 'failed' })).toEqual(queue)
  })

  it('drops an entry once it is settled', () => {
    expect(removeEntry(appendEntry([], entry()), ID)).toEqual([])
  })

  // A failed entry is retried — a server that was down is the usual reason to
  // be in that state. An entry waiting on a decision is not: sending it again
  // would hit the same conflict and ask the same question.
  it('retries what failed but not what waits on the user', () => {
    const queue = markEntry(
      markEntry(
        appendEntry(
          appendEntry([], entry()),
          newQueueEntry(OTHER, input, LATER),
        ),
        ID,
        { state: 'failed' },
      ),
      OTHER,
      { state: 'conflict', conflictId: 'somewhere-else' },
    )
    expect(sendableEntries(queue).map((e) => e.id)).toEqual([ID])
    expect(stuckEntries(queue).map((e) => e.id)).toEqual([ID, OTHER])
  })
})

describe('readQueue', () => {
  it('reads back what was written', () => {
    const stored = JSON.parse(JSON.stringify(appendEntry([], entry())))
    expect(readQueue(stored)).toHaveLength(1)
  })

  it('keeps the sound entries and drops the rest', () => {
    const stored = [
      JSON.parse(JSON.stringify(entry())),
      { id: OTHER },
      null,
      'nonsense',
    ]
    expect(readQueue(stored).map((e) => e.id)).toEqual([ID])
  })

  it('reports nothing for anything that is not a queue', () => {
    expect(readQueue(undefined)).toEqual([])
    expect(readQueue({ id: ID })).toEqual([])
  })
})

describe('queuedDevices', () => {
  it('renders an entry as a row the views can already show', () => {
    const [device] = queuedDevices(appendEntry([], entry()))
    expect(device).toMatchObject({
      id: ID,
      rustdeskId: '123456789',
      alias: 'Reception PC',
      customer: 'Acme',
      tags: ['office'],
      pending: true,
      hasPassword: false,
    })
  })

  // Nothing was sent, so nothing about it is known — least of all whether the
  // machine is reachable.
  it('claims nothing about a device the server has never seen', () => {
    const [device] = queuedDevices(appendEntry([], entry()))
    expect(displayStatus(device)).toBe('unknown')
    expect(device.lastSeen).toBeNull()
  })

  // The form leaves everything but the id and the alias optional, and a row
  // rendered from a sparse entry must not show "undefined" anywhere.
  it('renders an entry that was filled in with the bare minimum', () => {
    const sparse = newQueueEntry(
      ID,
      { rustdeskId: '123456789', alias: 'Bare' } as DeviceInput,
      AT,
    )
    const [device] = queuedDevices([sparse])
    expect(device).toMatchObject({
      customer: null,
      customerId: null,
      osKey: null,
      tags: [],
      status: 'offline',
      notes: null,
    })
  })
})
