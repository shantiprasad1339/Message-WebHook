import { useEffect, useState } from 'react'
import { Hash, Phone, Send } from 'lucide-react'
import { api } from '../lib/api'
import { Button, Card, Field, inputClass } from './ui'

const E164 = /^\+[1-9]\d{6,14}$/
const MAX_TEXT = 4096

function validate(form) {
  const errors = {}
  const conversationId = form.conversationId.trim()
  if (!conversationId) errors.conversationId = 'Conversation ID is required'
  else if (conversationId.length > 64) errors.conversationId = 'Must be at most 64 characters'
  if (!E164.test(form.to.trim())) errors.to = 'Use E.164 format, e.g. +919876543210'
  if (!form.text.trim()) errors.text = 'Message text is required'
  else if (form.text.length > MAX_TEXT) errors.text = `Must be at most ${MAX_TEXT} characters`
  return errors
}

export default function ComposeCard({ tenant, conversationId, onCreated, notify }) {
  const [form, setForm] = useState({ conversationId, to: '+919876543210', text: '' })
  const [errors, setErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    setForm(f => ({ ...f, conversationId }))
  }, [conversationId])

  const update = field => e => {
    setForm(f => ({ ...f, [field]: e.target.value }))
    setErrors(errs => ({ ...errs, [field]: undefined }))
  }

  async function submit(e) {
    e.preventDefault()
    const found = validate(form)
    setErrors(found)
    if (Object.keys(found).length) return

    setSubmitting(true)
    try {
      const message = await api.createMessage(tenant, {
        tenantId: tenant,
        conversationId: form.conversationId.trim(),
        to: form.to.trim(),
        text: form.text
      })
      setForm(f => ({ ...f, text: '' }))
      onCreated(message)
    } catch (err) {
      notify({ type: 'error', title: 'Could not send message', message: err.message })
    } finally {
      setSubmitting(false)
    }
  }

  const remaining = MAX_TEXT - form.text.length

  return (
    <Card title="New message" subtitle="Queued until the provider reports a status" icon={Send}>
      <form onSubmit={submit} noValidate className="space-y-4">
        <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3.5 py-2.5 text-xs ring-1 ring-slate-100">
          <span className="text-slate-500">Sending as</span>
          <span className="font-mono font-medium text-slate-800">{tenant}</span>
        </div>

        <Field label="Conversation" htmlFor="compose-conversation" error={errors.conversationId}>
          <div className="relative">
            <Hash className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
            <input
              id="compose-conversation"
              value={form.conversationId}
              onChange={update('conversationId')}
              aria-invalid={Boolean(errors.conversationId)}
              placeholder="conv-100"
              className={`${inputClass} pl-9`}
            />
          </div>
        </Field>

        <Field label="Recipient" htmlFor="compose-to" hint="E.164 format: + and 7–15 digits" error={errors.to}>
          <div className="relative">
            <Phone className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
            <input
              id="compose-to"
              type="tel"
              inputMode="tel"
              value={form.to}
              onChange={update('to')}
              aria-invalid={Boolean(errors.to)}
              placeholder="+919876543210"
              className={`${inputClass} pl-9 font-mono`}
            />
          </div>
        </Field>

        <Field
          label="Message"
          htmlFor="compose-text"
          error={errors.text}
          aside={
            <span className={`text-xs tabular-nums ${remaining < 0 ? 'text-rose-600' : 'text-slate-400'}`}>
              {form.text.length}/{MAX_TEXT}
            </span>
          }
        >
          <textarea
            id="compose-text"
            rows={4}
            value={form.text}
            onChange={update('text')}
            onKeyDown={e => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit(e)
            }}
            aria-invalid={Boolean(errors.text)}
            placeholder="Your order has shipped"
            className={`${inputClass} resize-y`}
          />
        </Field>

        <Button type="submit" loading={submitting} className="w-full">
          {!submitting && <Send className="size-4" />}
          Send message
        </Button>
        <p className="hidden text-center text-xs text-slate-400 sm:block">
          Press <kbd className="rounded bg-slate-100 px-1 font-sans">Ctrl</kbd> +{' '}
          <kbd className="rounded bg-slate-100 px-1 font-sans">Enter</kbd> to send
        </p>
      </form>
    </Card>
  )
}
