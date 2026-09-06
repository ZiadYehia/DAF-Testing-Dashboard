import 'reflect-metadata'
import { DataSource } from 'typeorm'
import {
  FeatureEntity,
  ScreenshotEntity,
  BugEntity,
  AttachmentEntity,
  KnowledgeFileEntity,
  RequirementEntity,
  SettingEntity,
  AcceptanceCriterionEntity,
  TestcaseVersionEntity,
  ApprovedExampleEntity,
  StoryLinkEntity,
  UserStoryEntity,
  TestExecutionEntity,
  UserEntity,
  SessionEntity,
  AppMembershipEntity,
  AppEntity,
  ModuleEntity,
  IntakeDocumentEntity,
  AutomationConfigEntity,
  ChangeRequestEntity,
  EnvironmentEntity,
} from './entities'

function createDataSource(): DataSource {
  return new DataSource({
    type: 'mssql',
    host: process.env.DB_HOST ?? 'localhost',
    port: parseInt(process.env.DB_PORT ?? '1433'),
    username: process.env.DB_USER ?? 'sa',
    password: process.env.DB_PASSWORD ?? '',
    database: process.env.DB_NAME ?? 'TestingDashboard',
    // synchronize:true auto-creates tables in dev when no migration has run yet.
    // Set DB_SYNC=false (or omit) in production — use migrations instead.
    synchronize: process.env.DB_SYNC === 'true',
    // Per-query logging floods the dev static-generation worker's stdout. When that
    // pipe breaks, the resulting unhandled `write EPIPE` crashes the Jest worker
    // ("child process exceptions, exceeding retry limit") — most visibly on query-heavy
    // routes like /[app]/features. Log errors only; opt into full query logs with DB_LOGGING=true.
    logging: process.env.DB_LOGGING === 'true' ? 'all' : ['error'],
    entities: [
      FeatureEntity,
      ScreenshotEntity,
      BugEntity,
      AttachmentEntity,
      KnowledgeFileEntity,
      RequirementEntity,
      SettingEntity,
      AcceptanceCriterionEntity,
      TestcaseVersionEntity,
      ApprovedExampleEntity,
      StoryLinkEntity,
      UserStoryEntity,
      TestExecutionEntity,
      UserEntity,
      SessionEntity,
      AppMembershipEntity,
      AppEntity,
      ModuleEntity,
      IntakeDocumentEntity,
      AutomationConfigEntity,
      ChangeRequestEntity,
      EnvironmentEntity,
    ],
    options: {
      encrypt: process.env.DB_ENCRYPT === 'true',
      // Default true for backward compatibility; set DB_TRUST_CERT=false in
      // production with DB_ENCRYPT=true and a CA-signed certificate.
      trustServerCertificate: process.env.DB_TRUST_CERT !== 'false',
    },
  })
}

// Module-level singleton for production
let _ds: DataSource | undefined
let _initPromise: Promise<DataSource> | undefined
let _lastPingAt: number | undefined

declare global {
  // Persist across Next.js hot-reloads in development
   
  var __typeorm_ds: DataSource | undefined
  // The in-flight initialize() promise, so concurrent requests on a cold/dropped
  // connection share one initialization instead of racing (TypeORM throws if
  // initialize() is called twice in parallel, which would surface as a 404).
   
  var __typeorm_init: Promise<DataSource> | undefined
  // Timestamp of the last successful liveness ping (see getDataSource).
   
  var __typeorm_ping: number | undefined
}

// When this module is hot-reloaded (entity schema changes in dev), destroy the
// stale DataSource so the next request re-initializes with fresh entity metadata.
if (process.env.NODE_ENV !== 'production' && globalThis.__typeorm_ds?.isInitialized) {
  globalThis.__typeorm_ds.destroy().catch(() => {})
  globalThis.__typeorm_ds = undefined
  globalThis.__typeorm_init = undefined
  globalThis.__typeorm_ping = undefined
}

// How long a pool is trusted after its last verified-alive moment. Requests
// inside this window skip the liveness ping; the first request after an idle
// gap pays one cheap `SELECT 1` round trip.
const PING_INTERVAL_MS = 30_000

/** Invalidate the ping-trust window so the next getDataSource() re-verifies the pool. */
function distrustPool(): void {
  globalThis.__typeorm_ping = 0
  _lastPingAt = 0
}

