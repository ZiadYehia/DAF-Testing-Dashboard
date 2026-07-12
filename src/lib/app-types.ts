// Client-safe app types, defaults, and the guided-knowledge templates.
// This module MUST stay free of `fs`/server-only imports so it can be pulled
// into client components (the Add-app wizard, the sidebar hook, etc.).

export interface AppConfig {
  /** URL slug, e.g. "my-app" */
  slug: string
  /** Display name */
  name: string
  /** Short description */
  description: string
  /** Emoji or icon identifier (fallback when no uploaded logo exists) */
  icon: string
  /** Whether this app is active (false = archived/hidden from the dashboard) */
  enabled: boolean
  /** Type of application */
  type: 'mobile' | 'desktop' | 'web'
  /** Platform details */
  platform: string
  /** Per-app feature flags — controls what's shown in the dashboard */
  capabilities: {
    testCaseWriter: boolean
    featureWizard: boolean
    /** Module Knowledge — pull stories from the board and synthesize domain knowledge */
    moduleKnowledge: boolean
  }
}

export const APP_TYPES: AppConfig['type'][] = ['web', 'mobile', 'desktop']

export function defaultCapabilities(): AppConfig['capabilities'] {
  return { testCaseWriter: true, featureWizard: true, moduleKnowledge: false }
}

/** A brand-new slug is lowercase letters, numbers and hyphens only. */
export function appSlugIsValid(slug: string): boolean {
  return /^[a-z0-9][a-z0-9-]*$/.test(slug)
}

/** Settings-table logo key for an app (mirrors the existing `dashboard` / `module_*` keys). */
export function appLogoKey(slug: string): string {
  return `app_${slug}`
}

// ─── Guided knowledge step (Add-app wizard) ──────────────────────────────────
// Each field becomes a markdown file under data/<slug>/knowledge/. The `guideline`
// text is shown to the user to explain what to write; the `template` pre-fills the
// editor so they have a structure to follow.

export interface KnowledgeFieldDef {
  /** Wizard form key */
  key: 'domain' | 'rules' | 'process'
  /** Filename written to disk; `{slug}` is replaced with the app slug */
  filename: string
  label: string
  /** One-line explanation of what this document is */
  guideline: string
  /** Pre-filled markdown structure */
  template: string
}

export const KNOWLEDGE_FIELDS: KnowledgeFieldDef[] = [
  {
    key: 'domain',
    filename: '{slug}-platform-domain-knowledge.md',
    label: 'Platform / domain knowledge',
    guideline:
      'What the app IS: its purpose, the business domain, the main user roles, the core objects/entities, key workflows, and any jargon the AI must understand to write good test cases. This is the single most important document.',
    template: `# {name} — Platform & Domain Knowledge

## What this product is
<!-- One paragraph: what the app does and who uses it. -->

## User roles
<!-- List each role and what they can do. -->
- Role — responsibilities

## Core concepts & entities
<!-- The main objects in the system and how they relate. -->
- Entity — what it represents

## Key workflows
<!-- The main end-to-end flows a tester should know. -->
1. Workflow — steps / outcome

## Environments & access
<!-- URLs, test environments, how to log in, test accounts. -->

## Glossary
<!-- Domain terms and abbreviations. -->
- Term — meaning
`,
  },
  {
    key: 'rules',
    filename: 'testcase-writing-rules.md',
    label: 'Test-case writing rules',
    guideline:
      'The FORMAT rules every generated test case must follow: ID scheme, required columns/fields, how steps and expected results are phrased, priority scale, and any house style. Highest-priority knowledge — it is never dropped from the AI prompt.',
    template: `# Test-Case Writing Rules

## ID scheme
<!-- e.g. PREFIX_001, grouped by feature/module. -->

## Required fields
<!-- Columns each test case must have. -->
- ID, Title, Preconditions, Steps, Expected Result, Priority, Type

## Style rules
- Steps are numbered, imperative ("Click…", "Enter…").
- One expected result per behaviour being verified.
- Priority scale: P1 (Critical) … P4 (Low).

## Do / Don't
- Do: cover negative and edge cases.
- Don't: combine unrelated checks into one case.
`,
  },
  {
    key: 'process',
    filename: 'testcase-generation-process.md',
    label: 'Test-case generation process',
    guideline:
      'The METHOD the AI should use when turning a feature/requirement into test cases: how to read acceptance criteria, how to enumerate scenarios (happy path, negative, boundary, permissions), and how much coverage to aim for.',
    template: `# Test-Case Generation Process

## Inputs
<!-- What the AI should read: feature workflow, acceptance criteria, screenshots, knowledge. -->

## Method
1. Restate each acceptance criterion as one or more verifiable scenarios.
2. For every scenario, add: happy path, negative, boundary, and permission variants.
3. Map each test case back to the acceptance criterion it covers.

## Coverage target
<!-- e.g. every AC covered by at least one positive and one negative case. -->
`,
  },
]
