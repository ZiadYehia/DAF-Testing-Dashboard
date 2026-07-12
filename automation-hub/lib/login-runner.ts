/**
 * Automation Hub — declarative login interpreter.
 *
 * Executes the ordered `LoginStep[]` from an app's data/<slug>/automation.json
 * against an unauthenticated Playwright page. This is the sole place that
 * translates the JSON schema (lib/login-config.ts) into real Playwright calls —
 * lib/apps.ts just wires it up per registered app.
 */
import type { Locator, Page } from '@playwright/test'
import type { AppAutomationConfig, LoginStep, StepLocator } from './login-config'
import { interpolate } from './login-config'

const DEFAULT_CLICK_TIMEOUT_MS = 10_000
const RETRY_CLICK_TIMEOUT_MS = 15_000

interface RunCtx {
  base: string
  env: (name: string) => string | undefined
}

function resolveText(template: string, ctx: RunCtx): string {
  return interpolate(template, ctx)
}

function resolveLocator(page: Page, loc: StepLocator, ctx: RunCtx): Locator {
  const value = resolveText(loc.value, ctx)
  const name = loc.name !== undefined ? resolveText(loc.name, ctx) : undefined
  switch (loc.kind) {
    case 'css':
      return page.locator(value)
    case 'id':
      return page.locator(`#${value}`)
    case 'text':
      return page.getByText(value)
    case 'role':
      return page.getByRole(value as Parameters<Page['getByRole']>[0], name !== undefined ? { name } : undefined)
    case 'testid':
      return page.getByTestId(value)
    case 'label':
      return page.getByLabel(value)
    default:
      throw new Error(`Unknown locator kind "${(loc as StepLocator).kind}" in login config`)
  }
}

/** Run one app's declarative login flow against an unauthenticated page. */
export async function runLogin(page: Page, config: AppAutomationConfig, baseUrl: string): Promise<void> {
  const ctx: RunCtx = { base: baseUrl, env: (name) => process.env[name] }

  for (const step of config.login) {
    await runStep(page, step, ctx)
  }
}

async function runStep(page: Page, step: LoginStep, ctx: RunCtx): Promise<void> {
  switch (step.action) {
    case 'goto': {
      await page.goto(resolveText(step.url, ctx))
      return
    }

    case 'click': {
      const locator = resolveLocator(page, step.locator, ctx)
      if (step.onlyIfVisible && !(await locator.isVisible())) return

      if (step.retryOnFlake && step.expectAnyVisible && step.expectAnyVisible.length > 0) {
        const [first, ...rest] = step.expectAnyVisible.map((l) => resolveLocator(page, l, ctx))
        const expectVisible = rest.reduce((acc, l) => acc.or(l), first).first()

        await locator.click()
        try {
          await expectVisible.waitFor({ state: 'visible', timeout: step.timeoutMs ?? DEFAULT_CLICK_TIMEOUT_MS })
        } catch {
          await locator.click()
          await expectVisible.waitFor({ state: 'visible', timeout: RETRY_CLICK_TIMEOUT_MS })
        }
        return
      }

      await locator.click()
      return
    }

    case 'fill': {
      const locator = resolveLocator(page, step.locator, ctx)
      if (step.onlyIfVisible && !(await locator.isVisible())) return
      await locator.fill(resolveText(step.value, ctx))
      return
    }

    case 'waitForUrl': {
      const startsWith = resolveText(step.startsWith, ctx)
      await page.waitForURL((u) => u.href.startsWith(startsWith), { timeout: step.timeoutMs ?? 15_000 })
      return
    }

    case 'waitForVisible': {
      const locator = resolveLocator(page, step.locator, ctx)
      await locator.waitFor({ state: 'visible', timeout: step.timeoutMs ?? 15_000 })
      return
    }

    default: {
      const unknown = step as { action?: unknown }
      throw new Error(`Unknown login step action ${JSON.stringify(unknown.action)}`)
    }
  }
}
