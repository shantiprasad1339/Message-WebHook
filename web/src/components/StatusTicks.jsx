import { Check, CheckCheck, CircleAlert, Clock } from 'lucide-react'
import { STATUS } from '../lib/status'

const icons = {
  QUEUED: { Icon: Clock, color: 'text-slate-400', inverted: 'text-indigo-200' },
  SENT: { Icon: Check, color: 'text-slate-400', inverted: 'text-indigo-100' },
  DELIVERED: { Icon: CheckCheck, color: 'text-slate-400', inverted: 'text-indigo-100' },
  READ: { Icon: CheckCheck, color: 'text-sky-500', inverted: 'text-sky-300' },
  FAILED: { Icon: CircleAlert, color: 'text-rose-500', inverted: 'text-rose-200' }
}

export default function StatusTicks({ status, inverted = false }) {
  const { Icon, color, inverted: invertedColor } = icons[status] ?? icons.QUEUED
  return (
    <span title={STATUS[status]?.label} className="inline-flex">
      <Icon className={`size-3.5 ${inverted ? invertedColor : color}`} strokeWidth={2.5} />
      <span className="sr-only">{STATUS[status]?.label}</span>
    </span>
  )
}
