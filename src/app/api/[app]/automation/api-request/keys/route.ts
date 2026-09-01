import { NextResponse } from 'next/server'
import { guardApp } from '@/lib/auth'
import { getApp } from '@/lib/apps'
import { listHubEnvKeys } from '@automation-hub/store'

export const runtime = 'nodejs'

/**
 * GET /api/[app]/automation/api-request/keys — the placeholder names the console may use.
 *
 * NAMES ONLY, never values. The composer needs to offer `{{EPTTS_MFG_APIKEY}}` as something
 * you can drop into a header, and the send route resolves it server-side; if the value came
 * down here instead, the credential would be sitting in the browser and the whole
 * placeholder mechanism would be decoration.
 *
 * Values are deliberately not obtainable through any route: automation-hub/.env is read only
 * inside the request handler that performs the call.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ app: string }> },
) {
  const { app } = await params
  const guard = await guardApp(app, 'automation.run')
  if (!guard.ok) return guard.response

  const appConfig = await getApp(app)
  if (!appConfig) return NextResponse.json({ error: 'App not found' }, { status: 404 })
  if (appConfig.type !== 'api') {
    return NextResponse.json({ error: 'API apps only.' }, { status: 400 })
  }

  const keys = await listHubEnvKeys()
  return NextResponse.json({
    // Secrets first: they are what a header placeholder is usually for.
    credentials: keys.filter((k) => /APIKEY|PASSWORD|SECRET|TOKEN/i.test(k)).sort(),
    urls: keys.filter((k) => /_URL$/.test(k)).sort(),
    other: keys.filter((k) => !/APIKEY|PASSWORD|SECRET|TOKEN/i.test(k) && !/_URL$/.test(k)).sort(),
  })
}
