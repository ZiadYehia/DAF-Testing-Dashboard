import { describe, it, expect } from 'vitest'
import {
  parseTsArtifacts,
  lintFluentTestTs,
  parseTsPageBlocks,
  parsePyArtifacts,
  lintFluentTest,
} from '../codegen'

// ─── Fixtures ───────────────────────────────────────────────────────────────

const CLEAN_TS_TEST = `import { test } from '@playwright/test'
import { stateFor } from '../../lib/apps'
import { uniqueSuffix } from '../../lib/framework/data'
import { ItemCreatePage } from '../../pages/myapp/item-create.page'

test.use({ storageState: stateFor('myapp') })

test('CRT_001: Sample Item created with required fields only', async ({ page }) => {
  const uniq = uniqueSuffix()
  const name = \`QA Sample Item \${uniq}\`
  await ItemCreatePage.open(page)
    .fillItemName(name)
    .create()
    .assertCreated(name)
})
`

const PAGE_APPEND_BLOCK = `=== FILE: pages/myapp/item-create.page.ts (append) ===
  fillItemName(name: string): this {
    return this.step(async () => {
      await fillField(this.page, 'Item Name', name)
    })
  }
`

const PAGE_NEW_BLOCK = `=== FILE: pages/myapp/item-details.page.ts (new) ===
import type { Page } from '@playwright/test'
import { FluentPage } from '../../lib/framework/chain'

export class ItemDetailsPage extends FluentPage {
  static open(page: Page): ItemDetailsPage {
    return new ItemDetailsPage(page)
  }

  assertCreated(name: string): this {
    return this.step(async () => {
      await expectText(this.page, name)
    })
  }
}
`

describe('parseTsArtifacts', () => {
  it('parses a response containing only a test block', () => {
    const text = `=== FILE: projects/sample/test.spec.ts ===\n${CLEAN_TS_TEST}`
    const result = parseTsArtifacts(text)
    expect(result.test.trim()).toBe(CLEAN_TS_TEST.trim())
    expect(result.pageAppends).toEqual([])
  })

  it('parses a test block plus one page-append block, tagging it "append"', () => {
    const text = `=== FILE: projects/sample/test.spec.ts ===\n${CLEAN_TS_TEST}\n${PAGE_APPEND_BLOCK}`
    const result = parseTsArtifacts(text)
    expect(result.pageAppends).toHaveLength(1)
    expect(result.pageAppends[0]).toMatchObject({
      path: 'pages/myapp/item-create.page.ts',
      mode: 'append',
    })
    expect(result.pageAppends[0].body).toContain('fillItemName')
  })

  it('parses a test block plus multiple page blocks (append + new)', () => {
    const text = `=== FILE: projects/sample/test.spec.ts ===\n${CLEAN_TS_TEST}\n${PAGE_APPEND_BLOCK}\n${PAGE_NEW_BLOCK}`
    const result = parseTsArtifacts(text)
    expect(result.pageAppends).toHaveLength(2)
    expect(result.pageAppends[0]).toMatchObject({
      path: 'pages/myapp/item-create.page.ts',
      mode: 'append',
    })
    expect(result.pageAppends[1]).toMatchObject({
      path: 'pages/myapp/item-details.page.ts',
      mode: 'new',
    })
    expect(result.pageAppends[1].body).toContain('export class ItemDetailsPage')
  })

  it('falls back to "new" for an unsuffixed page header whose body looks like a complete file', () => {
    const unsuffixed = `=== FILE: pages/myapp/item-details.page.ts ===\nimport type { Page } from '@playwright/test'\n\nexport class ItemDetailsPage {}\n`
    const text = `=== FILE: projects/sample/test.spec.ts ===\n${CLEAN_TS_TEST}\n${unsuffixed}`
    const result = parseTsArtifacts(text)
    expect(result.pageAppends[0]).toMatchObject({ mode: 'new' })
  })

  it('throws when no "=== FILE: ... ===" marker is present at all', () => {
    expect(() => parseTsArtifacts('just some plain text with no markers')).toThrow(
      /did not return any/i,
    )
  })

  it('throws when the first block is missing the @playwright/test import / test( call', () => {
    const text = `=== FILE: projects/sample/test.spec.ts ===\nconst x = 1\n`
    expect(() => parseTsArtifacts(text)).toThrow(/valid test file/i)
  })

  it('throws when an "(append)" page block contains an import or export class line', () => {
    const badAppend = `=== FILE: pages/myapp/item-create.page.ts (append) ===\nimport { foo } from 'bar'\n`
    const text = `=== FILE: projects/sample/test.spec.ts ===\n${CLEAN_TS_TEST}\n${badAppend}`
    expect(() => parseTsArtifacts(text)).toThrow(/must contain new methods only/i)
  })

  it('throws when a page block has no suffix and no "export class" (ambiguous)', () => {
    const ambiguous = `=== FILE: pages/myapp/item-create.page.ts ===\nsome ambiguous body with no class\n`
    const text = `=== FILE: projects/sample/test.spec.ts ===\n${CLEAN_TS_TEST}\n${ambiguous}`
    expect(() => parseTsArtifacts(text)).toThrow(/missing the "\(append\)"\/"\(new\)" header suffix/i)
  })
})

