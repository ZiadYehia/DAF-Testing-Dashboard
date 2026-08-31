// Client-safe intake question/group definitions + the intake.json shape.
// Mirrors src/lib/app-types.ts: this module MUST stay free of `fs`/server-only
// imports so it can be pulled into client components (IntakeGroupForm, wizards).
//
// Question groups are DATA, not code — adding/editing a question here changes
// what the wizard/edit forms render and what src/lib/intake.ts compiles, with
// no other code changes needed.

import type { AppConfig } from './app-types'

export type IntakeFieldType = 'short-text' | 'long-text' | 'list' | 'key-value' | 'login-steps'

/** One column of a `list`/`key-value` question's rows. */
export interface IntakeItemField {
  key: string
  label: string
  /** Render as a multi-line textarea instead of a single-line input. */
  long?: boolean
  placeholder?: string
}

export interface IntakeQuestion {
  id: string
  label: string
  /** Shown under the label — phrase as a question a non-technical QA can answer. */
  help?: string
  type: IntakeFieldType
  /** Row schema for `list` / `key-value` questions. */
  itemFields?: IntakeItemField[]
  placeholder?: string
}

export interface IntakeGroup {
  id: string
  title: string
  description: string
  questions: IntakeQuestion[]
}

/**
 * `short-text` / `long-text`      → string
 * `list` / `key-value`            → array of row objects (string-keyed, string-valued)
 * `login-steps`                   → array of login step objects (kept as `unknown[]`
 *                                    here — the shape lives in automation-hub, a
 *                                    separately-owned deployable; see IntakeLoginStep
 *                                    below for the editor-facing mirror of that shape)
 */
export type IntakeValue = string | Array<Record<string, string>> | unknown[]

export interface IntakeFile {
  version: 1
  updatedAt: string
  answers: Record<string, Record<string, IntakeValue>>
}

// ─── Login-steps editor shape ─────────────────────────────────────────────────
// Mirrors automation-hub/lib/login-config.ts field-for-field (NOT imported —
// intake-types.ts must stay dependency-free and automation-hub is a separate
// deployable; the JSON on disk is the contract between the two, not a shared
// TS type). Keep these two definitions in sync if the login schema changes.

export type IntakeLocatorKind = 'css' | 'id' | 'text' | 'role' | 'testid' | 'label'

export interface IntakeStepLocator {
  kind: IntakeLocatorKind
  value: string
  /** Accessible name filter — only meaningful for kind: 'role'. */
  name?: string
}

export type IntakeLoginStepAction = 'goto' | 'click' | 'fill' | 'waitForUrl' | 'waitForVisible'

export interface IntakeLoginStep {
  action: IntakeLoginStepAction
  url?: string
  locator?: IntakeStepLocator
  value?: string
  onlyIfVisible?: boolean
  retryOnFlake?: boolean
  expectAnyVisible?: IntakeStepLocator[]
  startsWith?: string
  timeoutMs?: number
}

export const LOCATOR_KINDS: IntakeLocatorKind[] = ['css', 'id', 'text', 'role', 'testid', 'label']
export const LOGIN_STEP_ACTIONS: IntakeLoginStepAction[] = ['goto', 'click', 'fill', 'waitForUrl', 'waitForVisible']

// ─── App-tier groups ───────────────────────────────────────────────────────────

