import { useEffect, useId, useRef, useState } from 'react'

import { filterCustomers, shouldOfferCreate } from '#/lib/customer-suggest'
import { m } from '#/paraglide/messages'

interface Props {
  /** Current committed value (customer name, or '' for none/all). */
  value: string
  onChange: (value: string) => void
  /** Existing customer names to suggest. */
  options: string[]
  placeholder?: string
  /**
   * `'change'` (form): text is live-bound, every keystroke commits — the input
   * value *is* the field. `'select'` (filter): commit only on picking a row, so
   * a partial query never becomes the (exact-matched) filter value.
   */
  commitMode: 'change' | 'select'
  /** Show a „create «query»“ row when the query matches no existing customer. */
  allowCreate?: boolean
  /** When set, a sticky first row that commits '' — e.g. „Alle Kunden“ in the filter. */
  clearLabel?: string
  id?: string
  'aria-label'?: string
}

interface Row {
  value: string
  label: string
  muted?: boolean
}

export function CustomerCombobox({
  value,
  onChange,
  options,
  placeholder,
  commitMode,
  allowCreate = false,
  clearLabel,
  id,
  'aria-label': ariaLabel,
}: Props) {
  const [query, setQuery] = useState(value)
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const wrapRef = useRef<HTMLDivElement>(null)
  const focusedRef = useRef(false)
  const listId = useId()

  // Re-sync the displayed text when the committed value changes from outside
  // (form reset, filter cleared) — but never while the user is mid-edit.
  // biome-ignore lint/correctness/useExhaustiveDependencies: syncing on `value` alone is the point — re-running on setQuery identity would fight the user's edit
  useEffect(() => {
    if (!focusedRef.current) setQuery(value)
  }, [value])

  // Close on click outside; discard an uncommitted query in select mode.
  // biome-ignore lint/correctness/useExhaustiveDependencies: the listener is (re)bound purely on open/close; `close` is stable for its lifetime
  useEffect(() => {
    if (!open) return
    function onDocMouseDown(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) close()
    }
    document.addEventListener('mousedown', onDocMouseDown)
    return () => document.removeEventListener('mousedown', onDocMouseDown)
  }, [open])

  const matches = filterCustomers(options, query)
  const offerCreate = allowCreate && shouldOfferCreate(options, query)

  const rows: Row[] = []
  if (clearLabel) rows.push({ value: '', label: clearLabel, muted: true })
  for (const name of matches) rows.push({ value: name, label: name })
  if (offerCreate) {
    rows.push({
      value: query.trim(),
      label: m.combobox_create({ name: query.trim() }),
      muted: true,
    })
  }
  const optionId = (i: number) => `${listId}-opt-${i}`

  function close() {
    setOpen(false)
    setActive(-1)
    if (commitMode === 'select') setQuery(value)
  }

  function commit(v: string) {
    onChange(v)
    setQuery(v)
    setOpen(false)
    setActive(-1)
  }

  function onInput(text: string) {
    setQuery(text)
    setOpen(true)
    setActive(-1)
    if (commitMode === 'change') onChange(text)
  }

  /** Row Enter should commit when nothing is arrow-highlighted. */
  function defaultRow(): number {
    if (offerCreate) return rows.length - 1
    const q = query.trim().toLowerCase()
    if (!q) return -1
    const exact = rows.findIndex((r) => r.value.toLowerCase() === q)
    if (exact >= 0) return exact
    return matches.length === 1
      ? rows.findIndex((r) => r.value === matches[0])
      : -1
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (!open) return setOpen(true)
      if (rows.length) setActive((a) => (a >= rows.length - 1 ? 0 : a + 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (rows.length) setActive((a) => (a <= 0 ? rows.length - 1 : a - 1))
    } else if (e.key === 'Enter') {
      if (!open) return
      const target = active >= 0 ? active : defaultRow()
      if (target >= 0) {
        e.preventDefault()
        commit(rows[target].value)
      }
    } else if (e.key === 'Escape') {
      if (open) {
        e.preventDefault()
        e.stopPropagation()
        close()
      }
    }
  }

  const showEmpty = matches.length === 0 && !offerCreate

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      <input
        id={id}
        className="tv-input"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={active >= 0 ? optionId(active) : undefined}
        aria-label={ariaLabel}
        autoComplete="off"
        value={query}
        placeholder={placeholder}
        onChange={(e) => onInput(e.target.value)}
        onFocus={() => {
          focusedRef.current = true
          setOpen(true)
        }}
        onBlur={() => {
          focusedRef.current = false
        }}
        onKeyDown={onKeyDown}
      />
      {open && (rows.length > 0 || showEmpty) && (
        <div
          id={listId}
          role="listbox"
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            right: 0,
            zIndex: 80,
            maxHeight: 220,
            overflowY: 'auto',
            padding: 4,
            borderRadius: 8,
            background: 'var(--bg-panel)',
            boxShadow: 'var(--sh-pop), var(--ring-card)',
          }}
        >
          {rows.map((row, i) => (
            <button
              key={row.label === row.value ? row.value : `__${i}__${row.label}`}
              type="button"
              role="option"
              id={optionId(i)}
              aria-selected={i === active}
              className="tv-menu-item"
              style={{
                ...(row.muted ? { color: 'var(--fg-2)' } : {}),
                ...(i === active ? { background: 'var(--bg-active)' } : {}),
              }}
              // mousedown (not click) so selection lands before the input blurs.
              onMouseDown={(e) => {
                e.preventDefault()
                commit(row.value)
              }}
              onMouseEnter={() => setActive(i)}
            >
              {row.label}
            </button>
          ))}
          {showEmpty && (
            <div
              style={{
                padding: '7px 8px',
                fontSize: 12.5,
                color: 'var(--fg-3)',
              }}
            >
              {m.combobox_empty()}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
