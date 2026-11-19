import { Fragment, useEffect, useState } from 'react'
import { ArrowDown, CircleAlert, Hash, Inbox, MessageCircle, RefreshCw } from 'lucide-react'
import { formatDay, formatTime } from '../lib/format'
import StatusTicks from './StatusTicks'
import { Button, Card, inputClass } from './ui'

function Bubble({ message, selected, onSelect }) {
  return (
    <button
      type="button"
      onClick={() => onSelect(message)}
      aria-pressed={selected}
      className={`ml-auto block w-fit max-w-[85%] rounded-2xl rounded-br-md px-4 py-2.5 text-left shadow-sm ring-1 transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 ${
        selected
          ? 'bg-indigo-600 text-white ring-indigo-600 shadow-indigo-600/20'
          : 'bg-white text-slate-800 ring-slate-200 hover:ring-indigo-300'
      }`}
    >
      <p className="text-sm break-words whitespace-pre-wrap">{message.text}</p>
      <span
        className={`mt-1 flex items-center justify-end gap-1.5 text-[11px] ${selected ? 'text-indigo-100' : 'text-slate-400'}`}
      >
        {formatTime(message.createdAt)}
        <StatusTicks status={message.status} inverted={selected} />
      </span>
    </button>
  )
}

function Skeleton() {
  return (
    <div className="space-y-3" aria-hidden>
      {['w-2/3', 'w-1/2', 'w-3/5'].map(width => (
        <div key={width} className={`ml-auto h-14 animate-pulse rounded-2xl rounded-br-md bg-slate-200/70 ${width}`} />
      ))}
    </div>
  )
}

export default function ConversationPanel({ tenant, conversationId, onConversationChange, conversation, selectedId, onSelect }) {
  const [draft, setDraft] = useState(conversationId)
  const { messages, nextCursor, loading, loadingMore, error, reload, loadMore } = conversation

  useEffect(() => {
    setDraft(conversationId)
  }, [conversationId])

  function open(e) {
    e.preventDefault()
    const value = draft.trim()
    if (value && value !== conversationId) onConversationChange(value)
    else if (value) reload()
  }

  return (
    <Card
      title="Conversation"
      subtitle={`${messages.length}${nextCursor ? '+' : ''} message${messages.length === 1 ? '' : 's'} · ${tenant}`}
      icon={MessageCircle}
      className="lg:h-[calc(100dvh-7.5rem)] lg:min-h-[560px]"
      bodyClassName="flex min-h-0 flex-1 flex-col"
      actions={
        <Button variant="ghost" onClick={reload} disabled={loading} className="px-2.5" aria-label="Refresh conversation">
          <RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      }
    >
      <form onSubmit={open} className="flex gap-2 border-b border-slate-100 px-5 py-3">
        <div className="relative flex-1">
          <Hash className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
          <input
            value={draft}
            onChange={e => setDraft(e.target.value)}
            placeholder="Conversation ID"
            aria-label="Conversation ID"
            className={`${inputClass} py-2 pl-9`}
          />
        </div>
        <Button type="submit" variant="secondary" className="py-2">
          Open
        </Button>
      </form>

      <div className="max-h-[60vh] min-h-64 flex-1 overflow-y-auto bg-slate-50 bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] [background-size:18px_18px] px-4 py-5 sm:px-5 lg:max-h-none">
        {error && (
          <div className="mb-4 flex items-start gap-3 rounded-xl bg-rose-50 p-3 text-sm text-rose-700 ring-1 ring-rose-200">
            <CircleAlert className="mt-0.5 size-4 shrink-0" />
            <div className="flex-1">{error}</div>
            <button type="button" onClick={reload} className="font-medium underline-offset-2 hover:underline">
              Retry
            </button>
          </div>
        )}

        {loading && messages.length === 0 ? (
          <Skeleton />
        ) : messages.length === 0 && !error ? (
          <div className="flex h-full flex-col items-center justify-center py-12 text-center">
            <span className="grid size-14 place-items-center rounded-2xl bg-white text-slate-400 shadow-sm ring-1 ring-slate-200">
              <Inbox className="size-6" />
            </span>
            <p className="mt-4 text-sm font-medium text-slate-700">No messages yet</p>
            <p className="mt-1 max-w-xs text-xs text-slate-500">
              Nothing in <span className="font-mono">{conversationId}</span> for{' '}
              <span className="font-mono">{tenant}</span>. Send one from the form, or switch tenant.
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {messages.map((message, i) => {
              const day = formatDay(message.createdAt)
              const showDay = i === 0 || formatDay(messages[i - 1].createdAt) !== day
              return (
                <Fragment key={message.id}>
                  {showDay && (
                    <div className="flex justify-center py-2">
                      <span className="rounded-full bg-white/90 px-3 py-1 text-[11px] font-medium text-slate-500 shadow-xs ring-1 ring-slate-200">
                        {day}
                      </span>
                    </div>
                  )}
                  <Bubble message={message} selected={message.id === selectedId} onSelect={onSelect} />
                </Fragment>
              )
            })}

            <div className="flex justify-center pt-3">
              {nextCursor ? (
                <Button variant="secondary" onClick={loadMore} loading={loadingMore} className="py-2 text-xs">
                  {!loadingMore && <ArrowDown className="size-3.5" />}
                  Load newer messages
                </Button>
              ) : (
                messages.length > 0 && <span className="text-[11px] text-slate-400">You're all caught up</span>
              )}
            </div>
          </div>
        )}
      </div>
    </Card>
  )
}