export const APP_INTAKE_GROUPS: IntakeGroup[] = [
  {
    id: 'domain',
    title: 'Domain & Platform Knowledge',
    description:
      'The single most important context the AI reads — what the app is, who uses it, and how it works. Compiles into the app-level domain knowledge document.',
    questions: [
      {
        id: 'purpose',
        label: 'Purpose',
        type: 'long-text',
        help: 'In a sentence or two, what does this app do and who uses it?',
        placeholder: 'e.g. An order-management platform used by staff and managers to track…',
      },
      {
        id: 'roles',
        label: 'User roles',
        type: 'list',
        help: 'Who are the user roles, and what can each one do?',
        itemFields: [
          { key: 'name', label: 'Role name', placeholder: 'e.g. Admin' },
          { key: 'permissions', label: 'What can they do?', long: true, placeholder: 'e.g. Full access, manages users and settings' },
        ],
      },
      {
        id: 'entities',
        label: 'Core concepts & entities',
        type: 'list',
        help: 'What are the main objects or records in the system (e.g. Order, Item, Customer), and how do they relate to each other?',
        itemFields: [
          { key: 'name', label: 'Entity', placeholder: 'e.g. Order' },
          { key: 'description', label: 'What it represents', long: true },
        ],
      },
      {
        id: 'workflows',
        label: 'Key workflows',
        type: 'long-text',
        help: 'What are the main end-to-end flows a tester should know, step by step?',
      },
      {
        id: 'environments',
        label: 'Environments & URLs',
        type: 'key-value',
        help: 'What environments exist (dev/staging/prod), and what are their URLs?',
        itemFields: [
          { key: 'label', label: 'Environment', placeholder: 'e.g. Staging' },
          { key: 'url', label: 'URL', placeholder: 'e.g. https://staging.example.com' },
        ],
      },
      {
        id: 'testAccounts',
        label: 'Test accounts',
        type: 'list',
        help: 'What test accounts can testers log in with, and which role does each belong to?',
        itemFields: [
          { key: 'role', label: 'Role', placeholder: 'e.g. Admin' },
          { key: 'username', label: 'Username' },
          { key: 'password', label: 'Password' },
        ],
      },
      {
        id: 'glossary',
        label: 'Glossary',
        type: 'key-value',
        help: 'What domain terms or abbreviations would confuse someone new to this app?',
        itemFields: [
          { key: 'term', label: 'Term', placeholder: 'e.g. AST-NNN' },
          { key: 'meaning', label: 'Meaning' },
        ],
      },
    ],
  },
  {
    id: 'testing',
    title: 'Test-Case Writing Rules',
    description:
      'The format every generated test case must follow. Compiles into the test-case writing rules and generation-process documents, and updates the tester name / environment used in prompts.',
    questions: [
      {
        id: 'idScheme',
        label: 'Test case ID scheme',
        type: 'short-text',
        help: 'How should test case IDs be formatted?',
        placeholder: 'e.g. PREFIX_001, grouped by feature',
      },
      {
        id: 'tableFormat',
        label: 'Required fields / table format',
        type: 'long-text',
        help: 'What columns or fields must every test case include?',
      },
      {
        id: 'stepStyle',
        label: 'Step-writing style',
        type: 'long-text',
        help: 'How should steps and expected results be phrased? (e.g. numbered, imperative voice, one behavior per case)',
      },
      {
        id: 'priorityScale',
        label: 'Priority scale',
        type: 'long-text',
        help: 'What does each priority level mean? (e.g. P1 = Critical … P4 = Low)',
      },
      {
        id: 'coverage',
        label: 'Coverage expectations',
        type: 'long-text',
        help: 'How thorough should generated test cases be? What must always be covered (happy path, negative, boundary, permissions)?',
      },
      {
        id: 'testerName',
        label: 'Tester name',
        type: 'short-text',
        help: 'Whose name should appear in the Tester column?',
      },
      {
        id: 'browserOs',
        label: 'Browser & OS',
        type: 'short-text',
        help: 'What browser and OS should be listed as the test environment?',
        placeholder: 'e.g. Microsoft Edge — Windows 11 Pro',
      },
      {
        id: 'envLabel',
        label: 'Environment label',
        type: 'short-text',
        help: 'What should the environment be called in test cases?',
        placeholder: 'e.g. QA, Staging, Dev Branch',
      },
    ],
  },
  {
    id: 'bugs',
    title: 'Bug Writing Guidance',
    description:
      'Prose guidance the AI reads when writing bug reports. Compiles into the bug-format document and the bug environment string. Which fields appear, Jira labels, and value lists are configured in Settings → Test Case & Bug Report Defaults → Bug Report Format.',
    questions: [
      {
        id: 'formatSections',
        label: 'Bug report sections',
        type: 'long-text',
        help: 'What sections must every bug report include?',
        placeholder: 'e.g. Summary, Steps to Reproduce, Expected Result, Actual Result, Environment, Priority, Bug Type',
      },
      {
        id: 'severityConventions',
        label: 'Severity / priority conventions',
        type: 'long-text',
        help: 'How should bug severity or priority be defined? (e.g. what makes something P1 vs P4)',
      },
      {
        id: 'browserOs',
        label: 'Browser & OS',
        type: 'short-text',
        help: "What browser and OS should be listed in a bug's Environment field?",
        placeholder: 'e.g. Microsoft Edge — Windows 11 Pro',
      },
      {
        id: 'envLabel',
        label: 'Environment label',
        type: 'short-text',
        help: 'What should the environment be called?',
        placeholder: 'e.g. QA, Staging, Dev Branch',
      },
    ],
  },
  {
    id: 'automation',
    title: 'Automation Login',
    description:
      "How the Automation Hub logs in before running a test. Values here go into this app's automation.json — credential values themselves stay in automation-hub/.env and are never stored here.",
    questions: [
      {
        id: 'baseUrlEnv',
        label: 'Base URL environment variable',
        type: 'short-text',
        help: "What is the name of the env var (in automation-hub/.env) that holds this app's base URL?",
        placeholder: 'e.g. APP_BASE_URL',
      },
      {
        id: 'credentialEnvs',
        label: 'Credential environment variables',
        type: 'list',
        help: 'What env var names hold the login credentials the automation should use?',
        itemFields: [{ key: 'name', label: 'Env var name', placeholder: 'e.g. APP_LOGIN_PASSWORD' }],
      },
      {
        id: 'loginSteps',
        label: 'Login steps',
        type: 'login-steps',
        help: 'Record the exact steps to log in: go to a URL, click things, fill fields, and wait for the app to load.',
      },
    ],
  },
]

