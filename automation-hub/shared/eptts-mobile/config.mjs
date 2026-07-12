/**
 * EPTTS mobile shared config — ported from the old suite's core/AppConfig.ts.
 * Credentials/URLs come from automation-hub/.env (harness.mjs loads it into
 * process.env before a spec runs) — never hardcoded here.
 */

// ─── Roles ───────────────────────────────────────────────────────────────────
export const ROLES = {
  INSPECTOR: 'inspector',
  DISTRIBUTOR: 'distributor',
  BRANCH: 'branch',
  PHARMACY: 'pharmacy',
  PATIENT: 'patient',
}

// ─── Timeouts (ms) ───────────────────────────────────────────────────────────
export const TIMEOUTS = {
  element: 15_000,
  page: 30_000,
  login: 60_000,
  pause: 3_000,
}

// ─── Shipment / Return statuses ───────────────────────────────────────────────
export const ShipmentStatus = {
  DRAFT: 'Draft',
  DISPATCHED: 'Dispatched',
  DELIVERED: 'Delivered',
  PARTIALLY_DELIVERED: 'Partially Delivered',
}

export const ReturnStatus = {
  PENDING: 'PENDING',
  CONFIRMED: 'CONFIRMED',
  CANCELLED: 'CANCELLED',
}

export const EpcisStatus = {
  ALL: 'All statuses',
  COMPLETED: 'Completed',
  FAILED: 'Failed',
}

export const EpcisEventType = {
  SHIPPING: 'SHIPPING',
  RECEIVING: 'RECEIVING',
  UNPACKING: 'UNPACKING',
  DISPENSING: 'DISPENSING',
  RETURN: 'RETURN', // observed in pharmacy EPCIS history
}

// ─── Credentials ─────────────────────────────────────────────────────────────
export const CREDENTIALS = {
  [ROLES.INSPECTOR]: {
    email: process.env.EPTTS_INSPECTOR_EMAIL ?? '',
    password: process.env.EPTTS_INSPECTOR_PASSWORD ?? '',
  },
  [ROLES.DISTRIBUTOR]: {
    email: process.env.EPTTS_DISTRIBUTOR_EMAIL ?? '',
    password: process.env.EPTTS_DISTRIBUTOR_PASSWORD ?? '',
  },
  [ROLES.BRANCH]: {
    email: process.env.EPTTS_BRANCH_EMAIL ?? '',
    password: process.env.EPTTS_BRANCH_PASSWORD ?? '',
  },
  [ROLES.PHARMACY]: {
    email: process.env.EPTTS_PHARMACY_EMAIL ?? '',
    password: process.env.EPTTS_PHARMACY_PASSWORD ?? '',
  },
  [ROLES.PATIENT]: { email: '', password: '' },
}

// ─── Keycloak config ─────────────────────────────────────────────────────────
export const KEYCLOAK = {
  baseUrl: process.env.EPTTS_KEYCLOAK_BASE_URL ?? '',
  realm: process.env.EPTTS_KEYCLOAK_REALM ?? '',
  clientId: process.env.EPTTS_KEYCLOAK_CLIENT_ID ?? '',
}
