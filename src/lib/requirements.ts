import fs from 'fs'
import path from 'path'
import { getDataSource } from './db'
import { IStoryLink, StoryLinkEntity } from './entities'
import { getDataRoot } from './paths'

export type StoryLinks = Record<string, string>

function storyLinksFile(appSlug: string): string {
  return path.join(getDataRoot(), appSlug, 'requirements', 'story-links.json')
}

export async function getStoryLinks(appSlug: string): Promise<StoryLinks> {
  try {
    const ds = await getDataSource()
    const repo = ds.getRepository<IStoryLink>(StoryLinkEntity)
    const rows = await repo.findBy({ appSlug })
    if (rows.length > 0) {
      const links: StoryLinks = {}
      for (const row of rows) {
        if (row.storyKey) links[row.frId] = row.storyKey
      }
      return links
    }
  } catch { /* fall through to FS */ }

  const file = storyLinksFile(appSlug)
  if (!fs.existsSync(file)) return {}
  try { return JSON.parse(fs.readFileSync(file, 'utf-8')) } catch { return {} }
}

export async function setStoryLink(appSlug: string, frId: string, storyKey: string): Promise<StoryLinks> {
  const existing = await getStoryLinks(appSlug).catch(() => ({} as StoryLinks))
  if (storyKey) {
    existing[frId] = storyKey
  } else {
    delete existing[frId]
  }

  // FS write-first (non-fatal)
  try {
    const file = storyLinksFile(appSlug)
    fs.mkdirSync(path.dirname(file), { recursive: true })
    fs.writeFileSync(file, JSON.stringify(existing, null, 2), 'utf-8')
  } catch { /* non-fatal */ }

  // DB write-through (non-fatal)
  try {
    const ds = await getDataSource()
    const repo = ds.getRepository<IStoryLink>(StoryLinkEntity)
    if (storyKey) {
      await repo.upsert({ appSlug, frId, storyKey }, ['appSlug', 'frId'])
    } else {
      await repo.delete({ appSlug, frId })
    }
  } catch { /* non-fatal */ }

  return existing
}
