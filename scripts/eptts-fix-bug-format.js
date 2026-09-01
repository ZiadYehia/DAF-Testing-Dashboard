#!/usr/bin/env node
/**
 * Bring every EPTTS bug report into line with bug-format.md.
 *
 * Usage:
 *   node scripts/eptts-fix-bug-format.js            # dry run, prints a per-file plan
 *   node scripts/eptts-fix-bug-format.js --write
 *
 * WHY THIS EXISTS
 *
 * The bug validator passed all 19 reports while 15 of them broke the spec, because it only
 * checked what I had thought to encode: required frontmatter, section presence and order.
 * It never checked the rules the spec actually spells out. Four classes of violation:
 *
 *  1. `Environment:` must be BULLETED (bug-format.md item 5). Most were a single "·"-joined
 *     prose line.
 *  2. `Steps to Reproduce:` must START from connecting the Citrix VPN — "since nothing is
 *     reachable without it". Seven jumped straight to an API call.
 *  3. `Covers test cases:` was invented as a top-level field. The spec has eight body
 *     sections and coverage belongs in `Notes:` ("which automated test covers it"). As a
 *     top-level field it also broke the "sections separated by --- rules" structure, since it
 *     sat between the rule and the `Steps` heading.
 *  4. A bug filed in Jira must carry its `jira_key` and `reported_at`, and its failing test
 *     cases must carry the `DW-###` key in the Attachment column. DW-958 was filed through
 *     the app, so the row knew; the file and the test cases still said `draft`.
 *
 * Transformations are mechanical and lossless — prose is re-flowed, never rewritten. The
 * Environment bullets are the existing fragments split on "·", so no wording is invented.
 */
const fs = require('fs')
const path = require('path')

const REPO = path.join(__dirname, '..')
const APPS = ['eptts-api', 'eptts-web']
const WRITE = process.argv.includes('--write')

/** Jira facts that live only in the app. Passed in rather than read from the DB so this
 *  script stays dependency-free; sync-bugs.ts reports them. */
const REPORTED = {
  'an-already-commissioned-sgtin-can-be-re-commissioned-and-re-commissioning-with-a': {
    jira_key: 'DW-958',
    reported_at: '2026-09-01T05:51:29.734Z',
    status: 'reported',
    jira_status: 'READY',
    jira_reporter: '712020:b6f2ccdf-1ea7-4b3c-85ca-0bf6ed8291ed',
  },
}

const VPN_STEP = 'Connect the Citrix VPN.'

/** Split "**Environment:** a · b · c" into bullets, preserving every fragment verbatim. */
function bulletEnvironment(body) {
  const at = body.indexOf('**Environment:**')
  if (at === -1) return { body, changed: false }

  // The Environment paragraph runs to the first blank line; an Evidence paragraph or the
  // next --- rule may follow and must be left alone.
  const rest = body.slice(at)
  const paraEnd = rest.search(/\n\s*\n|\n---/)
  const para = paraEnd === -1 ? rest : rest.slice(0, paraEnd)

  if (/\n\s*[-*]\s+\S/.test(para)) return { body, changed: false }   // already bulleted

  const inline = para.replace('**Environment:**', '').replace(/\s+/g, ' ').trim()
  if (!inline) return { body, changed: false }

  const parts = inline.split('·').map((s) => s.trim()).filter(Boolean)
  if (parts.length < 2) return { body, changed: false }

  const bullets = `**Environment:**\n${parts.map((p) => `- ${p}`).join('\n')}`
  return { body: body.slice(0, at) + bullets + rest.slice(para.length), changed: true }
}

/** Ensure step 1 connects the VPN, renumbering the existing steps if one is inserted. */
function vpnFirst(body) {
  const at = body.indexOf('**Steps to Reproduce:**')
  if (at === -1) return { body, changed: false }
  const end = body.indexOf('\n---', at)
  const block = end === -1 ? body.slice(at) : body.slice(at, end)

  const first = /^1\.[^\n]*/m.exec(block)
  if (first && /vpn|citrix/i.test(first[0])) return { body, changed: false }

  // Renumber from the bottom up so 1->2 cannot collide with an existing 2.
  const nums = [...block.matchAll(/^(\d+)\.\s/gm)].map((m) => Number(m[1]))
  if (!nums.length) return { body, changed: false }
  let next = block
  for (const n of nums.sort((a, b) => b - a)) {
    next = next.replace(new RegExp(`^${n}\\.\\s`, 'm'), `${n + 1}. `)
  }
  next = next.replace('**Steps to Reproduce:**', `**Steps to Reproduce:**\n1. ${VPN_STEP}`)
  return { body: body.slice(0, at) + next + (end === -1 ? '' : body.slice(end)), changed: true }
}

