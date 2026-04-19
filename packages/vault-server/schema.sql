-- ─────────────────────────────────────────────────────────────────────────────
-- OMXP Vault Database Schema — SQLite
-- Run on vault init. Compatible with SQLite 3.35+.
-- ─────────────────────────────────────────────────────────────────────────────

-- Vault identity and metadata
CREATE TABLE IF NOT EXISTS vault (
  id TEXT PRIMARY KEY,
  public_key TEXT NOT NULL,
  display_name TEXT,
  schema_version TEXT NOT NULL DEFAULT '0.1.0',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Memory units — user knowledge stored by AI applications
CREATE TABLE IF NOT EXISTS memory_units (
  id TEXT PRIMARY KEY,
  vault_id TEXT NOT NULL,
  type TEXT NOT NULL CHECK(type IN (
    'fact','preference','context','skill','goal','relationship'
  )),
  value TEXT NOT NULL,
  value_encrypted TEXT,           -- AES-256-GCM encrypted value
  source_app TEXT NOT NULL,
  confidence REAL NOT NULL DEFAULT 1.0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  expires_at TEXT,
  tags JSON NOT NULL DEFAULT '[]', -- JSON array
  visibility TEXT NOT NULL DEFAULT 'shared' 
    CHECK(visibility IN ('shared','private')),
  FOREIGN KEY(vault_id) REFERENCES vault(id)
);

-- Permission grants — OAuth tokens and auth codes
CREATE TABLE IF NOT EXISTS permission_grants (
  id TEXT PRIMARY KEY,
  vault_id TEXT NOT NULL,
  app_id TEXT NOT NULL,
  app_name TEXT NOT NULL,
  app_url TEXT NOT NULL,
  scopes JSON NOT NULL,           -- JSON array
  access_token TEXT UNIQUE,
  refresh_token TEXT UNIQUE,
  auth_code TEXT UNIQUE,
  auth_code_expires_at TEXT,
  token_expires_at TEXT,
  granted_at TEXT NOT NULL,
  revoked INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY(vault_id) REFERENCES vault(id)
);

-- Audit log — all vault access events
CREATE TABLE IF NOT EXISTS audit_log (
  id TEXT PRIMARY KEY,
  vault_id TEXT NOT NULL,
  app_id TEXT,
  action TEXT NOT NULL,           -- 'read', 'write', 'delete', 'grant', 'revoke'
  memory_unit_id TEXT,
  timestamp TEXT NOT NULL,
  FOREIGN KEY(vault_id) REFERENCES vault(id)
);

-- ─── Indexes ────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_memory_vault ON memory_units(vault_id);
CREATE INDEX IF NOT EXISTS idx_memory_type ON memory_units(type);
CREATE INDEX IF NOT EXISTS idx_memory_expires ON memory_units(expires_at);
CREATE INDEX IF NOT EXISTS idx_grants_token ON permission_grants(access_token);
CREATE INDEX IF NOT EXISTS idx_grants_app ON permission_grants(app_id);
