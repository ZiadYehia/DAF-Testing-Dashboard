import { describe, it, expect } from 'vitest'
import matter from 'gray-matter'
import {
  serializeApps,
  serializeModule,
  serializeIntake,
  serializeKnowledgeFile,
  serializeFeature,
  serializeExecution,
  serializeBug,
  serializeRequirements,
  serializeStoryLinks,
  serializeStory,
  serializeAutomationConfig,
  type AppRecordInput,
  type FeatureInput,
} from '../serializers'

/** Finds a serialized file by relPath, failing loudly (not undefined) when absent. */
function find(files: { relPath: string; content: string }[], relPath: string) {
  const f = files.find((x) => x.relPath === relPath)
  if (!f) throw new Error(`expected a serialized file at "${relPath}", got: ${files.map((x) => x.relPath).join(', ')}`)
  return f
}

describe('serializeApps', () => {
  it('round-trips a full apps.json array through JSON.parse', () => {
    const apps: AppRecordInput[] = [
      {
        slug: 'grc',
        name: 'GRC',
        description: 'Governance, Risk & Compliance (web).',
        icon: '🛡️',
        enabled: true,
        type: 'web',
        platform: 'Browser',
        capabilities: { testCaseWriter: true, featureWizard: true, moduleKnowledge: true },
      },
      {
        slug: 'digital-trustify',
        name: 'Digital Trustify',
        description: 'Digital trust & compliance platform (web).',
        icon: '🔐',
        enabled: false,
        type: 'web',
        platform: 'Browser',
        capabilities: { testCaseWriter: true, featureWizard: false, moduleKnowledge: true },
      },
    ]
    const files = serializeApps(apps)
    expect(files).toHaveLength(1)
    expect(files[0].relPath).toBe('apps.json')
    const parsed = JSON.parse(files[0].content)
    expect(parsed).toEqual(apps)
  })

  it('byte-matches a real apps.json fixture (2-space indent, no trailing newline)', () => {
    const fixture: AppRecordInput = {
      slug: 'grc',
      name: 'GRC',
      description: 'Governance, Risk & Compliance (web). In design; QA driven by stories + mockups.',
      icon: '🛡️',
      enabled: true,
      type: 'web',
      platform: 'Browser',
      capabilities: { testCaseWriter: true, featureWizard: true, moduleKnowledge: true },
    }
    const expected =
      '[\n' +
      '  {\n' +
      '    "slug": "grc",\n' +
      '    "name": "GRC",\n' +
      '    "description": "Governance, Risk & Compliance (web). In design; QA driven by stories + mockups.",\n' +
      '    "icon": "🛡️",\n' +
      '    "enabled": true,\n' +
      '    "type": "web",\n' +
      '    "platform": "Browser",\n' +
      '    "capabilities": {\n' +
      '      "testCaseWriter": true,\n' +
      '      "featureWizard": true,\n' +
      '      "moduleKnowledge": true\n' +
      '    }\n' +
      '  }\n' +
      ']'
    expect(serializeApps([fixture])[0].content).toBe(expected)
  })
})

describe('serializeModule', () => {
  it('round-trips a module manifest through JSON.parse', () => {
    const manifest = {
      slug: 'asset',
      name: 'Asset Manager',
      icon: 'Shield',
      order: 1,
      pathPrefix: '',
      description: 'Asset inventory, lifecycle, evidence, and relationships',
    }
    const files = serializeModule(manifest)
    expect(files).toHaveLength(1)
    expect(files[0].relPath).toBe('modules/asset/module.json')
    expect(JSON.parse(files[0].content)).toEqual(manifest)
  })

  it('byte-matches the real data/grc/modules/asset/module.json fixture', () => {
    const expected =
      '{\n' +
      '  "slug": "asset",\n' +
      '  "name": "Asset Manager",\n' +
      '  "icon": "Shield",\n' +
      '  "order": 1,\n' +
      '  "pathPrefix": "",\n' +
      '  "description": "Asset inventory, lifecycle, evidence, and relationships"\n' +
      '}'
    const content = serializeModule({
      slug: 'asset',
      name: 'Asset Manager',
      icon: 'Shield',
      order: 1,
      pathPrefix: '',
      description: 'Asset inventory, lifecycle, evidence, and relationships',
    })[0].content
    expect(content).toBe(expected)
  })

  it('omits description when null/undefined', () => {
    const files = serializeModule({ slug: 'risk', name: 'Risk', icon: 'AlertTriangle', order: 2, pathPrefix: 'risk' })
    expect(JSON.parse(files[0].content)).not.toHaveProperty('description')
  })
})

