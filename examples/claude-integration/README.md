# Claude + OMXP Integration

Inject your OMXP memory vault into every Claude conversation.

## Setup

```bash
# 1. Install dependencies
npm install @omxp/sdk @anthropic-ai/sdk tsx

# 2. Start your vault
omxp init
omxp serve

# 3. Create a token for this app
omxp token create --app claude-demo --scopes read:all,write:context

# 4. Add some memory about yourself
omxp memory add --type fact --value "My name is Rafee, founder of Anorthic Studio"
omxp memory add --type preference --value "I prefer concise technical answers"
omxp memory add --type fact --value "I am building OMXP, an open AI memory protocol"
```

## Run

```bash
export OMXP_TOKEN="omxp_tok_..."   # token from step 3
export ANTHROPIC_API_KEY="sk-..."

npx tsx index.ts "What are you building?"
```

## How it works

1. **Read** — fetches `fact`, `preference`, `context` memory from your vault
2. **Format** — converts them to a `[OMXP USER CONTEXT]` block
3. **Inject** — uses it as Claude's system prompt
4. **Write** — saves a short-lived `context` unit summarising what you asked

Claude now knows who you are, every conversation.
