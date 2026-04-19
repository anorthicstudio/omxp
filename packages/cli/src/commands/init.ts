// ─────────────────────────────────────────────────────────────────────────────
// OMXP CLI — omxp init
// Generates a new Ed25519 keypair, creates the SQLite vault database,
// and writes config to ~/.omxp/vault.json.
// ─────────────────────────────────────────────────────────────────────────────

import { Command } from 'commander';
import chalk from 'chalk';
import {
  generateVaultKeyPair,
  generateVaultId,
  deriveEncryptionKey,
} from '@omxp/core';
import { createDatabase } from '@omxp/vault-server';
import {
  ensureOmxpDir,
  getDbPath,
  vaultExists,
  saveConfig,
  getOmxpDir,
  type VaultConfig,
} from '../config.js';

export function registerInitCommand(program: Command): void {
  program
    .command('init')
    .description('Initialize a new OMXP vault')
    .option('--force', 'Overwrite existing vault configuration')
    .option('--name <name>', 'Display name for the vault')
    .action(async (opts: { force?: boolean; name?: string }) => {
      if (vaultExists() && !opts.force) {
        console.error(
          chalk.red('✗ Vault already exists at ') + chalk.dim(getOmxpDir()),
        );
        console.error(
          chalk.dim('  Use --force to overwrite the existing vault.'),
        );
        process.exit(1);
      }

      console.log(chalk.blue('⟐  Initializing OMXP vault...\n'));

      // 1. Generate Ed25519 keypair
      const keyPair = generateVaultKeyPair();
      const vaultId = generateVaultId();
      const now = new Date().toISOString();

      // 2. Save config
      const config: VaultConfig = {
        vault_id: vaultId,
        public_key: keyPair.publicKey,
        private_key: keyPair.privateKey,
        display_name: opts.name ?? null,
        created_at: now,
        schema_version: '0.1.0',
      };

      ensureOmxpDir();
      saveConfig(config);

      // 3. Create SQLite database
      const dbPath = getDbPath();
      const db = await createDatabase({ mode: 'local', sqlitePath: dbPath });

      // 4. Insert vault row
      await db.createVault({
        id: vaultId,
        public_key: keyPair.publicKey,
        display_name: opts.name ?? null,
        schema_version: '0.1.0',
        created_at: now,
        updated_at: now,
      });

      await db.close();

      // 5. Derive encryption key (verify it works)
      deriveEncryptionKey(keyPair.privateKey);

      // 6. Output
      console.log(chalk.green('✓ Vault initialized successfully\n'));
      console.log(`  ${chalk.dim('Vault ID:')}    ${chalk.bold(vaultId)}`);
      console.log(`  ${chalk.dim('Public Key:')}  ${chalk.bold(keyPair.publicKey)}`);
      console.log(`  ${chalk.dim('Config:')}      ${chalk.dim(getOmxpDir() + '/vault.json')}`);
      console.log(`  ${chalk.dim('Database:')}    ${chalk.dim(dbPath)}`);
      console.log('');
      console.log(chalk.yellow('⚠  Keep your private key safe. It is stored in vault.json.'));
      console.log(chalk.dim('   Never share vault.json or commit it to version control.'));
      console.log('');
      console.log(chalk.dim('Next steps:'));
      console.log(chalk.dim('  omxp serve          Start the vault server'));
      console.log(chalk.dim('  omxp memory add     Add your first memory'));
    });
}
