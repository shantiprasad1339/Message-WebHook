import { useEffect, useState } from 'react'

export function usePersistentState(key, initial) {
  const storageKey = `messaging-console:${key}`
  const [value, setValue] = useState(() => {
    try {
      return localStorage.getItem(storageKey) ?? initial
    } catch {
      return initial
    }
  })

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, value)
    } catch {}
  }, [storageKey, value])

  return [value, setValue]
}
