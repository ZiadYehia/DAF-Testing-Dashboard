import fs from 'fs'
import path from 'path'
import { getDataRoot } from './paths'

/**
 * Aggregates the "Open Questions / Ambiguities" that knowledge synthesis records
 * across features and modules, so the team has one list of what's underspecified.
 */

export interface KnowledgeGap {
  /** Feature name, or "<module>/<file>" for module-tier docs. */
  source: string
  tier: 'feature' | 'module' | 'app'
  items: string[]
}

const GAP_HEADING = /open question|ambiguit|unknown|tbd|to be (confirmed|determined|decided)|needs? clarif/i

/** Pull bullet/line items from any "Open Questions / Ambiguities"-style section. */
export function extractOpenQuestions(markdown: string): string[] {
  const lines = markdown.split('\n')
  const items: string[] = []
  let inSection = false
  let prose: string[] = []

  const flushProse = () => {
    const joined = prose.join(' ').trim()
    if (joined) items.push(joined)
    prose = []
  }

  for (const line of lines) {
    const heading = line.match(/^#{1,6}\s+(.*)$/)
    if (heading) {
      if (inSection) flushProse()
      inSection = GAP_HEADING.test(heading[1])
      continue
    }
    if (!inSection) continue
    const t = line.trim()
    if (!t) continue
    const bullet = t.match(/^(?:[-*]|\d+\.)\s+(.*)$/)
    if (bullet) {
      flushProse()
      const text = bullet[1].replace(/\*\*/g, '').trim()
      if (text) items.push(text)
    } else {
      prose.push(t)
    }
  }
  if (inSection) flushProse()
  return items
}

function readGapsFromDir(dir: string, label: (file: string) => string, tier: KnowledgeGap['tier']): KnowledgeGap[] {
  if (!fs.existsSync(dir)) return []
  const out: KnowledgeGap[] = []
  for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.md'))) {
    const items = extractOpenQuestions(fs.readFileSync(path.join(dir, file), 'utf-8'))
    if (items.length > 0) out.push({ source: label(file), tier, items })
  }
  return out
}

/** Collect open questions across feature, module, and app knowledge for an app. */
export function collectKnowledgeGaps(appSlug: string): KnowledgeGap[] {
  const root = getDataRoot()
  const gaps: KnowledgeGap[] = []

  // Feature tier — each feature's knowledge.md
  const featuresDir = path.join(root, appSlug, 'features')
  if (fs.existsSync(featuresDir)) {
    for (const feat of fs.readdirSync(featuresDir)) {
      const f = path.join(featuresDir, feat, 'knowledge.md')
      if (fs.existsSync(f)) {
        const items = extractOpenQuestions(fs.readFileSync(f, 'utf-8'))
        if (items.length > 0) gaps.push({ source: feat, tier: 'feature', items })
      }
    }
  }

  // Module tier
  const modulesDir = path.join(root, appSlug, 'modules')
  if (fs.existsSync(modulesDir)) {
    for (const mod of fs.readdirSync(modulesDir)) {
      gaps.push(...readGapsFromDir(path.join(modulesDir, mod, 'knowledge'), (file) => `${mod}/${file}`, 'module'))
    }
  }

  // App tier
  gaps.push(...readGapsFromDir(path.join(root, appSlug, 'knowledge'), (file) => file, 'app'))

  return gaps
}
