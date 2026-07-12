'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Beaker } from 'lucide-react'

export default function LoginForm({ from }: { from?: string }) {
  const router = useRouter()
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [dashboardLogo, setDashboardLogo] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/logo')
      .then((r) => r.ok ? r.json() : {})
      .then((data: Record<string, string>) => setDashboardLogo(data['dashboard'] ?? null))
      .catch(() => {})
  }, [])

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const form = e.currentTarget
    const email = (form.elements.namedItem('email') as HTMLInputElement).value
    const password = (form.elements.namedItem('password') as HTMLInputElement).value

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })

      if (res.ok) {
        // Only allow same-origin paths; block //host (protocol-relative) redirects
        const destination =
          from && /^\/[^/]/.test(from) && !from.startsWith('/login') ? from : '/'
        router.push(destination)
      } else {
        const data = await res.json().catch(() => ({}))
        setError(data.error ?? 'Login failed')
      }
    } catch {
      setError('Network error — please try again')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
      <div className="mb-6 flex flex-col items-center gap-2">
        <div className="flex h-24 w-24 items-center justify-center rounded-2xl bg-primary/10 text-primary overflow-hidden">
          {dashboardLogo
            ? <img src={dashboardLogo} alt="Logo" className="h-full w-full object-contain" />
            : <Beaker className="h-12 w-12" />}
        </div>
        <span className="text-lg font-semibold tracking-tight">Testing Dashboard</span>
      </div>

      <Card className="w-full max-w-sm">
        <CardHeader className="pb-2 text-center">
          <CardTitle className="text-xl">Sign in</CardTitle>
          <CardDescription>Enter your credentials to continue</CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="email" className="text-sm font-medium">
                Email
              </label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="you@example.com"
                autoComplete="email"
                required
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="password" className="text-sm font-medium">
                Password
              </label>
              <Input
                id="password"
                name="password"
                type="password"
                placeholder="••••••••"
                autoComplete="current-password"
                required
              />
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <Button type="submit" className="mt-1 w-full" disabled={loading}>
              {loading ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
