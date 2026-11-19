import { useState } from 'react'
import { ChevronDown, Repeat, Webhook, Zap } from 'lucide-react'
import { api } from '../lib/api'
import { formatTimeWithSeconds, newEventId, toLocalInput, uid } from '../lib/format'
import { STATUS, WEBHOOK_STATUSES, canMove } from '../lib/status'
import { Button, Field, inputClass } from './ui'

function describe(entry) {
  if (entry.error) {
    return {
      label: entry.error.status ? `${entry.error.status} ${entry.error.code}` : entry.error.code,
      tone: 'bg-rose-50 text-rose-700 ring-rose-200',
      text: entry.error.message
    }
  }
  const { result } = entry
  if (result.duplicate) {
    return {
      label: 'Duplicate',
      tone: 'bg-slate-100 text-slate-700 ring-slate-200',
      text: `Already processed as ${result.outcome}. Nothing changed.`
    }
  }
  if (result.outcome === 'APPLIED') {
    return {
      label: 'Applied',
      tone: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
      text: `Status moved to ${STATUS[result.messageStatus].label}.`
    }
  }
  return {
    label: 'Ignored',
    tone: 'bg-amber-50 text-amber-700 ring-amber-200',
    text: `Out of order. Status stays ${STATUS[result.messageStatus].label}.`
  }
}

function EventLog({ events }) {
  if (events.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-slate-200 px-4 py-6 text-center text-xs text-slate-400">
        Events you send will appear here.
      </p>
    )
  }
  return (
    <ol className="space-y-2">
      {events.map(entry => {
        const { label, tone, text } = describe(entry)
        return (
          <li key={entry.id} className="animate-slide-up rounded-xl bg-slate-50 p-3 ring-1 ring-slate-100">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`rounded-md px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${tone}`}>{label}</span>
              <span className="text-xs font-medium text-slate-700">{entry.event.status}</span>
              <span className="ml-auto text-[11px] text-slate-400 tabular-nums">{formatTimeWithSeconds(entry.at)}</span>
            </div>
            <p className="mt-1.5 text-xs text-slate-600">{text}</p>
            <p className="mt-1 truncate font-mono text-[11px] text-slate-400" title={entry.event.eventId}>
              {entry.event.eventId}
            </p>
          </li>
        )
      })}
    </ol>
  )
}

export default function WebhookSimulator({ message, events, onEvent, onUpdated }) {
  const [busy, setBusy] = useState(false)
  const [advanced, setAdvanced] = useState(false)
  const [custom, setCustom] = useState(() => ({
    eventId: newEventId(),
    status: 'DELIVERED',
    occurredAt: toLocalInput(new Date())
  }))
  const lastEvent = events[0]?.event

  async function send(event) {
    setBusy(true)
    try {
      const result = await api.sendWebhook(event)
      onEvent(message.id, { id: uid(), at: new Date().toISOString(), event, result })
    } catch (err) {
      onEvent(message.id, {
        id: uid(),
        at: new Date().toISOString(),
        event,
        error: { status: err.status, code: err.code, message: err.message }
      })
    }
    const fresh = await api.getMessage(message.tenantId, message.id).catch(() => null)
    if (fresh) onUpdated(fresh)
    setBusy(false)
  }

  const quickSend = status =>
    send({ eventId: newEventId(), messageId: message.id, status, occurredAt: new Date().toISOString() })

  function sendCustom(e) {
    e.preventDefault()
    const occurredAt = new Date(custom.occurredAt)
    send({
      eventId: custom.eventId.trim(),
      messageId: message.id,
      status: custom.status,
      occurredAt: isNaN(occurredAt) ? custom.occurredAt : occurredAt.toISOString()
    })
    setCustom(c => ({ ...c, eventId: newEventId() }))
  }

  return (
    <div className="space-y-5">
      <div>
        <div className="flex items-center gap-2">
          <Webhook className="size-4 text-indigo-600" />
          <h3 className="text-sm font-semibold text-slate-900">Simulate provider webhook</h3>
        </div>
        <p className="mt-1 text-xs text-slate-500">
          Each button sends a new event with a fresh eventId. Events that would move the status backwards are
          stored but ignored.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {WEBHOOK_STATUSES.map(status => {
          const forward = canMove(message.status, status)
          return (
            <button
              key={status}
              type="button"
              disabled={busy}
              onClick={() => quickSend(status)}
              className={`flex flex-col items-start rounded-xl bg-white px-3.5 py-2.5 text-left ring-1 ring-inset transition disabled:cursor-not-allowed disabled:opacity-60 ${STATUS[status].button}`}
            >
              <span className="flex items-center gap-1.5 text-sm font-semibold">
                <Zap className="size-3.5" />
                {STATUS[status].label}
              </span>
              <span className="mt-0.5 text-[11px] text-slate-500">{forward ? 'Will apply' : 'Will be ignored'}</span>
            </button>
          )
        })}
      </div>

      <Button
        variant="secondary"
        onClick={() => send(lastEvent)}
        disabled={!lastEvent || busy}
        className="w-full py-2 text-xs"
        title={lastEvent ? `Re-send ${lastEvent.eventId}` : 'Send an event first'}
      >
        <Repeat className="size-3.5" />
        Replay last event (provider retry)
      </Button>

      <div className="rounded-xl ring-1 ring-slate-200">
        <button
          type="button"
          onClick={() => setAdvanced(a => !a)}
          aria-expanded={advanced}
          className="flex w-full items-center justify-between px-4 py-3 text-xs font-medium text-slate-700"
        >
          Custom event
          <ChevronDown className={`size-4 text-slate-400 transition ${advanced ? 'rotate-180' : ''}`} />
        </button>
        {advanced && (
          <form onSubmit={sendCustom} className="space-y-3 border-t border-slate-100 p-4">
            <Field
              label="Event ID"
              htmlFor="custom-event-id"
              hint="Reuse an ID with a different status to see a 409 conflict."
              aside={
                lastEvent && (
                  <button
                    type="button"
                    onClick={() => setCustom(c => ({ ...c, eventId: lastEvent.eventId }))}
                    className="text-[11px] font-medium text-indigo-600 hover:text-indigo-500"
                  >
                    Use last ID
                  </button>
                )
              }
            >
              <input
                id="custom-event-id"
                value={custom.eventId}
                onChange={e => setCustom(c => ({ ...c, eventId: e.target.value }))}
                className={`${inputClass} py-2 font-mono text-xs`}
              />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Status" htmlFor="custom-status">
                <select
                  id="custom-status"
                  value={custom.status}
                  onChange={e => setCustom(c => ({ ...c, status: e.target.value }))}
                  className={`${inputClass} py-2`}
                >
                  {WEBHOOK_STATUSES.map(status => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Occurred at" htmlFor="custom-occurred-at">
                <input
                  id="custom-occurred-at"
                  type="datetime-local"
                  step="1"
                  value={custom.occurredAt}
                  onChange={e => setCustom(c => ({ ...c, occurredAt: e.target.value }))}
                  className={`${inputClass} py-2`}
                />
              </Field>
            </div>
            <Button type="submit" loading={busy} className="w-full py-2 text-xs">
              Send custom event
            </Button>
          </form>
        )}
      </div>

      <div>
        <h4 className="mb-2 text-xs font-semibold tracking-wide text-slate-500 uppercase">Event log</h4>
        <EventLog events={events} />
      </div>
    </div>
  )
}
