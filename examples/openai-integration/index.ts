// OMXP + OpenAI Integration Example
// Demonstrates how to inject OMXP memory context into every OpenAI conversation.
//
// Setup:
//   npm install @omxp/sdk openai
//   omxp init && omxp serve
//   omxp token create --app openai-demo --scopes read:all,write:context
//   OMXP_TOKEN=<token> OPENAI_API_KEY=<key> npx tsx index.ts

import { OmxpClient } from '@omxp/sdk';
import OpenAI from 'openai';

const omxp = new OmxpClient({
  vaultUrl: process.env['OMXP_URL'] ?? 'http://localhost:4747/v1',
  accessToken: process.env['OMXP_TOKEN'] ?? '',
});

const openai = new OpenAI({
  apiKey: process.env['OPENAI_API_KEY'],
});

async function chatWithMemory(userMessage: string): Promise<string> {
  // 1. Read user memory
  const memory = await omxp.memory.list({
    types: ['fact', 'preference', 'context'],
    visibility: 'shared',
  });

  // 2. Format as context block
  const context = omxp.format.forSystem(memory.memory_units);

  // 3. Call OpenAI with injected memory
  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      ...(context ? [{ role: 'system' as const, content: context }] : []),
      { role: 'user' as const, content: userMessage },
    ],
  });

  const aiResponse = completion.choices[0]?.message.content ?? '';

  // 4. Write context back to vault
  await omxp.memory.create({
    type: 'context',
    value: `User asked: "${userMessage.slice(0, 120)}"`,
    confidence: 0.7,
    tags: ['conversation', 'openai'],
    expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  });

  return aiResponse;
}

const userMessage = process.argv[2] ?? 'What do you know about me?';
console.log(`User: ${userMessage}\n`);

chatWithMemory(userMessage)
  .then((response) => {
    console.log(`GPT: ${response}\n`);
  })
  .catch((err) => {
    console.error('Error:', err.message);
    process.exit(1);
  });
