import { describe, it, expect } from 'vitest'
import { normalizeBugBody } from '@/lib/bug-body'

describe('normalizeBugBody', () => {
  it('adds the missing blank lines around every divider', () => {
    const raw = [
      'The orders table empties out.',
      '---',
      '**Steps to Reproduce:**',
      '1. Log in as Admin',
      '2. Open Orders',
      '---',
      '**Expected Result:**',
      'The table keeps at least one column.',
      '---',
      '**Actual Result:**',
      'The table renders empty.',
    ].join('\n')

    expect(normalizeBugBody(raw)).toBe(
      [
        'The orders table empties out.',
        '',
        '---',
        '',
        '**Steps to Reproduce:**',
        '',
        '1. Log in as Admin',
        '2. Open Orders',
        '',
        '---',
        '',
        '**Expected Result:**',
        '',
        'The table keeps at least one column.',
        '',
        '---',
        '',
        '**Actual Result:**',
        '',
        'The table renders empty.',
      ].join('\n')
    )
  })

  it('leaves an already well-formed body untouched', () => {
    const good = [
      'Summary paragraph.',
      '',
      '---',
      '',
      '**Steps to Reproduce:**',
      '',
      '1. Do the thing',
      '',
      '---',
      '',
      '**Priority:** P2 – High',
    ].join('\n')

    expect(normalizeBugBody(good)).toBe(good)
  })

  it('inserts a divider before a section the model forgot to separate', () => {
    const raw = ['**Actual Result:** It fails.', '**Priority:** P3 – Medium'].join('\n')

    expect(normalizeBugBody(raw)).toBe(
      ['**Actual Result:** It fails.', '', '---', '', '**Priority:** P3 – Medium'].join('\n')
    )
  })

  it('normalizes divider variants, collapses duplicates, and drops edge dividers', () => {
    const raw = ['---', '', 'Summary.', '', '***', '', '- - -', '', '**Priority:** P4 – Low', '', '_____'].join('\n')

    expect(normalizeBugBody(raw)).toBe(
      ['Summary.', '', '---', '', '**Priority:** P4 – Low'].join('\n')
    )
  })

  it('canonicalizes heading shapes the models drift into', () => {
    const raw = ['## Steps to Reproduce', '1. Open the page', '', 'expected result: it loads'].join('\n')

    expect(normalizeBugBody(raw)).toBe(
      [
        '**Steps to Reproduce:**',
        '',
        '1. Open the page',
        '',
        '---',
        '',
        '**Expected Result:** it loads',
      ].join('\n')
    )
  })

  it('treats a divider under a bare heading as a setext underline, not a section break', () => {
    const raw = ['Environment', '---', 'Chrome 120 | Windows 11'].join('\n')

    expect(normalizeBugBody(raw)).toBe(['**Environment:**', '', 'Chrome 120 | Windows 11'].join('\n'))
  })

  it('passes fenced code through verbatim', () => {
    const raw = [
      '**Actual Result:**',
      'The API returns:',
      '```json',
      '{',
      '  "a": 1,',
      '',
      '',
      '  "b": 2',
      '}',
      '```',
    ].join('\n')

    expect(normalizeBugBody(raw)).toBe(
      [
        '**Actual Result:**',
        '',
        'The API returns:',
        '```json',
        '{',
        '  "a": 1,',
        '',
        '',
        '  "b": 2',
        '}',
        '```',
      ].join('\n')
    )
  })

  it('collapses runaway blank lines and trims trailing whitespace', () => {
    const raw = ['', '', 'Summary.   ', '', '', '', '**Priority:** P1 – Critical', '', ''].join('\n')

    expect(normalizeBugBody(raw)).toBe(
      ['Summary.', '', '---', '', '**Priority:** P1 – Critical'].join('\n')
    )
  })

  it('normalizes CRLF input', () => {
    expect(normalizeBugBody('Summary.\r\n---\r\n**Priority:** P3 – Medium')).toBe(
      ['Summary.', '', '---', '', '**Priority:** P3 – Medium'].join('\n')
    )
  })

  it('returns an empty string for empty or whitespace-only input', () => {
    expect(normalizeBugBody('')).toBe('')
    expect(normalizeBugBody('   \n\n  ')).toBe('')
  })
})
