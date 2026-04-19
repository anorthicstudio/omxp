// ─────────────────────────────────────────────────────────────────────────────
// OMXP CLI — omxp serve
// Starts the OMXP vault server on localhost.
// ─────────────────────────────────────────────────────────────────────────────

import { Command } from 'commander';
import chalk from 'chalk';
import {
  OMXP_VERSION,
  OMXP_PORT,
  deriveEncryptionKey,
} from '@omxp/core';
import { createApp, createDatabase } from '@omxp/vault-server';
import { loadConfig, getDbPath } from '../config.js';

export function registerServeCommand(program: Command): void {
  program
    .command('serve')
    .description('Start the local OMXP vault server')
    .option('-p, --port <port>', 'Port to listen on', String(OMXP_PORT))
    .option('--cloud', 'Use Supabase cloud backend instead of local SQLite')
    .action(async (opts: { port: string; cloud?: boolean }) => {
      const config = loadConfig();
      const port = parseInt(opts.port, 10);

      if (isNaN(port) || port < 1 || port > 65535) {
        console.error(chalk.red(`✗ Invalid port: ${opts.port}`));
        process.exit(1);
      }

      const mode = opts.cloud ? 'cloud' : 'local';

      // Initialize database
      const db = await createDatabase({
        mode,
        sqlitePath: mode === 'local' ? getDbPath() : undefined,
        supabaseUrl: mode === 'cloud' ? process.env['OMXP_SUPABASE_URL'] : undefined,
        supabaseKey: mode === 'cloud' ? process.env['OMXP_SUPABASE_KEY'] : undefined,
      });

      // Ensure vault exists in DB
      const existing = await db.getVault(config.vault_id);
      if (!existing) {
        const now = new Date().toISOString();
        await db.createVault({
          id: config.vault_id,
          public_key: config.public_key,
          display_name: config.display_name,
          schema_version: config.schema_version,
          created_at: now,
          updated_at: now,
        });
      }

      // Derive encryption key
      const encryptionKey = deriveEncryptionKey(config.private_key);

      // Create Hono app
      const app = createApp(db, {
        vaultId: config.vault_id,
        encryptionKey,
      });

      // Start server
      const { serve } = await import('@hono/node-server');

      serve({ fetch: app.fetch, port }, (info) => {
        console.log('');
        console.log(chalk.blue('  ┌──────────────────────────────────────────┐'));
        console.log(chalk.blue(`  │  ${chalk.bold('OMXP Vault Server')} v${OMXP_VERSION}                 │`));
        console.log(chalk.blue('  │                                          │'));
        console.log(chalk.blue(`  │  Local:   ${chalk.white(`http://localhost:${info.port}/v1`)}       │`));
        console.log(chalk.blue(`  │  Health:  ${chalk.white(`http://localhost:${info.port}/health`)}    │`));
        console.log(chalk.blue('  │                                          │'));
        console.log(chalk.blue(`  │  Vault:   ${chalk.white(config.vault_id.padEnd(29))}│`));
        console.log(chalk.blue(`  │  Mode:    ${chalk.white(mode.padEnd(29))}│`));
        console.log(chalk.blue('  └──────────────────────────────────────────┘'));
        console.log('');
      });

      // Graceful shutdown
      const shutdown = async () => {
        console.log(chalk.dim('\n[OMXP] Shutting down...'));
        await db.close();
        process.exit(0);
      };

      process.on('SIGINT', shutdown);
      process.on('SIGTERM', shutdown);
    });
}
