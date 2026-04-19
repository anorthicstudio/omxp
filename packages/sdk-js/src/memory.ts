// ─────────────────────────────────────────────────────────────────────────────
// OMXP SDK — Memory Client
// CRUD operations for Memory Units.
// ─────────────────────────────────────────────────────────────────────────────

import type { RequestFn } from './client.js';
import type {
  MemoryUnit,
  MemoryType,
  Visibility,
  CreateMemoryInput,
  UpdateMemoryInput,
  MemoryListResponse,
} from './index.js';

// ─── Query Parameters ───────────────────────────────────────────────────────

export interface MemoryListParams {
  /** Filter by memory types (e.g. `['fact', 'preference']`) */
  types?: MemoryType[];
  /** Filter by tags (returns units matching any listed tag) */
  tags?: string[];
  /** Filter by source application */
  source_app?: string;
  /** Filter by visibility */
  visibility?: Visibility;
  /** Max results per page (1–100, default 20) */
  limit?: number;
  /** Offset for pagination (default 0) */
  offset?: number;
}

// ─── Memory Client ──────────────────────────────────────────────────────────

export class MemoryClient {
  constructor(private readonly request: RequestFn) {}

  /**
   * List memory units with optional filters.
   *
   * ```ts
   * const { memory_units } = await client.memory.list({
   *   types: ['fact', 'preference'],
   *   limit: 50,
   * });
   * ```
   */
  async list(params?: MemoryListParams): Promise<MemoryListResponse> {
    const query: Record<string, string | undefined> = {};

    if (params?.types?.length) query['types'] = params.types.join(',');
    if (params?.tags?.length) query['tags'] = params.tags.join(',');
    if (params?.source_app) query['source_app'] = params.source_app;
    if (params?.visibility) query['visibility'] = params.visibility;
    if (params?.limit !== undefined) query['limit'] = String(params.limit);
    if (params?.offset !== undefined) query['offset'] = String(params.offset);

    return this.request<MemoryListResponse>('GET', '/memory', { params: query });
  }

  /**
   * Create a new memory unit.
   *
   * ```ts
   * const unit = await client.memory.create({
   *   type: 'fact',
   *   value: 'User prefers TypeScript',
   *   confidence: 0.9,
   *   tags: ['technical'],
   * });
   * ```
   */
  async create(input: CreateMemoryInput): Promise<MemoryUnit> {
    return this.request<MemoryUnit>('POST', '/memory', { body: input });
  }

  /** Get a single memory unit by ID */
  async get(id: string): Promise<MemoryUnit> {
    return this.request<MemoryUnit>('GET', `/memory/${encodeURIComponent(id)}`);
  }

  /** Update a memory unit (only the source application can update) */
  async update(id: string, input: UpdateMemoryInput): Promise<MemoryUnit> {
    return this.request<MemoryUnit>('PUT', `/memory/${encodeURIComponent(id)}`, { body: input });
  }

  /** Delete a memory unit (requires `delete:own` or `admin` scope) */
  async delete(id: string): Promise<void> {
    await this.request<void>('DELETE', `/memory/${encodeURIComponent(id)}`);
  }
}
