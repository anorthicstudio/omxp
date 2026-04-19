// ─────────────────────────────────────────────────────────────────────────────
// OMXP Auth Routes — Custom OAuth 2.0 Implementation
// GET  /authorize       — Initiate permission grant flow
// POST /authorize       — Approve permission (form submit)
// POST /token           — Exchange auth code for access token
// POST /token/revoke    — Revoke an access token
// POST /token/refresh   — Refresh an access token
// ─────────────────────────────────────────────────────────────────────────────

import { Hono } from 'hono';
import { html } from 'hono/html';
import {
  AuthorizeParamsSchema,
  TokenExchangeSchema,
  TokenRevokeSchema,
  TokenRefreshSchema,
  parseScopesString,
  generateAccessToken,
  generateRefreshToken,
  generateAuthCode,
  generateId,
} from '@omxp/core';
import type { DatabaseAdapter } from '../db.js';
import type { AppEnv, ServerConfig } from '../server.js';
import { authRateLimit } from '../limiters.js';

/** Access token lifetime: 90 days in seconds */
const TOKEN_LIFETIME_SECONDS = 7776000;

/** Auth code validity: 10 minutes */
const AUTH_CODE_LIFETIME_MS = 600000;

/** Refresh token lifetime: 365 days in ms */
const REFRESH_TOKEN_LIFETIME_MS = 31536000000;