// ─── Module-tier group ─────────────────────────────────────────────────────────

export const MODULE_INTAKE_GROUPS: IntakeGroup[] = [
  {
    id: 'overview',
    title: 'Module Overview',
    description: 'Help the AI understand this module specifically — its purpose, rules, and quirks. Compiles into the module knowledge document.',
    questions: [
      {
        id: 'summary',
        label: 'Overview',
        type: 'long-text',
        help: 'What is this module for, and how does it fit into the app as a whole?',
      },
      {
        id: 'rolesInvolved',
        label: 'Roles involved',
        type: 'long-text',
        help: 'Which user roles interact with this module, and how?',
      },
      {
        id: 'mainWorkflows',
        label: 'Main workflows',
        type: 'long-text',
        help: 'What are the primary things a user does in this module, step by step?',
      },
      {
        id: 'businessRules',
        label: 'Business rules',
        type: 'long-text',
        help: 'What rules, constraints, or validations are specific to this module?',
      },
      {
        id: 'keyFields',
        label: 'Key fields & enums',
        type: 'key-value',
        help: 'What important fields or fixed value-lists (enums/dropdowns) exist in this module?',
        itemFields: [
          { key: 'name', label: 'Field / Enum', placeholder: 'e.g. Order Status' },
          { key: 'values', label: 'Values / notes', long: true, placeholder: 'e.g. Active, Draft, Expired, Archived' },
        ],
      },
      {
        id: 'openQuestions',
        label: 'Open questions',
        type: 'long-text',
        help: 'What is still unclear or undecided about this module that testers should flag?',
      },
    ],
  },
]

// ─── Feature-tier group ────────────────────────────────────────────────────────
// Exactly what the (ported) buildWorkflow() compiler consumes — see
// src/lib/intake.ts's compileFeatureWorkflow.

