import { useState } from 'react'
import { Check, CircleAlert, Copy, FileText, MousePointerClick } from 'lucide-react'
import { formatDateTime } from '../lib/format'
import { rankOf } from '../lib/status'
import { Card, StatusBadge } from './ui'
import WebhookSimulator from './WebhookSimulator'

function CopyButton({ value }) {
  const [copied, setCopied] = useState(false)
  if (!navigator.clipboard) return null
  return (
    <button
      type="button"
      onClick={() =>
        navigator.clipboard.writeText(value).then(() => {
          setCopied(true)
          setTimeout(() => setCopied(false), 1500)
        })
      }
      className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
      title="Copy message ID"
    >
      {copied ? <Check className="size-3.5 text-emerald-500" /> : <Copy className="size-3.5" />}
    </button>
  )
}

function Timeline({ message }) {
  const failed = message.status === 'FAILED'
  const current = rankOf(message.status)
  const steps = [
    { status: 'QUEUED', label: 'Queued', at: message.createdAt },
    { status: 'SENT', label: 'Sent', at: message.sentAt },
    { status: 'DELIVERED', label: 'Delivered', at: message.deliveredAt },
    { status: 'READ', label: 'Read', at: message.readAt }
  ]
  if (failed) steps.push({ status: 'FAILED', label: 'Failed', at: message.failedAt })

  return (
    <ol className="relative space-y-4">
      {steps.map((step, i) => {
        const reached = Boolean(step.at) || (!failed && rankOf(step.status) <= current)
        const isCurrent = step.status === message.status
        const skipped = !step.at && reached
        const dot = step.status === 'FAILED'
          ? 'bg-rose-500 ring-rose-100'
          : isCurrent
            ? 'bg-indigo-600 ring-indigo-100'
            : reached
              ? 'bg-indigo-300 ring-indigo-50'
              : 'bg-white ring-slate-200'

        return (
          <li key={step.status} className="relative flex gap-3">
            {i < steps.length - 1 && (
              <span
                className={`absolute top-4 left-[7px] h-[calc(100%+0.25rem)] w-0.5 ${reached ? 'bg-indigo-200' : 'bg-slate-200'}`}
                aria-hidden
              />
            )}
            <span className={`relative mt-0.5 size-4 shrink-0 rounded-full ring-4 ${dot}`} />
            <div className="flex min-w-0 flex-1 flex-wrap items-baseline justify-between gap-x-3">
              <span className={`text-sm ${reached ? 'font-medium text-slate-900' : 'text-slate-400'}`}>
                {step.label}
                {isCurrent && (
                  <span className="ml-2 text-[11px] font-medium text-indigo-600 uppercase">Current</span>
                )}
              </span>
              <span className="text-xs text-slate-500 tabular-nums">
                {step.at ? formatDateTime(step.at) : skipped ? 'Skipped' : '—'}
              </span>
            </div>
          </li>
        )
      })}
    </ol>
  )
}

export default function MessageDetail({ message, error, events, onEvent, onUpdated }) {
  if (!message) {
    return (
      <Card title="Message details" icon={FileText}>
        <div className="flex flex-col items-center py-12 text-center">
          <span className="grid size-14 place-items-center rounded-2xl bg-indigo-50 text-indigo-500">
            <MousePointerClick className="size-6" />
          </span>
          <p className="mt-4 text-sm font-medium text-slate-700">No message selected</p>
          <p className="mt-1 max-w-xs text-xs text-slate-500">
            Pick a message from the conversation to see its status history and simulate provider webhooks.
          </p>
        </div>
      </Card>
    )
  }

  return (
    <Card title="Message details" icon={FileText} className="@container" actions={<StatusBadge status={message.status} />}>
      <div className="grid gap-6 @2xl:grid-cols-2 @2xl:gap-8">
        <div className="space-y-5">
          {error && (
            <div className="flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-xs text-amber-800 ring-1 ring-amber-200">
              <CircleAlert className="mt-0.5 size-4 shrink-0" />
              {error}
            </div>
          )}

          <div className="flex items-center gap-1 rounded-xl bg-slate-50 py-1 pr-1 pl-3 ring-1 ring-slate-100">
            <code className="min-w-0 flex-1 truncate text-xs text-slate-600" title={message.id}>
              {message.id}
            </code>
            <CopyButton value={message.id} />
          </div>

          <blockquote className="rounded-xl border-l-4 border-indigo-500 bg-indigo-50/50 px-4 py-3 text-sm break-words whitespace-pre-wrap text-slate-800">
            {message.text}
          </blockquote>

          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-xs">
            {[
              ['Recipient', message.to, true],
              ['Conversation', message.conversationId, true],
              ['Tenant', message.tenantId, true],
              ['Last updated', formatDateTime(message.updatedAt)]
            ].map(([label, value, mono]) => (
              <div key={label} className="min-w-0">
                <dt className="text-slate-500">{label}</dt>
                <dd className={`mt-0.5 truncate font-medium text-slate-800 ${mono ? 'font-mono' : ''}`} title={value}>
                  {value}
                </dd>
              </div>
            ))}
          </dl>

          <div>
            <h4 className="mb-3 text-xs font-semibold tracking-wide text-slate-500 uppercase">Status history</h4>
            <Timeline message={message} />
          </div>
        </div>

        <div className="border-t border-slate-100 pt-5 @2xl:border-t-0 @2xl:border-l @2xl:pt-0 @2xl:pl-8">
          <WebhookSimulator
            key={message.id}
            message={message}
            events={events}
            onEvent={onEvent}
            onUpdated={onUpdated}
          />
        </div>
      </div>
    </Card>
  )
}
