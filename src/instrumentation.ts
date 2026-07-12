// Next.js calls register() once per server/worker instance at startup, in both the Node
// and Edge runtimes. The actual safety net uses Node-only `process` APIs, so it lives in
// instrumentation.node.ts and is imported dynamically here — only on the Node runtime.
// Importing it statically would pull those Node APIs into the Edge bundle and trip
// Turbopack's "A Node.js API is used ... not supported in the Edge Runtime" warnings.
// See node_modules/next/dist/docs/.../instrumentation.md ("Specifying the runtime").
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return

  const { installProcessGuards } = await import('./instrumentation.node')
  installProcessGuards()

  // Automation Hub nightly regression (Settings → Automation). No-op until enabled.
  const { startAutomationScheduler } = await import('./lib/automation-scheduler')
  startAutomationScheduler()
}
