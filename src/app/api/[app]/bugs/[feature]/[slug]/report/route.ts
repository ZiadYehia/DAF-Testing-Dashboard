import { NextRequest, NextResponse } from 'next/server'
import { getBug, saveBug, getAttachmentsForJira } from '@/lib/bugs'
import { createJiraIssue, uploadJiraAttachments } from '@/lib/jira'
import { guardApp } from '@/lib/auth'
import { getBugFormat } from '@/lib/bug-format-server'
import { getVariantConfig } from '@/lib/bug-format'

type Params = { params: Promise<{ app: string; feature: string; slug: string }> }

// Per-(app, feature, slug) in-process lock. Guards the check-then-act race between
// reading `status === 'reported'` and the later `saveBug` after `createJiraIssue` —
// a double-submit could otherwise create two Jira issues for the same bug.
// Pattern precedent: automation-hub/engine/runner.ts's `running` Set.
const reporting = new Set<string>()

export async function POST(req: NextRequest, { params }: Params) {
  const { app, feature, slug } = await params
  const guard = await guardApp(app, 'bugs.report')
  if (!guard.ok) return guard.response

  const reportKey = `${app}/${feature}/${slug}`
  if (reporting.has(reportKey)) {
    return NextResponse.json({ error: 'Report already in progress' }, { status: 409 })
  }
  reporting.add(reportKey)
  try {
    let bug = await getBug(app, feature, slug)
    if (!bug) return NextResponse.json({ error: 'Bug not found' }, { status: 404 })
    if (bug.status === 'reported') {
      return NextResponse.json({ error: 'Already reported', jira_key: bug.jira_key }, { status: 409 })
    }

    // Accept an optional parent_key/layer from the request body (for story bugs / layer
    // overrides chosen at report time), and optional labels to send to Jira.
    const body = await req.json().catch(() => ({})) as {
      parent_key?: string | null
      layer?: string
      labels?: string[]
    }
    if (body.parent_key !== undefined && body.parent_key !== bug.parent_key) {
      await saveBug(app, feature, slug, bug.body, { parent_key: body.parent_key })
      bug = { ...bug, parent_key: body.parent_key ?? null }
    }
    if (body.layer !== undefined && body.layer !== bug.layer) {
      await saveBug(app, feature, slug, bug.body, { layer: body.layer })
      bug = { ...bug, layer: body.layer }
    }

    try {
      // Load attachments up front so image filenames can be embedded inline in the
      // description (after the summary). Images render inline via Jira `!file!` markup;
      // videos can't render inline and stay in the Attachments panel.
      const files = await getAttachmentsForJira(app, feature, slug)
      const imageNames = files.filter((f) => f.mimeType.startsWith('image/')).map((f) => f.fileName)
      const videoNames = files.filter((f) => f.mimeType.startsWith('video/')).map((f) => f.fileName)

      // Label fallback is variant-aware: epic-level bugs (no parent_key) and
      // story bugs (parent_key set) can have different configured labels.
      const extraLabels = Array.isArray(body.labels)
        ? body.labels
        : getVariantConfig(await getBugFormat(app), bug.parent_key).jiraLabels
      const jiraKey = await createJiraIssue(app, bug, imageNames, videoNames, extraLabels)
      await saveBug(app, feature, slug, bug.body, {
        status: 'reported',
        jira_key: jiraKey,
        reported_at: new Date().toISOString(),
      })

      // Upload attachments to the Jira ticket. The report itself already succeeded,
      // so an attachment failure is non-fatal — surface it as a warning instead of 500.
      let attachmentWarning: string | undefined
      try {
        await uploadJiraAttachments(jiraKey, files)
      } catch (err) {
        attachmentWarning = err instanceof Error ? err.message : 'Attachment upload failed'
        console.error('[report] Jira attachment upload failed:', err)
      }

      const { getJiraIssueUrl } = await import('@/lib/jira')
      const jira_url = await getJiraIssueUrl(jiraKey)
      return NextResponse.json({ success: true, jira_key: jiraKey, jira_url, attachment_warning: attachmentWarning })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      return NextResponse.json({ error: message }, { status: 500 })
    }
  } finally {
    reporting.delete(reportKey)
  }
}
