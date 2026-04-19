// ─────────────────────────────────────────────────────────────────────────────
// OMXP CLI — omxp token
// Create and verify access tokens (dev helpers)
// ─────────────────────────────────────────────────────────────────────────────

import { Command } from 'commander';
import chalk from 'chalk';
import {
  generateAccessToken,
  generateRefreshToken,
  generateId,
  validateScopes,
  type OmxpScope,
} from '@omxp/core';
import { createDatabase } from '@omxp/vault-server';
import { loadConfig, getDbPath } from '../config.js';

/** Access token lifetime: 90 days */
const TOKEN_LIFETIME_SECONDS = 7_776_000;

export function registerTokenCommand(program: Command): void {
  const token = program
    .command('token')
    .description('Create and verify access tokens');

  // ── omxp token create ─────────────────────────────────────────────────────

  token
    .command('create')
    .description('Create a new access token for an app (dev helper)')
    .requiredOption('--app <id>', 'App ID (e.g. myapp, claude, cursor)')
    .requiredOption('--scopes <scopes>', 'Comma-separated scopes (e.g. read:all or read:facts,write:facts)')
    .option('--name <name>', 'Human-readable app name (defaults to app ID)')
    .action(async (opts: { app: string; scopes: string; name?: string }) => {
      const scopeList = opts.scopes.split(',').map((s) => s.trim());

      if (!validateScopes(scopeList)) {
        console.error(chalk.red('✗ Invalid scope(s).'));
        console.error(chalk.dim('  Valid: read:facts  read:preferences  read:context  read:skills'));
        console.error(chalk.dim('         read:goals  read:all  write:facts  write:preferences'));
        console.error(chalk.dim('         write:context  write:skills  write:all  delete:own  admin'));
        process.exit(1);
      }

      const config = loadConfig();
      const db = await createDatabase({ mode: 'local', sqlitePath: getDbPath() });

      try {
        const existing = await db.getPermissionByApp(config.vault_id, opts.app);

        if (existing) {
          console.error(chalk.red(`✗ App "${opts.app}" already has a permission grant.`));
          console.error(
            chalk.dim(`  Run "omxp permissions revoke ${opts.app}" first, then retry.`),
          );
          process.exit(1);
        }

        const accessToken = generateAccessToken();
        const refreshToken = generateRefreshToken();
        const now = new Date();
        const expiresAt = new Date(now.getTime() + TOKEN_LIFETIME_SECONDS * 1000);

        await db.createPermission({
          id: generateId('pg_'),
          vault_id: config.vault_id,
          app_id: opts.app,
          app_name: opts.name ?? opts.app,
          app_url: `cli://${opts.app}`,
          scopes: JSON.stringify(scopeList as OmxpScope[]),
          access_token: accessToken,
          refresh_token: refreshToken,
          auth_code: null,
          auth_code_expires_at: null,
          token_expires_at: expiresAt.toISOString(),
          granted_at: now.toISOString(),
          revoked: 0,
        });

        console.log('');
        console.log(chalk.green('✓ Token created'));
        console.log('');
        console.log(`  ${chalk.dim('App ID:   ')} ${chalk.bold(opts.app)}`);
        console.log(`  ${chalk.dim('Scopes:   ')} ${chalk.cyan(scopeList.join(', '))}`);
        console.log(`  ${chalk.dim('Expires:  ')} ${expiresAt.toLocaleDateString()} (90 days)`);
        console.log('');
        console.log(`  ${chalk.bold('Access token:')}`);
        console.log(`  ${chalk.green(accessToken)}`);
        console.log('');
        console.log(chalk.dim('  Use this in the Authorization: Bearer <token> header'));
        console.log(chalk.dim('  or: new OmxpClient({ accessToken: "..." })'));
        console.log('');
      } finally {
        await db.close();
      }
    });

  // ── omxp token verify ─────────────────────────────────────────────────────

  token
    .command('verify <token>')
    .description('Verify an access token and show its details')
    .action(async (rawToken: string) => {
      const config = loadConfig();
      const db = await createDatabase({ mode: 'local', sqlitePath: getDbPath() });

      try {
        const grant = await db.getPermissionByToken(rawToken);

        console.log('');

        if (!grant) {
          console.log(`  ${chalk.red('✗ Invalid or revoked token')}`);
          console.log('');
          process.exit(1);
        }

        if (grant.vault_id !== config.vault_id) {
          console.log(`  ${chalk.red('✗ Token belongs to a different vault')}`);
          console.log('');
          process.exit(1);
        }

        const isExpired = grant.token_expires_at
          ? new Date(grant.token_expires_at) < new Date()
          : false;

        if (isExpired) {
          console.log(`  ${chalk.yellow('⚠  Token is expired')}`);
        } else {
          console.log(`  ${chalk.green('✓ Token is valid')}`);
        }

        console.log('');
        console.log(`  ${chalk.dim('App ID:   ')} ${chalk.bold(grant.app_id)}`);
        console.log(`  ${chalk.dim('App Name: ')} ${grant.app_name}`);
        console.log(`  ${chalk.dim('Scopes:   ')} ${chalk.cyan((JSON.parse(grant.scopes) as string[]).join(', '))}`);
        console.log(`  ${chalk.dim('Granted:  ')} ${new Date(grant.granted_at).toLocaleString()}`);
        console.log(
          `  ${chalk.dim('Expires:  ')} ${
            grant.token_expires_at
              ? new Date(grant.token_expires_at).toLocaleString()
              : 'never'
          }`,
        );
        console.log(
          `  ${chalk.dim('Status:   ')} ${
            isExpired ? chalk.red('expired') : chalk.green('active')
          }`,
        );
        console.log('');
      } finally {
        await db.close();
      }
    });
}
