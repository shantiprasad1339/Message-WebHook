export const STATUS = {
  QUEUED: {
    label: 'Queued',
    badge: 'bg-slate-100 text-slate-700 ring-slate-200',
    dot: 'bg-slate-400',
    button: 'text-slate-700 ring-slate-200 hover:bg-slate-50'
  },
  SENT: {
    label: 'Sent',
    badge: 'bg-sky-50 text-sky-700 ring-sky-200',
    dot: 'bg-sky-500',
    button: 'text-sky-700 ring-sky-200 hover:bg-sky-50'
  },
  DELIVERED: {
    label: 'Delivered',
    badge: 'bg-indigo-50 text-indigo-700 ring-indigo-200',
    dot: 'bg-indigo-500',
    button: 'text-indigo-700 ring-indigo-200 hover:bg-indigo-50'
  },
  READ: {
    label: 'Read',
    badge: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
    dot: 'bg-emerald-500',
    button: 'text-emerald-700 ring-emerald-200 hover:bg-emerald-50'
  },
  FAILED: {
    label: 'Failed',
    badge: 'bg-rose-50 text-rose-700 ring-rose-200',
    dot: 'bg-rose-500',
    button: 'text-rose-700 ring-rose-200 hover:bg-rose-50'
  }
}

export const WEBHOOK_STATUSES = ['SENT', 'DELIVERED', 'READ', 'FAILED']

const rank = { QUEUED: 0, SENT: 1, DELIVERED: 2, READ: 3 }

export function rankOf(status) {
  return rank[status] ?? -1
}

export function canMove(from, to) {
  if (from === 'FAILED') return false
  if (to === 'FAILED') return from === 'QUEUED' || from === 'SENT'
  return rank[to] > rank[from]
}
