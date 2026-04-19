// ─────────────────────────────────────────────────────────────────────────────
// OMXP CLI — Shared configuration and vault context helpers
// Manages ~/.omxp/ directory, vault.json, and SQLite database path.
// ─────────────────────────────────────────────────────────────────────────────

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

// ─── Paths ──────────────────────────────────────────────────────────────────

const OMXP_DIR = join(homedir(), '.omxp');
const CONFIG_FILE = join(OMXP_DIR, 'vault.json');
const DB_FILE = join(OMXP_DIR, 'vault.db');

export function getOmxpDir(): string {
  return OMXP_DIR;
}

export function getDbPath(): string {
  return DB_FILE;
}

export function getConfigPath(): string {
  return CONFIG_FILE;
}

// ─── Config Schema ──────────────────────────────────────────────────────────

export interface VaultConfig {
  vault_id: string;
  public_key: string;
  private_key: string;
  display_name: string | null;
  created_at: string;
  schema_version: string;
}

// ─── Ensure ~/.omxp exists ──────────────────────────────────────────────────

export function ensureOmxpDir(): void {
  if (!existsSync(OMXP_DIR)) {
    mkdirSync(OMXP_DIR, { recursive: true });
  }
}

// ─── Read / Write ───────────────────────────────────────────────────────────

export function vaultExists(): boolean {
  return existsSync(CONFIG_FILE) && existsSync(DB_FILE);
}

export function loadConfig(): VaultConfig {
  if (!existsSync(CONFIG_FILE)) {
    throw new Error(
      `No vault found. Run "omxp init" first.\n  Expected config at: ${CONFIG_FILE}`,
    );
  }
  const raw = readFileSync(CONFIG_FILE, 'utf-8');
  return JSON.parse(raw) as VaultConfig;
}

export function saveConfig(config: VaultConfig): void {
  ensureOmxpDir();
  writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2) + '\n', 'utf-8');
}

// ─── Duration Parsing ───────────────────────────────────────────────────────

/**
 * Parses a human-readable duration string into milliseconds.
 * Supports: 30m, 1h, 2h, 24h, 7d, 30d, etc.
 */
export function parseDuration(input: string): number {
  const match = input.match(/^(\d+)(m|h|d)$/);
  if (!match) {
    throw new Error(`Invalid duration: "${input}" — use format like 30m, 24h, 7d`);
  }
  const value = parseInt(match[1]!, 10);
  const unit = match[2]!;
  switch (unit) {
    case 'm': return value * 60 * 1000;
    case 'h': return value * 60 * 60 * 1000;
    case 'd': return value * 24 * 60 * 60 * 1000;
    default: throw new Error(`Unknown duration unit: ${unit}`);
  }
}
