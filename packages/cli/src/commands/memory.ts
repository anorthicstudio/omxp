// ─────────────────────────────────────────────────────────────────────────────
// OMXP CLI — omxp memory
// Memory CRUD: list, add, delete, search
// ─────────────────────────────────────────────────────────────────────────────

import { Command } from 'commander';
import chalk from 'chalk';
import { generateMemoryId, generateId, MEMORY_TYPES, type MemoryType } from '@omxp/core';
import { createDatabase } from '@omxp/vault-server';
import { loadConfig, getDbPath, parseDuration } from '../config.js';

// ─── Display Helper ──────────────────────────────────────────────────────────

function printUnit(row: {
  id: string;
  type: string;
  value: string;
  source_app: string;
  confidence: number;
  updated_at: string;
  expires_at: string | null;
  tags: string[];
  visibility: string;
}, index: number): void {
  const expiry = row.expires_at
    ? chalk.dim(` · expires ${new Date(row.expires_at).toLocaleDateString()}`)
    : '';
  const priv = row.visibility === 'private' ? chalk.yellow(' [private]') : '';
  const tags = row.tags.length ? chalk.dim(` · #${row.tags.join(' #')}`) : '';

  console.log(`  ${chalk.dim(`${index + 1}.`)} ${chalk.bold(row.id)}`);
  console.log(`     ${chalk.cyan(row.type.padEnd(12))} ${row.value}${priv}`);
  console.log(`     ${chalk.dim(`confidence: ${row.confidence}  ·  app: ${row.source_app}  ·  updated: ${new Date(row.updated_at).toLocaleDateString()}${expiry}${tags}`)}`);
  console.log('');
}

// ─── Register ────────────────────────────────────────────────────────────────

