import { NextRequest, NextResponse } from 'next/server'
import { getBug, getAttachmentsForJira } from '@/lib/bugs'
import { updateJiraIssue, uploadJiraAttachments } from '@/lib/jira'
import { guardApp } from '@/lib/auth'

type Params = { params: Promise<{ app: string; feature: string; slug: string }> }

export async function POST(_req: NextRequest, { params }: Params) {
  const { app, feature, slug } = await params
  const guard = await guardApp(app, 'bugs.report')
  if (!guard.ok) return guard.response
  const userId = guard.access.user.id

  const bug = await getBug(app, feature, slug)
  if (!bug) return NextResponse.json({ error: 'Bug not found' }, { status: 404 })
  if (!bug.jira_key) return NextResponse.json({ error: 'Bug has no Jira key' }, { status: 400 })

  try {
    // Load attachments so image filenames can be embedded inline in the description.
    const files = await getAttachmentsForJira(app, feature, slug)
    const imageNames = files.filter((f) => f.mimeType.startsWith('image/')).map((f) => f.fileName)
    const videoNames = files.filter((f) => f.mimeType.startsWith('video/')).map((f) => f.fileName)

    await updateJiraIssue(app, bug.jira_key, bug, imageNames, videoNames, userId)

    // Push any new attachments to Jira (additive — dedup by filename avoids duplicates)
    let attachmentWarning: string | undefined
    try {
      await uploadJiraAttachments(bug.jira_key, files, { skipExisting: true, userId })
    } catch (err) {
      attachmentWarning = err instanceof Error ? err.message : 'Attachment upload failed'
      console.error('[jira-sync] Jira attachment upload failed:', err)
    }

    return NextResponse.json({ success: true, attachment_warning: attachmentWarning })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
