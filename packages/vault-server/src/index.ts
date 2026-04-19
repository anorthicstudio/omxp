// ─────────────────────────────────────────────────────────────────────────────
// OMXP Vault Server — Entry Point
// Loads configuration, initialises database, and starts the Hono server.
// ─────────────────────────────────────────────────────────────────────────────

import { serve } from '@hono/node-server';
import {
  OMXP_VERSION,
  OMXP_PORT,
  generateVaultKeyPair,
  generateVaultId,
  deriveEncryptionKey,
} from '@omxp/core';
import { createApp } from './server.js';
import { createDatabase } from './db.js';

// ─── Configuration ──────────────────────────────────────────────────────────

interface VaultServerConfig {
  mode: 'local' | 'cloud';
  port: number;
  vaultId: string;
  publicKey: string;
  privateKey: string;
  displayName: string;

  // Local mode
  sqlitePath: string;

  // Cloud mode
  supabaseUrl?: string;
  supabaseKey?: string;
}

function loadConfig(): VaultServerConfig {
  const mode = (process.env['OMXP_MODE'] ?? 'local') as 'local' | 'cloud';
  const port = parseInt(process.env['OMXP_PORT'] ?? String(OMXP_PORT), 10);

  // If no keypair is provided, generate one (first run)
  let vaultId = process.env['OMXP_VAULT_ID'] ?? '';
  let publicKey = process.env['OMXP_PUBLIC_KEY'] ?? '';
  let privateKey = process.env['OMXP_PRIVATE_KEY'] ?? '';

  if (!privateKey || !publicKey) {
    console.log('[OMXP] No keypair provided — generating new identity...');
    const kp = generateVaultKeyPair();
    publicKey = kp.publicKey;
    privateKey = kp.privateKey;
    vaultId = vaultId || generateVaultId();

    console.log(`[OMXP] Vault ID:    ${vaultId}`);
    console.log(`[OMXP] Public Key:  ${publicKey}`);
    console.log('[OMXP] ⚠  Save the private key from OMXP_PRIVATE_KEY env var for persistence.');
  }

  if (!vaultId) {
    vaultId = generateVaultId();
  }

  return {
    mode,
    port,
    vaultId,
    publicKey,
    privateKey,
    displayName: process.env['OMXP_DISPLAY_NAME'] ?? '',
    sqlitePath: process.env['OMXP_DB_PATH'] ?? './omxp-vault.db',
    supabaseUrl: process.env['OMXP_SUPABASE_URL'],
    supabaseKey: process.env['OMXP_SUPABASE_KEY'],
  };
}

// ─── Bootstrap ──────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const config = loadConfig();

  console.log(`[OMXP] Starting vault server v${OMXP_VERSION}`);
  console.log(`[OMXP] Mode: ${config.mode}`);

  // Initialise database
  const db = await createDatabase({
    mode: config.mode,
    sqlitePath: config.sqlitePath,
    supabaseUrl: config.supabaseUrl,
    supabaseKey: config.supabaseKey,
  });

  // Ensure the vault exists in the database
  const existing = await db.getVault(config.vaultId);
  if (!existing) {
    const now = new Date().toISOString();
    await db.createVault({
      id: config.vaultId,
      public_key: config.publicKey,
      created_at: now,
      updated_at: now,
      display_name: config.displayName || null,
      schema_version: '0.1.0',
    });
    console.log(`[OMXP] Created new vault: ${config.vaultId}`);
  } else {
    console.log(`[OMXP] Loaded existing vault: ${config.vaultId}`);
  }

  // Derive encryption key from private key
  const encryptionKey = deriveEncryptionKey(config.privateKey);

  // Create the Hono application
  const app = createApp(db, {
    vaultId: config.vaultId,
    encryptionKey,
  });

  // Start the Node.js HTTP server
  serve(
    {
      fetch: app.fetch,
      port: config.port,
    },
    (info) => {
      console.log('');
      console.log('  ┌──────────────────────────────────────────┐');
      console.log(`  │  OMXP Vault Server v${OMXP_VERSION}                 │`);
      console.log('  │                                          │');
      console.log(`  │  Local:   http://localhost:${info.port}/v1       │`);
      console.log(`  │  Health:  http://localhost:${info.port}/health    │`);
      console.log('  │                                          │');
      console.log(`  │  Vault:   ${config.vaultId.padEnd(29)}│`);
      console.log(`  │  Mode:    ${config.mode.padEnd(29)}│`);
      console.log('  └──────────────────────────────────────────┘');
      console.log('');
    },
  );

  // Graceful shutdown
  const shutdown = async () => {
    console.log('\n[OMXP] Shutting down...');
    await db.close();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  console.error('[OMXP] Fatal error:', err);
  process.exit(1);
});

export { createApp } from './server.js';
export { createDatabase } from './db.js';
export type { DatabaseAdapter, DatabaseConfig } from './db.js';
export type { ServerConfig } from './server.js';
