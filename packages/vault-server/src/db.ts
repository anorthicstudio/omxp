// ─────────────────────────────────────────────────────────────────────────────
// OMXP Database Abstraction Layer
// Supports: sql.js (local, WASM-based SQLite) and Supabase (cloud)
//
// Schema aligned with the OMXP protocol specification.
// ─────────────────────────────────────────────────────────────────────────────

import type {
  MemoryType,
  Visibility,
} from '@omxp/core';

// ─── Row Types (database-level representations) ────────────────────────────

export interface VaultRow {
  id: string;
  public_key: string;
  display_name: string | null;
  schema_version: string;
  created_at: string;
  updated_at: string;
}

export interface MemoryUnitRow {
  id: string;
  vault_id: string;
  type: MemoryType;
  value: string;                 // Plaintext value
  value_encrypted: string | null; // AES-256-GCM encrypted value (iv:tag:ciphertext)
  source_app: string;
  confidence: number;
  created_at: string;
  updated_at: string;
  expires_at: string | null;
  tags: string;                  // JSON-encoded string[]
  visibility: Visibility;
}

export interface PermissionRow {
  id: string;
  vault_id: string;
  app_id: string;
  app_name: string;
  app_url: string;
  scopes: string;                // JSON-encoded OmxpScope[]
  access_token: string | null;
  refresh_token: string | null;
  auth_code: string | null;
  auth_code_expires_at: string | null;
  token_expires_at: string | null;
  granted_at: string;
  revoked: number;               // 0 or 1 (SQLite boolean)
}

export interface AuditLogRow {
  id: string;
  vault_id: string;
  app_id: string | null;
  action: string;                // 'read' | 'write' | 'delete' | 'grant' | 'revoke'
  memory_unit_id: string | null;
  timestamp: string;
}

export interface MemoryFilters {
  types?: MemoryType[];
  tags?: string[];
  source_app?: string;
  visibility?: Visibility;
  limit: number;
  offset: number;
}

// ─── Database Adapter Interface ─────────────────────────────────────────────

export interface DatabaseAdapter {
  // Lifecycle
  initialize(): Promise<void>;
  close(): Promise<void>;

  // Vault
  getVault(vaultId: string): Promise<VaultRow | null>;
  createVault(vault: VaultRow): Promise<void>;
  updateVault(vaultId: string, data: Partial<Pick<VaultRow, 'display_name' | 'updated_at'>>): Promise<void>;
  deleteVault(vaultId: string): Promise<void>;

  // Memory Units
  listMemoryUnits(vaultId: string, filters: MemoryFilters): Promise<{ units: MemoryUnitRow[]; total: number }>;
  getMemoryUnit(vaultId: string, id: string): Promise<MemoryUnitRow | null>;
  createMemoryUnit(unit: MemoryUnitRow): Promise<void>;
  updateMemoryUnit(vaultId: string, id: string, data: Partial<MemoryUnitRow>): Promise<void>;
  deleteMemoryUnit(vaultId: string, id: string): Promise<void>;

  // Permission Grants
  listPermissions(vaultId: string): Promise<PermissionRow[]>;
  getPermissionByToken(accessToken: string): Promise<PermissionRow | null>;
  getPermissionByApp(vaultId: string, appId: string): Promise<PermissionRow | null>;
  getPermissionByAuthCode(authCode: string): Promise<PermissionRow | null>;
  getPermissionByRefreshToken(refreshToken: string): Promise<PermissionRow | null>;
  createPermission(permission: PermissionRow): Promise<void>;
  updatePermission(vaultId: string, appId: string, data: Partial<PermissionRow>): Promise<void>;
  revokePermission(vaultId: string, appId: string): Promise<void>;
  revokeAllPermissions(vaultId: string): Promise<void>;

  // Audit Log
  logAction(entry: AuditLogRow): Promise<void>;
}

// ─── SQLite Schema ──────────────────────────────────────────────────────────

