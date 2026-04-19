# OMXP — Open Mind Exchange Protocol

> The first open standard for portable, user-owned AI memory.

One vault. Every AI tool. Your data, your rules.

---

## The Problem

You use Claude, Cursor, Windsurf, ChatGPT, Gemini — probably several more by next month. Each one learns a different version of you. None of them talk to each other. Every context switch means starting from scratch.

OMXP is a new protocol — designed from scratch by [Anorthic Studio](https://anorthicstudio.com) — that gives you a single memory vault any AI tool can connect to. You control what gets stored, who can read it, and when access expires.

```
You ──→ Your OMXP Vault ──→ Claude, Cursor, Gemini, or any OMXP-compatible app
              ↑
     You control access.
     You own the data.
     Apps request permission. You approve or deny.
```

---

## Quick Start

```bash
npm install -g @omxp/cli

omxp init       # Generate keypair, create local vault
omxp serve      # Start vault server at localhost:4747
```

That's it. Your vault is running.

---

## Integrate in 20 Minutes

```bash
npm install @omxp/sdk
```

```typescript
import { OmxpClient } from '@omxp/sdk';

const omxp = new OmxpClient({ accessToken: 'omxp_tok_...' });

// Read user memory
const memory = await omxp.memory.list({
  types: ['fact', 'preference'],
});

// Format for any AI prompt
const context = omxp.format.forPrompt(memory.memory_units);

// Write new memory
await omxp.memory.create({
  type: 'fact',
  value: 'User prefers TypeScript over JavaScript',
  confidence: 0.9,
});
```

See the [SDK README](./packages/sdk-js/README.md) for full API reference and Claude/OpenAI integration examples.

---

## CLI

```bash
# Memory operations
omxp memory list
omxp memory list --type fact,preference
omxp memory add --type fact --value "Lives in Bangladesh"
omxp memory add --type context --value "Working on auth" --expires 24h
omxp memory delete <id>
omxp memory search <query>

# Permissions
omxp permissions list
omxp permissions revoke <app_id>

# Vault management
omxp vault status
omxp vault export > backup.json
omxp vault import backup.json

# Dev helpers
omxp token create --app myapp --scopes read:all
omxp token verify <token>
```

---

## What's in the Box

| Package | Description | Status |
|---|---|---|
| **Protocol spec** | [OMXP-WHITEPAPER.md](./OMXP-WHITEPAPER.md) | v0.1 — published |
| `@omxp/core` | Protocol types, validation, crypto primitives | ✅ Implemented |
| `@omxp/vault-server` | Local-first vault server (Hono + SQLite) | ✅ Implemented |
| `@omxp/sdk` | Zero-dependency JS/TS SDK | ✅ Implemented |
| `@omxp/cli` | Command line interface | ✅ Implemented |
| Python SDK | `omxp-sdk` for Python | 🚧 Planned |

---

## Read the Whitepaper

The full protocol specification — data model, permission system, API, security model, and governance:

**→ [OMXP-WHITEPAPER.md](./OMXP-WHITEPAPER.md)**

---

## Status

| | |
|---|---|
| Specification | v0.1 — Draft, open for review |
| Reference Implementation | Functional — local-first SQLite vault |
| Author | DRH — [Anorthic Studio](https://anorthicstudio.com) |
| Website | [omxp.anorthicstudio.com](https://omxp.anorthicstudio.com) |

---

## Contributing

This is an open protocol. Feedback makes it better.

- **Protocol design questions** → open an issue
- **Bug in the spec** → open an issue
- **SDK for a new language** → PRs welcome
- **Integration with your app** → we'll list it in the registry

Contributors to v0.1 are recognised as Founding Contributors.

---

## License

Apache License 2.0 — specification and implementation.

---

Built by [Anorthic Studio](https://anorthicstudio.com)