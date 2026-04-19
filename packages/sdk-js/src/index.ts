// ─────────────────────────────────────────────────────────────────────────────
// @omxp/sdk — Public API
// Zero-dependency OMXP client for Node.js, browsers, and edge runtimes.
// ─────────────────────────────────────────────────────────────────────────────

// ── Client ──────────────────────────────────────────────────────────────────
export { OmxpClient, OmxpApiError } from './client.js';
export type { OmxpClientOptions, RequestOptions, RequestFn } from './client.js';

// ── Memory ──────────────────────────────────────────────────────────────────
export { MemoryClient } from './memory.js';
export type { MemoryListParams } from './memory.js';

// ── Auth ────────────────────────────────────────────────────────────────────
export { AuthClient } from './auth.js';
export type { AuthorizeAppParams, ExchangeCodeParams, AuthorizeResponse } from './auth.js';

// ── Format ──────────────────────────────────────────────────────────────────
export { FormatHelper, formatForPrompt, groupByType } from './format.js';
export type { FormatOptions } from './format.js';

// ─── Protocol Types (self-contained — no @omxp/core dependency) ─────────────

/** OMXP protocol version */
export const OMXP_VERSION = '0.1' as const;

/** Default vault server port */
export const OMXP_PORT = 4747 as const;

// Memory types
export const MEMORY_TYPES = ['fact', 'preference', 'context', 'skill', 'goal', 'relationship'] as const;
export type MemoryType = (typeof MEMORY_TYPES)[number];

// Visibility
export const VISIBILITY_TYPES = ['shared', 'private'] as const;
export type Visibility = (typeof VISIBILITY_TYPES)[number];

// Scopes — exactly as specified in the protocol
export const SCOPES = [
  'read:facts', 'read:preferences', 'read:context',
  'read:skills', 'read:goals', 'read:all',
  'write:facts', 'write:preferences', 'write:context',
  'write:skills', 'write:all',
  'delete:own', 'admin',
] as const;
export type OmxpScope = (typeof SCOPES)[number];

// ── Data Objects ────────────────────────────────────────────────────────────

export interface MemoryUnit {
  id: string;                    // "mu_" + nanoid(10)
  type: MemoryType;
  value: string;                 // Natural language string
  source_app: string;            // App that created this
  confidence: number;            // 0.0 to 1.0
  created_at: string;            // ISO 8601
  updated_at: string;            // ISO 8601
  expires_at: string | null;     // ISO 8601 or null
  tags: string[];                // Freeform tags
  visibility: 'shared' | 'private';
}

export interface PermissionGrant {
  app_id: string;
  app_name: string;
  app_url: string;
  granted_at: string;
  scopes: OmxpScope[];
  token: string;                 // "omxp_tok_" + nanoid(24)
  token_expires_at: string;
  revoked: boolean;
}

// ── API Input Types ─────────────────────────────────────────────────────────

export interface CreateMemoryInput {
  type: MemoryType;
  value: string;
  confidence?: number;
  tags?: string[];
  visibility?: Visibility;
  expires_at?: string | null;
}

export interface UpdateMemoryInput {
  value?: string;
  confidence?: number;
  tags?: string[];
  visibility?: Visibility;
  expires_at?: string | null;
}

// ── API Response Types ──────────────────────────────────────────────────────

export interface TokenResponse {
  access_token: string;
  token_type: 'Bearer';
  expires_in: number;
  scopes: OmxpScope[];
}

export interface MemoryListResponse {
  memory_units: MemoryUnit[];
  total: number;
  page: number;
  limit: number;
}

export interface VaultInfo {
  omxp_version: string;          // "0.1"
  vault_id: string;              // "v_" + nanoid(12)
  public_key: string;            // "ed25519:base64pubkey"
  created_at: string;
  updated_at: string;
  metadata: {
    display_name?: string;
    schema_version: string;
  };
  stats: {
    memory_units: number;
    active_permissions: number;
    total_permissions: number;
  };
}

export interface VaultExport {
  omxp_version: string;
  vault_id: string;
  public_key: string;
  created_at: string;
  updated_at: string;
  memory_units: MemoryUnit[];
  permissions: Record<string, Omit<PermissionGrant, 'token'>>;
  metadata: {
    display_name?: string;
    schema_version: string;
  };
  exported_at: string;
}

export interface OmxpError {
  error: string;
  message: string;
  status: number;
}
