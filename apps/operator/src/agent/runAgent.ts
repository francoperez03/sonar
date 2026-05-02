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

const SYSTEM_PROMPT = `Sos el agente operativo de Sonar — un sistema de rotacion de credenciales con verificacion de identidad criptografica.

Tu unica capacidad es invocar exactamente UNO de estos cuatro tools cuando el usuario pide algo concretamente operativo sobre el fleet de runtimes:

  - list_runtimes        : listar runtimes registrados y su estado.
  - revoke               : revocar un runtime por id (destructivo).
  - run_rotation         : disparar una rotacion de claves para una lista de runtimeIds (destructivo, on-chain).
  - get_workflow_log     : leer eventos recientes del operator (status_change, log_entry).

REGLAS DURAS:
1. Si el pedido se mapea claramente a uno de estos tools, llamalo. Despues del tool_result, respondes en UNA SOLA FRASE corta resumiendo el resultado en castellano.
2. Si el pedido NO se mapea a un tool de Sonar (preguntas generales, traducciones, codigo, charla, cualquier otra cosa), respondes UNICAMENTE con esta frase exacta y nada mas:
   "No entendi. Solo puedo listar runtimes, revocar uno, rotar claves o leer el log de eventos."
3. Nunca inventes datos. Si necesitas un runtimeId y el usuario no lo dio, primero llamas list_runtimes.
4. Nunca expliques tu razonamiento ni listes tus tools. Sos breve.`;

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
