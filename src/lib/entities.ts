/**
 * TypeORM EntitySchema definitions for Next.js (no decorators — avoids
 * the need for emitDecoratorMetadata / Babel in the Next.js build).
 */
import { EntitySchema } from 'typeorm'

// ─── Interfaces ──────────────────────────────────────────────────────────────

export interface IFeature {
  id: number
  appSlug: string
  name: string
  workflow: string
  testcases: string
  lastModified: Date | null
  jiraKey?: string | null
  storyKey?: string | null
  knowledge?: string | null
  testingPhase?: string | null
  testingSubtasks?: string | null
  module?: string | null
  screenshots?: IScreenshot[]
  archivedAt?: Date | null
}

export interface IScreenshot {
  id: number
  feature?: IFeature
  fileName: string
  mimeType: string
  data: Buffer
  uploadedAt: Date
}

export interface IBug {
  id: number
  appSlug: string
  feature: string
  slug: string
  title: string
  status: string
  jiraKey: string | null
  reportedAt: Date | null
  priority: string
  bugType: string
  parentKey: string | null
  severity: string
  layer: string
  body: string
  module?: string | null
  jiraStatus?: string | null
  jiraStatusSyncedAt?: Date | null
  jiraReporter?: string | null
  attachments?: IAttachment[]
}

export interface IAttachment {
  id: number
  bug?: IBug
  fileName: string
  mimeType: string
  data: Buffer
  uploadedAt: Date
}

export interface IKnowledgeFile {
  id: number
  appSlug: string
  filename: string
  content: string
  module?: string | null
}

export interface IRequirement {
  id: number
  appSlug: string
  content: string
  module?: string | null
}

// ─── EntitySchemas ────────────────────────────────────────────────────────────

export const FeatureEntity = new EntitySchema<IFeature>({
  name: 'Feature',
  tableName: 'features',
  columns: {
    id: { type: Number, primary: true, generated: true },
    appSlug: { type: 'varchar', length: 50 },
    name: { type: 'varchar', length: 200 },
    workflow: { type: 'nvarchar', length: 'max' as unknown as number, default: '' },
    testcases: { type: 'nvarchar', length: 'max' as unknown as number, default: '' },
    lastModified: { type: 'datetime2', nullable: true },
    jiraKey: { type: 'varchar', length: 100, nullable: true },
    storyKey: { type: 'varchar', length: 100, nullable: true },
    knowledge: { type: 'nvarchar', length: 'max' as unknown as number, nullable: true },
    testingPhase: { type: 'varchar', length: 50, nullable: true },
    testingSubtasks: { type: 'nvarchar', length: 'max' as unknown as number, nullable: true },
    module: { type: 'varchar', length: 50, nullable: true },
    archivedAt: { type: 'datetime2', nullable: true },
  },
  relations: {
    screenshots: {
      type: 'one-to-many',
      target: 'Screenshot',
      inverseSide: 'feature',
      cascade: true,
      eager: false,
    },
  },
  uniques: [{ name: 'UQ_features_app_name', columns: ['appSlug', 'name'] }],
})

export const ScreenshotEntity = new EntitySchema<IScreenshot>({
  name: 'Screenshot',
  tableName: 'screenshots',
  columns: {
    id: { type: Number, primary: true, generated: true },
    fileName: { type: 'varchar', length: 500 },
    mimeType: { type: 'varchar', length: 100 },
    data: { type: 'varbinary', length: 'max' as unknown as number },
    uploadedAt: {
      type: 'datetime2',
      createDate: true,
    },
  },
  relations: {
    feature: {
      type: 'many-to-one',
      target: 'Feature',
      joinColumn: { name: 'featureId' },
      onDelete: 'CASCADE',
      nullable: false,
      inverseSide: 'screenshots',
    },
  },
})

export const BugEntity = new EntitySchema<IBug>({
  name: 'Bug',
  tableName: 'bugs',
  columns: {
    id: { type: Number, primary: true, generated: true },
    appSlug: { type: 'varchar', length: 50 },
    feature: { type: 'varchar', length: 200 },
    slug: { type: 'varchar', length: 200 },
    title: { type: 'nvarchar', length: 500 },
    status: { type: 'varchar', length: 20, default: 'draft' },
    jiraKey: { type: 'varchar', length: 100, nullable: true },
    reportedAt: { type: 'datetime2', nullable: true },
    priority: { type: 'varchar', length: 20, default: '' },
    bugType: { type: 'varchar', length: 100, default: '' },
    parentKey: { type: 'varchar', length: 100, nullable: true },
    severity: { type: 'varchar', length: 50, default: '' },
    layer: { type: 'varchar', length: 20, default: 'unknown' },
    body: { type: 'nvarchar', length: 'max' as unknown as number, default: '' },
    module: { type: 'varchar', length: 50, nullable: true },
    jiraStatus: { type: 'varchar', length: 100, nullable: true },
    jiraStatusSyncedAt: { type: 'datetime2', nullable: true },
    jiraReporter: { type: 'varchar', length: 255, nullable: true },
  },
  relations: {
    attachments: {
      type: 'one-to-many',
      target: 'Attachment',
      inverseSide: 'bug',
      cascade: true,
      eager: false,
    },
  },
  uniques: [{ name: 'UQ_bugs_app_feature_slug', columns: ['appSlug', 'feature', 'slug'] }],
})

