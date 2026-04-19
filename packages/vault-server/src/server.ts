// ─────────────────────────────────────────────────────────────────────────────
// OMXP Vault Server — Hono Application
// ─────────────────────────────────────────────────────────────────────────────

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import type { Context, Next } from 'hono';
import { OMXP_VERSION, type AuthContext, type OmxpScope } from '@omxp/core';
import type { DatabaseAdapter } from './db.js';
import { createAuthRoutes } from './routes/auth.js';
import { createMemoryRoutes } from './routes/memory.js';
import { createVaultRoutes } from './routes/vault.js';

// ─── Hono Environment Typing ────────────────────────────────────────────────

export type AppEnv = {
  Variables: {
    auth: AuthContext;
    db: DatabaseAdapter;
    vaultId: string;
    encryptionKey: Buffer;
  };
};

// ─── Server Configuration ───────────────────────────────────────────────────

export interface ServerConfig {
  /** Vault ID for this server instance */
  vaultId: string;
  /** AES-256 encryption key derived from the user's private key */
  encryptionKey: Buffer;
}

// ─── Auth Middleware ────────────────────────────────────────────────────────

/**
 * Bearer token authentication middleware.
 * Extracts the token from the Authorization header, verifies it against
 * the database, and attaches the auth context to the request.
 */
export function authMiddleware(db: DatabaseAdapter) {
  return async (c: Context<AppEnv>, next: Next): Promise<Response | void> => {
    const header = c.req.header('Authorization');

    if (!header || !header.startsWith('Bearer ')) {
      return c.json(
        { error: 'unauthorized', message: 'Missing or invalid Authorization header', status: 401 },
        401,
      );
    }

    const token = header.slice(7);

    // Look up permission by raw access token (stored directly in DB per spec)
    const permission = await db.getPermissionByToken(token);

    if (!permission) {
      return c.json(
        { error: 'unauthorized', message: 'Invalid or revoked token', status: 401 },
        401,
      );
    }

    if (permission.token_expires_at && new Date(permission.token_expires_at) < new Date()) {
      return c.json(
        { error: 'unauthorized', message: 'Token expired — request a new token via /authorize', status: 401 },
        401,
      );
    }

    const scopes: OmxpScope[] = JSON.parse(permission.scopes);

    c.set('auth', {
      vault_id: permission.vault_id,
      app_id: permission.app_id,
      app_name: permission.app_name,
      scopes,
    });

    await next();
  };
}

// ─── App Factory ────────────────────────────────────────────────────────────

export function createApp(db: DatabaseAdapter, config: ServerConfig): Hono<AppEnv> {
  const app = new Hono<AppEnv>();

  // ── Global Middleware ──────────────────────────────────────────────────

  app.use('*', logger());

  app.use('*', cors({
    origin: '*',
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
    exposeHeaders: ['X-OMXP-Version'],
    maxAge: 86400,
  }));

  // Inject shared context into every request
  app.use('*', async (c: Context<AppEnv>, next: Next) => {
    c.set('db', db);
    c.set('vaultId', config.vaultId);
    c.set('encryptionKey', config.encryptionKey);
    c.header('X-OMXP-Version', OMXP_VERSION);
    await next();
  });

  // ── Health Check ───────────────────────────────────────────────────────

  app.get('/health', (c) =>
    c.json({
      status: 'ok',
      omxp_version: OMXP_VERSION,
      vault_id: config.vaultId,
      timestamp: new Date().toISOString(),
    }),
  );

  // ── Mount API Routes at /omxp/v1 ──────────────────────────────────────

  const api = new Hono<AppEnv>();

  // Auth routes — no auth middleware needed (they issue tokens)
  api.route('/', createAuthRoutes(db, config));

  // Memory routes — require valid auth token
  const memoryRoutes = createMemoryRoutes(db, config);
  api.use('/memory/*', authMiddleware(db));
  api.use('/memory', authMiddleware(db));
  api.route('/memory', memoryRoutes);

  // Vault routes — require valid auth token
  const vaultRoutes = createVaultRoutes(db, config);
  api.use('/vault/*', authMiddleware(db));
  api.use('/vault', authMiddleware(db));
  api.route('/vault', vaultRoutes);

  app.route('/v1', api);

  // ── 404 Fallback ───────────────────────────────────────────────────────

  app.notFound((c) =>
    c.json({ error: 'not_found', message: 'Route not found', status: 404 }, 404),
  );

  // ── Global Error Handler ───────────────────────────────────────────────

  app.onError((err, c) => {
    console.error('[OMXP Error]', err.message);
    return c.json(
      { error: 'internal_error', message: err.message, status: 500 },
      500,
    );
  });

  return app;
}
