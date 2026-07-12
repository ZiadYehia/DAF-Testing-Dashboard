/**
 * AI management config — DB-backed layers over the hardcoded model registry and
 * per-app feature gating. Persisted as `settings` rows (no schema change):
 *   - global  AI_MODEL_REGISTRY : { disabled: string[], custom: AIModelDef[] }
 *   - <app>   AI_FEATURES       : { [featureKey]: { enabled, defaultModel, allowedModels } }
 */
import { getSetting, setSetting } from './settings'
import type { AIModelDef } from './ai'

export type BuiltinProvider = 'google' | 'anthropic' | 'groq'
/** Built-in provider slug or a user-defined custom provider id. */
export type AIProvider = string

/** Env var that gates each built-in provider (also the key under which it's stored). */
export const PROVIDER_ENV_KEY: Record<BuiltinProvider, string> = {
  google: 'GEMINI_API_KEY',
  anthropic: 'ANTHROPIC_API_KEY',
  groq: 'GROQ_API_KEY',
}

// ─── Custom providers (user-added, OpenAI-compatible) ─────────────────────────

/**
 * A user-added provider. Any endpoint speaking the OpenAI chat-completions
 * protocol works: OpenAI, OpenRouter, Mistral, Together, xAI, DeepSeek,
 * Ollama (http://localhost:11434/v1), etc. Persisted as the global
 * `AI_PROVIDERS` settings row.
 */
export interface CustomProvider {
  /** Slug id, e.g. "openrouter". Also referenced by models as their provider. */
  id: string
  /** Display name, e.g. "OpenRouter". */
  label: string
  /** API base URL up to (and including) the version segment, e.g. "https://openrouter.ai/api/v1". */
  baseUrl: string
}

/** Settings key under which a custom provider's API key is stored. */
export function customProviderKeyName(providerId: string): string {
  return `AI_PROVIDER_KEY_${providerId.toUpperCase().replace(/[^A-Z0-9]+/g, '_')}`
}

/** Settings key that stores a provider's API key (built-in or custom). */
export function providerKeyName(providerId: string): string {
  return providerId in PROVIDER_ENV_KEY
    ? PROVIDER_ENV_KEY[providerId as BuiltinProvider]
    : customProviderKeyName(providerId)
}

export async function getCustomProviders(): Promise<CustomProvider[]> {
  const raw = await getSetting('global', 'AI_PROVIDERS').catch(() => null)
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (p): p is CustomProvider =>
        p && typeof p.id === 'string' && typeof p.label === 'string' && typeof p.baseUrl === 'string'
    )
  } catch {
    return []
  }
}

export async function saveCustomProviders(providers: CustomProvider[]): Promise<void> {
  await setSetting('global', 'AI_PROVIDERS', JSON.stringify(providers))
}

// ─── Model registry ──────────────────────────────────────────────────────────

export interface ModelRegistry {
  /** Built-in or custom model ids the admin turned off (independent of key presence). */
  disabled: string[]
  /** User-added models, merged with the hardcoded defaults. */
  custom: AIModelDef[]
}

const EMPTY_REGISTRY: ModelRegistry = { disabled: [], custom: [] }

export async function getModelRegistry(): Promise<ModelRegistry> {
  const raw = await getSetting('global', 'AI_MODEL_REGISTRY').catch(() => null)
  if (!raw) return EMPTY_REGISTRY
  try {
    const p = JSON.parse(raw)
    return {
      disabled: Array.isArray(p.disabled) ? p.disabled : [],
      custom: Array.isArray(p.custom) ? p.custom : [],
    }
  } catch {
    return EMPTY_REGISTRY
  }
}

export async function saveModelRegistry(reg: ModelRegistry): Promise<void> {
  await setSetting('global', 'AI_MODEL_REGISTRY', JSON.stringify(reg))
}

// ─── Per-app feature gating ────────────────────────────────────────────────────

/** AI features that can be toggled per app. */
export const AI_FEATURES = [
  { key: 'automationHub', label: 'Automation Hub', detail: 'MCP chat, generate-from-test-case, and AI spec edits' },
  { key: 'testCaseWriter', label: 'Test Case Writer', detail: 'AI test-case generation' },
  { key: 'bugGenerator', label: 'Bug Report Generator', detail: 'AI bug-report drafting' },
  { key: 'acceptanceCriteria', label: 'Acceptance Criteria', detail: 'AI extraction & coverage analysis' },
] as const

export type AiFeatureKey = typeof AI_FEATURES[number]['key']

export interface FeatureConfig {
  enabled: boolean
  /** Preferred model id for this feature (optional). */
  defaultModel: string | null
  /** If non-empty, restricts the model picker to these ids. */
  allowedModels: string[]
}

export type AiFeatureMap = Record<string, FeatureConfig>

function defaultFeatureConfig(): FeatureConfig {
  return { enabled: true, defaultModel: null, allowedModels: [] }
}

/** Per-app feature config, defaulting every known feature to enabled. */
export async function getAiFeatures(app: string): Promise<AiFeatureMap> {
  let stored: Record<string, Partial<FeatureConfig>> = {}
  const raw = await getSetting(app, 'AI_FEATURES').catch(() => null)
  if (raw) { try { stored = JSON.parse(raw) } catch { stored = {} } }

  const out: AiFeatureMap = {}
  for (const f of AI_FEATURES) {
    const s = stored[f.key] ?? {}
    out[f.key] = {
      enabled: s.enabled ?? true,
      defaultModel: s.defaultModel ?? null,
      allowedModels: Array.isArray(s.allowedModels) ? s.allowedModels : [],
    }
  }
  return out
}

export async function saveAiFeatures(app: string, map: AiFeatureMap): Promise<void> {
  await setSetting(app, 'AI_FEATURES', JSON.stringify(map))
}

/** Convenience guard for routes: is this AI feature enabled for the app? */
export async function isFeatureEnabled(app: string, key: AiFeatureKey): Promise<boolean> {
  const features = await getAiFeatures(app)
  return features[key]?.enabled ?? true
}

export const DEFAULT_FEATURE_CONFIG = defaultFeatureConfig
