#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// OMXP CLI — Entry Point
// Registers all commands and delegates to Commander.
// ─────────────────────────────────────────────────────────────────────────────

import { Command } from 'commander';
import { registerInitCommand } from './commands/init.js';
import { registerServeCommand } from './commands/serve.js';
import { registerMemoryCommand } from './commands/memory.js';
import { registerPermissionsCommand } from './commands/permissions.js';
import { registerVaultCommand } from './commands/vault.js';
import { registerTokenCommand } from './commands/token.js';

const program = new Command();

program
  .name('omxp')
  .description('OMXP — Open Mind Exchange Protocol CLI\nManage your local AI memory vault.')
  .version('0.1.0', '-v, --version', 'Print version');

registerInitCommand(program);
registerServeCommand(program);
registerMemoryCommand(program);
registerPermissionsCommand(program);
registerVaultCommand(program);
registerTokenCommand(program);

program.parse();
