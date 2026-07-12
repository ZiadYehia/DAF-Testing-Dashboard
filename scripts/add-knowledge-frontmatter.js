#!/usr/bin/env node
/**
 * One-off migration: stamp explicit front-matter onto existing knowledge files
 * so the team can tune `type` and `priority` by hand. The context assembler
 * (src/lib/context.ts) already infers these for files WITHOUT front-matter, so
 * running this is optional — it just makes the inferred values explicit and editable.
 *
 * Usage:
 *   node scripts/add-knowledge-frontmatter.js <appSlug>           # dry run (prints proposed changes)
 *   node scripts/add-knowledge-frontmatter.js <appSlug> --write   # apply
 *
 * Non-destructive: files that already have a `type:` in their front-matter are
 * skipped. Bodies are preserved verbatim. Written as UTF-8 without a BOM.
 *
 * Keep the inference here in sync with src/lib/context.ts (inferType/defaultPriority).
 */
const fs = require('fs')
const path = require('path')
const matter = require('gray-matter')

const appSlug = process.argv[2]
const WRITE = process.argv.includes('--write')

if (!appSlug || appSlug.startsWith('--')) {
  console.error('Usage: node scripts/add-knowledge-frontmatter.js <appSlug> [--write]')
  process.exit(1)
}

const DATA_ROOT = process.env.DATA_ROOT ?? path.join(process.cwd(), 'data')
const today = new Date().toISOString().slice(0, 10)

function inferType(filename, tier) {
  const f = filename.toLowerCase()
  if (/rule|format|writing|generation-process|standard/.test(f)) return 'rules'
  if (/glossary|terminolog/.test(f)) return 'glossary'
  if (/\bui\b|screen|layout|mockup/.test(f)) return 'ui'
  if (tier === 'feature') return 'story-synth'
  return 'domain'
}

function defaultPriority(type, tier) {
  if (type === 'rules') return 10
  if (type === 'story-synth') return 9
  if (type === 'glossary') return 4
  if (type === 'ui') return 6
  if (tier === 'feature') return 8
  if (tier === 'module') return 7
  return 6
}

/** Collect [filePath, tier] for every knowledge markdown file across the 3 tiers. */
function collect() {
  const out = []
  const appDir = path.join(DATA_ROOT, appSlug)

  const appKnowledge = path.join(appDir, 'knowledge')
  if (fs.existsSync(appKnowledge)) {
    for (const f of fs.readdirSync(appKnowledge).filter((x) => x.endsWith('.md'))) {
      out.push([path.join(appKnowledge, f), 'app'])
    }
  }

  const modulesDir = path.join(appDir, 'modules')
  if (fs.existsSync(modulesDir)) {
    for (const mod of fs.readdirSync(modulesDir)) {
      const kdir = path.join(modulesDir, mod, 'knowledge')
      if (fs.existsSync(kdir)) {
        for (const f of fs.readdirSync(kdir).filter((x) => x.endsWith('.md'))) {
          out.push([path.join(kdir, f), 'module'])
        }
      }
    }
  }

  const featuresDir = path.join(appDir, 'features')
  if (fs.existsSync(featuresDir)) {
    for (const feat of fs.readdirSync(featuresDir)) {
      const kfile = path.join(featuresDir, feat, 'knowledge.md')
      if (fs.existsSync(kfile)) out.push([kfile, 'feature'])
    }
  }

  return out
}

let changed = 0
let skipped = 0

for (const [file, tier] of collect()) {
  const raw = fs.readFileSync(file, 'utf-8')
  const parsed = matter(raw)
  const rel = path.relative(process.cwd(), file)

  if (parsed.data && typeof parsed.data.type === 'string') {
    skipped++
    continue
  }

  const type = inferType(path.basename(file), tier)
  const priority = defaultPriority(type, tier)
  const data = {
    type,
    scope: tier,
    priority,
    lastReviewed: today,
    ...parsed.data, // preserve any existing keys (e.g. a hand-set priority)
  }
  const next = matter.stringify(parsed.content, data)

  console.log(`${WRITE ? 'WRITE' : 'PLAN '}  ${rel}  →  type=${type} scope=${tier} priority=${priority}`)
  if (WRITE) fs.writeFileSync(file, next, 'utf-8') // utf-8 → no BOM
  changed++
}

console.log(`\n${WRITE ? 'Wrote' : 'Would write'} front-matter to ${changed} file(s); skipped ${skipped} already-tagged.`)
if (!WRITE && changed > 0) console.log('Re-run with --write to apply.')
