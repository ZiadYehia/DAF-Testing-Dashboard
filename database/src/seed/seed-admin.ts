/**
 * One-time seed: creates the first admin user.
 * Idempotent — safe to re-run (skips if user already exists).
 *
 * Required env vars (in .env.local):
 *   SEED_ADMIN_PASSWORD  — the initial password for the admin account
 *
 * Optional:
 *   SEED_ADMIN_EMAIL  (default: admin@allendevaux.com)
 *   SEED_ADMIN_NAME   (default: Admin)
 *
 * Run with: npm run db:seed-admin
 */
import 'reflect-metadata'
import * as dotenv from 'dotenv'
import * as path from 'path'
import { hash } from '@node-rs/bcrypt'
import { AppDataSource } from '../data-source'
import { User } from '../entities/User'

dotenv.config({ path: path.resolve(__dirname, '../../../.env.local') })

async function main(): Promise<void> {
  const email = process.env.SEED_ADMIN_EMAIL ?? 'admin@allendevaux.com'
  const name = process.env.SEED_ADMIN_NAME ?? 'Admin'
  const password = process.env.SEED_ADMIN_PASSWORD

  if (!password) {
    console.error('Error: SEED_ADMIN_PASSWORD is not set in .env.local')
    console.error('Add it and re-run: npm run db:seed-admin')
    process.exit(1)
  }

  await AppDataSource.initialize()

  const repo = AppDataSource.getRepository(User)
  const existing = await repo.findOne({ where: { email } })

  if (existing) {
    console.log(`Admin already exists: ${email} (id=${existing.id}) — nothing to do.`)
    await AppDataSource.destroy()
    return
  }

  const passwordHash = await hash(password, 12)
  const user = await repo.save({ email, passwordHash, name, role: 'admin' })
  console.log(`Admin created: ${user.email} (id=${user.id})`)
  console.log('You can now log in with this account once the /login page is built (Step 5).')

  await AppDataSource.destroy()
}

main().catch((err) => {
  console.error('Seed failed:', err)
  process.exit(1)
})
