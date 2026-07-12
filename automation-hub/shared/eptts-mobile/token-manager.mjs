/**
 * Ported from the old suite's core/TokenManager.ts, keeping the exact 3-tier
 * logic (cached access token w/ 30s buffer → refresh grant → password
 * grant), but using global fetch + URLSearchParams instead of Node's
 * https/querystring, since this runs under plain node (no build step).
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { KEYCLOAK, CREDENTIALS } from './config.mjs'

const TOKEN_URL = `${KEYCLOAK.baseUrl}/realms/${KEYCLOAK.realm}/protocol/openid-connect/token`

// This file lives at automation-hub/shared/eptts-mobile/token-manager.mjs, so
// two levels up is automation-hub/ — resolved from the module file (not cwd)
// so the store path is stable regardless of which project this runs under.
const AUTH_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '.auth')
const STORE_FILE = path.join(AUTH_DIR, 'eptts-mobile.tokens.json')

// ─── File I/O ─────────────────────────────────────────────────────────────────

function load() {
  try {
    if (fs.existsSync(STORE_FILE)) {
      return JSON.parse(fs.readFileSync(STORE_FILE, 'utf8'))
    }
  } catch {
    // corrupt file — ignore
  }
  return {}
}

function save(store) {
  fs.mkdirSync(AUTH_DIR, { recursive: true })
  fs.writeFileSync(STORE_FILE, JSON.stringify(store, null, 2), 'utf8')
}

function toEntry(data) {
  const now = Date.now()
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: now + data.expires_in * 1000,
    refreshExpiresAt: now + data.refresh_expires_in * 1000,
  }
}

// ─── HTTP helper ──────────────────────────────────────────────────────────────

async function postForm(url, params) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(params),
  })
  let json
  try {
    json = await res.json()
  } catch {
    throw new Error('Failed to parse Keycloak response')
  }
  if (!res.ok) {
    throw new Error(`Keycloak ${res.status}: ${json.error_description ?? JSON.stringify(json)}`)
  }
  return json
}

// ─── TokenManager ─────────────────────────────────────────────────────────────

export const TokenManager = {
  /**
   * Returns a valid access_token for the given role.
   * - If a cached, non-expired token exists → returns it immediately.
   * - If only the refresh_token is still valid → exchanges it for a new token.
   * - Otherwise → fetches a fresh token using username/password (ROPC via admin-cli).
   */
  async getAccessToken(role) {
    const store = load()
    const entry = store[role]
    const now = Date.now()

    // 1. Access token still valid (with 30 s buffer)
    if (entry && entry.expiresAt - 30_000 > now) {
      return entry.accessToken
    }

    // 2. Refresh token still valid → exchange it
    if (entry && entry.refreshExpiresAt - 30_000 > now) {
      try {
        const data = await postForm(TOKEN_URL, {
          grant_type: 'refresh_token',
          client_id: KEYCLOAK.clientId,
          refresh_token: entry.refreshToken,
        })
        const updated = toEntry(data)
        store[role] = updated
        save(store)
        console.log(`[TokenManager] Refreshed token for role=${role}`)
        return updated.accessToken
      } catch (err) {
        console.warn(`[TokenManager] Refresh failed for role=${role}: ${err}. Falling back to password grant.`)
      }
    }

    // 3. Full password grant
    const creds = CREDENTIALS[role]
    if (!creds.email) throw new Error(`No credentials configured for role=${role}`)

    const data = await postForm(TOKEN_URL, {
      grant_type: 'password',
      client_id: KEYCLOAK.clientId,
      username: creds.email,
      password: creds.password,
    })
    const fresh = toEntry(data)
    store[role] = fresh
    save(store)
    console.log(`[TokenManager] Fetched new token for role=${role} (expires in ${data.expires_in}s)`)
    return fresh.accessToken
  },

  /**
   * Returns the full token entry (with refresh_token) for a role,
   * fetching/refreshing as needed.
   */
  async getEntry(role) {
    await this.getAccessToken(role) // ensures store is populated/refreshed
    const store = load()
    return store[role]
  },

  /** Clears cached tokens for a specific role (or all roles). */
  clear(role) {
    const store = load()
    if (role) {
      delete store[role]
    } else {
      Object.keys(store).forEach((k) => delete store[k])
    }
    save(store)
  },
}
