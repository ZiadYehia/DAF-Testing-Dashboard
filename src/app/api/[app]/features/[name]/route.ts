import { NextRequest, NextResponse } from 'next/server'
import { getFeature, saveWorkflow, saveTestcases, updateTestcaseVersionContent, saveFeatureMetadata, saveFeatureKnowledge, getFeatureTestingData, saveFeatureTestingPhase, listExamples, archiveFeature } from '@/lib/features'
import { fetchStoryByKey, saveLocalStory } from '@/lib/stories'
import { createTestingSubtask, getMyJiraAssignee, type TestingPhase } from '@/lib/jira'
import { guardApp } from '@/lib/auth'

type Params = { params: Promise<{ app: string; name: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  const { app, name } = await params
  const guard = await guardApp(app, 'features.view')
  if (!guard.ok) return guard.response
  const feature = await getFeature(app, name)
  if (!feature) return NextResponse.json({ error: 'Feature not found' }, { status: 404 })
  return NextResponse.json(feature)
}

export async function PUT(req: NextRequest, { params }: Params) {
  const { app, name } = await params
  const body = await req.json() as { type: 'workflow' | 'testcases' | 'metadata' | 'knowledge' | 'testing-phase'; content?: string; jiraKey?: string; storyKey?: string; versionFile?: string; phase?: string | null; assignToMe?: boolean }
  const permission = body.type === 'testing-phase' ? 'features.lifecycle' : 'features.edit'
  const guard = await guardApp(app, permission)
  if (!guard.ok) return guard.response
  const userId = guard.access.user.id
  if (body.type === 'workflow') {
    await saveWorkflow(app, name, body.content ?? '')
  } else if (body.type === 'testcases') {
    if (body.versionFile) {
      await updateTestcaseVersionContent(app, name, body.versionFile, body.content ?? '')
    }
    await saveTestcases(app, name, body.content ?? '')
  } else if (body.type === 'metadata') {
    const meta: { jiraKey?: string; storyKey?: string } = {}
    if ('jiraKey' in body) meta.jiraKey = body.jiraKey
    if ('storyKey' in body) meta.storyKey = body.storyKey
    await saveFeatureMetadata(app, name, meta)
    // Cache the linked Jira story locally so it appears in story dropdowns
    if (meta.jiraKey) {
      fetchStoryByKey(meta.jiraKey, userId)
        .then((story) => { if (story) saveLocalStory(app, story) })
        .catch(() => {})
    }
  } else if (body.type === 'knowledge') {
    await saveFeatureKnowledge(app, name, body.content ?? '')
  } else if (body.type === 'testing-phase') {
    const phase = body.phase ?? null
    const validPhases: TestingPhase[] = ['testcase_design', 'testcase_execution', 'retesting']
    if (phase !== null && !validPhases.includes(phase as TestingPhase)) {
      return NextResponse.json({ error: 'Invalid phase' }, { status: 400 })
    }

    let subtaskEntry: { phase: string; key: string } | undefined
    let subtaskCreated = false

    if (phase !== null) {
      const { jiraKey, testingSubtasks } = await getFeatureTestingData(app, name)
      if (!testingSubtasks[phase] && jiraKey) {
        try {
          const assignee = body.assignToMe ? await getMyJiraAssignee(userId) : undefined
          const subtaskKey = await createTestingSubtask(app, jiraKey, phase as TestingPhase, assignee ?? undefined, userId)
          subtaskEntry = { phase, key: subtaskKey }
          subtaskCreated = true
        } catch (err) {
          console.error('Failed to create Jira subtask:', err)
        }
      }
    }

    const { testingSubtasks } = await saveFeatureTestingPhase(app, name, phase, subtaskEntry)
    return NextResponse.json({
      success: true,
      phase,
      subtaskKey: subtaskEntry?.key ?? null,
      subtaskCreated,
      testingSubtasks,
    })
  } else {
    return NextResponse.json({ error: 'Invalid type' }, { status: 400 })
  }
  return NextResponse.json({ success: true })
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { app, name } = await params
  const guard = await guardApp(app, 'features.delete')
  if (!guard.ok) return guard.response
  const ok = await archiveFeature(app, name)
  if (!ok) return NextResponse.json({ error: 'Feature not found' }, { status: 404 })
  return NextResponse.json({ success: true })
}

export async function GET_examples(_req: NextRequest, { params }: Params) {
  const { app } = await params
  return NextResponse.json(await listExamples(app))
}
