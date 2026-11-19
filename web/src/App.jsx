import { useCallback, useRef, useState } from 'react'
import { api } from './lib/api'
import { useConversation } from './hooks/useConversation'
import { usePersistentState } from './hooks/usePersistentState'
import Header from './components/Header'
import ComposeCard from './components/ComposeCard'
import ConversationPanel from './components/ConversationPanel'
import MessageDetail from './components/MessageDetail'
import StatusGuide from './components/StatusGuide'
import Toasts, { useToasts } from './components/Toasts'

export default function App() {
  const [tenant, setTenant] = usePersistentState('tenant', 'tenant-a')
  const [conversationId, setConversationId] = usePersistentState('conversation', 'conv-100')
  const [selected, setSelected] = useState(null)
  const [selectedError, setSelectedError] = useState(null)
  const [eventLog, setEventLog] = useState({})
  const conversation = useConversation(tenant, conversationId)
  const { upsert, append } = conversation
  const { toasts, notify, dismiss } = useToasts()
  const detailRef = useRef(null)

  const updateMessage = useCallback(
    message => {
      setSelected(current => (current?.id === message.id ? message : current))
      upsert(message)
    },
    [upsert]
  )

  function select(message) {
    setSelected(message)
    setSelectedError(null)
    if (window.matchMedia('(max-width: 1279px)').matches) {
      detailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
    api
      .getMessage(tenant, message.id)
      .then(updateMessage)
      .catch(err => setSelectedError(`Showing cached data: ${err.message}`))
  }

  function changeTenant(next) {
    setTenant(next)
    setSelected(null)
  }

  function handleCreated(message) {
    notify({ title: 'Message queued', message: `${message.id} in ${message.conversationId}` })
    if (message.conversationId !== conversationId) setConversationId(message.conversationId)
    else append(message)
    setSelected(message)
    setSelectedError(null)
  }

  const recordEvent = useCallback((messageId, entry) => {
    setEventLog(log => ({ ...log, [messageId]: [entry, ...(log[messageId] ?? [])].slice(0, 25) }))
  }, [])

  return (
    <div className="min-h-dvh bg-gradient-to-b from-indigo-50/60 via-slate-50 to-slate-50">
      <Header tenant={tenant} onTenantChange={changeTenant} />

      <main className="mx-auto grid max-w-[1500px] gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)] lg:px-8 xl:grid-cols-[minmax(0,340px)_minmax(0,1fr)_minmax(0,420px)]">
        <div className="space-y-6">
          <ComposeCard tenant={tenant} conversationId={conversationId} onCreated={handleCreated} notify={notify} />
          <StatusGuide />
        </div>

        <ConversationPanel
          tenant={tenant}
          conversationId={conversationId}
          onConversationChange={id => {
            setConversationId(id)
            setSelected(null)
          }}
          conversation={conversation}
          selectedId={selected?.id}
          onSelect={select}
        />

        <div ref={detailRef} className="scroll-mt-24 lg:col-span-2 xl:col-span-1">
          <MessageDetail
            message={selected}
            error={selectedError}
            events={selected ? (eventLog[selected.id] ?? []) : []}
            onEvent={recordEvent}
            onUpdated={updateMessage}
          />
        </div>
      </main>

      <Toasts toasts={toasts} onDismiss={dismiss} />
    </div>
  )
}
