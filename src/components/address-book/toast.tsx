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
          style={{
            position: 'fixed',
            bottom: 36,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 60,
            display: 'flex',
            alignItems: 'center',
            gap: 9,
            padding: '9px 14px',
            borderRadius: 8,
            background: 'var(--fg-1)',
            color: 'var(--bg-panel)',
            fontSize: 12.5,
            fontWeight: 500,
            boxShadow: 'var(--sh-pop)',
            animation: 'tvToastIn .18s ease',
          }}
        >
          <span
            className="tv-dot"
            style={{ width: 7, height: 7, background: 'var(--brand)' }}
          />
          {message}
        </div>
      )}
    </ToastContext.Provider>
  )
}
