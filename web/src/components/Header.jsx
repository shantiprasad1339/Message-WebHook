import { useEffect, useState } from 'react'
import { Building2, ChevronDown, MessagesSquare } from 'lucide-react'
import { api } from '../lib/api'

const TENANTS = ['tenant-a', 'tenant-b', 'tenant-c']

function useHealth() {
  const [health, setHealth] = useState('checking')

  useEffect(() => {
    let active = true
    const check = () =>
      api.health().then(res => {
        if (active) setHealth(res.status === 'ok' ? 'up' : 'down')
      })
    check()
    const timer = setInterval(check, 15000)
    return () => {
      active = false
      clearInterval(timer)
    }
  }, [])

  return health
}

const healthStyles = {
  checking: { label: 'Checking API…', dot: 'bg-slate-400', text: 'text-slate-600' },
  up: { label: 'API online', dot: 'bg-emerald-500', text: 'text-emerald-700' },
  down: { label: 'API offline', dot: 'bg-rose-500', text: 'text-rose-700' }
}

export default function Header({ tenant, onTenantChange }) {
  const health = useHealth()
  const style = healthStyles[health]
  const tenants = TENANTS.includes(tenant) ? TENANTS : [tenant, ...TENANTS]

  return (
    <header className="z-20 border-b sm:sticky sm:top-0 border-slate-200/70 bg-white/80 backdrop-blur-lg">
      <div className="mx-auto flex max-w-[1500px] flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
        <div className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-md shadow-indigo-500/25">
            <MessagesSquare className="size-5" />
          </span>
          <div>
            <h1 className="text-base font-semibold tracking-tight text-slate-900">Messaging Console</h1>
            <p className="text-xs text-slate-500">Multi-tenant messages &amp; provider webhook simulator</p>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <span
            className={`inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-xs font-medium ring-1 ring-slate-200 ${style.text}`}
            aria-live="polite"
          >
            <span className="relative flex size-2">
              {health === 'up' && (
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              )}
              <span className={`relative inline-flex size-2 rounded-full ${style.dot}`} />
            </span>
            {style.label}
          </span>

          <label className="relative flex flex-1 items-center sm:flex-none">
            <span className="sr-only">Tenant</span>
            <Building2 className="pointer-events-none absolute left-3 size-4 text-slate-400" />
            <select
              value={tenant}
              onChange={e => onTenantChange(e.target.value)}
              className="w-full appearance-none rounded-xl border-0 bg-white py-2 pr-9 pl-9 text-sm font-medium text-slate-800 shadow-xs ring-1 ring-inset ring-slate-200 focus:ring-2 focus:ring-indigo-500 focus:outline-none sm:w-44"
            >
              {tenants.map(t => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 size-4 text-slate-400" />
          </label>
        </div>
      </div>
    </header>
  )
}
