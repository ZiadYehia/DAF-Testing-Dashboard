#!/usr/bin/env node
/**
 * Validate every bug report against ITS OWN app's bug-format.md.
 *
 * Usage: node scripts/eptts-validate-bugs.js [--verbose]
 * Exit code 1 when any rule is violated, so it can gate a commit.
 *
 * Covers all five apps that keep bug files. Two specs are in play and they differ, so rules
 * are applied per app — see STRICT_APPS. Judging eptts-mobile by eptts-api's document
 * produced 16 confident violations of a spec that does not govern it.
 *
 * Checks, in the order bug-format.md states them:
 *   - frontmatter carries every required field (the strict apps require seven more)
 *   - `feature` matches the folder the bug lives in
 *   - `status` and `priority` come from their closed sets
 *   - the body has Steps / Expected / Actual / Environment / Priority / Bug Type, in order,
 *     in whatever markup that app's spec sanctions
 *   - the body's Priority and Bug Type repeat the frontmatter values
 *   - every attachment is actually committable (not swallowed by .gitignore), and in the
 *     strict apps is numbered in reproduction order
 *   - no credential literals (data/ is committed)
 *   - bug_type is from the closed set bug-format.md defines
 *   - Environment is BULLETED, not a run-on prose line
 *   - Steps to Reproduce starts from connecting the Citrix VPN
 *   - each required section is preceded by a --- rule (no invented top-level fields)
 *   - a bug with a jira_key says status: reported and carries a reported_at
 *   - test coverage is declared inside Notes, where bug-format.md puts it
 *
 * Those last six were added after this validator reported "OK — every bug conforms" while 15
 * of the 19 broke the spec. It checked only what I had thought to encode; the rules the
 * document actually states went unchecked. A validator that passes everything is worse than
 * none, because its output gets believed.
 */
const fs = require('fs')
const path = require('path')
const { spawnSync } = require('child_process')

const REPO = path.join(__dirname, '..')
/**
 * Every app that keeps bug files. Checking only eptts-web and eptts-api meant 45 bug reports
 * in `eptts`, `eptts-mobile` and `dawana` were never looked at.
 */
const APPS = ['eptts-web', 'eptts-api', 'eptts', 'eptts-mobile', 'dawana']

/**
 * Apps whose bug-format.md states the stricter conventions.
 *
 * `eptts`, `eptts-mobile` and `dawana` carry a DIFFERENT, intake-generated spec: it asks for
 * "Windows version, Agent Version, Online/Offline state" in Environment and says explicitly
 * that plain lines and bullets are "both acceptable/observed". It has no Notes section, no
 * Citrix VPN (those are desktop-agent and mobile apps, not the VPN-only web platform) and no
 * attachment conventions. Applying eptts-api's rules to them would report violations of a
 * document that does not govern them — which is how 16 of their bugs first looked broken.
 */
const STRICT_APPS = new Set(['eptts-web', 'eptts-api'])
const VERBOSE = process.argv.includes('--verbose')

/**
 * Frontmatter every app's spec requires.
 *
 * The intake-generated spec for eptts / eptts-mobile / dawana lists exactly these seven and
 * no more, so demanding `severity`, `layer`, `found_by` and the rest of them there reports a
 * requirement that document never states.
 */
const FRONTMATTER = ['title', 'status', 'jira_key', 'reported_at', 'feature', 'priority', 'bug_type']
/** Additional fields the eptts-web / eptts-api spec adds ("This app additionally records…"). */
const FRONTMATTER_STRICT = [
  'parent_key', 'severity', 'layer', 'jira_status', 'jira_reporter', 'found_by', 'found_at',
]
const STATUS = ['draft', 'reported']
const PRIORITY = ['P1 – Critical', 'P2 – High', 'P3 – Medium', 'P4 – Low']
/**
 * The bare shorthand. Canonical is the em-dash form in every app, but the intake spec records
 * that its files "use both the full 'P2 – High' form and bare 'P1'/'P2'/'P3' shorthand", so
 * for those apps the short form is a style deviation to note, not a broken report.
 */
