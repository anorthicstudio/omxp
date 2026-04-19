// ─────────────────────────────────────────────────────────────────────────────
// OMXP CLI — omxp permissions
// List and revoke permission grants
// ─────────────────────────────────────────────────────────────────────────────

import { Command } from 'commander';
import chalk from 'chalk';
import { createDatabase } from '@omxp/vault-server';
import { loadConfig, getDbPath } from '../config.js';

export function registerPermissionsCommand(program: Command): void {
  const perms = program
    .command('permissions')
    .description('Manage app permission grants');

  // ── omxp permissions list ─────────────────────────────────────────────────

  perms
    .command('list')
    .description('List all permission grants')
    .action(async () => {
      const config = loadConfig();
      const db = await createDatabase({ mode: 'local', sqlitePath: getDbPath() });

      try {
        const grants = await db.listPermissions(config.vault_id);

        console.log('');

        if (grants.length === 0) {
          console.log(chalk.dim('  No permission grants.'));
          console.log('');
          return;
        }

        const activeCount = grants.filter((g) => g.revoked === 0).length;
        const revokedCount = grants.length - activeCount;

        console.log(
          chalk.blue(
            `  ${activeCount} active grant${activeCount !== 1 ? 's' : ''}, ${revokedCount} revoked`,
          ),
        );
        console.log('');

        for (const g of grants) {
          const isActive = g.revoked === 0;
          const status = isActive ? chalk.green('[active] ') : chalk.red('[revoked]');
          const scopes: string[] = JSON.parse(g.scopes);
          const expires = g.token_expires_at
            ? new Date(g.token_expires_at).toLocaleDateString()
            : 'never';

          console.log(`  ${status} ${chalk.bold(g.app_id)}`);
          console.log(`    ${chalk.dim('App name:')}  ${g.app_name}`);
          console.log(`    ${chalk.dim('Scopes:  ')}  ${chalk.cyan(scopes.join(', '))}`);
          console.log(`    ${chalk.dim('Granted: ')}  ${new Date(g.granted_at).toLocaleDateString()}`);

          if (isActive) {
            console.log(`    ${chalk.dim('Expires: ')}  ${expires}`);
          }

          console.log('');
        }
      } finally {
        await db.close();
      }
    });

  // ── omxp permissions revoke ───────────────────────────────────────────────

  perms
    .command('revoke [app_id]')
    .description('Revoke a permission grant by app ID')
    .option('--all', 'Revoke ALL permission grants')
    .action(async (appId: string | undefined, opts: { all?: boolean }) => {
      if (!opts.all && !appId) {
        console.error(chalk.red('✗ Provide an <app_id> or use --all'));
        process.exit(1);
      }

      const config = loadConfig();
      const db = await createDatabase({ mode: 'local', sqlitePath: getDbPath() });

      try {
        if (opts.all) {
          const grants = await db.listPermissions(config.vault_id);
          const activeCount = grants.filter((g) => g.revoked === 0).length;
          await db.revokeAllPermissions(config.vault_id);
          console.log(chalk.green(`✓ Revoked all ${activeCount} active grant${activeCount !== 1 ? 's' : ''}.`));
          return;
        }

        const grant = await db.getPermissionByApp(config.vault_id, appId!);

        if (!grant) {
          console.error(chalk.red(`✗ No active grant found for app: ${appId}`));
          process.exit(1);
        }

        await db.revokePermission(config.vault_id, appId!);
        console.log(chalk.green(`✓ Revoked access for: ${chalk.bold(appId!)}`));
      } finally {
        await db.close();
      }
    });
}
