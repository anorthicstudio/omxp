# @omxp/sdk

> JavaScript / TypeScript SDK for the **Open Mind Exchange Protocol (OMXP)**.
> Zero dependencies — works in Node.js 18+, browsers, Deno, Bun, and Cloudflare Workers.

```
npm install @omxp/sdk
```

---

## Quick Start

```typescript
import { OmxpClient } from '@omxp/sdk';

const omxp = new OmxpClient({
  accessToken: process.env.OMXP_TOKEN!,
  vaultUrl: 'http://localhost:4747',    // default
});

// List memory units
const { memory_units } = await omxp.memory.list({
  types: ['fact', 'preference'],
  limit: 50,
});

// Create a memory unit
await omxp.memory.create({
  type: 'fact',
  value: 'User prefers TypeScript over JavaScript',
  confidence: 0.95,
  tags: ['technical', 'language'],
});
```

---

## Integration with AI Models

The primary use-case for the SDK is injecting user memory into AI prompts.
The `format.forPrompt()` method produces a bracket-delimited context block
that any LLM can parse cleanly:

```
[OMXP USER CONTEXT]

Known facts:
- User is a TypeScript developer
- User works at Acme Corp

User preferences:
- Prefers dark mode
- Likes concise responses

Current context:
- Working on a React project
[/OMXP USER CONTEXT]
```

### Claude (Anthropic) Integration

```typescript
import { OmxpClient } from '@omxp/sdk';
import Anthropic from '@anthropic-ai/sdk';

const omxp = new OmxpClient({
  accessToken: process.env.OMXP_TOKEN!,
});

const anthropic = new Anthropic();

async function chatWithMemory(userMessage: string) {
  // 1. Read user memory from vault
  const memory = await omxp.memory.list({
    types: ['fact', 'preference', 'context'],
    visibility: 'shared',
  });

  // 2. Format memory as context
  const context = omxp.format.forPrompt(memory.memory_units);

  // 3. Call Claude with memory context
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    system: context || 'You are a helpful assistant.',
    messages: [{ role: 'user', content: userMessage }],
  });

  const aiResponse =
    response.content[0].type === 'text' ? response.content[0].text : '';

  // 4. Write new context discovered during conversation
  await omxp.memory.create({
    type: 'context',
    value: `User asked about: ${userMessage.slice(0, 100)}`,
    confidence: 0.7,
    tags: ['conversation'],
    expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  });

  return aiResponse;
}
```

### OpenAI Integration

```typescript
import { OmxpClient } from '@omxp/sdk';
import OpenAI from 'openai';

const omxp = new OmxpClient({ accessToken: process.env.OMXP_TOKEN! });
const openai = new OpenAI();

async function chatWithMemory(userMessage: string) {
  const memory = await omxp.memory.list({ visibility: 'shared' });
  const context = omxp.format.forSystem(memory.memory_units);

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: context || 'You are a helpful assistant.' },
      { role: 'user', content: userMessage },
    ],
  });

  return response.choices[0]?.message?.content ?? '';
}
```

### Standalone `formatForPrompt`

You can also import the formatting function directly — no client instance required:

```typescript
import { formatForPrompt } from '@omxp/sdk';

const block = formatForPrompt(memoryUnits);
// => "[OMXP USER CONTEXT]\n\nKnown facts:\n- ...\n[/OMXP USER CONTEXT]"
```

---

## API Reference

### `OmxpClient`

```typescript
const client = new OmxpClient({
  accessToken: string;      // Bearer token from OAuth flow
  vaultUrl?: string;        // Default: 'http://localhost:4747'
});
```

### Memory Operations

| Method | Description |
|---|---|
| `client.memory.list(params?)` | List memory units with optional filters |
| `client.memory.create(input)` | Create a new memory unit |
| `client.memory.get(id)` | Get a single memory unit by ID |
| `client.memory.update(id, input)` | Update a memory unit |
| `client.memory.delete(id)` | Delete a memory unit |

#### List Parameters

```typescript
interface MemoryListParams {
  types?: MemoryType[];     // 'fact' | 'preference' | 'context' | 'skill' | 'goal' | 'relationship'
  tags?: string[];          // Filter by tags (OR match)
  source_app?: string;      // Filter by source application
  visibility?: Visibility;  // 'shared' | 'private'
  limit?: number;           // 1–100, default 20
  offset?: number;          // Pagination offset
}
```

#### Create Input

```typescript
interface CreateMemoryInput {
  type: MemoryType;
  value: string;
  confidence?: number;      // 0.0–1.0
  tags?: string[];
  visibility?: Visibility;
  expires_at?: string;      // ISO 8601 or null
}
```

### Format Helpers

| Method | Description |
|---|---|
| `client.format.forPrompt(units, options?)` | Bracket-delimited `[OMXP USER CONTEXT]` block |
| `client.format.forSystem(units, options?)` | System message with instructional phrasing |
| `client.format.forCompact(units, options?)` | Single-line `[OMXP Context]` summary |
| `client.format.groupByType(units)` | Group units by `MemoryType` |

#### Format Options

```typescript
interface FormatOptions {
  minConfidence?: number;    // Exclude units below this threshold (default: 0)
  excludeExpired?: boolean;  // Skip expired units (default: true)
  showSource?: boolean;      // Append source app attribution (default: false)
}
```

### Auth Helpers

| Method | Description |
|---|---|
| `client.auth.buildAuthorizationUrl(params)` | Build the OAuth authorization URL |
| `client.auth.exchangeCode(params)` | Exchange an auth code for an access token |
| `client.auth.revokeToken()` | Revoke the current access token |

### Error Handling

```typescript
import { OmxpApiError } from '@omxp/sdk';

try {
  await omxp.memory.get('mu_nonexistent');
} catch (err) {
  if (err instanceof OmxpApiError) {
    console.error(err.status);  // 404
    console.error(err.code);    // 'not_found'
    console.error(err.message); // 'Memory unit not found'
  }
}
```

### Health Check

```typescript
const health = await omxp.health();
// { status: 'ok', omxp_version: '0.1', vault_id: 'v_...' }
```

---

## Memory Types

| Type | Description | Example |
|---|---|---|
| `fact` | Persistent user facts | "User is a TypeScript developer" |
| `preference` | User preferences | "Prefers dark mode" |
| `context` | Ephemeral session context | "Currently working on auth module" |
| `skill` | Known skills or expertise | "Expert in React and Node.js" |
| `goal` | Current objectives | "Learning Rust this quarter" |
| `relationship` | Connections between entities | "Works with Alice on Project X" |

---

## License

Apache 2.0 — see [LICENSE](../../LICENSE) for details.