const SQLITE_SCHEMA_STATEMENTS = [
  // Vault table (singular, per protocol spec)
  `CREATE TABLE IF NOT EXISTS vault (
    id              TEXT PRIMARY KEY,
    public_key      TEXT NOT NULL,
    display_name    TEXT,
    schema_version  TEXT NOT NULL DEFAULT '0.1.0',
    created_at      TEXT NOT NULL,
    updated_at      TEXT NOT NULL
  )`,

  // Memory units with plaintext value + optional encrypted value
  `CREATE TABLE IF NOT EXISTS memory_units (
    id              TEXT PRIMARY KEY,
    vault_id        TEXT NOT NULL,
    type            TEXT NOT NULL CHECK(type IN (
      'fact','preference','context','skill','goal','relationship'
    )),
    value           TEXT NOT NULL,
    value_encrypted TEXT,
    source_app      TEXT NOT NULL,
    confidence      REAL NOT NULL DEFAULT 1.0,
    created_at      TEXT NOT NULL,
    updated_at      TEXT NOT NULL,
    expires_at      TEXT,
    tags            TEXT NOT NULL DEFAULT '[]',
    visibility      TEXT NOT NULL DEFAULT 'shared'
      CHECK(visibility IN ('shared','private')),
    FOREIGN KEY(vault_id) REFERENCES vault(id)
  )`,

  // Permission grants — includes auth code fields (no separate auth_codes table)
  `CREATE TABLE IF NOT EXISTS permission_grants (
    id                    TEXT PRIMARY KEY,
    vault_id              TEXT NOT NULL,
    app_id                TEXT NOT NULL,
    app_name              TEXT NOT NULL,
    app_url               TEXT NOT NULL,
    scopes                TEXT NOT NULL,
    access_token          TEXT UNIQUE,
    refresh_token         TEXT UNIQUE,
    auth_code             TEXT UNIQUE,
    auth_code_expires_at  TEXT,
    token_expires_at      TEXT,
    granted_at            TEXT NOT NULL,
    revoked               INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY(vault_id) REFERENCES vault(id)
  )`,

  // Audit log
  `CREATE TABLE IF NOT EXISTS audit_log (
    id              TEXT PRIMARY KEY,
    vault_id        TEXT NOT NULL,
    app_id          TEXT,
    action          TEXT NOT NULL,
    memory_unit_id  TEXT,
    timestamp       TEXT NOT NULL,
    FOREIGN KEY(vault_id) REFERENCES vault(id)
  )`,

  // Indexes
  `CREATE INDEX IF NOT EXISTS idx_memory_vault   ON memory_units(vault_id)`,
  `CREATE INDEX IF NOT EXISTS idx_memory_type    ON memory_units(type)`,
  `CREATE INDEX IF NOT EXISTS idx_memory_expires ON memory_units(expires_at)`,
  `CREATE INDEX IF NOT EXISTS idx_grants_token   ON permission_grants(access_token)`,
  `CREATE INDEX IF NOT EXISTS idx_grants_app     ON permission_grants(app_id)`,
];

// ─── SQLite Adapter (sql.js — WASM, no native build required) ──────────────

export class SqliteAdapter implements DatabaseAdapter {
  private db: import('sql.js').Database | null = null;
  private dbPath: string;
  private fs: typeof import('node:fs') | null = null;

  constructor(dbPath: string) {
    this.dbPath = dbPath;
  }

  async initialize(): Promise<void> {
    const initSqlJs = (await import('sql.js')).default;
    this.fs = await import('node:fs');

    const SQL = await initSqlJs();

    if (this.fs.existsSync(this.dbPath)) {
      const fileBuffer = this.fs.readFileSync(this.dbPath);
      this.db = new SQL.Database(fileBuffer);
    } else {
      this.db = new SQL.Database();
    }

    this.db.run('PRAGMA foreign_keys = ON');

    for (const stmt of SQLITE_SCHEMA_STATEMENTS) {
      this.db.run(stmt);
    }

    this.persist();
  }

  async close(): Promise<void> {
    if (this.db) {
      this.persist();
      this.db.close();
      this.db = null;
    }
  }

  private get conn(): import('sql.js').Database {
    if (!this.db) throw new Error('Database not initialized');
    return this.db;
  }

  private persist(): void {
    if (!this.db || !this.fs) return;
    const data = this.db.export();
    this.fs.writeFileSync(this.dbPath, Buffer.from(data));
  }

