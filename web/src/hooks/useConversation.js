import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from '../lib/api'

const PAGE_SIZE = 20
const EMPTY = { key: null, messages: [], nextCursor: null }

export function useConversation(tenant, conversationId) {
  const key = `${tenant}/${conversationId}`
  const [page, setPage] = useState(EMPTY)
  const [state, setState] = useState('idle')
  const [error, setError] = useState(null)
  const requestId = useRef(0)

  const current = page.key === key ? page : EMPTY

  const load = useCallback(async () => {
    const id = ++requestId.current
    if (!tenant || !conversationId) return

    setState('loading')
    setError(null)
    try {
      const res = await api.listConversation(tenant, conversationId, { limit: PAGE_SIZE })
      if (id !== requestId.current) return
      setPage({ key: `${tenant}/${conversationId}`, messages: res.data, nextCursor: res.nextCursor })
    } catch (err) {
      if (id === requestId.current) setError(err.message)
    } finally {
      if (id === requestId.current) setState('idle')
    }
  }, [tenant, conversationId])

  const loadMore = useCallback(async () => {
    if (!current.nextCursor) return
    const id = ++requestId.current
    setState('loadingMore')
    setError(null)
    try {
      const res = await api.listConversation(tenant, conversationId, { limit: PAGE_SIZE, cursor: current.nextCursor })
      if (id !== requestId.current) return
      setPage(p => (p.key === key ? { key, messages: [...p.messages, ...res.data], nextCursor: res.nextCursor } : p))
    } catch (err) {
      if (id === requestId.current) setError(err.message)
    } finally {
      if (id === requestId.current) setState('idle')
    }
  }, [tenant, conversationId, key, current.nextCursor])

  useEffect(() => {
    load()
  }, [load])

  const upsert = useCallback(message => {
    setPage(p => ({ ...p, messages: p.messages.map(m => (m.id === message.id ? message : m)) }))
  }, [])

  const append = useCallback(
    message => {
      if (`${message.tenantId}/${message.conversationId}` !== key) return
      setPage(p =>
        p.key !== key || p.nextCursor || p.messages.some(m => m.id === message.id)
          ? p
          : { ...p, messages: [...p.messages, message] }
      )
    },
    [key]
  )

  return {
    messages: current.messages,
    nextCursor: current.nextCursor,
    loading: state === 'loading' || (page.key !== key && !error),
    loadingMore: state === 'loadingMore',
    error,
    reload: load,
    loadMore,
    upsert,
    append
  }
}
