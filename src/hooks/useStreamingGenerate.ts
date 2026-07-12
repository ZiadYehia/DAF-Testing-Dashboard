import { useState, useCallback, useRef } from 'react'
import type { PhaseEvent } from '@/components/shared/AIProgressBar'

export function useStreamingGenerate<T>() {
  const [phase, setPhase] = useState<PhaseEvent | null>(null)
  const [generating, setGenerating] = useState(false)
  // Populated by the generate routes' `{type:'warning', missing}` event — an
  // AI-context gap that doesn't block generation. Persists after generation
  // finishes so the caller can render a dismissible banner; cleared on the next
  // generate() call or via dismissWarning().
  const [warning, setWarning] = useState<string[] | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const generate = useCallback(async (url: string, body: object): Promise<T | null> => {
    abortRef.current?.abort()
    const abort = new AbortController()
    abortRef.current = abort

    setGenerating(true)
    setPhase(null)
    setWarning(null)

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: abort.signal,
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as { error?: string }
        throw new Error(data.error ?? `Request failed: ${res.status}`)
      }

      const reader = res.body!.getReader()
      const dec = new TextDecoder()
      let result: T | null = null
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += dec.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          try {
            const event = JSON.parse(line.slice(6)) as
              | ({ type: 'phase' } & PhaseEvent)
              | { type: 'warning'; missing: string[] }
              | { type: 'complete'; data: T }
              | { type: 'error'; message: string }

            if (event.type === 'phase') {
              setPhase({ label: event.label, detail: event.detail, step: event.step, total: event.total })
            } else if (event.type === 'warning') {
              setWarning(event.missing)
            } else if (event.type === 'complete') {
              result = event.data
            } else if (event.type === 'error') {
              throw new Error(event.message)
            }
          } catch (e) {
            if (e instanceof SyntaxError) continue
            throw e
          }
        }
      }

      return result
    } finally {
      setGenerating(false)
      setPhase(null)
    }
  }, [])

  const dismissWarning = useCallback(() => setWarning(null), [])

  return { generate, generating, phase, warning, dismissWarning }
}