  private query<T>(sql: string, params: unknown[] = []): T[] {
    const stmt = this.conn.prepare(sql);
    stmt.bind(params as import('sql.js').BindParams);
    const results: T[] = [];
    while (stmt.step()) {
      results.push(stmt.getAsObject() as T);
    }
    stmt.free();
    return results;
  }

  private queryOne<T>(sql: string, params: unknown[] = []): T | null {
    const rows = this.query<T>(sql, params);
    return rows[0] ?? null;
  }

  private execute(sql: string, params: unknown[] = []): void {
    this.conn.run(sql, params as import('sql.js').BindParams);
    this.persist();
  }

  // ── Vault ──────────────────────────────────────────────────────────────

  async getVault(vaultId: string): Promise<VaultRow | null> {
    return this.queryOne<VaultRow>('SELECT * FROM vault WHERE id = ?', [vaultId]);
  }

  async createVault(vault: VaultRow): Promise<void> {
    this.execute(
      `INSERT INTO vault (id, public_key, display_name, schema_version, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`,
      [vault.id, vault.public_key, vault.display_name, vault.schema_version, vault.created_at, vault.updated_at],
    );
  }

  async updateVault(vaultId: string, data: Partial<Pick<VaultRow, 'display_name' | 'updated_at'>>): Promise<void> {
    const sets: string[] = [];
    const values: unknown[] = [];
    if (data.display_name !== undefined) { sets.push('display_name = ?'); values.push(data.display_name); }
    if (data.updated_at !== undefined) { sets.push('updated_at = ?'); values.push(data.updated_at); }
    if (sets.length === 0) return;
    values.push(vaultId);
    this.execute(`UPDATE vault SET ${sets.join(', ')} WHERE id = ?`, values);
  }

  async deleteVault(vaultId: string): Promise<void> {
    this.execute('DELETE FROM vault WHERE id = ?', [vaultId]);
  }

  // ── Memory Units ───────────────────────────────────────────────────────

  async listMemoryUnits(vaultId: string, filters: MemoryFilters): Promise<{ units: MemoryUnitRow[]; total: number }> {
    const conditions: string[] = ['vault_id = ?'];
    const params: unknown[] = [vaultId];

    if (filters.types && filters.types.length > 0) {
      conditions.push(`type IN (${filters.types.map(() => '?').join(',')})`);
      params.push(...filters.types);
    }
    if (filters.source_app) { conditions.push('source_app = ?'); params.push(filters.source_app); }
    if (filters.visibility) { conditions.push('visibility = ?'); params.push(filters.visibility); }

    const where = conditions.join(' AND ');

    const countRow = this.queryOne<{ count: number }>(`SELECT COUNT(*) as count FROM memory_units WHERE ${where}`, params);
    const total = countRow?.count ?? 0;

    const units = this.query<MemoryUnitRow>(
      `SELECT * FROM memory_units WHERE ${where} ORDER BY updated_at DESC LIMIT ? OFFSET ?`,
      [...params, filters.limit, filters.offset],
    );

    if (filters.tags && filters.tags.length > 0) {
      const filtered = units.filter((u) => {
        const unitTags: string[] = JSON.parse(u.tags);
        return filters.tags!.some((t) => unitTags.includes(t));
      });
      return { units: filtered, total: filtered.length };
    }

    return { units, total };
  }

  async getMemoryUnit(vaultId: string, id: string): Promise<MemoryUnitRow | null> {
    return this.queryOne<MemoryUnitRow>('SELECT * FROM memory_units WHERE id = ? AND vault_id = ?', [id, vaultId]);
  }

