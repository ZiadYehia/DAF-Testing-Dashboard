import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { runExport } from '@/lib/export/run-export'

/** Admin-only: render the database back into the data/ file tree (one-way
 *  DB -> files export). Optionally scoped to a single app via `{ appSlug }`. */
export async function POST(req: NextRequest) {
  try {
    await requireAdmin()
    const body = (await req.json().catch(() => null)) as { appSlug?: string } | null
    const summary = await runExport({ appSlug: body?.appSlug || undefined })
    return NextResponse.json({ ok: true, summary })
  } catch (e: unknown) {
    const err = e as { status?: number; message?: string }
    return NextResponse.json({ error: err.message ?? 'Error' }, { status: err.status ?? 500 })
  }
}
