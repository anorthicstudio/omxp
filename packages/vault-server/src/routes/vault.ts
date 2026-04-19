// ─────────────────────────────────────────────────────────────────────────────
// OMXP Vault Routes — Vault Management
// GET    /              — Get vault metadata
// GET    /export        — Export complete vault as JSON
// GET    /permissions   — List all permission grants
// DELETE /              — Delete vault (destructive, requires admin scope)
// ─────────────────────────────────────────────────────────────────────────────

import { Hono } from 'hono';
import {
  OMXP_VERSION,
  hasScope,
  decryptMemory,
  generateId,
  type MemoryUnit,
  type OmxpScope,
} from '@omxp/core';
import type { AppEnv, ServerConfig } from '../server.js';
import type { DatabaseAdapter } from '../db.js';
import { readRateLimit, writeRateLimit } from '../limiters.js';

export function createVaultRoutes(db: DatabaseAdapter, _config: ServerConfig): Hono<AppEnv> {
  const vault = new Hono<AppEnv>();

  // ── GET / — Vault Metadata ─────────────────────────────────────────────

  vault.get('/', readRateLimit, async (c) => {
    const auth = c.get('auth');

    const row = await db.getVault(auth.vault_id);

    if (!row) {
      return c.json(
        { error: 'not_found', message: 'Vault not found', status: 404 },
        404,
      );
    }

    // Count memory units and active permissions
    const { total: memoryCount } = await db.listMemoryUnits(auth.vault_id, {
      limit: 1,
      offset: 0,
    });

    const permissions = await db.listPermissions(auth.vault_id);
    const activePermissions = permissions.filter((p) => p.revoked === 0);

    return c.json({
      omxp_version: OMXP_VERSION,
      vault_id: row.id,
      public_key: row.public_key,
      created_at: row.created_at,
      updated_at: row.updated_at,
      metadata: {
        display_name: row.display_name,
        schema_version: row.schema_version,
      },
      stats: {
        memory_units: memoryCount,
        active_permissions: activePermissions.length,
        total_permissions: permissions.length,
      },
    });
  });

  // ── GET /export — Full Vault Export ─────────────────────────────────────

  vault.get('/export', readRateLimit, async (c) => {
    const auth = c.get('auth');
    const encryptionKey = c.get('encryptionKey');

    // Export requires admin scope
    if (!hasScope(auth.scopes, 'admin')) {
      return c.json(
        { error: 'forbidden', message: 'Vault export requires admin scope', status: 403 },
        403,
      );
    }

    const row = await db.getVault(auth.vault_id);
    if (!row) {
      return c.json({ error: 'not_found', message: 'Vault not found', status: 404 }, 404);
    }

    // Fetch all memory units (paginate through all)
    const allUnits: MemoryUnit[] = [];
    let offset = 0;
    const batchSize = 100;

    while (true) {
      const { units: batch } = await db.listMemoryUnits(auth.vault_id, {
        limit: batchSize,
        offset,
      });

      if (batch.length === 0) break;

      for (const r of batch) {
        // Use decrypted value if encrypted, otherwise use plaintext
        let value = r.value;
        if (r.value_encrypted) {
          value = decryptMemory(r.value_encrypted, encryptionKey);
        }

        allUnits.push({
          id: r.id,
          type: r.type,
          value,
          source_app: r.source_app,
          confidence: r.confidence,
          created_at: r.created_at,
          updated_at: r.updated_at,
          expires_at: r.expires_at,
          tags: JSON.parse(r.tags),
          visibility: r.visibility,
        });
      }

      offset += batchSize;
    }

    // Fetch permissions (strip sensitive fields)
    const permissions = await db.listPermissions(auth.vault_id);
    const permissionsMap: Record<string, object> = {};

    for (const p of permissions) {
      permissionsMap[p.app_id] = {
        app_name: p.app_name,
        app_url: p.app_url,
        granted_at: p.granted_at,
        scopes: JSON.parse(p.scopes) as OmxpScope[],
        token_expires_at: p.token_expires_at,
        revoked: p.revoked === 1,
      };
    }

    await db.logAction({
      id: generateId('al_'),
      vault_id: auth.vault_id,
      app_id: auth.app_id,
      action: 'read',
      memory_unit_id: null,
      timestamp: new Date().toISOString(),
    });

    return c.json({
      omxp_version: OMXP_VERSION,
      vault_id: row.id,
      public_key: row.public_key,
      created_at: row.created_at,
      updated_at: row.updated_at,
      memory_units: allUnits,
      permissions: permissionsMap,
      metadata: {
        display_name: row.display_name,
        schema_version: row.schema_version,
      },
      exported_at: new Date().toISOString(),
    });
  });

  // ── GET /permissions — List Permission Grants ──────────────────────────

  vault.get('/permissions', readRateLimit, async (c) => {
    const auth = c.get('auth');

    const permissions = await db.listPermissions(auth.vault_id);

    const grants = permissions.map((p) => ({
      app_id: p.app_id,
      app_name: p.app_name,
      app_url: p.app_url,
      granted_at: p.granted_at,
      scopes: JSON.parse(p.scopes) as OmxpScope[],
      token_expires_at: p.token_expires_at,
      revoked: p.revoked === 1,
    }));

    return c.json({ permissions: grants, total: grants.length });
  });

  // ── DELETE / — Delete Vault ────────────────────────────────────────────

  vault.delete('/', writeRateLimit, async (c) => {
    const auth = c.get('auth');

    // Vault deletion requires admin scope
    if (!hasScope(auth.scopes, 'admin')) {
      return c.json(
        { error: 'forbidden', message: 'Vault deletion requires admin scope', status: 403 },
        403,
      );
    }

    const body = await c.req.json().catch(() => ({}));

    if (body.confirmation_token !== auth.vault_id) {
      return c.json(
        {
          error: 'invalid_request',
          message: 'Must pass confirmation_token in body equal to vault_id',
          status: 400,
        },
        400,
      );
    }

    await db.logAction({
      id: generateId('al_'),
      vault_id: auth.vault_id,
      app_id: auth.app_id,
      action: 'delete',
      memory_unit_id: null,
      timestamp: new Date().toISOString(),
    });

    await db.deleteVault(auth.vault_id);

    return c.json({ success: true });
  });

  return vault;
}