  async createMemoryUnit(unit: MemoryUnitRow): Promise<void> {
    this.execute(
      `INSERT INTO memory_units (id, vault_id, type, value, value_encrypted, source_app, confidence, created_at, updated_at, expires_at, tags, visibility) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [unit.id, unit.vault_id, unit.type, unit.value, unit.value_encrypted, unit.source_app, unit.confidence, unit.created_at, unit.updated_at, unit.expires_at, unit.tags, unit.visibility],
    );
  }

  async updateMemoryUnit(vaultId: string, id: string, data: Partial<MemoryUnitRow>): Promise<void> {
    const sets: string[] = [];
    const values: unknown[] = [];
    if (data.value !== undefined) { sets.push('value = ?'); values.push(data.value); }
    if (data.value_encrypted !== undefined) { sets.push('value_encrypted = ?'); values.push(data.value_encrypted); }
    if (data.confidence !== undefined) { sets.push('confidence = ?'); values.push(data.confidence); }
    if (data.tags !== undefined) { sets.push('tags = ?'); values.push(data.tags); }
    if (data.visibility !== undefined) { sets.push('visibility = ?'); values.push(data.visibility); }
    if (data.expires_at !== undefined) { sets.push('expires_at = ?'); values.push(data.expires_at); }
    if (data.updated_at !== undefined) { sets.push('updated_at = ?'); values.push(data.updated_at); }
    if (sets.length === 0) return;
    values.push(id, vaultId);
    this.execute(`UPDATE memory_units SET ${sets.join(', ')} WHERE id = ? AND vault_id = ?`, values);
  }

  async deleteMemoryUnit(vaultId: string, id: string): Promise<void> {
    this.execute('DELETE FROM memory_units WHERE id = ? AND vault_id = ?', [id, vaultId]);
  }

  // ── Permissions ────────────────────────────────────────────────────────

  async listPermissions(vaultId: string): Promise<PermissionRow[]> {
    return this.query<PermissionRow>('SELECT * FROM permission_grants WHERE vault_id = ?', [vaultId]);
  }

  async getPermissionByToken(accessToken: string): Promise<PermissionRow | null> {
    return this.queryOne<PermissionRow>('SELECT * FROM permission_grants WHERE access_token = ? AND revoked = 0', [accessToken]);
  }

  async getPermissionByApp(vaultId: string, appId: string): Promise<PermissionRow | null> {
    return this.queryOne<PermissionRow>('SELECT * FROM permission_grants WHERE vault_id = ? AND app_id = ? AND revoked = 0', [vaultId, appId]);
  }

  async getPermissionByAuthCode(authCode: string): Promise<PermissionRow | null> {
    return this.queryOne<PermissionRow>('SELECT * FROM permission_grants WHERE auth_code = ? AND revoked = 0', [authCode]);
  }

  async getPermissionByRefreshToken(refreshToken: string): Promise<PermissionRow | null> {
    return this.queryOne<PermissionRow>('SELECT * FROM permission_grants WHERE refresh_token = ? AND revoked = 0', [refreshToken]);
  }

  async createPermission(permission: PermissionRow): Promise<void> {
    this.execute(
      `INSERT INTO permission_grants (id, vault_id, app_id, app_name, app_url, scopes, access_token, refresh_token, auth_code, auth_code_expires_at, token_expires_at, granted_at, revoked) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [permission.id, permission.vault_id, permission.app_id, permission.app_name, permission.app_url, permission.scopes, permission.access_token, permission.refresh_token, permission.auth_code, permission.auth_code_expires_at, permission.token_expires_at, permission.granted_at, permission.revoked],
    );
  }

  async updatePermission(vaultId: string, appId: string, data: Partial<PermissionRow>): Promise<void> {
    const sets: string[] = [];
    const values: unknown[] = [];
    if (data.access_token !== undefined) { sets.push('access_token = ?'); values.push(data.access_token); }
    if (data.refresh_token !== undefined) { sets.push('refresh_token = ?'); values.push(data.refresh_token); }
    if (data.auth_code !== undefined) { sets.push('auth_code = ?'); values.push(data.auth_code); }
    if (data.auth_code_expires_at !== undefined) { sets.push('auth_code_expires_at = ?'); values.push(data.auth_code_expires_at); }
    if (data.token_expires_at !== undefined) { sets.push('token_expires_at = ?'); values.push(data.token_expires_at); }
    if (data.scopes !== undefined) { sets.push('scopes = ?'); values.push(data.scopes); }
    if (sets.length === 0) return;
    values.push(appId, vaultId);
    this.execute(`UPDATE permission_grants SET ${sets.join(', ')} WHERE app_id = ? AND vault_id = ? AND revoked = 0`, values);
  }

