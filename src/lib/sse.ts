/**
 * Shared SSE (Server-Sent Events) helper. Reproduces the hand-rolled
 * `TextEncoder` + `ReadableStream` + `text/event-stream` plumbing that used to be
 * duplicated across bugs/generate, features/[name]/generate, features/[name]/quick-add
 * and automation/chat routes — byte-identical wire output.
 *
 * Every one of those routes only ever wrote `data: ${JSON.stringify(obj)}\n\n` frames
 * where `obj` always has a `type` field plus a handful of extra fields. `emit` captures
 * that shape: the extra fields are merged onto `{ type }` in place, so passing the
 * event's own object as `data` (e.g. `emit(e.type, e)`) reproduces `e` exactly.
 */

export type SseEmit = (event: string, data: unknown) => void

export interface SseOptions {
  /** Overrides/extends the default SSE headers (e.g. automation/chat's charset + no-transform). */
  headers?: Record<string, string>
}

const DEFAULT_HEADERS: Record<string, string> = {
  'Content-Type': 'text/event-stream',
  'Cache-Control': 'no-cache',
  'Connection': 'keep-alive',
}

/**
 * Builds a streaming SSE `Response`. `handler` receives an `emit(event, data)` function;
 * each call enqueues one `data: {"type": event, ...data}\n\n` frame. The stream closes
 * once `handler`'s promise settles — same as the routes' original `controller.close()`
 * placement, so an error thrown out of `handler` (rather than caught internally) still
 * propagates the same way it did before (the stream never closes cleanly).
 */
export function sseResponse(
  handler: (emit: SseEmit) => Promise<void>,
  options?: SseOptions
): Response {
  const encoder = new TextEncoder()
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const emit: SseEmit = (event, data) => {
        const extra = data && typeof data === 'object' ? (data as Record<string, unknown>) : {}
        const payload = { type: event, ...extra }
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`))
      }
      await handler(emit)
      controller.close()
    },
  })

  return new Response(stream, {
    headers: { ...DEFAULT_HEADERS, ...options?.headers },
  })
}