describe('serializeIntake', () => {
  it('computes the right relPath per scope kind', () => {
    const intake = { updatedAt: '2026-07-03T04:35:23.048Z', answers: { domain: { purpose: 'x' } } }
    expect(serializeIntake({ kind: 'app' }, intake)[0].relPath).toBe('intake.json')
    expect(serializeIntake({ kind: 'module', module: 'asset' }, intake)[0].relPath).toBe('modules/asset/intake.json')
    expect(serializeIntake({ kind: 'feature', feature: 'asset-edit' }, intake)[0].relPath).toBe(
      'features/asset-edit/intake.json'
    )
  })

  it('round-trips version + updatedAt + answers through JSON.parse', () => {
    const intake = { updatedAt: '2026-07-03T04:35:23.048Z', answers: { domain: { purpose: 'x', roles: [{ name: 'Admin' }] } } }
    const parsed = JSON.parse(serializeIntake({ kind: 'app' }, intake)[0].content)
    expect(parsed).toEqual({ version: 1, updatedAt: intake.updatedAt, answers: intake.answers })
  })
})

describe('serializeKnowledgeFile', () => {
  it('routes each docType to its expected path', () => {
    expect(
      serializeKnowledgeFile({ filename: 'grc-platform-domain-knowledge.md', content: '# x', module: null, docType: 'knowledge' })[0]
        .relPath
    ).toBe('knowledge/grc-platform-domain-knowledge.md')
    expect(
      serializeKnowledgeFile({ filename: 'asset-domain-knowledge.md', content: '# x', module: 'asset', docType: 'knowledge' })[0]
        .relPath
    ).toBe('modules/asset/knowledge/asset-domain-knowledge.md')
    expect(serializeKnowledgeFile({ filename: 'bug-format.md', content: '# x', module: null, docType: 'bug-format' })[0].relPath).toBe(
      'bug-format.md'
    )
    expect(
      serializeKnowledgeFile({ filename: 'assets-list-testcases.md', content: '# x', module: null, docType: 'example' })[0].relPath
    ).toBe('examples/assets-list-testcases.md')
    expect(
      serializeKnowledgeFile({ filename: 'workflow-template.md', content: '# x', module: null, docType: 'template' })[0].relPath
    ).toBe('.github/templates/workflow-template.md')
  })

  it('passes content through byte-for-byte', () => {
    const content = '<!-- generated-from-intake -->\n# Bug Report Format\n\nline two\n'
    const files = serializeKnowledgeFile({ filename: 'bug-format.md', content, module: null, docType: 'bug-format' })
    expect(files[0].content).toBe(content)
  })
})

