# @sonar/mcp

A Model Context Protocol (MCP) server that lets Claude Desktop drive your local
Sonar Operator. Exposes three tools over stdio:

- **`list_runtimes`** — list every runtime registered with the Operator and its
  current status (`registered | awaiting | received | deprecated | revoked`).
- **`revoke`** — destructive: permanently revoke a runtime by id (with optional
  reason). Further handshakes from that runtime will fail.
- **`get_workflow_log`** — return the most recent rotation/handshake log events
  from the Operator's broadcast log stream (in-memory ring buffer, default 500).

This README is the canonical 5-minute install path. Paste the snippet, run the
two pnpm commands, restart Claude Desktop. Done.

---

## 1. `claude_desktop_config.json` snippet

Add the following entry to your Claude Desktop config (see step 3 below for the
file location). Replace `<ABSOLUTE-PATH-TO-SONAR>` with the absolute path to
your local clone of this repo — relative paths will fail because Claude Desktop
does not spawn the MCP server with the repo as cwd.

```json
{
  "mcpServers": {
    "sonar": {
      "command": "node",
      "args": ["<ABSOLUTE-PATH-TO-SONAR>/apps/mcp/dist/index.js"],
      "env": {
        "OPERATOR_HTTP_URL": "http://localhost:8787",
        "OPERATOR_LOGS_WS": "ws://localhost:8787/logs"
      }
    }
  }
}
```

The `env` block tells the MCP server where the Operator is listening. The
defaults above match `pnpm --filter @sonar/operator dev`; override only if you
moved the Operator off localhost or to a non-default port.

---

## 2. Three setup steps

### Step 1 — Clone, install, build

```bash
git clone <repo-url> sonar
cd sonar
pnpm install
pnpm --filter @sonar/mcp build
```

The build step compiles `apps/mcp/src/**` to `apps/mcp/dist/index.js` — this is
the file Claude Desktop will spawn.

### Step 2 — Start the Operator

In a separate terminal, from the repo root:

```bash
pnpm --filter @sonar/operator dev
```

The Operator must be running before Claude Desktop launches the MCP server,
otherwise the first WS subscription will fail (the server will then enter its
exponential-backoff reconnect loop and tools will return
`{ code: 'operator_unavailable' }` until the Operator comes up).

### Step 3 — Paste snippet, relaunch Claude Desktop

Edit Claude Desktop's MCP config and paste the snippet from section 1. The
config file lives at:

- **macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows:** `%APPDATA%\Claude\claude_desktop_config.json`
- **Linux:** `~/.config/Claude/claude_desktop_config.json`

Quit Claude Desktop fully (not just close the window) and relaunch Claude
Desktop. On the next launch the `sonar` MCP server will appear in the tools
list.

---

## 3. Tool catalog

| Tool                | Description                                                        | Example prompt                                       |
| ------------------- | ------------------------------------------------------------------ | ---------------------------------------------------- |
| `list_runtimes`     | List every runtime registered with the Operator with current status | "List my runtimes"                                   |
| `revoke`            | Permanently revoke a runtime by id (destructive — confirm in UI)    | "Revoke alpha because a clone showed up"             |
| `get_workflow_log`  | Return recent rotation/handshake log events (snapshot, default 50)  | "Show the last 50 log events for beta"               |

Claude Desktop will display a tool-approval prompt before each call. `revoke`
is marked destructive — review the runtime id carefully before approving.

---

## 4. Troubleshooting

- **MCP server won't start.** Check the Claude Desktop log at
  `~/Library/Logs/Claude/mcp-server-sonar.log` (macOS) — `ENOENT node` means
  Node isn't on Claude Desktop's PATH; replace `"command": "node"` with an
  absolute path to your node binary (e.g. `/usr/local/bin/node`).
- **All tools return `operator_unavailable`.** The MCP server can't reach the
  Operator. Confirm `pnpm --filter @sonar/operator dev` is running and that
  `OPERATOR_HTTP_URL` / `OPERATOR_LOGS_WS` in the snippet match the Operator's
  actual host/port.
- **Tool list is empty after relaunch.** Make sure you fully quit Claude
  Desktop (Cmd-Q on macOS) before relaunching — closing the window leaves the
  process running with the old config.