export function createAuthRoutes(db: DatabaseAdapter, config: ServerConfig): Hono<AppEnv> {
  const auth = new Hono<AppEnv>();

  // Apply auth rate limiting
  auth.use('*', authRateLimit);

  // ── GET /authorize — Initiate OAuth Permission Grant ───────────────────

  auth.get('/authorize', async (c) => {
    // Manually parse query parameters since we have app_url which wasn't strictly in AuthorizeParamsSchema
    const query = c.req.query();
    const parsed = AuthorizeParamsSchema.safeParse(query);

    if (!parsed.success) {
      return c.json(
        { error: 'invalid_request', message: parsed.error.issues[0]?.message ?? 'Invalid parameters', status: 400 },
        400,
      );
    }

    const { app_id, app_name, scopes: scopesRaw, redirect_uri, state } = parsed.data;
    const app_url = query['app_url'] ?? '';

    // Validate scopes
    const scopesParsed = parseScopesString(scopesRaw);
    if (!scopesParsed.success) {
      return c.json(
        { error: 'invalid_scope', message: `Unrecognised scopes. Valid scopes: read:facts, read:preferences, read:all, write:facts, etc.`, status: 400 },
        400,
      );
    }

    const scopes = scopesParsed.data;

    // Render HTML page showing permission grant UI
    return c.html(
      html`<!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Authorize ${app_name} | OMXP Vault</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background: #fafafa; color: #333; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; }
          .card { background: white; padding: 2rem; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); max-width: 400px; width: 100%; }
          h1 { margin-top: 0; font-size: 1.5rem; text-align: center; }
          .scopes { background: #f0f4f8; padding: 1rem; border-radius: 8px; font-family: monospace; font-size: 0.875rem; color: #1e3a8a; margin: 1.5rem 0; word-break: break-word; }
          .actions { display: flex; gap: 1rem; margin-top: 2rem; }
          button { flex: 1; padding: 0.75rem; border: none; border-radius: 6px; font-weight: bold; cursor: pointer; transition: all 0.2s; }
          .btn-approve { background: #3b82f6; color: white; }
          .btn-approve:hover { background: #2563eb; }
          .btn-deny { background: #e5e7eb; color: #4b5563; }
          .btn-deny:hover { background: #d1d5db; }
          .form-hidden { display: none; }
        </style>
      </head>
      <body>
        <div class="card">
          <h1>Authorize Application</h1>
          <p><strong>${app_name}</strong> is requesting access to your mind vault.</p>
          <div class="scopes">
            ${scopes.join('<br>')}
          </div>
          <form method="POST" action="/v1/authorize">
            <input type="hidden" name="app_id" value="${app_id}">
            <input type="hidden" name="app_name" value="${app_name}">
            <input type="hidden" name="app_url" value="${app_url}">
            <input type="hidden" name="scopes" value="${scopesRaw}">
            <input type="hidden" name="redirect_uri" value="${redirect_uri}">
            ${state ? html`<input type="hidden" name="state" value="${state}">` : ''}
            <div class="actions">
              <button type="button" class="btn-deny" onclick="window.history.back()">Cancel</button>
              <button type="submit" class="btn-approve">Approve Access</button>
            </div>
          </form>
        </div>
      </body>
      </html>`
    );
  });

  // POST /authorize - Handle the form submission from the HTML UI
  auth.post('/authorize', async (c) => {
    const body = await c.req.parseBody();
    const query = {
      app_id: body['app_id'] as string,
      app_name: body['app_name'] as string,
      scopes: body['scopes'] as string,
      redirect_uri: body['redirect_uri'] as string,
      state: body['state'] as string | undefined,
    };
    
    const parsed = AuthorizeParamsSchema.safeParse(query);
    if (!parsed.success) {
      return c.json({ error: 'invalid_request', message: 'Invalid form validation', status: 400 }, 400);
    }
    
    const { app_id, app_name, scopes: scopesRaw, redirect_uri, state } = parsed.data;
    const app_url = (body['app_url'] as string) || '';
    const scopes = parseScopesString(scopesRaw).data!;

    // Generate an auth code and store it in the permission_grants row
    const code = generateAuthCode();
    const now = new Date();
    const codeExpiresAt = new Date(now.getTime() + AUTH_CODE_LIFETIME_MS);

    await db.createPermission({
      id: generateId('pg_'),
      vault_id: config.vaultId,
      app_id,
      app_name,
      app_url,
      scopes: JSON.stringify(scopes),
      access_token: null,
      refresh_token: null,
      auth_code: code,
      auth_code_expires_at: codeExpiresAt.toISOString(),
      token_expires_at: null,
      granted_at: now.toISOString(),
      revoked: 0,
    });

    await db.logAction({
      id: generateId('al_'),
      vault_id: config.vaultId,
      app_id,
      action: 'grant',
      memory_unit_id: null,
      timestamp: now.toISOString(),
    });

    const redirectUrl = new URL(redirect_uri);
    redirectUrl.searchParams.set('code', code);
    if (state) redirectUrl.searchParams.set('state', state);

    return c.redirect(redirectUrl.toString());
  });

  // ── POST /token — Exchange Code for Access Token ───────────────────────

  auth.post('/token', async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const parsed = TokenExchangeSchema.safeParse(body);

    if (!parsed.success) {
      return c.json(
        { error: 'invalid_request', message: parsed.error.issues[0]?.message ?? 'Invalid request body', status: 400 },
        400,
      );
    }

    const { code } = parsed.data;

    // Look up the permission grant by auth code
    const permission = await db.getPermissionByAuthCode(code);

    if (!permission) {
      return c.json(
        { error: 'invalid_grant', message: 'Authorization code is invalid or has already been used', status: 400 },
        400,
      );
    }

    // Check auth code expiry
    if (permission.auth_code_expires_at && new Date(permission.auth_code_expires_at) < new Date()) {
      return c.json(
        { error: 'invalid_grant', message: 'Authorization code has expired', status: 400 },
        400,
      );
    }

    // Generate tokens
    const accessToken = generateAccessToken();
    const refreshToken = generateRefreshToken();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + TOKEN_LIFETIME_SECONDS * 1000);

    // Update the permission grant: set tokens, clear auth code (one-time use)
    await db.updatePermission(permission.vault_id, permission.app_id, {
      access_token: accessToken,
      refresh_token: refreshToken,
      auth_code: null,
      auth_code_expires_at: null,
      token_expires_at: expiresAt.toISOString(),
    });

    await db.logAction({
      id: generateId('al_'),
      vault_id: permission.vault_id,
      app_id: permission.app_id,
      action: 'grant',
      memory_unit_id: null,
      timestamp: now.toISOString(),
    });

    const scopes = JSON.parse(permission.scopes);

    return c.json({
      access_token: accessToken,
      refresh_token: refreshToken,
      token_type: 'Bearer' as const,
      expires_in: TOKEN_LIFETIME_SECONDS,
      scopes,
    });
  });

  // ── POST /token/revoke — Revoke an Access Token ────────────────────────

  auth.post('/token/revoke', async (c) => {
    const authHeader = c.req.header('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return c.json({ error: 'unauthorized', message: 'Missing Bearer token', status: 401 }, 401);
    }

    const bearerToken = authHeader.slice(7);
    const body = await c.req.json().catch(() => ({}));
    const parsed = TokenRevokeSchema.safeParse(body);

    if (!parsed.success) {
      return c.json(
        { error: 'invalid_request', message: 'Missing or invalid token', status: 400 },
        400,
      );
    }

    const { token } = parsed.data;

    // Verify the caller is authenticated
    const callerPermission = await db.getPermissionByToken(bearerToken);
    if (!callerPermission) {
      return c.json({ error: 'unauthorized', message: 'Invalid Bearer token', status: 401 }, 401);
    }

    // Attempt to revoke the specified token
    const toRevoke = await db.getPermissionByToken(token);
    if (toRevoke && toRevoke.app_id === callerPermission.app_id) {
      await db.revokePermission(toRevoke.vault_id, toRevoke.app_id);

      await db.logAction({
        id: generateId('al_'),
        vault_id: toRevoke.vault_id,
        app_id: toRevoke.app_id,
        action: 'revoke',
        memory_unit_id: null,
        timestamp: new Date().toISOString(),
      });
    }

    return c.json({ success: true });
  });

  // ── POST /token/refresh — Exchange Refresh Token for New Access Token ──

  auth.post('/token/refresh', async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const parsed = TokenRefreshSchema.safeParse(body);

    if (!parsed.success) {
      return c.json(
        { error: 'invalid_request', message: 'Missing or invalid refresh_token', status: 400 },
        400,
      );
    }

    const { refresh_token } = parsed.data;

    const permission = await db.getPermissionByRefreshToken(refresh_token);

    if (!permission) {
      return c.json(
        { error: 'invalid_grant', message: 'Refresh token is invalid or has been revoked', status: 400 },
        400,
      );
    }

    const grantedAt = new Date(permission.granted_at);
    const now = new Date();

    if (now.getTime() - grantedAt.getTime() > REFRESH_TOKEN_LIFETIME_MS) {
      return c.json(
        { error: 'invalid_grant', message: 'Refresh token has expired', status: 400 },
        400,
      );
    }

    // Issue a new access token (refresh token stays the same)
    const newAccessToken = generateAccessToken();
    const expiresAt = new Date(now.getTime() + TOKEN_LIFETIME_SECONDS * 1000);

    await db.updatePermission(permission.vault_id, permission.app_id, {
      access_token: newAccessToken,
      token_expires_at: expiresAt.toISOString(),
    });

    await db.logAction({
      id: generateId('al_'),
      vault_id: permission.vault_id,
      app_id: permission.app_id,
      action: 'grant',
      memory_unit_id: null,
      timestamp: now.toISOString(),
    });

    return c.json({
      access_token: newAccessToken,
      token_type: 'Bearer' as const,
      expires_in: TOKEN_LIFETIME_SECONDS,
    });
  });

  return auth;
}