describe('serializeFeature', () => {
  const fixture: FeatureInput = {
    name: 'asset-create-manual',
    workflow: '# Asset Create Manual Workflow\n\n...\n',
    testcases: '# Asset Create Manual\n\n|Feature ID|...|\n',
    knowledge: '# Notes\n\nSome knowledge.\n',
    metadata: { jiraKey: 'DT-2841', storyKey: 'DT-2841', module: 'asset' },
    testcaseVersions: [
      { version: 1, content: 'v1 content\n' },
      { version: 2, content: 'v2 content\n' },
    ],
    acceptanceCriteria: [
      { id: 'AC-01', text: 'Page header', parentId: null, manualCoverage: null, aiCoveredBy: [], aiAnalyzedAt: null },
      {
        id: 'AC-01.1',
        text: 'Header reads "Create New Asset"',
        parentId: 'AC-01',
        manualCoverage: null,
        aiCoveredBy: ['CRT_016'],
        aiAnalyzedAt: '2026-06-11T06:58:16.427Z',
      },
    ],
    lastAddition: { ids: ['CRT_120', 'CRT_121'], version: 2, at: '2026-07-10T00:00:00.000Z' },
  }

  it('emits workflow.md, base testcases.md, and every version file', () => {
    const files = serializeFeature(fixture)
    expect(find(files, 'features/asset-create-manual/workflow.md').content).toBe(fixture.workflow)
    expect(find(files, 'features/asset-create-manual/asset-create-manual-testcases.md').content).toBe(fixture.testcases)
    expect(find(files, 'features/asset-create-manual/asset-create-manual-testcases-v1.md').content).toBe('v1 content\n')
    expect(find(files, 'features/asset-create-manual/asset-create-manual-testcases-v2.md').content).toBe('v2 content\n')
  })

  it('round-trips metadata.json through JSON.parse', () => {
    const files = serializeFeature(fixture)
    const meta = JSON.parse(find(files, 'features/asset-create-manual/metadata.json').content)
    expect(meta).toEqual({ jiraKey: 'DT-2841', storyKey: 'DT-2841', module: 'asset' })
  })

  it('byte-matches the real asset-create-manual metadata.json fixture', () => {
    const expected = '{\n  "jiraKey": "DT-2841",\n  "storyKey": "DT-2841",\n  "module": "asset"\n}'
    const files = serializeFeature(fixture)
    expect(find(files, 'features/asset-create-manual/metadata.json').content).toBe(expected)
  })

  it('adds archived/archivedAt to metadata.json only when archivedAt is set', () => {
    const archived = serializeFeature({ ...fixture, metadata: { ...fixture.metadata, archivedAt: '2026-07-01T00:00:00.000Z' } })
    const meta = JSON.parse(find(archived, 'features/asset-create-manual/metadata.json').content)
    expect(meta).toEqual({
      jiraKey: 'DT-2841', storyKey: 'DT-2841', module: 'asset', archived: true, archivedAt: '2026-07-01T00:00:00.000Z',
    })
  })

  it('omits metadata.json entirely when no metadata fields are set', () => {
    const files = serializeFeature({ ...fixture, metadata: {} })
    expect(files.find((f) => f.relPath.endsWith('metadata.json'))).toBeUndefined()
  })

  it('round-trips acceptance-criteria.json through JSON.parse and byte-matches real formatting', () => {
    const files = serializeFeature(fixture)
    const ac = find(files, 'features/asset-create-manual/acceptance-criteria.json')
    expect(JSON.parse(ac.content)).toEqual(fixture.acceptanceCriteria)
    expect(ac.content).toBe(
      '[\n' +
        '  {\n' +
        '    "id": "AC-01",\n' +
        '    "text": "Page header",\n' +
        '    "parentId": null,\n' +
        '    "manualCoverage": null,\n' +
        '    "aiCoveredBy": [],\n' +
        '    "aiAnalyzedAt": null\n' +
        '  },\n' +
        '  {\n' +
        '    "id": "AC-01.1",\n' +
        '    "text": "Header reads \\"Create New Asset\\"",\n' +
        '    "parentId": "AC-01",\n' +
        '    "manualCoverage": null,\n' +
        '    "aiCoveredBy": [\n' +
        '      "CRT_016"\n' +
        '    ],\n' +
        '    "aiAnalyzedAt": "2026-06-11T06:58:16.427Z"\n' +
        '  }\n' +
        ']'
    )
  })

  it('omits acceptance-criteria.json when there are no ACs', () => {
    const files = serializeFeature({ ...fixture, acceptanceCriteria: [] })
    expect(files.find((f) => f.relPath.endsWith('acceptance-criteria.json'))).toBeUndefined()
  })

  it('round-trips last-addition.json and omits it when null', () => {
    const withAddition = find(serializeFeature(fixture), 'features/asset-create-manual/last-addition.json')
    expect(JSON.parse(withAddition.content)).toEqual(fixture.lastAddition)
    const without = serializeFeature({ ...fixture, lastAddition: null })
    expect(without.find((f) => f.relPath.endsWith('last-addition.json'))).toBeUndefined()
  })

  it('omits knowledge.md when knowledge is null/undefined', () => {
    const files = serializeFeature({ ...fixture, knowledge: null })
    expect(files.find((f) => f.relPath.endsWith('knowledge.md'))).toBeUndefined()
  })
})

