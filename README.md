# OMXP — Open Mind Exchange Protocol

An open standard for portable, user-owned AI memory.

Your Claude memory doesn't follow you to Cursor. Your ChatGPT history is invisible to Gemini. Every new AI tool you try knows nothing about you, no matter how much time you've spent with the others.

OMXP fixes this. It's a protocol — like OAuth, but for AI memory — that lets you store your context in a vault you control and grant access to whichever tools you choose.

> **Current status:** OMXP is a published specification. The reference implementation is under active development and not yet available. Star/watch this repo to get notified when it ships.

---

## How It Works

```
You ──→ Your OMXP Vault ──→ Claude, Cursor, Gemini, or any OMXP-compatible app
              ↑
     You control access.
     You own the data.
     Apps request permission. You approve or deny.
```

---

## What Exists Today

- ✅ **Protocol specification** — [OMXP-WHITEPAPER.md](./OMXP-WHITEPAPER.md) (v0.1 draft)
- 🚧 **Reference implementation** — in progress
- 🚧 **JavaScript SDK** (`@omxp/sdk`) — in progress
- 🚧 **Python SDK** (`omxp-sdk`) — in progress
- 🚧 **CLI & local vault server** — in progress

---

## What It Will Look Like

Once the implementation ships, this is how you'll use it:

### Vault Setup

```bash
# Install the vault server
npm install -g @omxp/vault

# Create your vault
omxp init

# Run it locally
omxp serve
# → http://localhost:4737/omxp/v1
```

### CLI Usage

```bash
# Add a memory
omxp memory add --type fact --value "I prefer TypeScript over JavaScript"

# See what's stored
omxp memory list

# Export everything
omxp vault export > backup.json
```

### SDK Integration

```bash
npm install @omxp/sdk
```

```javascript
import { OmxpClient } from '@omxp/sdk';

const client = new OmxpClient({
  vaultUrl: 'http://localhost:4737',
  accessToken: process.env.OMXP_TOKEN,
});

// Read user context before an AI call
const memory = await client.memory.list({
  types: ['facts', 'preferences', 'skills'],
});

// Write new context after an AI call
await client.memory.create({
  type: 'context',
  value: 'Working on a React migration',
  confidence: 0.9,
  tags: ['project'],
});
```

Integration takes about 20 minutes with the SDK. See the [Integration Guide](./OMXP-WHITEPAPER.md#11-integration-guide) for the full walkthrough.

---

## Read the Whitepaper

The full protocol specification — data model, permission system, API, security model, and governance:

**→ [OMXP-WHITEPAPER.md](./OMXP-WHITEPAPER.md)**

---

## Status

| | |
|---|---|
| Specification | v0.1 — Draft, open for review |
| Reference Implementation | In progress |
| Author | Rafee (DRH) — [Anorthic Studio](https://anorthicstudio.com) |
| Website | [omxp.anorthicstudio.com](https://omxp.anorthicstudio.com) |

---

## Contributing

This is a draft. We want feedback.

- **Protocol design questions** → open an issue
- **Bug in the spec** → open an issue
- **SDK for a new language** → PRs welcome
- **Integration with your app** → we'll list it in the registry

Contributors to v0.1 are recognised as Founding Contributors.

---

## License

Apache License 2.0 — specification and implementation.
