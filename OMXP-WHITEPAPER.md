# OMXP: Open Mind Exchange Protocol

### A Standard for Portable, User-Owned AI Memory

```
Document:   OMXP Whitepaper v0.1
Author:     DRH, Anorthic Studio
Published:  April 2026
Website:    omxp.anorthicstudio.com
Repository: github.com/anorthicstudio/omxp
Status:     Draft — Open for Community Review
License:    Apache 2.0 (this document and implementation)
```

---

## Abstract

Hundreds of millions of people now use AI assistants daily, but every one of those assistants operates in isolation. What Claude knows about you, Cursor doesn't. What ChatGPT has learned over six months of conversation is invisible to Gemini. Users end up repeating themselves to every new tool, and the tools themselves never get meaningfully smarter about the person using them.

OMXP (Open Mind Exchange Protocol) is an open protocol for structuring, storing, and exchanging AI memory between applications. It lets users own their context and decide which tools get access to it.

This document lays out the problem, the protocol design, the data model, the permission and security systems, the reference implementation, and where we think standardization should go from here.

---

## Table of Contents

1. [Introduction](#1-introduction)
2. [Problem Statement](#2-problem-statement)
3. [Prior Art & Existing Approaches](#3-prior-art--existing-approaches)
4. [Protocol Design Goals](#4-protocol-design-goals)
5. [Core Concepts](#5-core-concepts)
6. [Data Model](#6-data-model)
7. [Permission System](#7-permission-system)
8. [API Specification](#8-api-specification)
9. [Security Model](#9-security-model)
10. [Reference Implementation](#10-reference-implementation)
11. [Integration Guide](#11-integration-guide)
12. [Governance & Standardization](#12-governance--standardization)
13. [Open Questions](#13-open-questions)
14. [Conclusion](#14-conclusion)

---

## 1. Introduction

The problems worth solving with open protocols tend to look obvious in hindsight. HTTP gave every computer a common language for sharing documents. OAuth let users authenticate once and grant access across services without handing out passwords. Both succeeded not because they were technically brilliant — plenty of competing approaches existed — but because they were simple enough that anyone could implement them, and open enough that nobody controlled them.

AI memory is heading toward the same kind of inflection point. Every major AI company has recognised that persistent memory matters. Anthropic, OpenAI, Google, and Meta have all shipped memory features in the last two years. But every one of those implementations is proprietary and closed. Your memory in Claude can't be read by Cursor. Six months of ChatGPT conversations teach Gemini nothing. The context you've built inside Notion AI is invisible to your coding assistant.

This isn't a technical limitation — it's a business decision. Proprietary memory creates lock-in, and lock-in is valuable. No major AI company has a commercial incentive to make your memory portable.

So we built OMXP: an open protocol that any application can implement, that puts memory ownership in the user's hands, and that nobody — including us — controls.

---

## 2. Problem Statement

### 2.1 The Fragmentation Problem

Most knowledge workers in 2026 use at least three or four AI tools on a given day, often more:

- A conversational AI (Claude, ChatGPT, Gemini)
- A coding assistant (Cursor, GitHub Copilot, Windsurf)
- A writing tool (Notion AI, Grammarly, Jasper)
- A research assistant (Perplexity, You.com)
- A task or project tool with AI features

All of these systems learn about you through interaction, and none of them share what they learn. They store everything in proprietary formats on proprietary servers, with no mechanism for exchange.

In practice this means someone who's used Claude for six months — long enough for it to understand their communication style, technical background, and current projects — opens Cursor for the first time and starts from absolute zero. The accumulated context doesn't transfer. It can't.

We call this the fragmentation problem, and it gets worse over time, not better. The more tools you add, the more fragmented your context becomes.

### 2.2 The Ownership Problem

There's a related problem: when your memory lives inside a company's product, you don't really own it. Try exporting your Claude memory in a structured format. Try transferring your ChatGPT context to a competitor. Try auditing exactly what's been stored, or selectively deleting some of it while keeping the rest. None of this is possible with current tools.

The practical consequence is lock-in. After months of building up context in one system, switching means losing everything and starting over. Your accumulated understanding becomes a retention mechanism for the company, not a portable asset for you.

### 2.3 The Scale of Impact

To put a rough scale on it: there are over 500 million active AI assistant users globally as of early 2026, and knowledge workers typically use between three and seven AI-powered tools daily. The number of open standards that address memory interoperability between any of these tools is, as of this writing, zero.

### 2.4 Why Companies Won't Solve This

The reason this hasn't been solved internally is straightforward:

| Actor          | Incentive                                      |
| -------------- | ---------------------------------------------- |
| OpenAI         | Lock memory in ChatGPT → reduce churn          |
| Anthropic      | Lock memory in Claude → reduce churn           |
| Google         | Lock memory in Gemini → deepen ecosystem       |
| Microsoft      | Lock memory in Copilot → enterprise stickiness |
| Any AI startup | Lock memory → build switching costs            |

Every major AI company benefits from keeping memory proprietary. An open standard would reduce their switching costs, and nobody volunteers to do that. If this problem gets solved, the solution has to come from outside.

---

## 3. Prior Art & Existing Approaches

### 3.1 Proprietary Memory Systems

**Claude Memory (Anthropic, 2025–2026)**
Anthropic introduced persistent memory for Claude, letting the system retain facts about users across conversations. Memory is stored on Anthropic's servers, is not exportable in any structured form, and is inaccessible to non-Anthropic systems. The feature itself is genuinely useful — which only makes the closed implementation more frustrating.

**ChatGPT Memory (OpenAI, 2024–2026)**
OpenAI introduced memory features allowing ChatGPT to remember user preferences and facts. Same structural limitations: closed, proprietary, non-portable.

**Mem0 (2024)**
Mem0 is a memory layer for AI applications, offering developer APIs for storing and retrieving AI memories. It is a centralised service rather than an open protocol. Applications must route memory through Mem0's infrastructure. While genuinely useful, it introduces a new central dependency rather than eliminating centralisation.

**Zep (2024)**
Zep provides long-term memory for AI agents and assistants. Developer-focused and capable, but again a proprietary service rather than an open standard.

### 3.2 Relevant Open Protocols

**OAuth 2.0 (RFC 6749)**
The closest analogy to what OMXP aims to achieve. OAuth solved authentication fragmentation by defining a standard flow for delegated authorisation. Any service can implement it. Users grant access without sharing credentials. OMXP borrows heavily from OAuth's permission model.

**OpenID Connect**
Extended OAuth with identity information. Relevant as a model for how OMXP could evolve to carry richer user context beyond simple key-value memory.

**ActivityPub (W3C Recommendation)**
The protocol underlying the Fediverse. Relevant as a model for federated, user-owned data flowing between independent servers.

**Solid (W3C)**
Tim Berners-Lee's project for decentralised personal data storage. OMXP shares Solid's philosophy of user data ownership but is narrower in scope — focused on AI memory rather than all personal data.

### 3.3 The Gap

As far as we can tell, no existing open standard addresses AI memory portability specifically. That's the gap OMXP is designed to fill.

---

## 4. Protocol Design Goals

OMXP is designed against the following goals, listed in priority order:

**G1 — User Sovereignty**
Users must own their memory completely. No OMXP-compliant implementation may store user memory in a way that prevents the user from exporting, deleting, or migrating their data at any time.

**G2 — Simplicity**
The protocol must be simple enough that a solo developer can build a compliant integration in under four hours. Complexity is the enemy of adoption.

**G3 — Privacy by Default**
Memory must be encrypted at rest. No third party — including OMXP cloud providers — may have access to the plaintext contents of a user's vault without explicit cryptographic authorisation.

**G4 — Interoperability**
Any OMXP-compliant application must be able to read memory written by any other OMXP-compliant application, without those applications needing to coordinate with each other.

**G5 — Openness**
The protocol specification and reference implementation must be permanently open source. No entity may impose licensing terms that restrict implementation.

**G6 — Minimalism**
OMXP defines the minimum necessary to achieve interoperability. It does not attempt to standardise AI model behaviour, response quality, or application-layer functionality.

---

## 5. Core Concepts

### 5.1 The Vault

A **Vault** is the fundamental unit of OMXP. It is a user's complete AI memory store — an encrypted container holding all Memory Units belonging to that user.

A Vault:

- Is identified by a unique, user-controlled keypair
- May be stored locally, self-hosted, or on a cloud provider
- Is portable — a user may migrate their Vault between storage backends at any time
- Is encrypted — storage providers hold ciphertext, never plaintext

### 5.2 Memory Units

A **Memory Unit** is a single atomic piece of information within a Vault. Memory Units are typed, versioned, and timestamped.

Types of Memory Units:

| Type           | Description                      | Example                               |
| -------------- | -------------------------------- | ------------------------------------- |
| `fact`         | A persistent fact about the user | "Lives in Bangladesh"                 |
| `preference`   | A stated or inferred preference  | "Prefers minimal UI design"           |
| `context`      | Current situational context      | "Currently building OMXP"             |
| `skill`        | A known capability               | "Expert in Next.js"                   |
| `goal`         | A stated objective               | "Wants to launch open source company" |
| `relationship` | A known connection               | "Works with a team of 4"              |

### 5.3 The Permission System

**Applications do not have access to a Vault by default.**

An application must request access through the OMXP Permission Flow. The user explicitly grants or denies each request, with granular control over what the application may read or write.

This is structurally identical to OAuth 2.0's authorisation code flow.

### 5.4 Scopes

Permissions are expressed as **Scopes**:

```
read:facts              — Read all fact-type Memory Units
read:preferences        — Read all preference-type Memory Units
read:context            — Read all context-type Memory Units
read:all                — Read all Memory Units of all types
read:skills             — Read all skill-type Memory Units
read:goals              — Read all goal-type Memory Units
read:relationships      — Read all relationship-type Memory Units
write:facts             — Create and update fact-type Memory Units
write:context           — Create and update context-type Memory Units
write:skills            — Create and update skill-type Memory Units
write:goals             — Create and update goal-type Memory Units
write:relationships     — Create and update relationship-type Memory Units
write:all               — Create and update Memory Units of all types
delete:own              — Delete Memory Units created by this application
admin                   — Full vault access (requires explicit user confirmation)
```

### 5.5 Identity

OMXP identity is **keypair-based**. Users are identified by a public key, not by an email address or an account on any central server. This enables:

- Self-sovereign identity — no central authority can revoke a user's identity
- Pseudonymity — users may create multiple identities for different contexts
- Portability — identity is not tied to any service provider

---

## 6. Data Model

### 6.1 Vault Object

```json
{
  "omxp_version": "0.1",
  "vault_id": "v_a1b2c3d4e5f6",
  "public_key": "ed25519:AbCdEfGhIjKlMnOpQrStUvWxYz...",
  "created_at": "2026-04-18T00:00:00Z",
  "updated_at": "2026-04-18T12:00:00Z",
  "memory_units": [],
  "permissions": {},
  "metadata": {
    "display_name": "DRH",
    "schema_version": "0.1.0"
  }
}
```

### 6.2 Memory Unit Object

```json
{
  "id": "mu_x9y8z7w6v5u4",
  "type": "fact",
  "value": "Based in Bangladesh",
  "source_app": "claude",
  "confidence": 1.0,
  "created_at": "2026-04-18T09:00:00Z",
  "updated_at": "2026-04-18T09:00:00Z",
  "expires_at": null,
  "tags": ["location", "demographics"],
  "visibility": "shared"
}
```

**Field definitions:**

| Field        | Type             | Description                                                  |
| ------------ | ---------------- | ------------------------------------------------------------ |
| `id`         | string           | Unique identifier, prefixed `mu_`                            |
| `type`       | enum             | One of: fact, preference, context, skill, goal, relationship |
| `value`      | string           | The memory content, in plain natural language                |
| `source_app` | string           | Application that created this unit                           |
| `confidence` | float            | 0.0–1.0, how confident the source is in this fact            |
| `created_at` | ISO 8601         | Creation timestamp                                           |
| `updated_at` | ISO 8601         | Last modification timestamp                                  |
| `expires_at` | ISO 8601 or null | Optional expiry (useful for context-type units)              |
| `tags`       | string[]         | Freeform tags for filtering                                  |
| `visibility` | enum             | `shared` (any permitted app) or `private` (source app only)  |

### 6.3 Permission Grant Object

```json
{
  "app_id": "cursor_ai",
  "app_name": "Cursor",
  "app_url": "https://cursor.sh",
  "granted_at": "2026-04-18T10:00:00Z",
  "scopes": ["read:facts", "read:preferences"],
  "token": "omxp_tok_a1b2c3...",
  "token_expires_at": "2026-07-18T10:00:00Z",
  "revoked": false
}
```

### 6.4 Complete Vault Example

```json
{
  "omxp_version": "0.1",
  "vault_id": "v_a1b2c3d4e5f6",
  "public_key": "ed25519:AbCdEfGhIjKlMnOpQrStUvWxYz...",
  "created_at": "2026-04-18T00:00:00Z",
  "updated_at": "2026-04-18T12:00:00Z",
  "memory_units": [
    {
      "id": "mu_001",
      "type": "fact",
      "value": "Based in Bangladesh",
      "source_app": "claude",
      "confidence": 1.0,
      "created_at": "2026-04-18T09:00:00Z",
      "updated_at": "2026-04-18T09:00:00Z",
      "expires_at": null,
      "tags": ["location"],
      "visibility": "shared"
    },
    {
      "id": "mu_002",
      "type": "preference",
      "value": "Prefers direct communication, no filler phrases",
      "source_app": "claude",
      "confidence": 0.95,
      "created_at": "2026-04-18T09:01:00Z",
      "updated_at": "2026-04-18T09:01:00Z",
      "expires_at": null,
      "tags": ["communication"],
      "visibility": "shared"
    },
    {
      "id": "mu_003",
      "type": "skill",
      "value": "Expert in Next.js, Tailwind CSS, and vanilla JavaScript",
      "source_app": "cursor",
      "confidence": 0.9,
      "created_at": "2026-04-18T09:05:00Z",
      "updated_at": "2026-04-18T09:05:00Z",
      "expires_at": null,
      "tags": ["technical", "frontend"],
      "visibility": "shared"
    },
    {
      "id": "mu_004",
      "type": "context",
      "value": "Currently building OMXP — an open AI memory protocol — as first product of Anorthic Studio",
      "source_app": "claude",
      "confidence": 1.0,
      "created_at": "2026-04-18T10:00:00Z",
      "updated_at": "2026-04-18T10:00:00Z",
      "expires_at": "2026-07-18T10:00:00Z",
      "tags": ["project", "startup"],
      "visibility": "shared"
    }
  ],
  "permissions": {
    "cursor_ai": {
      "app_name": "Cursor",
      "granted_at": "2026-04-18T10:00:00Z",
      "scopes": [
        "read:facts",
        "read:preferences",
        "read:skills",
        "write:skills"
      ],
      "token": "omxp_tok_a1b2c3...",
      "token_expires_at": "2026-07-18T10:00:00Z",
      "revoked": false
    },
    "claude": {
      "app_name": "Claude",
      "granted_at": "2026-04-18T09:00:00Z",
      "scopes": [
        "read:all",
        "write:facts",
        "write:preferences",
        "write:context"
      ],
      "token": "omxp_tok_d4e5f6...",
      "token_expires_at": "2026-07-18T09:00:00Z",
      "revoked": false
    }
  }
}
```

---

## 7. Permission System

### 7.1 The Authorization Flow

OMXP permission grants follow the OAuth 2.0 authorisation code pattern, adapted for memory-specific scopes.

```
Step 1: Application requests authorisation

  App → User's OMXP Vault:
  GET /omxp/authorize
    ?app_id=cursor_ai
    &app_name=Cursor
    &scopes=read:facts,read:preferences
    &redirect_uri=https://cursor.sh/omxp/callback
    &state=random_csrf_token


Step 2: User reviews and approves

  OMXP displays:
  "Cursor is requesting access to:
   → Read your facts
   → Read your preferences

   [Allow]  [Deny]"


Step 3: Vault issues access token

  Vault → App (via redirect):
  GET https://cursor.sh/omxp/callback
    ?code=authorization_code
    &state=random_csrf_token


Step 4: App exchanges code for token

  App → Vault:
  POST /omxp/token
  { code: "authorization_code" }

  Vault → App:
  {
    access_token: "omxp_tok_a1b2c3",
    token_type: "Bearer",
    expires_in: 7776000,
    scopes: ["read:facts", "read:preferences"]
  }


Step 5: App reads memory

  App → Vault:
  GET /omxp/memory?types=facts,preferences
  Authorization: Bearer omxp_tok_a1b2c3

  Vault → App:
  { memory_units: [...] }
```

### 7.2 Token Lifecycle

```
Access tokens:    Default 90-day expiry, renewable
Refresh tokens:   Issued alongside access token, used to renew
Revocation:       User may revoke any token at any time
                  Revocation is immediate and irreversible
Expiry:           Expired tokens return 401. App must re-authorise.
```

### 7.3 User Controls

The user dashboard provides complete visibility and control:

- List of all applications with active permission grants
- Exact scopes granted to each application
- History of all reads and writes by each application
- One-click revocation of any individual application
- One-click revocation of all applications
- Export complete vault as JSON
- Delete specific Memory Units
- Delete entire vault

---

## 8. API Specification

### 8.1 Base URL

```
Local vault:      http://localhost:4737/omxp/v1
Self-hosted:      https://your-domain.com/omxp/v1
OMXP Cloud:       https://vault.omxp.anorthicstudio.com/omxp/v1
```

### 8.2 Endpoints

**Authorisation**

```
GET  /authorize          Initiate permission grant flow
POST /token              Exchange authorisation code for access token
POST /token/revoke       Revoke an access token
POST /token/refresh      Refresh an expired access token
```

**Memory**

```
GET    /memory           List Memory Units (filterable by type, tags)
POST   /memory           Create a new Memory Unit
GET    /memory/:id       Get a specific Memory Unit
PUT    /memory/:id       Update a Memory Unit
DELETE /memory/:id       Delete a Memory Unit (source app only)
```

**Vault**

```
GET    /vault              Get vault metadata
GET    /vault/export       Export complete vault as JSON
GET    /vault/permissions  List all permission grants
DELETE /vault              Delete vault (requires confirmation token)
```

### 8.3 Request/Response Examples

**List Memory Units**

```http
GET /omxp/v1/memory?types=facts,preferences&limit=20
Authorization: Bearer omxp_tok_a1b2c3

200 OK
{
  "memory_units": [
    {
      "id": "mu_001",
      "type": "fact",
      "value": "Based in Bangladesh",
      ...
    }
  ],
  "total": 47,
  "page": 1
}
```

**Create Memory Unit**

```http
POST /omxp/v1/memory
Authorization: Bearer omxp_tok_a1b2c3
Content-Type: application/json

{
  "type": "skill",
  "value": "Expert in Next.js and Tailwind CSS",
  "confidence": 0.9,
  "tags": ["technical", "frontend"]
}

201 Created
{
  "id": "mu_099",
  "type": "skill",
  "value": "Expert in Next.js and Tailwind CSS",
  "source_app": "cursor_ai",
  "confidence": 0.9,
  "created_at": "2026-04-18T10:00:00Z",
  ...
}
```

**Error Responses**

```http
401 Unauthorized    — Invalid or expired token
403 Forbidden       — Insufficient scope for this operation
404 Not Found       — Memory Unit does not exist
409 Conflict        — Duplicate Memory Unit detected
429 Too Many Reqs   — Rate limit exceeded
```

### 8.4 Rate Limits

```
Read operations:    1,000 requests per hour per token
Write operations:   100 requests per hour per token
Authorisation:      10 requests per hour per IP
```

---

## 9. Security Model

### 9.1 Encryption

**At rest:** All Memory Units are encrypted using AES-256-GCM before storage. The encryption key is derived from the user's private key and is never transmitted to or stored by the vault host.

**In transit:** All OMXP communication occurs over TLS 1.3 minimum. Plain HTTP connections are rejected.

**Zero-knowledge hosting:** Cloud vault providers hold only ciphertext. They cannot read the contents of any vault they host. Users can verify this through client-side decryption.

### 9.2 Identity Verification

OMXP uses Ed25519 keypairs for user identity. The private key never leaves the user's device. The public key serves as the user's permanent identifier.

```
Key generation:     Client-side only
Private key:        Never transmitted, stored locally encrypted
Public key:         Vault identifier, shared freely
Signing:            All write operations signed by the user's private key
Verification:       Vault verifies signature before processing any write
```

### 9.3 Application Trust

Applications are not verified by OMXP. The protocol does not maintain a registry of trusted applications. Trust decisions are made entirely by users at permission-grant time.

Future versions may support optional application attestation through a community-maintained registry.

### 9.4 Threat Model

| Threat                 | Mitigation                                               |
| ---------------------- | -------------------------------------------------------- |
| Compromised vault host | Zero-knowledge encryption — host holds only ciphertext   |
| Stolen access token    | Short expiry (90 days) + immediate revocation capability |
| Malicious application  | User reviews scopes before granting — no silent access   |
| Private key theft      | Key stored locally, encrypted with user passphrase       |
| Network interception   | TLS 1.3 mandatory — plaintext connections rejected       |
| Replay attacks         | Request timestamps + nonce validation                    |

---

## 10. Reference Implementation

### 10.1 Architecture

The OMXP reference implementation is structured as a monorepo:

```
omxp/
├── packages/
│   ├── core/           — Protocol types, validation, crypto
│   ├── sdk-js/         — JavaScript/TypeScript SDK
│   ├── sdk-python/     — Python SDK
│   ├── vault-server/   — Local vault server (Node.js)
│   └── cli/            — Command line interface
├── apps/
│   └── dashboard/      — Web UI for vault management (Next.js)
├── docs/               — Protocol documentation
└── spec/               — Formal specification files
```

### 10.2 Local Vault Server

The local vault server runs on `localhost:4737` and requires no external dependencies:

```bash
# Install
npm install -g @omxp/vault

# Initialize a new vault
omxp init

# Start the vault server
omxp serve

# Vault is now available at http://localhost:4737/omxp/v1
```

Storage backend: SQLite (single file, zero configuration).

### 10.3 JavaScript SDK

```bash
npm install @omxp/sdk
```

```javascript
import { OmxpClient } from "@omxp/sdk";

// Initialize client (points to user's vault)
const omxp = new OmxpClient({
  vaultUrl: "http://localhost:4737",
  accessToken: process.env.OMXP_TOKEN,
});

// Read user memory before AI call
const memory = await omxp.memory.list({
  types: ["facts", "preferences", "context"],
});

// Format for AI context injection
const context = omxp.format.forPrompt(memory);

// Make AI call with user context
const response = await anthropic.messages.create({
  model: "claude-sonnet-4-6",
  messages: [
    {
      role: "user",
      content: `${context}\n\nUser message: ${userMessage}`,
    },
  ],
});

// Write new memory discovered during the interaction
await omxp.memory.create({
  type: "context",
  value: "User is debugging a Next.js routing issue",
  confidence: 0.8,
  tags: ["technical", "current-task"],
  expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
});
```

### 10.4 Python SDK

```bash
pip install omxp-sdk
```

```python
from omxp import OmxpClient

omxp = OmxpClient(
    vault_url="http://localhost:4737",
    access_token=os.environ["OMXP_TOKEN"]
)

# Read memory
memory = omxp.memory.list(types=["facts", "preferences"])

# Format for prompt injection
context = omxp.format.for_prompt(memory)

# Write memory
omxp.memory.create(
    type="fact",
    value="User prefers Python for data tasks, JavaScript for UI",
    confidence=0.85,
    tags=["technical", "language-preference"]
)
```

### 10.5 CLI Reference

```bash
omxp init                               # Initialize new vault
omxp serve [--port 4737]               # Start local vault server
omxp memory list [--type fact]         # List memory units
omxp memory add --type fact --value "..."  # Add memory unit
omxp memory delete <id>                # Delete memory unit
omxp permissions list                   # List app permissions
omxp permissions revoke <app_id>       # Revoke app access
omxp vault export > backup.json        # Export complete vault
omxp vault import backup.json          # Import vault from backup
```

---

## 11. Integration Guide

### 11.1 Integrating OMXP into an AI Application

The typical integration has three steps:

**Step 1: Request Authorization (once per user)**

```javascript
// Redirect user to grant access to your app
const authUrl = omxp.auth.buildAuthorizationUrl({
  appId: "your-app-id",
  appName: "Your App Name",
  scopes: ["read:facts", "read:preferences", "write:context"],
  redirectUri: "https://yourapp.com/omxp/callback",
});

// Redirect user to authUrl
// After approval, user is redirected back to redirectUri with ?code=...
```

**Step 2: Exchange Code for Token**

```javascript
// In your callback handler
const { accessToken } = await omxp.auth.exchangeCode({
  code: req.query.code,
  redirectUri: "https://yourapp.com/omxp/callback",
});

// Store accessToken securely for this user
await db.users.update(userId, { omxpToken: accessToken });
```

**Step 3: Use Memory in AI Calls**

```javascript
// On every AI interaction
const client = new OmxpClient({ accessToken: user.omxpToken });
const memory = await client.memory.list({ types: ["facts", "preferences"] });
const context = client.format.forPrompt(memory);

const response = await ai.complete(`${context}\n\n${userMessage}`);

// Optionally write new memory discovered during interaction
await client.memory.create({ type: "context", value: "..." });
```

### 11.2 Time to Integration

A developer following this guide, using the official SDK, should have a working OMXP integration running in under 20 minutes. Building a fully compliant implementation from scratch — without the SDK — typically takes under four hours (see G2 in Section 4).

### 11.3 Compatible Frameworks

OMXP integrates with any framework. Integration guides are available for:

- LangChain (Python + JavaScript)
- LlamaIndex
- CrewAI
- AutoGPT
- Direct Anthropic SDK
- Direct OpenAI SDK
- Direct Google Gemini SDK

---

## 12. Governance & Standardization

### 12.1 Current Status

OMXP is currently a **draft protocol** authored by Anorthic Studio. It is not yet an official standard of any standards body.

### 12.2 Open Governance Model

Anorthic Studio commits to the following governance principles:

**Protocol openness:** The OMXP specification will remain permanently open under the Apache License 2.0. No entity may restrict implementation of the protocol.

**Reference implementation:** The reference implementation will remain permanently open source under the Apache License 2.0.

**Community governance:** Once OMXP reaches 1,000 GitHub stars, governance will transition to a community steering committee. No single company — including Anorthic Studio — will hold veto power over protocol changes.

**Versioning:** Protocol changes follow semantic versioning. Breaking changes require a new major version and a 12-month deprecation period for prior versions.

### 12.3 Path to Standardization

Anorthic Studio intends to submit OMXP to relevant standards bodies as adoption grows:

```
Phase 1 (Current):   Draft spec, reference implementation
Phase 2:             Community review, public comment period
Phase 3:             Submit to W3C Community Group
Phase 4:             RFC submission to IETF
Phase 5:             Formal standardization
```

### 12.4 Contributing

OMXP is open to community contribution at every level:

- **Protocol changes:** Submit as a GitHub issue with rationale
- **Implementation contributions:** Standard pull request process
- **SDK contributions:** New language SDKs are welcome
- **Integrations:** Third-party integrations listed in the registry

All contributors to the v0.1 specification are listed as Founding Contributors.

---

## 13. Open Questions

The following questions are unresolved in this draft and are open for community discussion:

**Q1 — Conflict Resolution**
When two applications write conflicting facts about the same user, how should the vault resolve it? Options include: last-write-wins, confidence-weighted merging, user-resolution prompts, or source-priority rules.

**Q2 — Memory Unit Deduplication**
Should the protocol define deduplication logic, or leave this to implementations? Without it, naive storage will accumulate redundant memory over time.

**Q3 — Federated Vaults**
Should OMXP support federated vault discovery — where a user's vault can be resolved from their email or domain, similar to WebFinger? This would simplify the authorisation flow but introduces meaningful complexity.

**Q4 — Application Attestation**
Should the protocol include an optional mechanism for applications to attest their identity? This would help users evaluate permission requests — but risks creating a centralised application registry that becomes a point of control.

**Q5 — Memory Expiry Defaults**
Should context-type memory units have a default expiry, or persist until explicitly deleted? Stale context can be worse than no context.

**Q6 — Structured vs. Natural Language Memory**
This draft uses natural language strings for all memory values. Should OMXP also support structured schemas for specific memory types — for example, a formal location schema rather than a freeform string?

---

## 14. Conclusion

AI memory is fragmented, that fragmentation is getting worse as the number of tools grows, and the companies building those tools have no incentive to fix it.

We think OMXP is a viable answer: a minimal, privacy-first protocol that gives users ownership of their AI memory and lets applications share context with explicit consent, without requiring any central authority.

We deliberately kept the scope narrow. OMXP doesn't try to define how models should use memory, what counts as a good memory, or how applications should behave internally. It specifies only the minimum needed for interoperability: a data model, a permission system, and an API. A single developer can build a compliant implementation in weeks.

The protocol is open, the reference implementation is open, and governance will be community-driven once adoption reaches critical mass. What happens next depends on whether developers find this useful enough to build with.

---

## Appendix A — Glossary

| Term         | Definition                                                  |
| ------------ | ----------------------------------------------------------- |
| Vault        | A user's complete OMXP memory store                         |
| Memory Unit  | A single atomic piece of information within a vault         |
| Scope        | A permission defining what an application may read or write |
| Access Token | A credential issued to an application after authorisation   |
| Source App   | The application that created a specific Memory Unit         |
| Confidence   | A float (0.0–1.0) expressing certainty about a memory value |

## Appendix B — Version History

| Version | Date       | Changes                         |
| ------- | ---------- | ------------------------------- |
| 0.1     | April 2026 | Initial draft — Anorthic Studio |

## Appendix C — Acknowledgments

OMXP is designed by DRH at Anorthic Studio, Bangladesh.

OMXP wouldn't exist without the groundwork laid by OAuth 2.0 (RFC 6749), OpenID Connect, ActivityPub, and W3C Solid. We owe a genuine debt to those communities and their contributors.

---

```
OMXP Whitepaper v0.1
Anorthic Studio — omxp.anorthicstudio.com
github.com/anorthicstudio/omxp

This document is licensed under the Apache License 2.0.
The reference implementation is licensed under the Apache License 2.0.
```
