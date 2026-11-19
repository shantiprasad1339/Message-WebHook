import { useCallback, useState } from 'react'
import { CircleAlert, CircleCheck, X } from 'lucide-react'
import { uid } from '../lib/format'

export function useToasts() {
  const [toasts, setToasts] = useState([])

  const dismiss = useCallback(id => setToasts(list => list.filter(t => t.id !== id)), [])

  const notify = useCallback(
    toast => {
      const id = uid()
      setToasts(list => [...list, { id, type: 'success', ...toast }].slice(-4))
      setTimeout(() => dismiss(id), toast.duration ?? 4000)
    },
    [dismiss]
  )

  return { toasts, notify, dismiss }
}

const icons = {
  success: <CircleCheck className="size-5 text-emerald-500" />,
  error: <CircleAlert className="size-5 text-rose-500" />
}

export default function Toasts({ toasts, onDismiss }) {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex flex-col items-center gap-2 p-4 sm:items-end sm:p-6">
      {toasts.map(toast => (
        <div
          key={toast.id}
          role="status"
          className="pointer-events-auto flex w-full max-w-sm animate-slide-up items-start gap-3 rounded-2xl bg-white p-4 shadow-lg ring-1 ring-slate-200"
        >
          <span className="mt-0.5 shrink-0">{icons[toast.type]}</span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-slate-900">{toast.title}</p>
            {toast.message && <p className="mt-0.5 text-sm break-words text-slate-500">{toast.message}</p>}
          </div>
          <button
            type="button"
            onClick={() => onDismiss(toast.id)}
            className="shrink-0 rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="size-4" />
            <span className="sr-only">Dismiss</span>
          </button>
        </div>
      ))}
    </div>
  )
}