export const AttachmentEntity = new EntitySchema<IAttachment>({
  name: 'Attachment',
  tableName: 'attachments',
  columns: {
    id: { type: Number, primary: true, generated: true },
    fileName: { type: 'varchar', length: 500 },
    mimeType: { type: 'varchar', length: 100 },
    data: { type: 'varbinary', length: 'max' as unknown as number },
    uploadedAt: {
      type: 'datetime2',
      createDate: true,
    },
  },
  relations: {
    bug: {
      type: 'many-to-one',
      target: 'Bug',
      joinColumn: { name: 'bugId' },
      onDelete: 'CASCADE',
      nullable: false,
      inverseSide: 'attachments',
    },
  },
})

export const KnowledgeFileEntity = new EntitySchema<IKnowledgeFile>({
  name: 'KnowledgeFile',
  tableName: 'knowledge_files',
  columns: {
    id: { type: Number, primary: true, generated: true },
    appSlug: { type: 'varchar', length: 50 },
    filename: { type: 'varchar', length: 500 },
    content: { type: 'nvarchar', length: 'max' as unknown as number, default: '' },
    module: { type: 'varchar', length: 50, nullable: true },
  },
  uniques: [{ name: 'UQ_knowledge_app_filename', columns: ['appSlug', 'filename'] }],
})

export const RequirementEntity = new EntitySchema<IRequirement>({
  name: 'Requirement',
  tableName: 'requirements',
  columns: {
    id: { type: Number, primary: true, generated: true },
    appSlug: { type: 'varchar', length: 50 },
    content: { type: 'nvarchar', length: 'max' as unknown as number, default: '' },
    module: { type: 'varchar', length: 50, nullable: true },
  },
  uniques: [{ name: 'UQ_requirements_app_module', columns: ['appSlug', 'module'] }],
})

export interface ITestcaseVersion {
  id: number
  feature?: IFeature
  version: number
  content: string
  createdAt: Date
}

export const TestcaseVersionEntity = new EntitySchema<ITestcaseVersion>({
  name: 'TestcaseVersion',
  tableName: 'testcase_versions',
  columns: {
    id:        { type: Number, primary: true, generated: true },
    version:   { type: Number },
    content:   { type: 'nvarchar', length: 'max' as unknown as number, default: '' },
    createdAt: { type: 'datetime2', createDate: true },
  },
  relations: {
    feature: {
      type: 'many-to-one',
      target: 'Feature',
      joinColumn: { name: 'featureId' },
      onDelete: 'CASCADE',
      nullable: false,
    },
  },
  uniques: [{ name: 'UQ_tv_feature_version', columns: ['feature', 'version'] }],
})

export interface IAcceptanceCriterion {
  id: number
  feature?: IFeature
  criterionKey: string
  text: string
  parentId: string | null
  manualCoverage: string | null
  aiCoveredBy: string
  aiAnalyzedAt: Date | null
  sortOrder: number
}

export const AcceptanceCriterionEntity = new EntitySchema<IAcceptanceCriterion>({
  name: 'AcceptanceCriterion',
  tableName: 'acceptance_criteria',
  columns: {
    id:             { type: Number, primary: true, generated: true },
    criterionKey:   { type: 'varchar', length: 50 },
    text:           { type: 'nvarchar', length: 'max' as unknown as number },
    parentId:       { type: 'varchar', length: 50, nullable: true },
    manualCoverage: { type: 'varchar', length: 20, nullable: true },
    aiCoveredBy:    { type: 'nvarchar', length: 'max' as unknown as number, default: '[]' },
    aiAnalyzedAt:   { type: 'datetime2', nullable: true },
    sortOrder:      { type: Number, default: 0 },
  },
  relations: {
    feature: {
      type: 'many-to-one',
      target: 'Feature',
      joinColumn: { name: 'featureId' },
      onDelete: 'CASCADE',
      nullable: false,
    },
  },
  uniques: [{ name: 'UQ_ac_feature_key', columns: ['feature', 'criterionKey'] }],
})

export interface IApprovedExample {
  id: number
  feature?: IFeature
  content: string
  source: string
  sourceVersion: number | null
  createdAt: Date
}

export const ApprovedExampleEntity = new EntitySchema<IApprovedExample>({
  name: 'ApprovedExample',
  tableName: 'approved_examples',
  columns: {
    id:            { type: Number, primary: true, generated: true },
    content:       { type: 'nvarchar', length: 'max' as unknown as number, default: '' },
    source:        { type: 'varchar', length: 20, default: 'approved' },
    sourceVersion: { type: Number, nullable: true },
    createdAt:     { type: 'datetime2', createDate: true },
  },
  relations: {
    feature: {
      type: 'many-to-one',
      target: 'Feature',
      joinColumn: { name: 'featureId' },
      onDelete: 'CASCADE',
      nullable: false,
    },
  },
})

export interface IStoryLink {
  id: number
  appSlug: string
  frId: string
  storyKey: string
}

