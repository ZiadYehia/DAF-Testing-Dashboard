import { NextRequest, NextResponse } from 'next/server'
import { guardApp } from '@/lib/auth'
import { getJiraFieldOptions } from '@/lib/jira'

export const runtime = 'nodejs'

/**
 * GET /api/[app]/bug-format/jira-field-options?fieldId=customfield_10415&variant=epic
 * Fetches a Jira custom field's real configured options, so Settings can offer a
 * value -> Jira-option mapping instead of guessing at string equality. Used for
 * any field registered in JIRA_SYNC_FIELDS (severity, bug type, ...).
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ app: string }> }) {
  const { app } = await params
  const guard = await guardApp(app, 'settings.edit')
  if (!guard.ok) return guard.response

  const fieldId = req.nextUrl.searchParams.get('fieldId')?.trim()
  const variant = req.nextUrl.searchParams.get('variant')
  if (!fieldId) {
    return NextResponse.json({ error: 'fieldId is required' }, { status: 400 })
  }
  if (variant !== 'epic' && variant !== 'story') {
    return NextResponse.json({ error: 'variant must be "epic" or "story"' }, { status: 400 })
  }

  try {
    const options = await getJiraFieldOptions(app, variant, fieldId)
    return NextResponse.json({ options })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch Jira field options'
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
