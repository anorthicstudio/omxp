// ─────────────────────────────────────────────────────────────────────────────
// OMXP SDK — Auth Client
// OAuth 2.0 authorization flow helpers.
// ─────────────────────────────────────────────────────────────────────────────

import type { OmxpScope, TokenResponse, OmxpError } from './index.js';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface AuthorizeAppParams {
  /** Unique identifier for your application */
  appId: string;
  /** Human-readable name shown during the approval prompt */
  appName: string;
  /** Scopes your application is requesting */
  scopes: OmxpScope[];
  /** URL the user is redirected to after approval */
  redirectUri: string;
  /** CSRF protection token (recommended) */
  state?: string;
}

export interface ExchangeCodeParams {
  /** Authorization code received via redirect callback */
  code: string;
  /** Must match the redirect_uri used during authorization */
  redirectUri?: string;
}

export interface AuthorizeResponse {
  authorization_url: string;
  code: string;
  message: string;
  scopes: OmxpScope[];
  expires_in: number;
}

// ─── Auth Client ────────────────────────────────────────────────────────────

export class AuthClient {
  constructor(private readonly baseUrl: string) {}

  /**
   * Build the authorization URL to redirect the user to.
   *
   * ```ts
   * const url = client.auth.buildAuthorizationUrl({
   *   appId: 'my-app',
   *   appName: 'My App',
   *   scopes: ['read:facts', 'read:preferences'],
   *   redirectUri: 'https://myapp.com/callback',
   * });
   * // Redirect user to `url`
   * ```
   */
  buildAuthorizationUrl(params: AuthorizeAppParams): string {
    const url = new URL(`${this.baseUrl}/authorize`);
    url.searchParams.set('app_id', params.appId);
    url.searchParams.set('app_name', params.appName);
    url.searchParams.set('scopes', params.scopes.join(','));
    url.searchParams.set('redirect_uri', params.redirectUri);
    if (params.state) url.searchParams.set('state', params.state);
    return url.toString();
  }

  /**
   * Request authorization directly (for local vault / development).
   * Returns the authorization code without requiring a redirect.
   */
  async authorize(params: AuthorizeAppParams): Promise<AuthorizeResponse> {
    const url = this.buildAuthorizationUrl(params);
    const res = await fetch(url);
    if (!res.ok) {
      const err: OmxpError = await res.json().catch(() => ({
        error: 'auth_failed', message: res.statusText, status: res.status,
      }));
      throw new Error(`Authorization failed: ${err.message}`);
    }
    return res.json();
  }

  /**
   * Exchange an authorization code for an access token.
   *
   * ```ts
   * const { access_token } = await client.auth.exchangeCode({
   *   code: 'abc123',
   * });
   * client.setAccessToken(access_token);
   * ```
   */
  async exchangeCode(params: ExchangeCodeParams): Promise<TokenResponse> {
    const res = await fetch(`${this.baseUrl}/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code: params.code,
        redirect_uri: params.redirectUri,
      }),
    });

    if (!res.ok) {
      const err: OmxpError = await res.json().catch(() => ({
        error: 'token_exchange_failed', message: res.statusText, status: res.status,
      }));
      throw new Error(`Token exchange failed: ${err.message}`);
    }

    return res.json();
  }

  /**
   * Revoke an access token. Revocation is immediate and irreversible.
   */
  async revokeToken(token: string): Promise<void> {
    const res = await fetch(`${this.baseUrl}/token/revoke`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    });

    if (!res.ok) {
      const err: OmxpError = await res.json().catch(() => ({
        error: 'revoke_failed', message: res.statusText, status: res.status,
      }));
      throw new Error(`Token revocation failed: ${err.message}`);
    }
  }
}