// The pool can die underneath TypeORM without any request noticing (SQL Server
// restart, idle kill, machine sleep). Listening for the mssql pool's 'error'
// event collapses the trust window the moment the pool reports trouble, instead
// of serving dead connections for up to PING_INTERVAL_MS.
function watchPool(ds: DataSource): void {
  const master = (ds.driver as { master?: { on?: (ev: string, fn: (e: unknown) => void) => void } }).master
  master?.on?.('error', () => distrustPool())
}

const CONNECTION_ERROR_CODES = new Set(['ENOTOPEN', 'ECONNCLOSED', 'ESOCKET', 'ECONNRESET', 'ETIMEOUT'])
const CONNECTION_ERROR_RE = /connection (is closed|is closing|not yet open|lost)/i

/** True when the error is a dead/dying-pool connection failure (not a SQL error). */
export function isDbConnectionError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false
  const e = err as { code?: string; message?: string; driverError?: { code?: string; message?: string } }
  const code = e.driverError?.code ?? e.code
  if (code && CONNECTION_ERROR_CODES.has(code)) return true
  return CONNECTION_ERROR_RE.test(e.driverError?.message ?? e.message ?? '')
}

/**
 * Run a DB-touching function, retrying exactly once when it fails with a
 * connection-level error. The retry invalidates the pool-trust window first, so
 * the function's own getDataSource() call re-pings and rebuilds the pool before
 * queries run again. Do not use around multi-step writes that must not repeat
 * their already-committed steps.
 */
export async function withDbRetry<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn()
  } catch (err) {
    if (!isDbConnectionError(err)) throw err
    distrustPool()
    return await fn()
  }
}

export async function getDataSource(): Promise<DataSource> {
  const dev = process.env.NODE_ENV !== 'production'

  // Resolve the cached DataSource (dev keeps it on globalThis to survive HMR).
  let ds = dev ? globalThis.__typeorm_ds : _ds
  if (!ds) {
    ds = createDataSource()
    if (dev) globalThis.__typeorm_ds = ds
    else _ds = ds
  }
  if (ds.isInitialized) {
    // `isInitialized` stays true even after the mssql pool dies underneath
    // TypeORM (SQL Server restart, idle timeout, machine sleep), which leaves
    // every query failing with "ConnectionError: Connection is closed." until
    // the process restarts. Ping the pool when it hasn't been verified
    // recently; on failure, tear it down and fall through to re-initialize.
    const now = Date.now()
    const lastPing = (dev ? globalThis.__typeorm_ping : _lastPingAt) ?? 0
    if (now - lastPing < PING_INTERVAL_MS) return ds
    try {
      await ds.query('SELECT 1')
      if (dev) globalThis.__typeorm_ping = now
      else _lastPingAt = now
      return ds
    } catch {
      await ds.destroy().catch(() => {})
      // Only clear the caches if they still point at the pool we just killed —
      // a concurrent request may have already swapped in a fresh DataSource.
      if (dev) {
        if (globalThis.__typeorm_ds === ds) globalThis.__typeorm_ds = undefined
      } else if (_ds === ds) {
        _ds = undefined
      }
      ds = (dev ? globalThis.__typeorm_ds : _ds) ?? createDataSource()
      if (dev) globalThis.__typeorm_ds = ds
      else _ds = ds
      if (ds.isInitialized) return ds
    }
  }

  // Dedupe concurrent initialize() calls behind a single shared promise.
  let init = dev ? globalThis.__typeorm_init : _initPromise
  if (!init) {
    init = ds
      .initialize()
      .then((initialized) => {
        // A fresh initialize just proved the connection alive — start the
        // ping-trust window now instead of pinging again on the next request.
        if (dev) globalThis.__typeorm_ping = Date.now()
        else _lastPingAt = Date.now()
        watchPool(initialized)
        return initialized
      })
      .catch((err) => {
        // Initialization failed — clear caches so the next call retries cleanly.
        if (dev) globalThis.__typeorm_ds = undefined
        else _ds = undefined
        throw err
      })
      .finally(() => {
        if (dev) globalThis.__typeorm_init = undefined
        else _initPromise = undefined
      })
    if (dev) globalThis.__typeorm_init = init
    else _initPromise = init
  }
  return init
}
