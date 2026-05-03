import Anthropic from '@anthropic-ai/sdk';
import type { LogBus } from '../log/LogBus.js';
import { TOOL_DEFS, dispatchTool, type AgentToolsCtx } from './tools.js';

/**
 * Sonar agent loop. Streams the model's response, executes tool_use blocks
 * via the in-process dispatcher, feeds tool_results back, recurses until
 * end_turn. Emits an async iterable of agent events for SSE.
 *
 * Guardrail: a strict system prompt restricts the agent to the four Sonar
 * tools. If the user asks anything off-topic, it must reply with a fixed
 * "no entendi" sentence and stop.
 */

const MODEL = 'claude-haiku-4-5-20251001';
const MAX_TURNS = 6;

const SYSTEM_PROMPT = `You are the Sonar operations agent — a credential rotation system with cryptographic identity verification.

Your only capability is to invoke exactly ONE of these six tools when the user asks for something concretely operational about the runtime fleet:

  - list_runtimes         : list registered runtimes and their status.
  - revoke                : revoke a runtime by id (destructive).
  - run_rotation          : trigger a key rotation for runtimeIds (destructive, on-chain).
  - get_workflow_log      : read recent operator events (status_change, log_entry).
  - simulate_clone_attack : run a real clone attack against a runtimeId (closes socket 4403 and leaves a "Clone rejected:" log).
  - reset_demo            : reset all runtimes back to "registered" and clear the log to record a clean demo.

HARD RULES:
1. If the request maps cleanly to one of these tools, call it. After the tool_result, reply with ONE short sentence summarizing the result in English.
2. If the request does NOT map to a Sonar tool (general questions, translations, code, chit-chat, anything else), reply ONLY with this exact sentence and nothing more:
   "I didn't get that. I can only list runtimes, revoke, rotate keys, read the log, simulate a clone attack, or reset the demo."
3. Never invent data. If you need a runtimeId and the user didn't provide one, call list_runtimes first.
4. Never explain your reasoning or list your tools. Be brief.`;

export type AgentEvent =
  | { type: 'token'; text: string }
  | { type: 'tool_use'; id: string; name: string; input: unknown }
  | { type: 'tool_result'; id: string; ok: boolean; output: unknown }
  | { type: 'done'; reason: 'end_turn' | 'max_turns' | 'error'; detail?: string };

export interface RunAgentOpts {
  apiKey: string;
  prompt: string;
  toolsCtx: AgentToolsCtx;
  logBus: LogBus;
}

type ContentBlock =
  | { type: 'text'; text: string }
  | { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> }
  | { type: 'tool_result'; tool_use_id: string; content: string; is_error?: boolean };

export async function* runAgent(opts: RunAgentOpts): AsyncGenerator<AgentEvent> {
  const client = new Anthropic({ apiKey: opts.apiKey });
  const messages: { role: 'user' | 'assistant'; content: string | ContentBlock[] }[] = [
    { role: 'user', content: opts.prompt },
  ];

  // Mirror the user turn into the demo bus so any spectator sees the prompt.
  opts.logBus.emitEvent({
    type: 'chat',
    role: 'user',
    content: opts.prompt,
    timestamp: Date.now(),
  });

  let assistantTextAccum = '';

  for (let turn = 0; turn < MAX_TURNS; turn++) {
    const stream = client.messages.stream({
      model: MODEL,
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      tools: TOOL_DEFS as unknown as Anthropic.Tool[],
      messages: messages as Anthropic.MessageParam[],
    });

    const turnContent: ContentBlock[] = [];
    let turnText = '';
    const toolUses: { id: string; name: string; input: Record<string, unknown> }[] = [];

    try {
      for await (const event of stream) {
        if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
          const text = event.delta.text;
          turnText += text;
          assistantTextAccum += text;
          yield { type: 'token', text };
        }
      }
    } catch (e) {
      const detail = e instanceof Error ? e.message : 'stream_failed';
      yield { type: 'done', reason: 'error', detail };
      return;
    }

    const final = await stream.finalMessage();

    for (const block of final.content) {
      if (block.type === 'text') {
        turnContent.push({ type: 'text', text: block.text });
      } else if (block.type === 'tool_use') {
        const tu = {
          type: 'tool_use' as const,
          id: block.id,
          name: block.name,
          input: (block.input ?? {}) as Record<string, unknown>,
        };
        turnContent.push(tu);
        toolUses.push({ id: block.id, name: block.name, input: tu.input });
      }
    }

    if (turnText) {
      // already streamed via tokens — nothing more to emit per-block.
    }

    if (toolUses.length === 0) {
      // No tool requested — model finished its turn.
      messages.push({ role: 'assistant', content: turnContent });
      finalizeAssistant(opts.logBus, assistantTextAccum);
      yield { type: 'done', reason: 'end_turn' };
      return;
    }

    // Push assistant turn (with tool_use blocks) and then a user turn with tool_results.
    messages.push({ role: 'assistant', content: turnContent });

    const resultsContent: ContentBlock[] = [];
    for (const tu of toolUses) {
      yield { type: 'tool_use', id: tu.id, name: tu.name, input: tu.input };
      const res = await dispatchTool(opts.toolsCtx, tu.name, tu.input);
      yield { type: 'tool_result', id: tu.id, ok: res.ok, output: res.ok ? res.output : { code: res.code, message: res.message } };
      resultsContent.push({
        type: 'tool_result',
        tool_use_id: tu.id,
        content: JSON.stringify(res.ok ? res.output : { error: res.code, message: res.message }),
        is_error: !res.ok,
      });
    }
    messages.push({ role: 'user', content: resultsContent });
  }

  finalizeAssistant(opts.logBus, assistantTextAccum);
  yield { type: 'done', reason: 'max_turns' };
}

function finalizeAssistant(logBus: LogBus, text: string): void {
  const trimmed = text.trim();
  if (!trimmed) return;
  logBus.emitEvent({
    type: 'chat',
    role: 'assistant',
    content: trimmed,
    timestamp: Date.now(),
  });
}
