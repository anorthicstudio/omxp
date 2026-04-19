// ─────────────────────────────────────────────────────────────────────────────
// OMXP Core Protocol Types
// Open Mind Exchange Protocol v0.1
// ─────────────────────────────────────────────────────────────────────────────

/** Protocol version identifier */
export const OMXP_VERSION = '0.1' as const;

/** Default local vault server port */
export const OMXP_PORT = 4747 as const;

// ─── Memory Types ───────────────────────────────────────────────────────────

export const MEMORY_TYPES = [
  'fact',
  'preference',
  'context',
  'skill',
  'goal',
  'relationship',
] as const;

export type MemoryType = (typeof MEMORY_TYPES)[number];

// ─── Visibility ─────────────────────────────────────────────────────────────

export const VISIBILITY_TYPES = ['shared', 'private'] as const;
export type Visibility = (typeof VISIBILITY_TYPES)[number];

// ─── Scopes ─────────────────────────────────────────────────────────────────

export const SCOPES = [
  'read:facts',
  'read:preferences',
  'read:context',
  'read:skills',
  'read:goals',
  'read:all',
  'write:facts',
  'write:preferences',
  'write:context',
  'write:skills',
  'write:all',
  'delete:own',
  'admin',
] as const;

export type OmxpScope = (typeof SCOPES)[number];

/** @deprecated Use OmxpScope instead */
export type Scope = OmxpScope;

// ─── Scope Mapping ──────────────────────────────────────────────────────────

/** Maps a memory type to its corresponding scope suffix */
const MEMORY_TYPE_TO_SCOPE_SUFFIX: Record<MemoryType, string> = {
  fact: 'facts',
  preference: 'preferences',
  context: 'context',
  skill: 'skills',
  goal: 'goals',
  relationship: 'facts', // relationships use read:all / admin
};

/** Returns the scope required to read a specific memory type */
export function readScopeFor(type: MemoryType): OmxpScope {
  if (type === 'relationship') return 'read:all';
  return `read:${MEMORY_TYPE_TO_SCOPE_SUFFIX[type]}` as OmxpScope;
}

/** Returns the scope required to write a specific memory type */
export function writeScopeFor(type: MemoryType): OmxpScope {
  if (type === 'relationship' || type === 'goal') return 'write:all';
  return `write:${MEMORY_TYPE_TO_SCOPE_SUFFIX[type]}` as OmxpScope;
}

/** Checks whether a set of granted scopes authorises a specific scope */
export function hasScope(granted: OmxpScope[], required: OmxpScope): boolean {
  if (granted.includes('admin')) return true;
  if (granted.includes(required)) return true;
  if (required.startsWith('read:') && granted.includes('read:all')) return true;
  if (required.startsWith('write:') && granted.includes('write:all')) return true;
  return false;
}

/** Validates that all scopes in a list are recognised protocol scopes */
export function validateScopes(scopes: string[]): scopes is OmxpScope[] {
  return scopes.every((s) => (SCOPES as readonly string[]).includes(s));
}

// ─── Memory Unit ────────────────────────────────────────────────────────────

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

// ─── Permission Grant ───────────────────────────────────────────────────────

export interface PermissionGrant {
  app_id: string;
  app_name: string;
  app_url: string;
  granted_at: string;
  scopes: OmxpScope[];
  token: string;                 // "omxp_tok_" + nanoid(24)
  refresh_token?: string;        // "omxp_ref_" + nanoid(24)
  token_expires_at: string;
  revoked: boolean;
}

// ─── Vault ──────────────────────────────────────────────────────────────────

export interface VaultMetadata {
  display_name?: string;
  schema_version: string;        // "0.1.0"
}

export interface Vault {
  omxp_version: string;          // "0.1"
  vault_id: string;              // "v_" + nanoid(12)
  public_key: string;            // "ed25519:base64pubkey"
  created_at: string;
  updated_at: string;
  memory_units: MemoryUnit[];
  permissions: Record<string, PermissionGrant>;
  metadata: VaultMetadata;
}

// ─── API Input Types ────────────────────────────────────────────────────────

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

export interface AuthorizeParams {
  app_id: string;
  app_name: string;
  scopes: string;
  redirect_uri: string;
  state?: string;
}

export interface TokenExchangeInput {
  code: string;
  redirect_uri?: string;
}

export interface TokenRefreshInput {
  refresh_token: string;
}

// ─── API Response Types ─────────────────────────────────────────────────────

export interface TokenResponse {
  access_token: string;
  refresh_token?: string;
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

export interface VaultExport {
  omxp_version: string;
  vault_id: string;
  public_key: string;
  created_at: string;
  updated_at: string;
  memory_units: MemoryUnit[];
  permissions: Record<string, Omit<PermissionGrant, 'token' | 'refresh_token'>>;
  metadata: VaultMetadata;
  exported_at: string;
}

export interface OmxpError {
  error: string;
  message: string;
  status: number;
}

// ─── Auth Context (set by middleware, consumed by route handlers) ────────────

export interface AuthContext {
  vault_id: string;
  app_id: string;
  app_name: string;
  scopes: OmxpScope[];
}