describe('serializeExecution', () => {
  it('round-trips status + bugs + notes maps through JSON.parse, with the flat namespace unsuffixed', () => {
    const status = { CRT_001: 'pass', CRT_002: 'fail' }
    const bugs = { CRT_002: 'some-bug-slug' }
    const notes = { CRT_001: 'Verified on staging.' }
    const files = serializeExecution('asset-edit', { version: null, status, bugs, notes })
    expect(find(files, 'features/asset-edit/execution-status.json').content).toBe(JSON.stringify(status, null, 2))
    expect(find(files, 'features/asset-edit/execution-bugs.json').content).toBe(JSON.stringify(bugs, null, 2))
    expect(find(files, 'features/asset-edit/execution-notes.json').content).toBe(JSON.stringify(notes, null, 2))
  })

  it('suffixes versioned files with -vN', () => {
    const files = serializeExecution('asset-create-manual', { version: 2, status: { CRT_100: 'pass' }, bugs: {}, notes: { CRT_100: 'Looks good.' } })
    expect(find(files, 'features/asset-create-manual/execution-status-v2.json')).toBeTruthy()
    expect(files.find((f) => f.relPath.includes('execution-bugs'))).toBeUndefined()
    expect(find(files, 'features/asset-create-manual/execution-notes-v2.json')).toBeTruthy()
  })

  it('omits execution-notes.json when the notes map is empty', () => {
    const files = serializeExecution('asset-edit', { version: null, status: { CRT_001: 'pass' }, bugs: {}, notes: {} })
    expect(files.find((f) => f.relPath.includes('execution-notes'))).toBeUndefined()
  })

  it('emits nothing when all maps are empty', () => {
    expect(serializeExecution('x', { version: null, status: {}, bugs: {}, notes: {} })).toEqual([])
  })
})

