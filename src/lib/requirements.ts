import { getDataSource } from './db'
import { IStoryLink, StoryLinkEntity } from './entities'

export type StoryLinks = Record<string, string>

/** Read all FR→story links for an app — DB-only (`story_links` table). */
export async function getStoryLinks(appSlug: string): Promise<StoryLinks> {
  const ds = await getDataSource()
  const repo = ds.getRepository<IStoryLink>(StoryLinkEntity)
  const rows = await repo.findBy({ appSlug })
  const links: StoryLinks = {}
  for (const row of rows) {
    if (row.storyKey) links[row.frId] = row.storyKey
  }
  return links
}

/**
 * Set (or clear, when `storyKey` is empty) a single FR→story link — DB-only.
 * A write failure now throws rather than being swallowed.
 */
export async function setStoryLink(appSlug: string, frId: string, storyKey: string): Promise<StoryLinks> {
  const existing = await getStoryLinks(appSlug)
  if (storyKey) {
    existing[frId] = storyKey
  } else {
    delete existing[frId]
  }

  const ds = await getDataSource()
  const repo = ds.getRepository<IStoryLink>(StoryLinkEntity)
  if (storyKey) {
    await repo.upsert({ appSlug, frId, storyKey }, ['appSlug', 'frId'])
  } else {
    await repo.delete({ appSlug, frId })
  }

  return existing
}
