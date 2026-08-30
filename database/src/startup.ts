import 'reflect-metadata'
import * as path from 'path'
import * as dotenv from 'dotenv'

// No-op when env vars are already injected (e.g. docker compose); useful for local dev
dotenv.config({ path: path.resolve(__dirname, '../../.env.local') })

import { hash } from '@node-rs/bcrypt'
import { DataSource, DataSourceOptions } from 'typeorm'
import { AppDataSource } from './data-source'
import { User } from './entities/User'

// A fresh MSSQL volume contains only the system databases; the target
// database must be created before AppDataSource can connect to it.
async function ensureDatabaseExists(): Promise<void> {
  const dbName = process.env.DB_NAME ?? 'TestingDashboard'
  const master = new DataSource({
    ...AppDataSource.options,
    database: 'master',
    entities: [],
    migrations: [],
  } as DataSourceOptions)
  await master.initialize()
  try {
    const escaped = dbName.replace(/]/g, ']]')
    const rows: { id: number | null }[] = await master.query('SELECT DB_ID(@0) AS id', [dbName])
    if (rows[0]?.id == null) {
      await master.query(`CREATE DATABASE [${escaped}]`)
      console.log(`[startup] Created database ${dbName}.`)
    }
  } finally {
    await master.destroy()
  }
}

// Generous window: MSSQL's first boot on a fresh volume can take minutes.
async function connectWithRetry(maxAttempts = 120, delayMs = 5000): Promise<void> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      console.log(`[startup] Connecting to database (attempt ${attempt}/${maxAttempts})...`)
      await ensureDatabaseExists()
      await AppDataSource.initialize()
      console.log('[startup] Connected.')
      return
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.warn(`[startup] Connection failed: ${msg}`)
      if (attempt === maxAttempts) throw err
      console.log(`[startup] Retrying in ${delayMs / 1000}s...`)
      await new Promise(resolve => setTimeout(resolve, delayMs))
    }
  }
}

async function main(): Promise<void> {
  await connectWithRetry();

  const ran = await AppDataSource.runMigrations()
  if (ran.length === 0) {
    console.log('[startup] No pending migrations.')
  } else {
    console.log(`[startup] Ran ${ran.length} migration(s): ${ran.map(m => m.name).join(', ')}`)
  }

  const seedPassword = process.env.SEED_ADMIN_PASSWORD
  if (seedPassword) {
    const repo = AppDataSource.getRepository(User)
    const count = await repo.count()
    if (count === 0) {
      const email = process.env.SEED_ADMIN_EMAIL ?? 'admin@allendevaux.com'
      const name  = process.env.SEED_ADMIN_NAME  ?? 'Admin'
      const passwordHash = await hash(seedPassword, 12)
      const user = await repo.save({ email, passwordHash, name, role: 'admin' })
      console.log(`[startup] Seeded admin: ${user.email} (id=${user.id})`)
    } else {
      console.log('[startup] Skipping admin seed — users already exist.')
    }
  }

  await AppDataSource.destroy()
  console.log('[startup] Done.')
}

main().catch(err => {
  console.error('[startup] FAILED:', err)
  process.exit(1)
})
