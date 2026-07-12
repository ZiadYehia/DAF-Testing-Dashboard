import { NextRequest, NextResponse } from 'next/server'
import { guardApp } from '@/lib/auth'
import { listFeatures, getFeature, parseTestcaseRows } from '@/lib/features'

export const runtime = 'nodejs'

/**
 * GET /api/[app]/automation/testcases — flat list of the app's test cases, for the
 * "Automate a test case" picker. Each carries enough (objective + steps) to seed an
 * authoring prompt and enough (feature + id) to sync execution status later.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ app: string }> },
) {
  const { app } = await params
  const guard = await guardApp(app, 'automation.view')
  if (!guard.ok) return guard.response

  const features = await listFeatures(app)
  const out: { feature: string; id: string; objective: string; steps: string }[] = []
  await Promise.all(
    features
      .filter((f) => f.hasTestcases)
      .map(async (f) => {
        const detail = await getFeature(app, f.name)
        if (!detail?.testcases) return
        for (const row of parseTestcaseRows(detail.testcases)) {
          out.push({ feature: f.name, id: row.id, objective: row.objective, steps: row.steps })
        }
      }),
  )
  return NextResponse.json(out)
}
