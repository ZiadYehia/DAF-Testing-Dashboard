/**
 * Deterministic formatter for bug report bodies.
 *
 * The AI is told to emit the body template with a `---` divider between every
 * section, but models routinely drop the blank lines around it. That is not
 * cosmetic: in CommonMark (what react-markdown renders, and what Jira's
 * markdown import sees) a bare `---` directly under a line of text is a *setext
 * heading underline*, so the line above renders as a huge H2 instead of the
 * divider rendering as a horizontal rule.
 *
 * Rather than hope the model complies, `normalizeBugBody` re-lays-out the body
 * after generation: canonical section headings, exactly one `---` divider
 * between sections, exactly one blank line on each side of it. Pure string work
 * with no imports, so it is safe in client components too.
 */

/** Canonical body sections. Order matches SECTION_RE's alternation (longest first). */
const SECTION_LABELS = [
  'Steps to Reproduce',
  'Expected Result',
  'Actual Result',
  'Precondition',
  'Environment',
  'Bug Type',
  'Priority',
  'Severity',
] as const

/**
 * A line opening a canonical section, in any of the shapes models drift into:
 * `**Environment:**`, `**Environment:** Chrome 120`, `## Environment`,
 * `Environment:`. Group 1 = label, group 2 = same-line content (if any).
 * Alternation is longest-first so `Bug Type` can't be truncated by a prefix.
 */
const SECTION_RE =
  /^ {0,3}(?:#{1,6} +)?\*{0,2}(Steps to Reproduce|Expected Result|Actual Result|Precondition|Environment|Bug Type|Priority|Severity)[ \t]*:?[ \t]*\*{0,2}[ \t]*(.*)$/i

/** `---`, `***`, `___`, `- - -`, `-----` … all mean "divider" here. */
const HR_RE = /^ {0,3}([-*_])[ \t]*(?:\1[ \t]*){2,}$/

/** ``` / ~~~ fence toggle — everything inside a fence is passed through verbatim. */
const FENCE_RE = /^ {0,3}(?:```|~~~)/

/** A bare canonical heading we emitted, i.e. with no content on the same line. */
const BARE_HEADING_RE = /^\*\*[^*]+:\*\*$/

const isBlank = (line: string) => line.trim() === ''

/** Restore canonical casing for a label the model may have cased differently. */
function canonicalLabel(matched: string): string {
  return SECTION_LABELS.find((l) => l.toLowerCase() === matched.toLowerCase()) ?? matched
}

export function normalizeBugBody(raw: string): string {
  if (!raw?.trim()) return ''

  const lines = raw
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.replace(/[ \t]+$/, ''))

  const out: string[] = []
  let inFence = false

  const lastNonBlank = () => {
    for (let i = out.length - 1; i >= 0; i--) if (!isBlank(out[i])) return out[i]
    return null
  }
  /** Emit a divider with exactly one blank line before it, leaving one after. */
  const pushDivider = () => {
    while (out.length > 0 && isBlank(out[out.length - 1])) out.pop()
    // Nothing above it yet: a leading divider is not part of the template.
    if (out.length === 0) return
    // One is already there — keep it single, but restore the blank line under it
    // that popping the trailing blanks just removed.
    if (out[out.length - 1] === '---') {
      out.push('')
      return
    }
    out.push('', '---', '')
  }

  for (const line of lines) {
    if (FENCE_RE.test(line)) {
      inFence = !inFence
      out.push(line)
      continue
    }
    if (inFence) {
      out.push(line)
      continue
    }

    if (HR_RE.test(line)) {
      // A divider straight under a bare heading was meant as a setext underline
      // (`Environment` + `---`), not as a section break — the heading has already
      // been captured in canonical form, so drop it.
      if (BARE_HEADING_RE.test(lastNonBlank() ?? '')) continue
      pushDivider()
      continue
    }

    const section = line.match(SECTION_RE)
    if (section) {
      const label = canonicalLabel(section[1])
      const inline = section[2].trim()
      pushDivider()
      out.push(inline ? `**${label}:** ${inline}` : `**${label}:**`)
      // A heading whose content lives on the following lines needs a blank line,
      // or that list/paragraph renders glued to the heading.
      if (!inline) out.push('')
      continue
    }

    if (isBlank(line)) {
      // Collapse runs of blank lines to one; never open the body with one.
      if (out.length > 0 && !isBlank(out[out.length - 1])) out.push('')
      continue
    }

    out.push(line)
  }

  // A trailing divider or blank line is never part of the template.
  while (out.length > 0 && (isBlank(out[out.length - 1]) || out[out.length - 1] === '---')) out.pop()

  return out.join('\n')
}
