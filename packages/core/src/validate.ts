// ─────────────────────────────────────────────────────────────────────────────
// OMXP Schema Validation
// Zod schemas for all protocol inputs
// ─────────────────────────────────────────────────────────────────────────────

import { z } from 'zod';
import { MEMORY_TYPES, VISIBILITY_TYPES, SCOPES } from './types.js';

// ─── Primitives ─────────────────────────────────────────────────────────────

export const MemoryTypeSchema = z.enum(MEMORY_TYPES);
export const VisibilitySchema = z.enum(VISIBILITY_TYPES);
export const ScopeSchema = z.enum(SCOPES);

// ─── Memory Schemas ─────────────────────────────────────────────────────────

export const CreateMemorySchema = z.object({
  type: MemoryTypeSchema,
  value: z.string().min(1, 'Value must not be empty').max(10_000),
  confidence: z.number().min(0).max(1).default(1.0),
  tags: z.array(z.string().max(100)).max(20).default([]),
  visibility: VisibilitySchema.default('shared'),
  expires_at: z.string().datetime().nullable().default(null),
});

export const UpdateMemorySchema = z.object({
  value: z.string().min(1).max(10_000).optional(),
  confidence: z.number().min(0).max(1).optional(),
  tags: z.array(z.string().max(100)).max(20).optional(),
  visibility: VisibilitySchema.optional(),
  expires_at: z.string().datetime().nullable().optional(),
});

export type CreateMemoryParsed = z.infer<typeof CreateMemorySchema>;
export type UpdateMemoryParsed = z.infer<typeof UpdateMemorySchema>;

// ─── Auth Schemas ───────────────────────────────────────────────────────────

export const AuthorizeParamsSchema = z.object({
  app_id: z.string().min(1).max(255),
  app_name: z.string().min(1).max(255),
  scopes: z.string().min(1),
  redirect_uri: z.string().url(),
  state: z.string().max(1024).optional(),
});

export const TokenExchangeSchema = z.object({
  code: z.string().min(1),
  redirect_uri: z.string().url().optional(),
});

export const TokenRefreshSchema = z.object({
  refresh_token: z.string().min(1),
});

export const TokenRevokeSchema = z.object({
  token: z.string().min(1),
});

// ─── Query Schemas ──────────────────────────────────────────────────────────

export const MemoryListQuerySchema = z.object({
  types: z.string().optional(),
  tags: z.string().optional(),
  source_app: z.string().optional(),
  visibility: VisibilitySchema.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

export type MemoryListQueryParsed = z.infer<typeof MemoryListQuerySchema>;

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Parses a comma-separated scopes string and validates each scope.
 * Returns the validated scope array or null if any scope is invalid.
 */
export function parseScopesString(raw: string): z.SafeParseReturnType<string[], z.infer<typeof ScopeSchema>[]> {
  const parts = raw.split(',').map((s) => s.trim()).filter(Boolean);
  const schema = z.array(ScopeSchema);
  return schema.safeParse(parts);
}
