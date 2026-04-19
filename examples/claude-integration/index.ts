// OMXP + Claude Integration Example
// Demonstrates how to inject OMXP memory context into every Claude conversation.
//
// Setup:
//   npm install @omxp/sdk @anthropic-ai/sdk
//   omxp init && omxp serve
//   omxp token create --app claude-demo --scopes read:all,write:context
//   OMXP_TOKEN=<token> ANTHROPIC_API_KEY=<key> npx tsx index.ts

import { OmxpClient } from '@omxp/sdk';
import Anthropic from '@anthropic-ai/sdk';

const omxp = new OmxpClient({
  vaultUrl: process.env['OMXP_URL'] ?? 'http://localhost:4747/v1',
  accessToken: process.env['OMXP_TOKEN'] ?? '',
});

const anthropic = new Anthropic({
  apiKey: process.env['ANTHROPIC_API_KEY'],
});

/**
 * Chat with Claude, automatically injecting OMXP user memory into the system prompt
 * and writing new context back to the vault after each conversation.
 */
async function chatWithMemory(userMessage: string): Promise<string> {
  // 1. Read user memory from vault
  const memory = await omxp.memory.list({
    types: ['fact', 'preference', 'context'],
    visibility: 'shared',
  });

  // 2. Format memory as context block for Claude
  const context = omxp.format.forPrompt(memory.memory_units);

  // 3. Call Claude with memory context in system prompt
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 1024,
    system: context
      ? `You are a helpful assistant. Use the following context about the user to personalise your responses.\n\n${context}`
      : 'You are a helpful assistant.',
    messages: [{ role: 'user', content: userMessage }],
  });

  const aiResponse =
    response.content[0]?.type === 'text' ? response.content[0].text : '';

  // 4. Write short-lived context back to the vault
  await omxp.memory.create({
    type: 'context',
    value: `User asked: "${userMessage.slice(0, 120)}"`,
    confidence: 0.7,
    tags: ['conversation', 'claude'],
    expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24h
  });

  return aiResponse;
}

// Run
const userMessage = process.argv[2] ?? 'What do you know about me?';
console.log(`User: ${userMessage}\n`);

chatWithMemory(userMessage)
  .then((response) => {
    console.log(`Claude: ${response}\n`);
  })
  .catch((err) => {
    console.error('Error:', err.message);
    process.exit(1);
  });
