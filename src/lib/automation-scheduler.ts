/**
 * Nightly regression scheduler for the Automation Hub.
 *
 * Started once per server process from instrumentation.ts. Every minute it checks
 * the schedule settings (Settings → Automation):
 *   AUTOMATION_SCHEDULE_ENABLED  '1' to enable
 *   AUTOMATION_SCHEDULE_TIME     local HH:mm, e.g. "02:00"
 *   AUTOMATION_SCHEDULE_TAG      optional tag filter, e.g. "smoke"
 *
 * The last fired date is persisted (AUTOMATION_SCHEDULE_LAST_RUN) so a restart
 * after the scheduled time doesn't re-fire the same day, and it's written BEFORE
 * the run starts so overlapping ticks can't double-fire.
 */
import { getSetting, setSetting } from './settings'

const TICK_MS = 60_000

export function startAutomationScheduler(): void {
  // Survive HMR re-evaluation: at most one interval per process.
  const g = globalThis as typeof globalThis & { __automationSchedulerStarted?: boolean }
  if (g.__automationSchedulerStarted) return
  g.__automationSchedulerStarted = true

  const timer = setInterval(() => {
    tick().catch((err) => console.error('[automation-scheduler] tick failed:', err))
  }, TICK_MS)
  timer.unref?.() // never keep the process alive just for the scheduler
}

/** Local calendar date as YYYY-MM-DD (schedule times are local, so the date must be too). */
function localDate(now: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

async function tick(): Promise<void> {
  const enabled = await getSetting('global', 'AUTOMATION_SCHEDULE_ENABLED')
  if (enabled !== '1' && enabled !== 'true') return

  const time = (await getSetting('global', 'AUTOMATION_SCHEDULE_TIME')) || '02:00'
  const m = /^(\d{1,2}):(\d{2})$/.exec(time.trim())
  if (!m) return
  const scheduledMinutes = Number(m[1]) * 60 + Number(m[2])

  const now = new Date()
  if (now.getHours() * 60 + now.getMinutes() < scheduledMinutes) return

  const today = localDate(now)
  const lastRun = await getSetting('global', 'AUTOMATION_SCHEDULE_LAST_RUN')
  if (lastRun === today) return

  // Claim today before starting so a slow run or parallel tick can't double-fire.
  await setSetting('global', 'AUTOMATION_SCHEDULE_LAST_RUN', today)

  const tag = (await getSetting('global', 'AUTOMATION_SCHEDULE_TAG'))?.trim() || undefined
  console.log(`[automation-scheduler] starting scheduled regression${tag ? ` (tag: ${tag})` : ''}`)

  // Imported lazily so server startup doesn't pull in the whole hub engine.
  const { runRegression, isRegressionRunning } = await import('./automation-regression')
  if (isRegressionRunning()) return
  const summary = await runRegression({ trigger: 'scheduled', tag })
  console.log(
    `[automation-scheduler] done: ${summary.passed}/${summary.total} passed, ${summary.failed} failed`,
  )
}
