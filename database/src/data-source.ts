import 'reflect-metadata'
import { DataSource } from 'typeorm'
import * as dotenv from 'dotenv'
import path from 'path'
import {
  Feature,
  Screenshot,
  Bug,
  Attachment,
  KnowledgeFile,
  Requirement,
  Setting,
  AcceptanceCriterion,
  TestcaseVersion,
  ApprovedExample,
  StoryLink,
  UserStory,
  TestExecution,
  User,
  Session,
  AppMembership,
  App,
  Module,
  IntakeDocument,
  AutomationConfig,
  ChangeRequest,
  Environment,
} from './entities'

// Load .env.local from the project root (one level above the database/ folder)
dotenv.config({ path: path.resolve(__dirname, '../../.env.local') })

// Fail fast in production if no DB password is configured — an empty
// fallback is only acceptable for local docker dev.
if (!process.env.DB_PASSWORD && process.env.NODE_ENV === 'production') {
  throw new Error('DB_PASSWORD is required in production')
}

export const AppDataSource = new DataSource({
  type: 'mssql',
  host: process.env.DB_HOST ?? 'localhost',
  port: parseInt(process.env.DB_PORT ?? '1433'),
  username: process.env.DB_USER ?? 'sa',
  password: process.env.DB_PASSWORD ?? '',
  database: process.env.DB_NAME ?? 'TestingDashboard',
  synchronize: false,
  logging: false,
  entities: [Feature, Screenshot, Bug, Attachment, KnowledgeFile, Requirement, Setting, AcceptanceCriterion, TestcaseVersion, ApprovedExample, StoryLink, UserStory, TestExecution, User, Session, AppMembership, App, Module, IntakeDocument, AutomationConfig, ChangeRequest, Environment],
  migrations: [path.join(__dirname, 'migrations', process.env.NODE_ENV === 'production' ? '*.js' : '*.ts')],
  options: {
    encrypt: process.env.DB_ENCRYPT === 'true',
    // Default true for backward compatibility; set DB_TRUST_CERT=false in
    // production with DB_ENCRYPT=true and a CA-signed certificate.
    trustServerCertificate: process.env.DB_TRUST_CERT !== 'false',
  },
})
