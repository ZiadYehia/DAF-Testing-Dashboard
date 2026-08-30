import { NextRequest, NextResponse } from 'next/server'
import { guardApp } from '@/lib/auth'
import { getCrJiraFieldOptions } from '@/lib/jira'

export const runtime = 'nodejs'

/**
 * GET /api/[app]/cr-format/jira-field-options?fieldId=customfield_10415&parentType=story
 * Fetches a Jira custom field's real configured options for the change-request issue
 * type (sub-task under a story, story under an epic), so Settings can offer a
 * value -> Jira-option mapping instead of guessing at string equality.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ app: string }> }) {
  const { app } = await params
  const guard = await guardApp(app, 'settings.edit')
  if (!guard.ok) return guard.response

  const fieldId = req.nextUrl.searchParams.get('fieldId')?.trim()
  const parentType = req.nextUrl.searchParams.get('parentType')
  if (!fieldId) {
    return NextResponse.json({ error: 'fieldId is required' }, { status: 400 })
  }
  if (parentType !== 'epic' && parentType !== 'story') {
    return NextResponse.json({ error: 'parentType must be "epic" or "story"' }, { status: 400 })
  }

  try {
    const options = await getCrJiraFieldOptions(app, parentType, fieldId, guard.access.user.id)
    return NextResponse.json({ options })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch Jira field options'
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