/** Move `Covers test cases:` (and any paragraph attached to it) into `Notes:`. */
function coversIntoNotes(body) {
  const at = body.search(/\*\*Covers test cases?:\*\*/)
  if (at === -1) return { body, changed: false }

  const after = body.slice(at)
  const stop = after.search(/\n\*\*Steps to Reproduce:\*\*|\n---/)
  const chunk = (stop === -1 ? after : after.slice(0, stop)).trim()

  let next = body.slice(0, at) + body.slice(at + (stop === -1 ? after.length : stop) + 1)
  // Collapse the blank space the removal leaves behind, and make sure the --- rule still
  // sits directly before Steps.
  next = next.replace(/\n{3,}/g, '\n\n').replace(/---\n+\*\*Steps to Reproduce:\*\*/, '---\n**Steps to Reproduce:**')

  const notesAt = next.indexOf('**Notes:**')
  if (notesAt === -1) {
    next = `${next.replace(/\s*$/, '')}\n---\n**Notes:**\n${chunk}\n`
  } else {
    const insertAt = notesAt + '**Notes:**'.length
    next = `${next.slice(0, insertAt)}\n${chunk}\n${next.slice(insertAt)}`
  }
  return { body: next, changed: true }
}

/** A filed bug's frontmatter must say so. */
function applyJira(frontmatter, slug) {
  const facts = REPORTED[slug]
  if (!facts) return { frontmatter, changed: false }
  let next = frontmatter
  let changed = false
  for (const [k, v] of Object.entries(facts)) {
    const re = new RegExp(`^${k}:.*$`, 'm')
    const line = `${k}: ${k === 'reported_at' ? `'${v}'` : v}`
    if (!re.test(next)) continue
    if (re.exec(next)[0] === line) continue
    next = next.replace(re, line)
    changed = true
  }
  return { frontmatter: next, changed }
}

// ─── apply ───────────────────────────────────────────────────────────────────

let touched = 0
for (const app of APPS) {
  const root = path.join(REPO, 'data', app, 'bugs')
  if (!fs.existsSync(root)) continue

  for (const feature of fs.readdirSync(root)) {
    const dir = path.join(root, feature)
    if (!fs.statSync(dir).isDirectory()) continue

    for (const entry of fs.readdirSync(dir)) {
      if (!entry.endsWith('.md') || entry === '_template.md') continue
      const file = path.join(dir, entry)
      const text = fs.readFileSync(file, 'utf8')

      const fmEnd = text.indexOf('\n---', 4)
      let frontmatter = text.slice(4, fmEnd)
      let body = text.slice(fmEnd + 4)
      const applied = []

      const jira = applyJira(frontmatter, entry.replace(/\.md$/, ''))
      frontmatter = jira.frontmatter
      if (jira.changed) applied.push('jira_key + reported_at from the app')

      const cov = coversIntoNotes(body)
      body = cov.body
      if (cov.changed) applied.push('Covers test cases -> Notes')

      const env = bulletEnvironment(body)
      body = env.body
      if (env.changed) applied.push('Environment bulleted')

      const vpn = vpnFirst(body)
      body = vpn.body
      if (vpn.changed) applied.push('VPN inserted as step 1')

      if (!applied.length) continue
      touched++
      console.log(`${WRITE ? 'fixed' : 'would fix'}  ${feature}/${entry.slice(0, 46)}`)
      for (const a of applied) console.log(`     - ${a}`)

      if (WRITE) fs.writeFileSync(file, `---\n${frontmatter}\n---${body}`)
    }
  }
}

console.log(`\n${touched} bug(s) ${WRITE ? 'rewritten' : 'to rewrite'}`)
if (!WRITE) console.log('(dry run — nothing written)')