export const FEATURE_INTAKE_GROUPS: IntakeGroup[] = [
  {
    id: 'workflow',
    title: 'Feature Workflow',
    description: "These answers become the feature's workflow.md — the spec the AI reads when generating test cases.",
    questions: [
      {
        id: 'featureName',
        label: 'Feature display name',
        type: 'short-text',
        help: 'What should this feature be called in test cases and documents?',
      },
      {
        id: 'featureId',
        label: 'Feature / story ID',
        type: 'short-text',
        help: 'Is there a ticket or story ID to reference for traceability? (optional)',
      },
      {
        id: 'roles',
        label: 'Roles',
        type: 'list',
        help: 'Which user role(s) can use this feature?',
        itemFields: [{ key: 'name', label: 'Role', placeholder: 'e.g. Admin' }],
      },
      {
        id: 'modulePath',
        label: 'Navigation path',
        type: 'short-text',
        help: 'Where in the app does a user find this feature?',
        placeholder: 'e.g. Settings → Users',
      },
      {
        id: 'priority',
        label: 'Priority',
        type: 'short-text',
        help: 'How important is this feature? (P1 = Critical … P4 = Low)',
        placeholder: 'P2',
      },
      {
        id: 'appVersion',
        label: 'App version',
        type: 'short-text',
        help: 'Which app version or release is this feature part of?',
      },
      {
        id: 'purpose',
        label: 'Business purpose',
        type: 'long-text',
        help: 'What problem does this feature solve, and why does it exist?',
      },
      {
        id: 'screens',
        label: 'Screens / pages',
        type: 'list',
        help: 'What screens or pages are involved in this feature?',
        itemFields: [
          { key: 'name', label: 'Screen name', placeholder: 'e.g. Orders List' },
          { key: 'description', label: 'What it shows / lets the user do', long: true },
        ],
      },
      {
        id: 'userFlow',
        label: 'User flow',
        type: 'long-text',
        help: 'Walk through the flow step by step, from start to finish.',
        placeholder: '1. User opens the module\n2. Clicks New\n3. Fills in the form\n4. Submits',
      },
      {
        id: 'fields',
        label: 'Field definitions',
        type: 'list',
        help: 'What input fields does this feature have, and what validation applies to each?',
        itemFields: [
          { key: 'name', label: 'Field name' },
          { key: 'inputType', label: 'Input type', placeholder: 'e.g. text, dropdown' },
          { key: 'required', label: 'Required?', placeholder: 'Yes / No' },
          { key: 'validation', label: 'Validation / notes', long: true },
        ],
      },
      {
        id: 'businessRules',
        label: 'Business rules',
        type: 'long-text',
        help: 'What business rules or constraints apply to this feature? (one per line)',
      },
      {
        id: 'edgeCases',
        label: 'Edge cases',
        type: 'long-text',
        help: 'What edge cases or unusual behaviors should testers know about? (one per line)',
      },
      {
        id: 'relatedFeatures',
        label: 'Related features',
        type: 'list',
        help: 'Which other features are related to this one, and how?',
        itemFields: [
          { key: 'name', label: 'Feature' },
          { key: 'relationship', label: 'Relationship', placeholder: 'e.g. Row click destination' },
        ],
      },
    ],
  },
]

/**
 * The app-tier intake groups that apply to an app of the given type.
 *
 * API apps have no browser login flow, so the **Automation Login** group is omitted
 * entirely. Two reasons it must be omitted rather than left in:
 *
 *   1. Left in, it is a question nobody can answer, so `scoreGroups` scores every API app
 *      permanently short of 100% — a red bucket that can never go green.
 *   2. Worse, answering it writes an `automation_configs` row, which
 *      `src/lib/automation-cache.ts` then renders into `data/<slug>/automation.json`. The
 *      Hub reads that file as "this app has a browser login" and tries to log into an app
 *      that has no UI. Not asking is what keeps that cache a no-op.
 *
 * Omitted, not marked ready: `scoreOf`'s denominator stays honest, and
 * `capabilities.automation` becomes an empty list on its own.
 */
export function appIntakeGroupsFor(type?: AppConfig['type']): IntakeGroup[] {
  return type === 'api' ? APP_INTAKE_GROUPS.filter((g) => g.id !== 'automation') : APP_INTAKE_GROUPS
}
