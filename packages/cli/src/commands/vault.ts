// ─────────────────────────────────────────────────────────────────────────────
// OMXP CLI — omxp vault
// Vault status, export (JSON + Markdown), and import
// ─────────────────────────────────────────────────────────────────────────────

import { Command } from 'commander';
import chalk from 'chalk';
import { readFileSync, writeFileSync } from 'node:fs';
import { OMXP_VERSION, generateMemoryId, type MemoryType, type Visibility } from '@omxp/core';
import { createDatabase } from '@omxp/vault-server';
import { loadConfig, getDbPath, getOmxpDir } from '../config.js';

export function registerVaultCommand(program: Command): void {
  const vault = program
    .command('vault')
    .description('Manage your OMXP vault');

  // ── omxp vault status ─────────────────────────────────────────────────────

  vault
    .command('status')
    .description('Show vault status and statistics')
    .action(async () => {
      const config = loadConfig();
      const db = await createDatabase({ mode: 'local', sqlitePath: getDbPath() });

      try {
        const vaultRow = await db.getVault(config.vault_id);

        if (!vaultRow) {
          console.error(chalk.red('✗ Vault not found in database. Run omxp init.'));
          process.exit(1);
        }

        const { total: memoryCount } = await db.listMemoryUnits(config.vault_id, {
          limit: 1,
          offset: 0,
        });

        const grants = await db.listPermissions(config.vault_id);
        const activeGrants = grants.filter((g) => g.revoked === 0);

        console.log('');
        console.log(chalk.blue('  ┌─────────────────────────────────────────┐'));
        console.log(chalk.blue(`  │  ${chalk.bold('OMXP Vault Status')}                       │`));
        console.log(chalk.blue('  └─────────────────────────────────────────┘'));
        console.log('');
        console.log(`  ${chalk.dim('Vault ID:    ')} ${chalk.bold(config.vault_id)}`);
        console.log(`  ${chalk.dim('Public Key:  ')} ${chalk.dim(config.public_key.slice(0, 42))}...`);
        console.log(`  ${chalk.dim('Schema:      ')} ${vaultRow.schema_version}`);
        console.log(`  ${chalk.dim('Protocol:    ')} OMXP v${OMXP_VERSION}`);
        console.log(`  ${chalk.dim('Config dir:  ')} ${getOmxpDir()}`);
        console.log(`  ${chalk.dim('Created:     ')} ${new Date(vaultRow.created_at).toLocaleString()}`);
        console.log('');
        console.log(`  ${chalk.dim('Memory units:')} ${chalk.bold(String(memoryCount))}`);
        console.log(`  ${chalk.dim('Active apps: ')} ${chalk.bold(String(activeGrants.length))}`);
        console.log(`  ${chalk.dim('Total grants:')} ${chalk.bold(String(grants.length))}`);
        console.log('');
      } finally {
        await db.close();
      }
    });

  // ── omxp vault export ─────────────────────────────────────────────────────

  vault
    .command('export')
    .description('Export vault data (pipe to file: omxp vault export > backup.json)')
    .option('--format <fmt>', 'Output format: json (default) or markdown', 'json')
    .option('--output <file>', 'Write to file instead of stdout')
    .action(async (opts: { format: string; output?: string }) => {
      const config = loadConfig();
      const db = await createDatabase({ mode: 'local', sqlitePath: getDbPath() });

      try {
        const vaultRow = await db.getVault(config.vault_id);

        if (!vaultRow) {
          console.error(chalk.red('✗ Vault not found.'));
          process.exit(1);
        }

        // Paginate through ALL memory units
        type UnitShape = {
          id: string; type: string; value: string; source_app: string;
          confidence: number; created_at: string; updated_at: string;
          expires_at: string | null; tags: string[]; visibility: string;
        };
        const allUnits: UnitShape[] = [];
        let offset = 0;

        while (true) {
          const { units: batch } = await db.listMemoryUnits(config.vault_id, {
            limit: 100,
            offset,
          });
          if (batch.length === 0) break;

          for (const r of batch) {
            allUnits.push({
              id: r.id,
              type: r.type,
              value: r.value,
              source_app: r.source_app,
              confidence: r.confidence,
              created_at: r.created_at,
              updated_at: r.updated_at,
              expires_at: r.expires_at,
              tags: JSON.parse(r.tags) as string[],
              visibility: r.visibility,
            });
          }

          offset += 100;
        }

        let out: string;

        if (opts.format === 'markdown') {
          const grouped: Record<string, UnitShape[]> = {};
          for (const u of allUnits) {
            (grouped[u.type] ??= []).push(u);
          }

          const lines: string[] = [
            `# OMXP Vault Export`,
            ``,
            `*Exported: ${new Date().toISOString()}*`,
            `*Vault: ${config.vault_id}*`,
            `*Memory units: ${allUnits.length}*`,
            ``,
          ];

          for (const [type, units] of Object.entries(grouped)) {
            lines.push(`## ${type.charAt(0).toUpperCase()}${type.slice(1)}s`);
            for (const u of units) {
              const tags = u.tags.length ? `  *(${u.tags.join(', ')})*` : '';
              lines.push(`- ${u.value}${tags}`);
            }
            lines.push('');
          }

          out = lines.join('\n');
        } else {
          out = JSON.stringify(
            {
              omxp_version: OMXP_VERSION,
              vault_id: config.vault_id,
              public_key: config.public_key,
              created_at: vaultRow.created_at,
              updated_at: vaultRow.updated_at,
              memory_units: allUnits,
              metadata: {
                schema_version: vaultRow.schema_version,
                display_name: vaultRow.display_name,
              },
              exported_at: new Date().toISOString(),
            },
            null,
            2,
          );
        }

        if (opts.output) {
          writeFileSync(opts.output, out + '\n', 'utf-8');
          console.error(chalk.green(`✓ Exported ${allUnits.length} units to ${opts.output}`));
        } else {
          process.stdout.write(out + '\n');
        }
      } finally {
        await db.close();
      }
    });

  // ── omxp vault import ─────────────────────────────────────────────────────

  vault
    .command('import <file>')
    .description('Import memory units from a JSON export file')
    .action(async (file: string) => {
      const config = loadConfig();
      const db = await createDatabase({ mode: 'local', sqlitePath: getDbPath() });

      try {
        let raw: string;
        try {
          raw = readFileSync(file, 'utf-8');
        } catch {
          console.error(chalk.red(`✗ Cannot read file: ${file}`));
          process.exit(1);
        }

        let data: { memory_units?: unknown[] };
        try {
          data = JSON.parse(raw) as { memory_units?: unknown[] };
        } catch {
          console.error(chalk.red('✗ File is not valid JSON.'));
          process.exit(1);
        }

        const units = data.memory_units;
        if (!Array.isArray(units)) {
          console.error(chalk.red('✗ Export file has no memory_units array.'));
          process.exit(1);
        }

        let imported = 0;
        let skipped = 0;

        for (const u of units as Record<string, unknown>[]) {
          const uid = typeof u['id'] === 'string' ? u['id'] : generateMemoryId();
          const existing = await db.getMemoryUnit(config.vault_id, uid);

          if (existing) {
            skipped++;
            continue;
          }

          const now = new Date().toISOString();

          await db.createMemoryUnit({
            id: uid,
            vault_id: config.vault_id,
            type: (u['type'] as MemoryType) ?? 'fact',
            value: (u['value'] as string) ?? '',
            value_encrypted: null,
            source_app: (u['source_app'] as string) ?? 'omxp-import',
            confidence: typeof u['confidence'] === 'number' ? u['confidence'] : 1.0,
            created_at: (u['created_at'] as string) ?? now,
            updated_at: (u['updated_at'] as string) ?? now,
            expires_at: (u['expires_at'] as string | null) ?? null,
            tags: JSON.stringify(Array.isArray(u['tags']) ? u['tags'] : []),
            visibility: ((u['visibility'] as string) ?? 'shared') as Visibility,
          });

          imported++;
        }

        console.log('');
        console.log(chalk.green(`✓ Import complete`));
        console.log(`  ${chalk.dim('Imported:')} ${imported}`);
        console.log(`  ${chalk.dim('Skipped: ')} ${skipped} (already exist)`);
        console.log('');
      } finally {
        await db.close();
      }
    });
}