describe('lintFluentTestTs', () => {
  it('reports no violations for a clean single-page fluent chain', () => {
    expect(lintFluentTestTs(CLEAN_TS_TEST)).toEqual([])
  })

  it('flags a test that imports TWO page classes (one-page-per-test rule)', () => {
    const twoPageTest = `import { test } from '@playwright/test'
import { stateFor } from '../../lib/apps'
import { ItemCreatePage } from '../../pages/myapp/item-create.page'
import { ItemDetailsPage } from '../../pages/myapp/item-details.page'

test.use({ storageState: stateFor('myapp') })

test('CRT_002: two pages', async ({ page }) => {
  await ItemCreatePage.open(page).create()
})
`
    const violations = lintFluentTestTs(twoPageTest)
    expect(violations.some((v) => /exactly one page class, found 2/.test(v))).toBe(true)
  })

  it('flags raw selector usage (page.locator)', () => {
    const withRawSelector = CLEAN_TS_TEST.replace(
      '.fillItemName(name)',
      '.fillItemName(name)\n    // eslint-disable-next-line\n',
    ).concat('\nconst raw = page.locator(\'button\')\n')
    const violations = lintFluentTestTs(withRawSelector)
    expect(violations.some((v) => v.includes('page.locator('))).toBe(true)
  })

  it('flags inline expect( calls', () => {
    const withInlineExpect = `${CLEAN_TS_TEST}\nexpect(name).toBeTruthy()\n`
    const violations = lintFluentTestTs(withInlineExpect)
    expect(violations.some((v) => v.includes('expect('))).toBe(true)
  })

  it('flags a raw page. call (e.g. page.click)', () => {
    const withRawPageCall = `${CLEAN_TS_TEST}\nawait page.click('#submit')\n`
    const violations = lintFluentTestTs(withRawPageCall)
    expect(violations.some((v) => v.includes("page.click("))).toBe(true)
  })
})

describe('parseTsPageBlocks', () => {
  it('parses well-formed page blocks (append + new)', () => {
    const text = `${PAGE_APPEND_BLOCK}\n${PAGE_NEW_BLOCK}`
    const result = parseTsPageBlocks(text)
    expect(result).toHaveLength(2)
    expect(result[0]).toMatchObject({ path: 'pages/myapp/item-create.page.ts', mode: 'append' })
    expect(result[1]).toMatchObject({ path: 'pages/myapp/item-details.page.ts', mode: 'new' })
  })

  it('treats the "=== NONE ===" sentinel as an empty result (case/whitespace tolerant)', () => {
    expect(parseTsPageBlocks('=== NONE ===')).toEqual([])
    expect(parseTsPageBlocks('  ===   none   ===  ')).toEqual([])
    expect(parseTsPageBlocks('')).toEqual([])
  })

  it('handles malformed input leniently: no markers at all yields []', () => {
    expect(parseTsPageBlocks('some prose with no markers')).toEqual([])
  })

  it('handles an unsuffixed, non-class body leniently by defaulting to "append" rather than throwing', () => {
    const ambiguous = `=== FILE: pages/myapp/item-create.page.ts ===\nsome new method body, no header suffix, no class keyword here\n`
    const result = parseTsPageBlocks(ambiguous)
    // Unlike parseTsArtifacts (which throws on this exact shape), parseTsPageBlocks is
    // lenient by design and falls back to 'append' instead of erroring.
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({ path: 'pages/myapp/item-create.page.ts', mode: 'append' })
  })

  it('drops a block with an empty body rather than including it', () => {
    const withEmptyBody = `=== FILE: pages/myapp/item-create.page.ts (append) ===\n`
    expect(parseTsPageBlocks(withEmptyBody)).toEqual([])
  })
})

// ─── Python pair (smoke) ────────────────────────────────────────────────────

const CLEAN_PY_TEST = `import allure
import pytest

from autotest_framework.src.utils.data import unique_suffix


@allure.feature("Asset Manager")
@allure.story("Asset Create Manual")
class TestCRT172:

    @pytest.mark.regression
    @allure.title("CRT_172: Item created with required fields only")
    def test_item_minimal_create(self, item_create_page):
        uniq = unique_suffix()
        name = f"QA Item {uniq}"
        (item_create_page
            .fill_item_name(name)
            .create()
            .assert_created(name))
`

describe('parsePyArtifacts (smoke)', () => {
  it('parses a happy-path response with a test block and a page-append block', () => {
    const text = `=== FILE: tests/myapp/test_myapp.py ===\n${CLEAN_PY_TEST}\n=== FILE: pages/myapp/item_create_page.py (append) ===\n    def fill_item_name(self, name):\n        self.get_by_label("Item Name", exact=True).fill(name)\n        return self\n`
    const result = parsePyArtifacts(text)
    expect(result.test.trim()).toBe(CLEAN_PY_TEST.trim())
    expect(result.pageAppends).toHaveLength(1)
    expect(result.pageAppends[0].path).toBe('pages/myapp/item_create_page.py')
    expect(result.pageAppends[0].methods).toContain('fill_item_name')
  })
})

describe('lintFluentTest (smoke)', () => {
  it('reports no violations for a clean fluent test', () => {
    expect(lintFluentTest(CLEAN_PY_TEST)).toEqual([])
  })

  it('flags a test method taking a second fixture argument (one-page-per-test rule)', () => {
    const twoFixtureTest = CLEAN_PY_TEST.replace(
      'def test_item_minimal_create(self, item_create_page):',
      'def test_item_minimal_create(self, item_create_page, item_details_page):',
    )
    const violations = lintFluentTest(twoFixtureTest)
    expect(violations.some((v) => v.startsWith('def test_item_minimal_create'))).toBe(true)
  })
})