  async revokePermission(vaultId: string, appId: string): Promise<void> {
    this.execute('UPDATE permission_grants SET revoked = 1 WHERE app_id = ? AND vault_id = ?', [appId, vaultId]);
  }

  async revokeAllPermissions(vaultId: string): Promise<void> {
    this.execute('UPDATE permission_grants SET revoked = 1 WHERE vault_id = ?', [vaultId]);
  }

  // ── Audit Log ──────────────────────────────────────────────────────────

  async logAction(entry: AuditLogRow): Promise<void> {
    this.execute(
      `INSERT INTO audit_log (id, vault_id, app_id, action, memory_unit_id, timestamp) VALUES (?, ?, ?, ?, ?, ?)`,
      [entry.id, entry.vault_id, entry.app_id, entry.action, entry.memory_unit_id, entry.timestamp],
    );
  }
}

// ─── Supabase Adapter ───────────────────────────────────────────────────────

export class SupabaseAdapter implements DatabaseAdapter {
  private client: import('@supabase/supabase-js').SupabaseClient | null = null;
  private supabaseUrl: string;
  private supabaseKey: string;

  constructor(supabaseUrl: string, supabaseKey: string) {
    this.supabaseUrl = supabaseUrl;
    this.supabaseKey = supabaseKey;
  }

  async initialize(): Promise<void> {
    const { createClient } = await import('@supabase/supabase-js');
    this.client = createClient(this.supabaseUrl, this.supabaseKey);
  }

  async close(): Promise<void> {
    this.client = null;
  }

  private get sb(): import('@supabase/supabase-js').SupabaseClient {
    if (!this.client) throw new Error('Supabase client not initialized');
    return this.client;
  }

  // ── Vault ──────────────────────────────────────────────────────────────

  async getVault(vaultId: string): Promise<VaultRow | null> {
    const { data } = await this.sb.from('vault').select('*').eq('id', vaultId).single();
    return data as VaultRow | null;
  }

  async createVault(vault: VaultRow): Promise<void> {
    const { error } = await this.sb.from('vault').insert(vault);
    if (error) throw new Error(`Supabase: ${error.message}`);
  }

  async updateVault(vaultId: string, data: Partial<Pick<VaultRow, 'display_name' | 'updated_at'>>): Promise<void> {
    const { error } = await this.sb.from('vault').update(data).eq('id', vaultId);
    if (error) throw new Error(`Supabase: ${error.message}`);
  }

  async deleteVault(vaultId: string): Promise<void> {
    const { error } = await this.sb.from('vault').delete().eq('id', vaultId);
    if (error) throw new Error(`Supabase: ${error.message}`);
  }

  // ── Memory Units ───────────────────────────────────────────────────────

  async listMemoryUnits(vaultId: string, filters: MemoryFilters): Promise<{ units: MemoryUnitRow[]; total: number }> {
    let query = this.sb.from('memory_units').select('*', { count: 'exact' }).eq('vault_id', vaultId);
    if (filters.types && filters.types.length > 0) query = query.in('type', filters.types);
    if (filters.source_app) query = query.eq('source_app', filters.source_app);
    if (filters.visibility) query = query.eq('visibility', filters.visibility);
    query = query.order('updated_at', { ascending: false }).range(filters.offset, filters.offset + filters.limit - 1);

    const { data, count, error } = await query;
    if (error) throw new Error(`Supabase: ${error.message}`);

    let units = (data ?? []) as MemoryUnitRow[];
    if (filters.tags && filters.tags.length > 0) {
      units = units.filter((u) => {
        const unitTags: string[] = JSON.parse(u.tags);
        return filters.tags!.some((t) => unitTags.includes(t));
      });
    }
    return { units, total: count ?? units.length };
  }

  async getMemoryUnit(vaultId: string, id: string): Promise<MemoryUnitRow | null> {
    const { data } = await this.sb.from('memory_units').select('*').eq('id', id).eq('vault_id', vaultId).single();
    return data as MemoryUnitRow | null;
  }

  async createMemoryUnit(unit: MemoryUnitRow): Promise<void> {
    const { error } = await this.sb.from('memory_units').insert(unit);
    if (error) throw new Error(`Supabase: ${error.message}`);
  }

