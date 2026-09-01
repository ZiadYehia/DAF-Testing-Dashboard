#!/usr/bin/env node
/**
 * Rewrite every EPTTS bug into the shape bugs/_template.md actually specifies.
 *
 * Usage:
 *   node scripts/eptts-fix-bug-format.js            # dry run, prints a per-file plan
 *   node scripts/eptts-fix-bug-format.js --write
 *
 * WHAT WAS WRONG
 *
 * The reports had drifted into essays. Against the template, four differences:
 *
 *  1. No blank line either side of the `---` rules. The template has
 *     "...text\n\n---\n\n**Steps to Reproduce:**\n\n1. ...".
 *  2. Expected/Actual as numbered lists of two or three items. The template asks for ONE
 *     clear sentence each.
 *  3. Environment as a bullet list. The template uses plain lines, one fact per line.
 *  4. A `Notes:` section, which the template does not have. It had become the place where
 *     long-form discussion accumulated — exactly what a developer opening the bug has to
 *     wade past to reach the defect.
 *
 * The summary is trimmed to its first paragraph, and the `Covers test cases` line is kept
 * directly beneath it: which cases produced the bug is the one piece of context worth having
 * up front. Everything else that used to sit in the body is already in the attachments.
 *
 * The trimmed prose is not silently discarded — it is written to
 * <slug>-attachments/analysis.md, so nothing that took real work to establish is lost, and
 * anyone who wants the reasoning can still find it beside the bug.
 */
const fs = require('fs')
const path = require('path')

const REPO = path.join(__dirname, '..')
const APPS = ['eptts-api', 'eptts-web']
const WRITE = process.argv.includes('--write')

const SECTIONS = ['Steps to Reproduce', 'Expected Result', 'Actual Result', 'Environment',
  'Priority', 'Bug Type']

/** Split a body into the labelled sections the template defines. */
function parseBody(body) {
  const out = { summary: '', sections: {} }
  // Every section heading, wherever it sits and however it is fenced.
  const marks = []
  for (const label of [...SECTIONS, 'Notes']) {
    const re = new RegExp(`^\\s*(?:#{1,6}\\s*|\\*\\*)?${label}:(?:\\*\\*)?`, 'm')
    const m = re.exec(body)
    if (m) marks.push({ label, start: m.index, end: m.index + m[0].length })
  }
  marks.sort((a, b) => a.start - b.start)
  if (!marks.length) return { summary: body.trim(), sections: {} }

  out.summary = body.slice(0, marks[0].start)
  marks.forEach((mk, i) => {
    const stop = i + 1 < marks.length ? marks[i + 1].start : body.length
    out.sections[mk.label] = body.slice(mk.end, stop)
      // Drop the trailing --- rule that belonged to the next section.
      .replace(/\n\s*---\s*$/, '').trim()
  })
  return out
}

/** The first paragraph, plus the Covers line if one exists anywhere. */
function trimSummary(summary, wholeBody) {
  const covers = (wholeBody.match(/\*\*Covers test cases?:\*\*[^\n]*/) ?? [])[0] ?? null

  const paragraphs = summary
    .replace(/\*\*Covers test cases?:\*\*[^\n]*/g, '')
    .replace(/^\s*---\s*$/gm, '')
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)
    // A blockquote correction or a markdown table is context, not the headline.
    .filter((p) => !p.startsWith('>') && !p.startsWith('|'))

  const kept = paragraphs.length ? paragraphs[0] : ''
  const dropped = paragraphs.slice(1)
  return { kept, dropped, covers }
}

/**
 * Collapse a numbered list into one sentence.
 *
 * Split on the NUMBER MARKERS rather than matching item bodies with a lookahead. The earlier
 * version used /^\s*\d+\.\s+([\s\S]*?)(?=\n\s*\d+\.\s|\s*$)/gm, where the `m` flag makes `$`
 * match a line end — so every wrapped item was truncated at its first newline and the
 * sentences came out cut in half ("refused — synchronously with `400`, or asynchronously
 * with"). Losing half a sentence is worse than leaving the list alone.
 */
