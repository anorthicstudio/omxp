// ─────────────────────────────────────────────────────────────────────────────
// OMXP Memory Routes — Memory Unit CRUD
// GET    /          — List memory units (filterable)
// POST   /          — Create a new memory unit
// GET    /:id       — Get a specific memory unit
// PUT    /:id       — Update a memory unit
// DELETE /:id       — Delete a memory unit (source app only)
// ─────────────────────────────────────────────────────────────────────────────

import { Hono } from 'hono';
import {
  CreateMemorySchema,
  UpdateMemorySchema,
  MemoryListQuerySchema,
  generateMemoryId,
  generateId,
  encryptMemory,
  decryptMemory,
  hasScope,
  readScopeFor,
  writeScopeFor,
  type MemoryType,
  type MemoryUnit,
} from '@omxp/core';
import type { MemoryUnitRow } from '../db.js';
import type { AppEnv, ServerConfig } from '../server.js';
import type { DatabaseAdapter } from '../db.js';
import { readRateLimit, writeRateLimit } from '../limiters.js';

/** Converts a MemoryUnitRow into a client-facing MemoryUnit */
function rowToUnit(row: MemoryUnitRow): MemoryUnit {
  return {
    id: row.id,
    type: row.type,
    value: row.value,
    source_app: row.source_app,
    confidence: row.confidence,
    created_at: row.created_at,
    updated_at: row.updated_at,
    expires_at: row.expires_at,
    tags: JSON.parse(row.tags),
    visibility: row.visibility,
  };
}