describe('serializeBug', () => {
  const bugFixture = {
    feature: 'asset-edit',
    slug: 'asset-edit-form-fails-to-save',
    title: 'Asset edit form fails to save when more than 5 attachments are present',
    status: 'reported',
    jiraKey: 'DT-3607',
    reportedAt: '2026-07-10T12:33:40.620Z',
    priority: 'P2 – High',
    bugType: 'Functional / Validation',
    parentKey: 'DT-2896',
    severity: 'S2 – Major',
    layer: 'backend',
    jiraStatus: 'Done',
    jiraReporter: '712020:af0a67e5-25e2-4ed1-a7e4-57c55353b428',
    body: 'The system allows users to upload more than 5 attachments.\n\n---\n\n**Steps to Reproduce:**\n\n1. Do the thing.',
  }

  it('round-trips frontmatter + body through gray-matter, in writeBugMarkdown field order', () => {
    const files = serializeBug(bugFixture)
    expect(files[0].relPath).toBe('bugs/asset-edit/asset-edit-form-fails-to-save.md')
    const { data, content } = matter(files[0].content)
    expect(data).toEqual({
      title: bugFixture.title,
      status: bugFixture.status,
      jira_key: bugFixture.jiraKey,
      reported_at: bugFixture.reportedAt,
      feature: bugFixture.feature,
      priority: bugFixture.priority,
      bug_type: bugFixture.bugType,
      parent_key: bugFixture.parentKey,
      severity: bugFixture.severity,
      layer: bugFixture.layer,
      jira_status: bugFixture.jiraStatus,
      jira_reporter: bugFixture.jiraReporter,
    })
    expect(content.trim()).toBe(bugFixture.body.trim())
    // Field order in the raw YAML block must match writeBugMarkdown's BugFrontmatter order.
    const fmBlock = files[0].content.split('---\n')[1]
    const orderedKeys = fmBlock
      .split('\n')
      .map((l) => l.match(/^(\w+):/)?.[1])
      .filter(Boolean)
    expect(orderedKeys).toEqual([
      'title', 'status', 'jira_key', 'reported_at', 'feature', 'priority',
      'bug_type', 'parent_key', 'severity', 'layer', 'jira_status', 'jira_reporter',
    ])
  })

  it('appends deleted_at as the last frontmatter key for soft-deleted bugs', () => {
    const files = serializeBug({ ...bugFixture, deletedAt: '2026-07-15T00:00:00.000Z' })
    const { data } = matter(files[0].content)
    expect(data.deleted_at).toBe('2026-07-15T00:00:00.000Z')
    const keys = Object.keys(data)
    expect(keys[keys.length - 1]).toBe('deleted_at')
  })

  it('never adds deleted_at when the bug is not deleted', () => {
    const { data } = matter(serializeBug(bugFixture)[0].content)
    expect(data).not.toHaveProperty('deleted_at')
  })
})

describe('serializeRequirements', () => {
  it('emits FRs.md at app root and FRs-<module>.md for a module, passthrough content', () => {
    const content = '# Functional Requirements\n\n| ID | Requirement |\n|----|-------------|\n'
    expect(serializeRequirements(null, content)).toEqual([{ relPath: 'requirements/FRs.md', content }])
    expect(serializeRequirements('asset', content)).toEqual([{ relPath: 'requirements/FRs-asset.md', content }])
  })

  it('emits nothing for empty content', () => {
    expect(serializeRequirements(null, '')).toEqual([])
  })
})

describe('serializeStoryLinks', () => {
  it('round-trips the frId -> storyKey map through JSON.parse, preserving key order', () => {
    const links = { AM_FR_CREATE_01: 'DT-2841', AM_FR_LIFECYCLE_01: 'DT-2877' }
    const files = serializeStoryLinks(links)
    expect(JSON.parse(files[0].content)).toEqual(links)
    expect(Object.keys(JSON.parse(files[0].content))).toEqual(Object.keys(links))
  })

  it('emits nothing for an empty map', () => {
    expect(serializeStoryLinks({})).toEqual([])
  })
})

describe('serializeStory', () => {
  it('matches saveLocalStory\'s `# summary\\n\\ndescription` template', () => {
    const files = serializeStory({ key: 'DT-2840', summary: 'View, search & filter assets', description: 'Body text here.' })
    expect(files).toEqual([
      { relPath: 'stories/DT-2840.md', content: '# View, search & filter assets\n\nBody text here.' },
    ])
  })
})

describe('serializeAutomationConfig', () => {
  it('round-trips through JSON.parse and always sets _derivedCache: true', () => {
    const cfg = {
      slug: 'grc',
      baseUrlEnv: 'GRC_BASE_URL',
      credentialEnvs: ['GRC_LOGIN_USER', 'GRC_LOGIN_PASSWORD'],
      login: [{ action: 'goto', url: '{base}/login' }],
      generatedFromIntake: true,
    }
    const files = serializeAutomationConfig(cfg)
    expect(files[0].relPath).toBe('automation.json')
    const parsed = JSON.parse(files[0].content)
    expect(parsed).toEqual({
      slug: cfg.slug,
      baseUrlEnv: cfg.baseUrlEnv,
      credentialEnvs: cfg.credentialEnvs,
      login: cfg.login,
      _generatedFromIntake: true,
      _derivedCache: true,
    })
  })
})