function oneSentence(text) {
  const parts = text.split(/^\s*\d+\.\s+/m).map((s) => s.replace(/\s+/g, ' ').trim()).filter(Boolean)
  if (parts.length <= 1) return (parts[0] ?? text).replace(/\s+/g, ' ').trim()
  return parts
    .map((s, i) => (i === parts.length - 1 ? s : s.replace(/[.;]\s*$/, '')))
    // Lower-case the first word of every clause after the first, so a semicolon join reads as
    // one sentence rather than three stitched together. Left alone when the word is an
    // identifier or a quoted value, where capitalisation is meaningful.
    .map((s, i) => (i === 0 || /^[`"'A-Z]{2}|^`/.test(s) ? s : s.charAt(0).toLowerCase() + s.slice(1)))
    .join('; ')
}

/**
 * Environment as plain lines — and ONLY the environment.
 *
 * Anything after the first blank line is discussion that happened to sit between Environment
 * and Priority; the earlier version kept it, which put a stray half-paragraph and an entire
 * argument about validator consistency inside the Environment block.
 */
function plainLines(text) {
  const firstBlock = text.split(/\n\s*\n/)[0] ?? ''
  return {
    kept: firstBlock.split('\n')
      .map((l) => l.replace(/^\s*[-*]\s+/, '').trim())
      .filter(Boolean)
      .filter((l) => !/^\*\*Evidence/i.test(l))
      .join('\n'),
    // Returned so the caller can park it in analysis.md instead of dropping it.
    rest: text.split(/\n\s*\n/).slice(1).join('\n\n').trim(),
  }
}

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
      const raw = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n')

      const fmEnd = raw.indexOf('\n---', 4)
      const frontmatter = raw.slice(4, fmEnd)
      const body = raw.slice(fmEnd + 4)

      const parsed = parseBody(body)
      const { kept, dropped, covers } = trimSummary(parsed.summary, body)

      const parts = [kept]
      if (covers) parts.push('', covers.trim())
      const strays = []
      for (const label of SECTIONS) {
        const content = parsed.sections[label]
        if (content === undefined) continue
        let shaped
        if (label === 'Expected Result' || label === 'Actual Result') {
          shaped = oneSentence(content)
        } else if (label === 'Environment') {
          const env = plainLines(content)
          shaped = env.kept
          if (env.rest) strays.push(env.rest)
        } else {
          shaped = content.trim()
        }
        parts.push('', '---', '', `**${label}:**`, label === 'Steps to Reproduce' ? '' : null, shaped)
      }
      const next = `---\n${frontmatter}\n---\n${parts.filter((p) => p !== null).join('\n')}\n`

      if (next === raw) continue
      touched++
      const droppedNotes = parsed.sections.Notes ? 1 : 0
      console.log(`${WRITE ? 'reshaped' : 'would reshape'} ${feature}/${entry.slice(0, 44)}`)
      console.log(`     ${raw.length} -> ${next.length} chars` +
        `${droppedNotes ? ', Notes removed' : ''}` +
        `${dropped.length ? `, ${dropped.length} paragraph(s) moved to analysis.md` : ''}`)

      if (!WRITE) continue
      fs.writeFileSync(file, next)

      // Park the trimmed reasoning beside the bug rather than deleting it.
      const extra = [...dropped, ...strays, parsed.sections.Notes].filter(Boolean)
      if (extra.length) {
        const adir = path.join(dir, `${entry.replace(/\.md$/, '')}-attachments`)
        fs.mkdirSync(adir, { recursive: true })
        fs.writeFileSync(path.join(adir, 'analysis.md'),
          `# Background for ${entry.replace(/\.md$/, '')}\n\n` +
          'Moved out of the bug body to keep the report to the point. Not an attachment the ' +
          'platform indexes (only images and video are), just a file kept beside it.\n\n' +
          `${extra.join('\n\n')}\n`)
      }
    }
  }
}

console.log(`\n${touched} bug(s) ${WRITE ? 'reshaped' : 'to reshape'}`)
if (!WRITE) console.log('(dry run — nothing written)')
