import { createContext, useCallback, useContext, useRef, useState } from 'react'

interface ToastContextValue {
  toast: (message: string) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within <ToastProvider>')
  return ctx
}

/**
 * One transient message at a time, anchored bottom-left above the status bar.
 * Bottom-centre would sit on top of the row a user just acted on.
 */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [message, setMessage] = useState<string | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const toast = useCallback((msg: string) => {
    setMessage(msg)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => setMessage(null), 2600)
  }, [])

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      {message && (
        <div
          role="status"
          aria-live="polite"
          className="fade-in-0 slide-in-from-bottom-2 fixed bottom-9 left-4 z-60 flex max-w-sm animate-in items-center gap-2.5 rounded-lg border border-line bg-elevated px-3 py-2 text-text text-xs shadow-pop"
        >
          <span className="size-1.5 shrink-0 rounded-full bg-accent" />
          {message}
        </div>
      )}
    </ToastContext.Provider>
  )
}