export function createMemoryRoutes(db: DatabaseAdapter, _config: ServerConfig): Hono<AppEnv> {
  const memory = new Hono<AppEnv>();

  // ── GET / — List Memory Units ──────────────────────────────────────────

  memory.get('/', readRateLimit, async (c) => {
    const auth = c.get('auth');
    const encryptionKey = c.get('encryptionKey');
    const parsed = MemoryListQuerySchema.safeParse(c.req.query());

    if (!parsed.success) {
      return c.json(
        { error: 'invalid_request', message: parsed.error.issues[0]?.message ?? 'Invalid query parameters', status: 400 },
        400,
      );
    }

    const query = parsed.data;

    // Parse comma-separated types and validate scope for each
    let types: MemoryType[] | undefined;
    if (query.types) {
      types = query.types.split(',').map((t) => t.trim()) as MemoryType[];
      for (const type of types) {
        if (!hasScope(auth.scopes, readScopeFor(type))) {
          return c.json(
            { error: 'forbidden', message: `Insufficient scope to read ${type} memory units`, status: 403 },
            403,
          );
        }
      }
    } else {
      // If no types specified, check for read:all
      if (!hasScope(auth.scopes, 'read:all')) {
        return c.json(
          { error: 'forbidden', message: 'Specify types or request read:all scope', status: 403 },
          403,
        );
      }
    }

    const tags = query.tags ? query.tags.split(',').map((t) => t.trim()) : undefined;

    const { units: rows, total } = await db.listMemoryUnits(auth.vault_id, {
      types,
      tags,
      source_app: query.source_app,
      visibility: query.visibility,
      limit: query.limit,
      offset: query.offset,
    });

    // Filter out private units from other apps
    const visible = rows.filter(
      (r) => r.visibility === 'shared' || r.source_app === auth.app_id,
    );

    // Decrypt values if they are encrypted, otherwise use plaintext
    const units = visible.map((r) => {
      if (r.value_encrypted) {
        const decrypted = decryptMemory(r.value_encrypted, encryptionKey);
        return { ...rowToUnit(r), value: decrypted };
      }
      return rowToUnit(r);
    });

    await db.logAction({
      id: generateId('al_'),
      vault_id: auth.vault_id,
      app_id: auth.app_id,
      action: 'read',
      memory_unit_id: null,
      timestamp: new Date().toISOString(),
    });

    return c.json({
      memory_units: units,
      total,
      page: Math.floor(query.offset / query.limit) + 1,
      limit: query.limit,
    });
  });

  // ── POST / — Create Memory Unit ────────────────────────────────────────

  memory.post('/', writeRateLimit, async (c) => {
    const auth = c.get('auth');
    const encryptionKey = c.get('encryptionKey');
    const body = await c.req.json().catch(() => ({}));
    const parsed = CreateMemorySchema.safeParse(body);

    if (!parsed.success) {
      return c.json(
        { error: 'invalid_request', message: parsed.error.issues[0]?.message ?? 'Invalid request body', status: 400 },
        400,
      );
    }

    const input = parsed.data;

    // Check write scope for this memory type
    if (!hasScope(auth.scopes, writeScopeFor(input.type))) {
      return c.json(
        { error: 'forbidden', message: `Insufficient scope to write ${input.type} memory units`, status: 403 },
        403,
      );
    }

    // Encrypt the value at rest
    const encryptedValue = encryptMemory(input.value, encryptionKey);
    const now = new Date().toISOString();
    const id = generateMemoryId();

    const row: MemoryUnitRow = {
      id,
      vault_id: auth.vault_id,
      type: input.type,
      value: input.value,
      value_encrypted: encryptedValue,
      source_app: auth.app_id,
      confidence: input.confidence,
      created_at: now,
      updated_at: now,
      expires_at: input.expires_at,
      tags: JSON.stringify(input.tags),
      visibility: input.visibility,
    };

    await db.createMemoryUnit(row);

    await db.logAction({
      id: generateId('al_'),
      vault_id: auth.vault_id,
      app_id: auth.app_id,
      action: 'write',
      memory_unit_id: id,
      timestamp: now,
    });

    return c.json(rowToUnit(row), 201);
  });

  // ── GET /:id — Get Single Memory Unit ──────────────────────────────────

  memory.get('/:id', readRateLimit, async (c) => {
    const auth = c.get('auth');
    const encryptionKey = c.get('encryptionKey');
    const id = c.req.param('id') as string;

    const row = await db.getMemoryUnit(auth.vault_id, id);

    if (!row) {
      return c.json(
        { error: 'not_found', message: 'Memory unit not found', status: 404 },
        404,
      );
    }

    // Check visibility
    if (row.visibility === 'private' && row.source_app !== auth.app_id) {
      return c.json(
        { error: 'not_found', message: 'Memory unit not found', status: 404 },
        404,
      );
    }

    // Check read scope
    if (!hasScope(auth.scopes, readScopeFor(row.type))) {
      return c.json(
        { error: 'forbidden', message: `Insufficient scope to read ${row.type} memory units`, status: 403 },
        403,
      );
    }

    // Decrypt if encrypted
    const unit = rowToUnit(row);
    if (row.value_encrypted) {
      unit.value = decryptMemory(row.value_encrypted, encryptionKey);
    }

    return c.json(unit);
  });

  // ── PUT /:id — Update Memory Unit ──────────────────────────────────────

  memory.put('/:id', writeRateLimit, async (c) => {
    const auth = c.get('auth');
    const encryptionKey = c.get('encryptionKey');
    const id = c.req.param('id') as string;
    const body = await c.req.json().catch(() => ({}));
    const parsed = UpdateMemorySchema.safeParse(body);

    if (!parsed.success) {
      return c.json(
        { error: 'invalid_request', message: parsed.error.issues[0]?.message ?? 'Invalid request body', status: 400 },
        400,
      );
    }

    const existing = await db.getMemoryUnit(auth.vault_id, id);

    if (!existing) {
      return c.json(
        { error: 'not_found', message: 'Memory unit not found', status: 404 },
        404,
      );
    }

    // Only the source app can update a memory unit
    if (existing.source_app !== auth.app_id) {
      return c.json(
        { error: 'forbidden', message: 'Only the source application can update a memory unit', status: 403 },
        403,
      );
    }

    // Check write scope
    if (!hasScope(auth.scopes, writeScopeFor(existing.type))) {
      return c.json(
        { error: 'forbidden', message: `Insufficient scope to write ${existing.type} memory units`, status: 403 },
        403,
      );
    }

    const input = parsed.data;
    const now = new Date().toISOString();
    const updates: Partial<MemoryUnitRow> = { updated_at: now };

    if (input.value !== undefined) {
      updates.value = input.value;
      updates.value_encrypted = encryptMemory(input.value, encryptionKey);
    }
    if (input.confidence !== undefined) updates.confidence = input.confidence;
    if (input.tags !== undefined) updates.tags = JSON.stringify(input.tags);
    if (input.visibility !== undefined) updates.visibility = input.visibility;
    if (input.expires_at !== undefined) updates.expires_at = input.expires_at;

    await db.updateMemoryUnit(auth.vault_id, id, updates);

    await db.logAction({
      id: generateId('al_'),
      vault_id: auth.vault_id,
      app_id: auth.app_id,
      action: 'write',
      memory_unit_id: id,
      timestamp: now,
    });

    const updated = await db.getMemoryUnit(auth.vault_id, id);
    if (!updated) {
      return c.json({ error: 'internal_error', message: 'Failed to read updated unit', status: 500 }, 500);
    }

    const unit = rowToUnit(updated);
    if (updated.value_encrypted) {
      unit.value = decryptMemory(updated.value_encrypted, encryptionKey);
    }

    return c.json(unit);
  });

  // ── DELETE /:id — Delete Memory Unit ───────────────────────────────────

  memory.delete('/:id', writeRateLimit, async (c) => {
    const auth = c.get('auth');
    const id = c.req.param('id') as string;

    const existing = await db.getMemoryUnit(auth.vault_id, id);

    if (!existing) {
      return c.json(
        { error: 'not_found', message: 'Memory unit not found', status: 404 },
        404,
      );
    }

    // Only the source app or admin can delete
    if (existing.source_app !== auth.app_id && !hasScope(auth.scopes, 'admin')) {
      if (!hasScope(auth.scopes, 'delete:own')) {
        return c.json(
          { error: 'forbidden', message: 'Insufficient scope — requires delete:own or admin', status: 403 },
          403,
        );
      }
      // delete:own only allows deleting units created by this app
      if (existing.source_app !== auth.app_id) {
        return c.json(
          { error: 'forbidden', message: 'Can only delete memory units created by your application', status: 403 },
          403,
        );
      }
    }

    await db.deleteMemoryUnit(auth.vault_id, id);

    await db.logAction({
      id: generateId('al_'),
      vault_id: auth.vault_id,
      app_id: auth.app_id,
      action: 'delete',
      memory_unit_id: id,
      timestamp: new Date().toISOString(),
    });

    return c.json({ success: true });
  });

  return memory;
}
