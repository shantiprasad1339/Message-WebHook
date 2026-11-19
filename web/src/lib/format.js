const time = new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' })
const timeWithSeconds = new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' })
const dateTime = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'medium' })
const day = new Intl.DateTimeFormat(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })

export const formatTime = iso => (iso ? time.format(new Date(iso)) : '—')
export const formatTimeWithSeconds = iso => (iso ? timeWithSeconds.format(new Date(iso)) : '—')
export const formatDateTime = iso => (iso ? dateTime.format(new Date(iso)) : '—')
export const formatDay = iso => day.format(new Date(iso))

export function toLocalInput(date) {
  const offset = date.getTimezoneOffset() * 60000
  return new Date(date.getTime() - offset).toISOString().slice(0, 19)
}

export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8)

export const newEventId = () => `evt-${uid()}`
