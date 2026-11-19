import { ArrowRight, Info } from 'lucide-react'
import { Card, StatusBadge } from './ui'

const rules = [
  ['Duplicates', 'Re-sending the same eventId returns the stored result and changes nothing.'],
  ['Out of order', 'Events that would move status backwards are stored as IGNORED.'],
  ['Failures', 'FAILED is only allowed from Queued or Sent, and is final.'],
  ['Isolation', 'Switch tenant to see that other tenants’ messages are hidden.']
]

export default function StatusGuide() {
  return (
    <Card title="How status works" icon={Info}>
      <div className="flex flex-wrap items-center gap-1.5">
        {['QUEUED', 'SENT', 'DELIVERED', 'READ'].map((status, i) => (
          <span key={status} className="inline-flex items-center gap-1.5">
            {i > 0 && <ArrowRight className="size-3.5 text-slate-300" />}
            <StatusBadge status={status} />
          </span>
        ))}
      </div>
      <dl className="mt-4 space-y-2.5">
        {rules.map(([term, text]) => (
          <div key={term} className="text-xs leading-relaxed">
            <dt className="inline font-semibold text-slate-700">{term}. </dt>
            <dd className="inline text-slate-500">{text}</dd>
          </div>
        ))}
      </dl>
    </Card>
  )
}