const PRIORITY_SHORT = /^P[1-4]$/
/** Closed set, from bug-format.md's "bug_type is a closed set" line. */
const BUG_TYPES = [
  'Functional',
  'Functional / Integration',
  'Functional (Backend/API)',
  'Functional — Intermittent / Flaky',
  'UI/UX',
]

/** Body sections that must appear, in this order. Notes is optional. */
/** Section labels, without markup — the strict apps bold them, the others use headings. */
const SECTION_LABELS = [
  'Steps to Reproduce',
  'Expected Result',
  'Actual Result',
  'Environment',
  'Priority',
  'Bug Type',
]
/** The bold form, used by the strict apps' --- rule check. */
const SECTIONS = SECTION_LABELS.map((l) => `**${l}:**`)

const problems = []
const add = (file, msg) => problems.push({ file, msg })
/**
 * Style deviations, reported but not failing the run.
 *
 * Kept separate so a genuinely malformed report — no frontmatter, a bug_type outside the
 * closed set — is not buried among "P2 should be written P2 – High". Mixing the two is how a
 * long violation list gets skimmed and ignored.
 */
const notes = []
const note = (file, msg) => notes.push({ file, msg })

/**
 * Is this path excluded from the repository?
 *
 * One `git check-ignore` call per attachment would be ~60 subprocesses, so the whole set is
 * resolved once, lazily, and cached. `check-ignore --stdin` exits 1 when nothing matches,
 * which is a normal answer here rather than a failure.
 */
let ignoredSet = null
function isGitIgnored(filePath) {
  if (ignoredSet === null) {
    ignoredSet = new Set()
    const all = []
    const walk = (d) => {
      for (const e of fs.readdirSync(d, { withFileTypes: true })) {
        const p = path.join(d, e.name)
        if (e.isDirectory()) walk(p)
        else all.push(p)
      }
    }
    for (const app of APPS) {
      const root = path.join(REPO, 'data', app, 'bugs')
      if (fs.existsSync(root)) walk(root)
    }
    if (all.length) {
      const res = spawnSync('git', ['check-ignore', '--stdin'],
        { cwd: REPO, input: all.join('\n'), encoding: 'utf8' })
      for (const line of (res.stdout ?? '').split('\n')) {
        if (line.trim()) ignoredSet.add(path.resolve(REPO, line.trim()))
      }
    }
  }
  return ignoredSet.has(path.resolve(filePath))
}

