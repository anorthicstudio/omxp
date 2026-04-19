// ─────────────────────────────────────────────────────────────────────────────
// OMXP SDK — Client
// Main entry class. Uses native fetch — zero dependencies.
// Works in Node.js 18+, browsers, Deno, Bun, Cloudflare Workers.
// ─────────────────────────────────────────────────────────────────────────────

import { MemoryClient } from './memory.js';
import { AuthClient } from './auth.js';
import { FormatHelper, formatForPrompt as _formatForPrompt, groupByType as _groupByType } from './format.js';
import type { OmxpError, MemoryUnit, CreateMemoryInput, UpdateMemoryInput } from './index.js';
import type { MemoryListParams as ListMemoryOptions } from './memory.js';
import type { AuthorizeAppParams as AuthUrlOptions, ExchangeCodeParams as ExchangeCodeOptions } from './auth.js';

const _formatHelper = new FormatHelper();

// ─── Options ────────────────────────────────────────────────────────────────

export interface OmxpClientOptions {
  /** Base URL of the OMXP vault server (e.g. `http://localhost:4747/v1`) */
  vaultUrl: string;
  /** Bearer access token — obtain via the OAuth authorization flow */
  accessToken?: string;
}

// ─── Internal HTTP Types ────────────────────────────────────────────────────

export interface RequestOptions {
  params?: Record<string, string | undefined>;
  body?: unknown;
  headers?: Record<string, string>;
}

export type RequestFn = <T>(
  method: string,
  path: string,
  options?: RequestOptions,
) => Promise<T>;

// ─── Error ──────────────────────────────────────────────────────────────────

export class OmxpApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(data: OmxpError) {
    super(data.message);
    this.name = 'OmxpApiError';
    this.status = data.status;
    this.code = data.error;
  }
}

// ─── Client ─────────────────────────────────────────────────────────────────

export class OmxpClient {
  private vaultUrl: string;
  private accessToken: string;
  
  private _memoryClient: MemoryClient;
  private _authClient: AuthClient;

  constructor(config: {
    vaultUrl?: string;
    accessToken: string;
  }) {
    this.vaultUrl = config.vaultUrl || 'http://localhost:4747/v1';
    this.accessToken = config.accessToken;

    const requestFn: RequestFn = this.request.bind(this);
    this._memoryClient = new MemoryClient(requestFn);
    
    // Build baseUrl for AuthClient and request routing
    const baseUrl = this.vaultUrl.replace(/[\\/]+$/, '');
    this._authClient = new AuthClient(baseUrl);
  }

  // Memory operations
  memory = {
    list: (opts?: ListMemoryOptions) => this.listMemory(opts),
    create: (data: CreateMemoryInput) => this.createMemory(data),
    get: (id: string) => this.getMemory(id),
    update: (id: string, data: UpdateMemoryInput) => this.updateMemory(id, data),
    delete: (id: string) => this.deleteMemory(id),
  };

  // Auth helpers
  auth = {
    buildAuthorizationUrl: (opts: AuthUrlOptions) => this.buildAuthUrl(opts),
    exchangeCode: (opts: ExchangeCodeOptions) => this.exchangeCode(opts),
    revokeToken: () => this.revokeToken(),
  };

  // Formatting helpers
  format = {
    forPrompt: (units: MemoryUnit[], options?: import('./format.js').FormatOptions) => _formatForPrompt(units, options),
    forSystem: (units: MemoryUnit[], options?: import('./format.js').FormatOptions) => _formatHelper.forSystem(units, options),
    forCompact: (units: MemoryUnit[], options?: import('./format.js').FormatOptions) => _formatHelper.forCompact(units, options),
    groupByType: (units: MemoryUnit[]) => _groupByType(units),
  };

  private async listMemory(opts?: ListMemoryOptions) { return this._memoryClient.list(opts); }
  private async createMemory(data: CreateMemoryInput) { return this._memoryClient.create(data); }
  private async getMemory(id: string) { return this._memoryClient.get(id); }
  private async updateMemory(id: string, data: UpdateMemoryInput) { return this._memoryClient.update(id, data); }
  private async deleteMemory(id: string) { return this._memoryClient.delete(id); }

  private buildAuthUrl(opts: AuthUrlOptions) { return this._authClient.buildAuthorizationUrl(opts); }
  private async exchangeCode(opts: ExchangeCodeOptions) { return this._authClient.exchangeCode(opts); }
  private async revokeToken() { return this._authClient.revokeToken(this.accessToken); }

  /** Update the access token (e.g. after a refresh) */
  setAccessToken(token: string): void {
    this.accessToken = token;
  }

  /** Get the current access token */
  getAccessToken(): string {
    return this.accessToken;
  }

  /** Check whether the vault server is reachable */
  async health(): Promise<{ status: string; omxp_version: string; vault_id: string }> {
    const healthUrl = this.vaultUrl.replace(/[\\/]+$/, '').replace(/\/v1$/, '') + '/health';
    const res = await fetch(healthUrl);
    if (!res.ok) throw new OmxpApiError({ error: 'unreachable', message: 'Vault server unreachable', status: res.status });
    return res.json();
  }

  // ── Internal HTTP ───────────────────────────────────────────────────────

  async request<T>(method: string, path: string, options?: RequestOptions): Promise<T> {
    const baseUrl = this.vaultUrl.replace(/[\\/]+$/, '');
    const url = new URL(`${baseUrl}${path}`);

    if (options?.params) {
      for (const [key, value] of Object.entries(options.params)) {
        if (value !== undefined && value !== '') {
          url.searchParams.set(key, value);
        }
      }
    }

    const headers: Record<string, string> = {
      'Accept': 'application/json',
      ...options?.headers,
    };

    if (this.accessToken) {
      headers['Authorization'] = `Bearer ${this.accessToken}`;
    }

    if (options?.body !== undefined) {
      headers['Content-Type'] = 'application/json';
    }

    const response = await fetch(url.toString(), {
      method,
      headers,
      body: options?.body !== undefined ? JSON.stringify(options.body) : undefined,
    });

    if (!response.ok) {
      const errorBody: OmxpError = await response.json().catch(() => ({
        error: 'unknown_error',
        message: response.statusText || `HTTP ${response.status}`,
        status: response.status,
      }));
      throw new OmxpApiError(errorBody);
    }

    // 204 No Content
    if (response.status === 204 || response.headers.get('content-length') === '0') {
      return undefined as T;
    }

    return response.json() as Promise<T>;
  }
}
