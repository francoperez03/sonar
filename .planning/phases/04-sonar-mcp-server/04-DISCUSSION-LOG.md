# Phase 4: Sonar MCP Server - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-29
**Phase:** 04-sonar-mcp-server
**Areas discussed:** Transport MCP, get_workflow_log, Tool I/O schemas, Config + README

---

## Transport MCP

### Q1: Transport del MCP server?

| Option | Description | Selected |
|--------|-------------|----------|
| stdio (Recomendado) | Claude Desktop spawnea proceso vía config; JSON-RPC por stdin/stdout. Cero puertos, cero auth. | ✓ |
| HTTP/SSE | Server escucha en un puerto; Claude Desktop conecta vía URL. Más setup. | |
| Ambos | stdio por default + flag para HTTP. | |

**User's choice:** stdio (Recomendado)

### Q2: SDK MCP a usar?

| Option | Description | Selected |
|--------|-------------|----------|
| @modelcontextprotocol/sdk (Recomendado) | SDK oficial Anthropic en TS. stdio + HTTP, schemas zod, registro tools/resources. | ✓ |
| Implementación manual | Hablar JSON-RPC a mano. | |

**User's choice:** @modelcontextprotocol/sdk

---

## get_workflow_log

### Q3: ¿Cómo expone el server MCP el log stream?

| Option | Description | Selected |
|--------|-------------|----------|
| Ring buffer + snapshot (Recomendado) | WS persistente al boot, buffer ~500 events, tool retorna últimas N. | ✓ |
| Ring buffer + cursor | Igual + since={timestamp\|cursor}. | |
| On-demand drain | Tool abre WS al llamarse, drena, cierra. Sin buffer. | |
| MCP resource + subscribe | Resource con notifications. UX flaca en Claude Desktop. | |

**User's choice:** Ring buffer + snapshot

### Q4: ¿Qué hace el MCP server si el Operator está caído al arrancar?

| Option | Description | Selected |
|--------|-------------|----------|
| Reconnect loop, tools devuelven error 'operator unavailable' (Recomendado) | Server arranca igual, reconecta exponencial. Tools retornan error MCP. | ✓ |
| Fallar al boot | Server exitea hasta que operator suba. | |
| Lazy connect | Sin WS al boot; solo on first call. Pierde buffer histórico. | |

**User's choice:** Reconnect loop con error estructurado

---

## Tool I/O schemas

### Q5: list_runtimes — ¿qué campos por runtime?

| Option | Description | Selected |
|--------|-------------|----------|
| Mismos campos que GET /runtimes (Recomendado) | {runtimeId, status, registeredAt, lastHandshakeAt?}. | ✓ |
| Versión enriquecida | + hasActiveSession, uptime, lastLogEvent. | |
| Mínimo | Solo {runtimeId, status}. | |

**User's choice:** Passthrough de GET /runtimes

### Q6: revoke — ¿inputs y output?

| Option | Description | Selected |
|--------|-------------|----------|
| Input {runtimeId, reason?}, output {ok, status} (Recomendado) | Mapea 1:1 a POST /revoke. Reason opcional, queda en log. | ✓ |
| Input {runtimeId} solo | Sin reason. | |
| Input + confirmación | Flag confirm:true. | |

**User's choice:** {runtimeId, reason?} → {ok, status}

### Q7: get_workflow_log — ¿inputs?

| Option | Description | Selected |
|--------|-------------|----------|
| {limit?: number=50, runtimeId?: string} (Recomendado) | Default 50, max ~500. Filtro opcional por runtime. | ✓ |
| Sin parámetros | Siempre últimos 50, todos los runtimes. | |
| {limit, runtimeId, eventType?} | + filtro por tipo. | |

**User's choice:** {limit?: 50, runtimeId?}

### Q8: ¿Formato de output del log?

| Option | Description | Selected |
|--------|-------------|----------|
| Array JSON estructurado (Recomendado) | [{ts, runtimeId, type, payload}]. Claude razona mejor sobre JSON. | ✓ |
| Texto plano formateado | Strings tipo '[ts] runtimeId: msg'. | |
| Ambos | format:'json'\|'text'. | |

**User's choice:** Array JSON estructurado

---

## Config + README

### Q9: ¿Cómo se configura la conexión al Operator?

| Option | Description | Selected |
|--------|-------------|----------|
| Env vars con defaults (Recomendado) | OPERATOR_HTTP_URL=http://localhost:8787, OPERATOR_LOGS_WS=ws://localhost:8787/logs. | ✓ |
| Args CLI | Flags vía claude_desktop_config.json. | |
| Archivo de config | ~/.sonar/mcp.json. | |

**User's choice:** Env vars con defaults localhost

### Q10: ¿Cómo se distribuye el binario?

| Option | Description | Selected |
|--------|-------------|----------|
| node + ruta local al monorepo (Recomendado para demo) | claude_desktop_config.json apunta a 'node /path/sonar/apps/mcp/dist/index.js'. | ✓ |
| npx @sonar/mcp | Publicar a npm. | |
| tsx directo desde src | Saltar build. | |

**User's choice:** node + ruta local al monorepo

### Q11: ¿Qué incluye el README de Phase 4?

| Option | Description | Selected |
|--------|-------------|----------|
| Snippet de claude_desktop_config.json + 3 pasos (Recomendado) | clone+install, dev:operator, paste snippet. + 3 prompts ejemplo. | ✓ |
| Sólo el snippet | Sin pasos. | |
| Quickstart + troubleshooting | + sección de errores. | |

**User's choice:** Snippet + 3 pasos + ejemplos de tools

---

## Claude's Discretion

- Internal directory layout under `apps/mcp/src/`
- Specific @modelcontextprotocol/sdk APIs (Server vs McpServer helper)
- WebSocket client library choice (ws is the obvious pick)
- HTTP client (native fetch is fine)
- Error-mapping strategy from HTTP/WS failures to MCP error codes
- Whether to include a minimal troubleshooting section in README
- Tool description strings (must mark revoke as destructive)
- LOG_BUFFER_SIZE env var: keep or drop

## Deferred Ideas

- HTTP/SSE transport variant (post-demo)
- npm publish of @sonar/mcp (post-v1)
- Cursor/since pagination on get_workflow_log
- MCP resource subscriptions / live notifications
- distribute as MCP tool (Phase 5 wires KeeperHub directly)
- Auth/shared-secret between MCP and Operator
- Persistent log buffer across reboots