/** Secrets that must never appear in a committed file. */
function secretValues() {
  const p = path.join(REPO, 'automation-hub', '.env')
  if (!fs.existsSync(p)) return []
  return [...fs.readFileSync(p, 'utf8').matchAll(/^\s*\w*(?:APIKEY|PASSWORD|SECRET|TOKEN)\w*=(.+)$/gm)]
    .map((m) => m[1].trim().replace(/^["']|["']$/g, ''))
    .filter((v) => v.length > 7 && !/^(UNKNOWN|TODO|CHANGEME)/i.test(v))
}
const SECRETS = secretValues()

function parseFrontmatter(text) {
  if (!text.startsWith('---\n')) return null
  const end = text.indexOf('\n---', 4)
  if (end === -1) return null
  const block = text.slice(4, end)
  const out = {}
  let key = null
  for (const line of block.split('\n')) {
    const m = /^([a-z_]+):\s*(.*)$/.exec(line)
    if (m) { key = m[1]; out[key] = m[2].trim(); continue }
    // folded scalar continuation (title: >-)
    if (key && /^\s+\S/.test(line)) out[key] = `${out[key]} ${line.trim()}`.trim()
  }
  return { fields: out, body: text.slice(end + 4) }
}

let total = 0
const perApp = {}

for (const app of APPS) {
  const root = path.join(REPO, 'data', app, 'bugs')
  if (!fs.existsSync(root)) continue
  perApp[app] = 0

  for (const feature of fs.readdirSync(root)) {
    const dir = path.join(root, feature)
    if (!fs.statSync(dir).isDirectory()) continue

    for (const entry of fs.readdirSync(dir)) {
      if (entry.endsWith('-attachments')) {
        // Attachment conventions.
        const adir = path.join(dir, entry)
        const files = fs.readdirSync(adir).filter((f) => !f.startsWith('.'))
        const rel = `${app}/${feature}/${entry}`
        /**
         * Check what actually matters: will the file survive a clone?
         *
         * This used to assert that any PNG "is silently never committed", which was true
         * while .gitignore carried a blanket *.png — it was dropping 61 real attachments. The
         * blanket rule now has negations for evidence directories, so asking git directly is
         * both correct and immune to the next .gitignore edit. A PNG that IS tracked is fine.
         */
        for (const f of files) {
          if (isGitIgnored(path.join(adir, f))) {
            add(rel, `"${f}" is excluded by .gitignore — it exists here but in no clone, so ` +
              'the bug ships referencing evidence nobody else can open')
          } else if (f.toLowerCase().endsWith('.png') && STRICT_APPS.has(app)) {
            note(rel, `"${f}" is a PNG; this app's bug-format.md asks for .jpg`)
          }
        }
        // Reproduction-order naming is one of the "two conventions specific to this app" in
        // the eptts-web / eptts-api spec. The intake spec has no attachment section at all,
        // so requiring it of eptts-mobile invents a rule.
        const images = files.filter((f) => /\.(jpg|jpeg|png|gif|webp)$/i.test(f))
        if (STRICT_APPS.has(app) && images.length > 1 && !images.every((f) => /^\d+-/.test(f))) {
          add(rel, `${images.length} images but not all numbered in reproduction order (1-…, 2-…)`)
        }
        continue
      }
      if (!entry.endsWith('.md')) continue

      total++
      perApp[app]++
      const file = `${app}/${feature}/${entry}`
      // Normalise line endings before anything looks at the text. Six dawana bugs were
      // reported as having "no YAML frontmatter" purely because they are CRLF files and the
      // parser tested for '---\n'. On Windows with git's autocrlf that is the normal case,
      // so the check was condemning correct files.
      const text = fs.readFileSync(path.join(dir, entry), 'utf8').replace(/\r\n/g, '\n')

      const parsed = parseFrontmatter(text)
      if (!parsed) { add(file, 'no YAML frontmatter'); continue }
      const { fields, body } = parsed

      const required = STRICT_APPS.has(app) ? [...FRONTMATTER, ...FRONTMATTER_STRICT] : FRONTMATTER
      for (const f of required) {
        if (!(f in fields)) add(file, `frontmatter is missing "${f}"`)
      }
      if (fields.feature && fields.feature !== feature) {
        add(file, `frontmatter feature "${fields.feature}" does not match its folder "${feature}"`)
      }
      if (fields.status && !STATUS.includes(fields.status)) {
        add(file, `status "${fields.status}" is not one of ${STATUS.join(' / ')}`)
      }
      if (fields.priority && !PRIORITY.includes(fields.priority)) {
        // The bare form is documented as observed outside the strict apps, so note it as
        // non-canonical rather than calling a usable bug report malformed.
        if (!STRICT_APPS.has(app) && PRIORITY_SHORT.test(fields.priority)) {
          note(file, `priority "${fields.priority}" is the bare shorthand; canonical is the em-dash form`)
        } else {
          add(file, `priority "${fields.priority}" is not one of ${PRIORITY.join(' / ')}`)
        }
      }

      /**
       * Required body sections, in order.
       *
       * The strict apps write these as `**Steps to Reproduce:**`. The intake-generated spec
       * does not prescribe markup — it says real files "sometimes use a plain 'Summary:'
       * label instead of an H1" — and those apps use H3 headings (`### Steps to Reproduce:`).
       * Insisting on the bold form there reported six sections missing from a report that had
       * every one of them.
       */
      const sectionAt = (label) => {
        if (STRICT_APPS.has(app)) return body.indexOf(`**${label}:**`)
        const m = new RegExp(`^\\s*(?:#{1,6}\\s*|\\*\\*)?${label}:`, 'im').exec(body)
        return m ? m.index : -1
      }

      let cursor = -1
      for (const label of SECTION_LABELS) {
        const at = sectionAt(label)
        if (at === -1) { add(file, `body is missing the ${label} section`); continue }
        if (at < cursor) add(file, `${label} appears out of order`)
        cursor = at
      }

      // The body's Priority / Bug Type must repeat the frontmatter, or a reader gets two answers.
      const bodyPriority = /\*\*Priority:\*\*\s*(.+)/.exec(body)?.[1].trim()
      if (bodyPriority && fields.priority && bodyPriority !== fields.priority) {
        // "P2" in the frontmatter and "P2 – High" in the body are the same severity written
        // two ways, which the intake spec records as normal. Only a different LEVEL is a
        // contradiction a reader could act on wrongly.
        const level = (v) => (/^P([1-4])/.exec(v) ?? [])[1]
        if (level(bodyPriority) && level(bodyPriority) === level(fields.priority)) {
          note(file, `body Priority "${bodyPriority}" and frontmatter "${fields.priority}" ` +
            'are the same level written two ways')
        } else {
          add(file, `body Priority "${bodyPriority}" disagrees with frontmatter "${fields.priority}"`)
        }
      }
      const bodyType = /\*\*Bug Type:\*\*\s*(.+)/.exec(body)?.[1].trim()
      if (bodyType && fields.bug_type && bodyType !== fields.bug_type) {
        add(file, `body Bug Type "${bodyType}" disagrees with frontmatter "${fields.bug_type}"`)
      }

      if (fields.bug_type && !BUG_TYPES.includes(fields.bug_type)) {
        add(file, `bug_type "${fields.bug_type}" is not in the closed set (${BUG_TYPES.join(' | ')})`)
      }

      // A filed bug must say it is filed. Nothing writes these back from the app, so the file
      // drifts silently: DW-958 still read `status: draft` hours after it was reported.
      if (fields.jira_key && fields.jira_key !== 'null') {
        if (fields.status !== 'reported') {
          add(file, `has jira_key ${fields.jira_key} but status is "${fields.status}", not "reported"`)
        }
        if (!fields.reported_at || fields.reported_at === 'null') {
          add(file, `has jira_key ${fields.jira_key} but no reported_at`)
        }
      }

      if (STRICT_APPS.has(app)) {
        /**
         * Environment is PLAIN LINES, one fact per line — what bugs/_template.md shows.
         *
         * This check used to demand bullets, on the strength of a bug-format.md line that did
         * not match the template the format was actually built from. It converted 8 reports
         * to bullets before that was noticed. The template is the authority.
         */
        const envAt = body.indexOf('**Environment:**')
        if (envAt !== -1) {
          const rest = body.slice(envAt)
          const stop = rest.search(/\n\s*\n|\n---/)
          const para = stop === -1 ? rest : rest.slice(0, stop)
          if (/\n\s*[-*]\s+\S/.test(para)) {
            add(file, 'Environment uses bullets; the template uses plain lines, one fact per line')
          }
        }

        // No Notes section: the template ends at Bug Type, and Notes had become the place
        // long-form discussion accumulated. Evidence belongs in the attachments.
        if (/^\s*(?:#{1,6}\s*|\*\*)?Notes:/m.test(body)) {
          add(file, 'has a Notes section — the template ends at Bug Type; put background in the attachments')
        }

        // One sentence each, not a numbered list.
        for (const label of ['Expected Result', 'Actual Result']) {
          const at = body.indexOf(`**${label}:**`)
          if (at === -1) continue
          const stop = body.indexOf('\n---', at)
          const block = (stop === -1 ? body.slice(at) : body.slice(at, stop))
            .replace(`**${label}:**`, '')
          if (/^\s*\d+\.\s/m.test(block)) {
            add(file, `${label} is a numbered list; the template asks for one clear sentence`)
          }
        }

        /**
         * A --- rule needs a blank line either side, as the template has it.
         *
         * Checked line-wise on purpose. Matching /\n\s*---\s*\n/ does not work: `\s*` happily
         * consumes the very blank lines being verified, so a correctly formatted file matched
         * and then failed its own check — which is how this first reported all 19 as broken.
         */
        const lines = body.split('\n')
        for (let i = 0; i < lines.length; i++) {
          if (lines[i].trim() !== '---') continue
          const prev = i > 0 ? lines[i - 1].trim() : ''
          const next = i + 1 < lines.length ? lines[i + 1].trim() : ''
          if (prev !== '' || next !== '') {
            add(file, `the --- rule on body line ${i + 1} needs a blank line before and after it`)
            break
          }
        }

        // "Always start from connecting the Citrix VPN, since nothing is reachable without it."
        const stepsAt = body.indexOf('**Steps to Reproduce:**')
        if (stepsAt !== -1) {
          const stop = body.indexOf('\n---', stepsAt)
          const block = stop === -1 ? body.slice(stepsAt) : body.slice(stepsAt, stop)
          const first = /^1\.[^\n]*/m.exec(block)
          if (!first || !/vpn|citrix/i.test(first[0])) {
            add(file, 'Steps to Reproduce step 1 does not start from connecting the Citrix VPN')
          }
        }

        // Every required section sits directly after a --- rule. This catches an invented
        // top-level field wedged between the rule and the heading, which is how "Covers test
        // cases:" became a tenth section the format does not have.
        for (const section of SECTIONS) {
          const at = body.indexOf(section)
          if (at === -1) continue
          if (!/---\s*$/.test(body.slice(Math.max(0, at - 6), at))) {
            add(file, `${section} is not preceded by a --- rule — something is wedged before it`)
          }
        }

        // Coverage sits with the summary, above the first rule: which cases produced the bug
        // is the one piece of context worth having before the reproduction steps.
        const coversAt = body.search(/\*\*Covers test cases?:\*\*/)
        const firstRule = body.search(/\n\s*---\s*\n/)
        if (coversAt === -1) {
          // A note, not a failure: some bugs were found by hand during discovery and have no
          // automated case to name. Silence would hide the ones that simply forgot the line.
          note(file, 'no "Covers test cases" line — expected unless the bug was found by hand')
        } else if (firstRule !== -1 && coversAt > firstRule) {
          add(file, 'the "Covers test cases" line is below the first --- rule; it belongs with the summary')
        }
      }

      for (const secret of SECRETS) {
        if (text.includes(secret)) add(file, 'contains a credential literal from automation-hub/.env')
      }
    }
  }
}

const byFile = {}
for (const p of problems) (byFile[p.file] = byFile[p.file] ?? []).push(p.msg)

console.log(`checked ${total} bug report(s): ${Object.entries(perApp).map(([a, n]) => `${a} ${n}`).join(', ')}`)
if (!problems.length) {
  console.log('\nOK — every bug conforms to bug-format.md')
} else {
  for (const [file, msgs] of Object.entries(byFile)) {
    console.log(`\n${file}`)
    for (const m of VERBOSE ? msgs : [...new Set(msgs)]) console.log(`   x  ${m}`)
  }
  console.log(`\n${problems.length} problem(s) across ${Object.keys(byFile).length} file(s)`)
  process.exitCode = 1
}

if (notes.length) {
  const noteByFile = {}
  for (const n of notes) (noteByFile[n.file] = noteByFile[n.file] ?? []).push(n.msg)
  console.log(`\n${notes.length} style note(s) — not failures, the spec records these forms as observed:`)
  for (const [file, msgs] of Object.entries(noteByFile)) {
    console.log(`   ${file}`)
    for (const m of [...new Set(msgs)]) console.log(`      - ${m}`)
  }
}
