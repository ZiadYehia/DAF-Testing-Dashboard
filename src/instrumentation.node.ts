// Node-runtime-only process safety net. Kept in a separate module so the Edge bundle
// never statically includes these Node `process` APIs — instrumentation.ts only imports
// this file when NEXT_RUNTIME === 'nodejs'. Bundling it into the Edge build is what
// produced the "A Node.js API is used ... not supported in the Edge Runtime" warnings.
//
// We install a process-level safety net that keeps a worker from dying on transient,
// non-request errors — when a worker dies, Next stops serving its route segments and
// returns HTML 404s (most visibly the query-heavy /api/[app]/features/[name]/* routes)
// until a manual `npm run dev` restart.
//
// Dominant trigger: EPIPE. When the parent process stops reading a worker's stdout, or
// the pipe buffer breaks under a burst of log writes, the next process.stdout.write
// throws EPIPE asynchronously and Node escalates it to an uncaught exception. TypeORM
// logs to stdout (query logs, plus dropped-connection warnings via its own pool 'error'
// handler), so DB flakiness and logging volume compound into exactly this failure. The
// db.ts logging change cut the volume; this removes the crash itself.
export function installProcessGuards() {
  // Survive HMR re-evaluation: attach the listeners at most once per process.
  const g = globalThis as typeof globalThis & { __processGuardsInstalled?: boolean }
  if (g.__processGuardsInstalled) return
  g.__processGuardsInstalled = true

  // 1. A broken stdout/stderr pipe must never crash the worker. Handling 'error' on the
  //    streams directly stops EPIPE from ever escalating to an uncaught exception.
  for (const stream of [process.stdout, process.stderr]) {
    stream.on('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'EPIPE') return
      // Anything else is unexpected for a std stream — surface it on the other stream.
      try {
        const other = stream === process.stdout ? process.stderr : process.stdout
        other.write(`[instrumentation] std stream error: ${err.stack ?? err.message}\n`)
      } catch {
        /* nothing left we can safely write to */
      }
    })
  }

  // 2. A promise rejection nobody awaited shouldn't take the worker down.
  process.on('unhandledRejection', (reason) => {
    console.error('[instrumentation] Unhandled promise rejection (kept alive):', reason)
  })

  // 3. Backstop for uncaught exceptions. Transient network/pipe faults (a dropped DB
  //    socket that slips past TypeORM's pool handler, a broken pipe) are logged and
  //    survived. Anything else is treated as a genuine fault: logged loudly, and in
  //    production the process exits so the platform restarts it cleanly rather than
  //    serving from an unknown state. In development we stay alive on purpose — a dead
  //    worker Next won't recover is the worse outcome while iterating.
  const TRANSIENT = new Set(['EPIPE', 'ECONNRESET', 'ETIMEDOUT', 'ESOCKET', 'ECONNREFUSED'])
  process.on('uncaughtException', (err: NodeJS.ErrnoException) => {
    if (err?.code && TRANSIENT.has(err.code)) {
      console.error(`[instrumentation] Transient uncaught exception (${err.code}, kept alive):`, err.message)
      return
    }
    console.error('[instrumentation] Uncaught exception:', err)
    if (process.env.NODE_ENV === 'production') process.exit(1)
  })
}
