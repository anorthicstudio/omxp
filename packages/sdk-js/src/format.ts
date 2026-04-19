// ─────────────────────────────────────────────────────────────────────────────
// OMXP SDK — Format Helper
// Transform memory units into text suitable for AI prompt injection.
// ─────────────────────────────────────────────────────────────────────────────

import type { MemoryUnit, MemoryType } from './index.js';

// ─── Labels ─────────────────────────────────────────────────────────────────

/** Human-readable plural labels used as section headers in formatted output. */
const SECTION_LABELS: Record<MemoryType, string> = {
  fact: 'Known facts',
  preference: 'User preferences',
  context: 'Current context',
  skill: 'Known skills',
  goal: 'Current goals',
  relationship: 'Relationships',
};

/** Render order for memory type sections. */
const TYPE_ORDER: MemoryType[] = [
  'fact',
  'preference',
  'context',
  'skill',
  'goal',
  'relationship',
];

// ─── Options ────────────────────────────────────────────────────────────────

export interface FormatOptions {
  /** Minimum confidence threshold — units below this are excluded (default: 0) */
  minConfidence?: number;
  /** Exclude expired context-type units (default: true) */
  excludeExpired?: boolean;
  /** Include source app attribution per item (default: false) */
  showSource?: boolean;
}

// ─── Standalone Utilities ───────────────────────────────────────────────────

/**
 * Group an array of MemoryUnits by their type.
 *
 * ```ts
 * const grouped = groupByType(units);
 * console.log(grouped.fact); // MemoryUnit[]
 * ```
 */
export function groupByType(units: MemoryUnit[]): Record<MemoryType, MemoryUnit[]> {
  const grouped: Record<MemoryType, MemoryUnit[]> = {
    fact: [],
    preference: [],
    context: [],
    skill: [],
    goal: [],
    relationship: [],
  };

  for (const unit of units) {
    if (grouped[unit.type]) {
      grouped[unit.type].push(unit);
    }
  }

  return grouped;
}

/**
 * Format memory units as a bracket-delimited context block for AI prompts.
 *
 * Output format:
 * ```
 * [OMXP USER CONTEXT]
 *
 * Known facts:
 * - User is a TypeScript developer
 *
 * User preferences:
 * - Prefers dark mode
 * [/OMXP USER CONTEXT]
 * ```
 *
 * This is the **critical feature** for integrating OMXP with any LLM.
 * Inject the returned string into your system prompt or prepend it to user messages.
 *
 * ```ts
 * import { formatForPrompt } from '@omxp/sdk';
 *
 * const context = formatForPrompt(memoryUnits);
 * const response = await ai.complete({
 *   system: context || 'You are a helpful assistant.',
 *   messages: [{ role: 'user', content: userMessage }],
 * });
 * ```
 */
export function formatForPrompt(units: MemoryUnit[], options?: FormatOptions): string {
  const filtered = filterUnits(units, options);
  if (filtered.length === 0) return '';

  const grouped = groupByType(filtered);
  const showSource = options?.showSource ?? false;
  const lines: string[] = ['[OMXP USER CONTEXT]'];

  for (const type of TYPE_ORDER) {
    const items = grouped[type];
    if (!items || items.length === 0) continue;

    lines.push(`\n${SECTION_LABELS[type]}:`);
    for (const unit of items) {
      const suffix = showSource ? ` (via ${unit.source_app})` : '';
      lines.push(`- ${unit.value}${suffix}`);
    }
  }

  lines.push('[/OMXP USER CONTEXT]');
  return lines.join('\n');
}

// ─── Filter Helper ──────────────────────────────────────────────────────────

function filterUnits(units: MemoryUnit[], options?: FormatOptions): MemoryUnit[] {
  const minConfidence = options?.minConfidence ?? 0;
  const excludeExpired = options?.excludeExpired ?? true;
  const now = new Date();

  return units.filter((u) => {
    if (u.confidence < minConfidence) return false;
    if (excludeExpired && u.expires_at && new Date(u.expires_at) < now) return false;
    return true;
  });
}

// ─── Format Helper Class ────────────────────────────────────────────────────

export class FormatHelper {
  /**
   * Format memory units as a bracket-delimited `[OMXP USER CONTEXT]` block
   * for injection into AI prompts.
   *
   * Delegates to the standalone `formatForPrompt` function.
   */
  forPrompt(units: MemoryUnit[], options?: FormatOptions): string {
    return formatForPrompt(units, options);
  }

  /**
   * Format as a system message — wraps forPrompt with instructional phrasing.
   *
   * ```ts
   * const systemCtx = client.format.forSystem(memoryUnits);
   * messages.unshift({ role: 'system', content: systemCtx });
   * ```
   */
  forSystem(units: MemoryUnit[], options?: FormatOptions): string {
    const prompt = this.forPrompt(units, options);
    if (!prompt) return '';

    return [
      'The following information is known about the user from their OMXP memory vault.',
      'Use this context to personalise your responses. Do not repeat this context back to the user unless asked.',
      '',
      prompt,
    ].join('\n');
  }

  /**
   * Format as a concise single-line summary.
   * Useful for token-constrained contexts or logging.
   */
  forCompact(units: MemoryUnit[], options?: FormatOptions): string {
    const filtered = filterUnits(units, options);
    if (filtered.length === 0) return '';

    const parts = filtered.map((u) => u.value);
    return `[OMXP Context] ${parts.join('. ')}.`;
  }

  /**
   * Group memory units by type.
   *
   * Delegates to the standalone `groupByType` function.
   */
  byType(units: MemoryUnit[]): Record<MemoryType, MemoryUnit[]> {
    return groupByType(units);
  }
}