export function registerMemoryCommand(program: Command): void {
  const memory = program
    .command('memory')
    .description('Manage memory units in your vault');

  // ── omxp memory list ─────────────────────────────────────────────────────

  memory
    .command('list')
    .description('List memory units')
    .option('--type <types>', 'Filter by type(s), comma-separated (fact,preference,...)')
    .option('--tag <tag>', 'Filter by tag')
    .option('--visibility <v>', 'Filter by visibility: shared|private')
    .option('--limit <n>', 'Max results (default 50)', '50')
    .action(async (opts: { type?: string; tag?: string; visibility?: string; limit: string }) => {
      const config = loadConfig();
      const db = await createDatabase({ mode: 'local', sqlitePath: getDbPath() });

      try {
        const types = opts.type
          ? (opts.type.split(',').map((t) => t.trim()) as MemoryType[])
          : undefined;

        const tags = opts.tag ? [opts.tag] : undefined;

        const { units, total } = await db.listMemoryUnits(config.vault_id, {
          types,
          tags,
          visibility: opts.visibility as 'shared' | 'private' | undefined,
          limit: parseInt(opts.limit, 10),
          offset: 0,
        });

        console.log('');

        if (units.length === 0) {
          console.log(chalk.dim('  No memory units found.'));
          console.log('');
          return;
        }

        console.log(chalk.blue(`  ${total} memory unit${total !== 1 ? 's' : ''}${types ? ` (${types.join(', ')})` : ''}`));
        console.log('');

        units.forEach((row, i) =>
          printUnit({ ...row, tags: JSON.parse(row.tags) as string[] }, i),
        );
      } finally {
        await db.close();
      }
    });

  // ── omxp memory add ──────────────────────────────────────────────────────

  memory
    .command('add')
    .description('Add a new memory unit')
    .requiredOption('--type <type>', `Memory type: ${MEMORY_TYPES.join('|')}`)
    .requiredOption('--value <value>', 'Memory value (natural language)')
    .option('--confidence <n>', 'Confidence score 0–1 (default 1.0)', '1.0')
    .option('--tag <tags>', 'Tags, comma-separated')
    .option('--expires <duration>', 'Expiry: 30m | 24h | 7d | 30d')
    .option('--private', 'Mark as private (not visible to other apps)')
    .action(async (opts: {
      type: string;
      value: string;
      confidence: string;
      tag?: string;
      expires?: string;
      private?: boolean;
    }) => {
      if (!(MEMORY_TYPES as readonly string[]).includes(opts.type)) {
        console.error(chalk.red(`✗ Invalid type: "${opts.type}"`));
        console.error(chalk.dim(`  Valid types: ${MEMORY_TYPES.join(', ')}`));
        process.exit(1);
      }

      const confidence = parseFloat(opts.confidence);
      if (isNaN(confidence) || confidence < 0 || confidence > 1) {
        console.error(chalk.red('✗ Confidence must be a number between 0 and 1'));
        process.exit(1);
      }

      const config = loadConfig();
      const db = await createDatabase({ mode: 'local', sqlitePath: getDbPath() });

      try {
        const now = new Date().toISOString();
        const tags = opts.tag ? opts.tag.split(',').map((t) => t.trim()) : [];

        let expires_at: string | null = null;
        if (opts.expires) {
          const ms = parseDuration(opts.expires);
          expires_at = new Date(Date.now() + ms).toISOString();
        }

        const id = generateMemoryId();

        await db.createMemoryUnit({
          id,
          vault_id: config.vault_id,
          type: opts.type as MemoryType,
          value: opts.value,
          value_encrypted: null,
          source_app: 'omxp-cli',
          confidence,
          created_at: now,
          updated_at: now,
          expires_at,
          tags: JSON.stringify(tags),
          visibility: opts.private ? 'private' : 'shared',
        });

        await db.logAction({
          id: generateId('al_'),
          vault_id: config.vault_id,
          app_id: 'omxp-cli',
          action: 'write',
          memory_unit_id: id,
          timestamp: now,
        });

        console.log('');
        console.log(chalk.green(`✓ Memory unit added`));
        console.log('');
        console.log(`  ${chalk.dim('ID:    ')} ${chalk.bold(id)}`);
        console.log(`  ${chalk.dim('Type:  ')} ${chalk.cyan(opts.type)}`);
        console.log(`  ${chalk.dim('Value: ')} ${opts.value}`);
        if (expires_at) {
          console.log(`  ${chalk.dim('Expires:')} ${new Date(expires_at).toLocaleString()}`);
        }
        console.log('');
      } finally {
        await db.close();
      }
    });

  // ── omxp memory delete ───────────────────────────────────────────────────

  memory
    .command('delete <id>')
    .description('Delete a memory unit by ID')
    .action(async (id: string) => {
      const config = loadConfig();
      const db = await createDatabase({ mode: 'local', sqlitePath: getDbPath() });

      try {
        const unit = await db.getMemoryUnit(config.vault_id, id);

        if (!unit) {
          console.error(chalk.red(`✗ Memory unit not found: ${id}`));
          process.exit(1);
        }

        await db.deleteMemoryUnit(config.vault_id, id);

        await db.logAction({
          id: generateId('al_'),
          vault_id: config.vault_id,
          app_id: 'omxp-cli',
          action: 'delete',
          memory_unit_id: id,
          timestamp: new Date().toISOString(),
        });

        console.log(chalk.green(`✓ Deleted: ${id}`));
      } finally {
        await db.close();
      }
    });

  // ── omxp memory search ───────────────────────────────────────────────────

  memory
    .command('search <query>')
    .description('Search memory units by value (case-insensitive substring match)')
    .option('--type <types>', 'Filter by type(s), comma-separated')
    .action(async (query: string, opts: { type?: string }) => {
      const config = loadConfig();
      const db = await createDatabase({ mode: 'local', sqlitePath: getDbPath() });

      try {
        const types = opts.type
          ? (opts.type.split(',').map((t) => t.trim()) as MemoryType[])
          : undefined;

        const { units: allUnits } = await db.listMemoryUnits(config.vault_id, {
          types,
          limit: 1000,
          offset: 0,
        });

        const q = query.toLowerCase();
        const matched = allUnits.filter((u) => u.value.toLowerCase().includes(q));

        console.log('');

        if (matched.length === 0) {
          console.log(chalk.dim(`  No results for "${query}".`));
          console.log('');
          return;
        }

        console.log(chalk.blue(`  ${matched.length} result${matched.length !== 1 ? 's' : ''} for "${query}"`));
        console.log('');

        matched.forEach((row, i) =>
          printUnit({ ...row, tags: JSON.parse(row.tags) as string[] }, i),
        );
      } finally {
        await db.close();
      }
    });
}