export const StoryLinkEntity = new EntitySchema<IStoryLink>({
  name: 'StoryLink',
  tableName: 'story_links',
  columns: {
    id:       { type: Number, primary: true, generated: true },
    appSlug:  { type: 'varchar', length: 50 },
    frId:     { type: 'varchar', length: 100 },
    storyKey: { type: 'varchar', length: 100, default: '' },
  },
  uniques: [{ name: 'UQ_story_links_app_frId', columns: ['appSlug', 'frId'] }],
})

export interface IUserStory {
  id: number
  appSlug: string
  storyKey: string
  summary: string
  description: string
  status: string
  labels: string
  components: string
}

export const UserStoryEntity = new EntitySchema<IUserStory>({
  name: 'UserStory',
  tableName: 'user_stories',
  columns: {
    id:          { type: Number, primary: true, generated: true },
    appSlug:     { type: 'varchar', length: 50 },
    storyKey:    { type: 'varchar', length: 100 },
    summary:     { type: 'nvarchar', length: 'max' as unknown as number, default: '' },
    description: { type: 'nvarchar', length: 'max' as unknown as number, default: '' },
    status:      { type: 'varchar', length: 50, default: '' },
    labels:      { type: 'nvarchar', length: 'max' as unknown as number, default: '[]' },
    components:  { type: 'nvarchar', length: 'max' as unknown as number, default: '[]' },
  },
  uniques: [{ name: 'UQ_user_stories_app_key', columns: ['appSlug', 'storyKey'] }],
})

export interface ISetting {
  id?: number
  scope: string
  key: string
  value: string
  updatedAt: Date
}

export const SettingEntity = new EntitySchema<ISetting>({
  name: 'Setting',
  tableName: 'settings',
  columns: {
    id:        { type: Number, primary: true, generated: true },
    scope:     { type: 'varchar', length: 100 },
    key:       { type: 'varchar', length: 200 },
    value:     { type: 'nvarchar', length: 'max' as unknown as number, default: '' },
    updatedAt: { type: 'datetime2', updateDate: true, nullable: true },
  },
  uniques: [{ name: 'UQ_settings_scope_key', columns: ['scope', 'key'] }],
})

export interface ITestExecution {
  id: number
  feature?: IFeature
  testcaseId: string
  status: string
  updatedAt: Date | null
}

export const TestExecutionEntity = new EntitySchema<ITestExecution>({
  name: 'TestExecution',
  tableName: 'test_executions',
  columns: {
    id:         { type: Number, primary: true, generated: true },
    testcaseId: { type: 'varchar', length: 50 },
    status:     { type: 'varchar', length: 20, default: 'new_added' },
    updatedAt:  { type: 'datetime2', updateDate: true, nullable: true },
  },
  relations: {
    feature: {
      type: 'many-to-one',
      target: 'Feature',
      joinColumn: { name: 'featureId' },
      onDelete: 'CASCADE',
      nullable: false,
    },
  },
  uniques: [{ name: 'UQ_te_feature_testcase', columns: ['feature', 'testcaseId'] }],
})

// ─── Auth Entities ────────────────────────────────────────────────────────────

export interface IUser {
  id: number
  email: string
  passwordHash: string
  name: string
  role: string
  createdAt: Date
  updatedAt: Date | null
}

export const UserEntity = new EntitySchema<IUser>({
  name: 'User',
  tableName: 'users',
  columns: {
    id:           { type: Number, primary: true, generated: true },
    email:        { type: 'varchar', length: 255 },
    passwordHash: { type: 'varchar', length: 72 },
    name:         { type: 'varchar', length: 100 },
    role:         { type: 'varchar', length: 10, default: 'member' },
    createdAt:    { type: 'datetime2', createDate: true },
    updatedAt:    { type: 'datetime2', updateDate: true, nullable: true },
  },
  uniques: [{ name: 'UQ_users_email', columns: ['email'] }],
})

export interface ISession {
  id: string
  userId: number
  expiresAt: Date
  createdAt: Date
}

export const SessionEntity = new EntitySchema<ISession>({
  name: 'Session',
  tableName: 'sessions',
  columns: {
    id:        { type: 'varchar', length: 36, primary: true },
    userId:    { type: Number },
    expiresAt: { type: 'datetime2' },
    createdAt: { type: 'datetime2', createDate: true },
  },
})

export interface IAppMembership {
  id: number
  userId: number
  appSlug: string
  role: string
  permissions: string | null
  createdAt: Date
}

export const AppMembershipEntity = new EntitySchema<IAppMembership>({
  name: 'AppMembership',
  tableName: 'app_memberships',
  columns: {
    id:          { type: Number, primary: true, generated: true },
    userId:      { type: Number },
    appSlug:     { type: 'varchar', length: 50 },
    role:        { type: 'varchar', length: 20, default: 'qa' },
    permissions: { type: 'nvarchar', length: 'MAX', nullable: true },
    createdAt:   { type: 'datetime2', createDate: true },
  },
  uniques: [{ name: 'UQ_app_memberships_user_app', columns: ['userId', 'appSlug'] }],
})