  async updateMemoryUnit(vaultId: string, id: string, data: Partial<MemoryUnitRow>): Promise<void> {
    const { error } = await this.sb.from('memory_units').update(data).eq('id', id).eq('vault_id', vaultId);
    if (error) throw new Error(`Supabase: ${error.message}`);
  }

  async deleteMemoryUnit(vaultId: string, id: string): Promise<void> {
    const { error } = await this.sb.from('memory_units').delete().eq('id', id).eq('vault_id', vaultId);
    if (error) throw new Error(`Supabase: ${error.message}`);
  }

  // ── Permissions ────────────────────────────────────────────────────────

  async listPermissions(vaultId: string): Promise<PermissionRow[]> {
    const { data, error } = await this.sb.from('permission_grants').select('*').eq('vault_id', vaultId);
    if (error) throw new Error(`Supabase: ${error.message}`);
    return (data ?? []) as PermissionRow[];
  }

  async getPermissionByToken(accessToken: string): Promise<PermissionRow | null> {
    const { data } = await this.sb.from('permission_grants').select('*').eq('access_token', accessToken).eq('revoked', 0).single();
    return data as PermissionRow | null;
  }

  async getPermissionByApp(vaultId: string, appId: string): Promise<PermissionRow | null> {
    const { data } = await this.sb.from('permission_grants').select('*').eq('vault_id', vaultId).eq('app_id', appId).eq('revoked', 0).single();
    return data as PermissionRow | null;
  }

  async getPermissionByAuthCode(authCode: string): Promise<PermissionRow | null> {
    const { data } = await this.sb.from('permission_grants').select('*').eq('auth_code', authCode).eq('revoked', 0).single();
    return data as PermissionRow | null;
  }

  async getPermissionByRefreshToken(refreshToken: string): Promise<PermissionRow | null> {
    const { data } = await this.sb.from('permission_grants').select('*').eq('refresh_token', refreshToken).eq('revoked', 0).single();
    return data as PermissionRow | null;
  }

  async createPermission(permission: PermissionRow): Promise<void> {
    const { error } = await this.sb.from('permission_grants').insert(permission);
    if (error) throw new Error(`Supabase: ${error.message}`);
  }

  async updatePermission(vaultId: string, appId: string, data: Partial<PermissionRow>): Promise<void> {
    const { error } = await this.sb.from('permission_grants').update(data).eq('app_id', appId).eq('vault_id', vaultId).eq('revoked', 0);
    if (error) throw new Error(`Supabase: ${error.message}`);
  }

  async revokePermission(vaultId: string, appId: string): Promise<void> {
    const { error } = await this.sb.from('permission_grants').update({ revoked: 1 }).eq('app_id', appId).eq('vault_id', vaultId);
    if (error) throw new Error(`Supabase: ${error.message}`);
  }

  async revokeAllPermissions(vaultId: string): Promise<void> {
    const { error } = await this.sb.from('permission_grants').update({ revoked: 1 }).eq('vault_id', vaultId);
    if (error) throw new Error(`Supabase: ${error.message}`);
  }

  // ── Audit Log ──────────────────────────────────────────────────────────

  async logAction(entry: AuditLogRow): Promise<void> {
    const { error } = await this.sb.from('audit_log').insert(entry);
    if (error) throw new Error(`Supabase: ${error.message}`);
  }
}

// ─── Factory ────────────────────────────────────────────────────────────────

export interface DatabaseConfig {
  mode: 'local' | 'cloud';
  sqlitePath?: string;
  supabaseUrl?: string;
  supabaseKey?: string;
}

export async function createDatabase(config: DatabaseConfig): Promise<DatabaseAdapter> {
  if (config.mode === 'cloud') {
    if (!config.supabaseUrl || !config.supabaseKey) {
      throw new Error('Supabase URL and key are required for cloud mode');
    }
    const adapter = new SupabaseAdapter(config.supabaseUrl, config.supabaseKey);
    await adapter.initialize();
    return adapter;
  }

  const dbPath = config.sqlitePath ?? './omxp-vault.db';
  const adapter = new SqliteAdapter(dbPath);
  await adapter.initialize();
  return adapter;
}
