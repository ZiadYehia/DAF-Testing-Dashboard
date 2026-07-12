// Server-only: create the data/<slug>/ folder structure when a new app is added
// from the UI. Knowledge documents are no longer seeded here — the app's
// structured intake (domain/testing/bugs/automation groups) compiles them once
// the user fills out the corresponding wizard/settings steps (see src/lib/intake.ts).

import fs from 'fs'
import path from 'path'
import { getDataRoot } from './paths'

const APP_SUBDIRS = ['features', 'bugs', 'knowledge', 'requirements', 'examples', 'attachments', 'modules']

/** Create data/<slug>/{features,bugs,knowledge,...,modules}/. */
export function scaffoldAppData(slug: string): void {
  const appRoot = path.join(getDataRoot(), slug)
  for (const sub of APP_SUBDIRS) {
    fs.mkdirSync(path.join(appRoot, sub), { recursive: true })
  }
}
