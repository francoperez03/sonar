# @sonar/mcp

A Model Context Protocol (MCP) server that lets Claude Desktop drive your local
Sonar Operator. Exposes four tools over stdio:

- **`list_runtimes`** — list every runtime registered with the Operator and its
  current status (`registered | awaiting | received | deprecated | revoked`).
- **`revoke`** — destructive: permanently revoke a runtime by id (with optional
  reason). Further handshakes from that runtime will fail.
- **`get_workflow_log`** — return the most recent rotation/handshake log events
  from the Operator's broadcast log stream (in-memory ring buffer, default 500).
- **`run_rotation`** *(Phase 5)* — destructive: triggers a KeeperHub workflow
  run that generates fresh EOAs, funds them, distributes to runtimes, and
  deprecates old wallets on Base Sepolia. Returns the runId immediately; poll
  on-chain progress via `get_workflow_log`.

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
        "OPERATOR_LOGS_WS": "ws://localhost:8787/logs",
        "KEEPERHUB_API_TOKEN": "<your KeeperHub API token — M-01>",
        "KEEPERHUB_WORKFLOW_ID": "<id from publish-workflow output — M-06>",
        "KEEPERHUB_WEBHOOK_SECRET": "dev-secret",
        "POLLER_BASE_URL": "http://localhost:8788"
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
| `run_rotation`      | DESTRUCTIVE — triggers an on-chain rotation via KeeperHub (Phase 5) | "Run rotation on alpha, beta, gamma"                 |

Claude Desktop will display a tool-approval prompt before each call. `revoke`
and `run_rotation` are marked destructive — review the inputs carefully before
approving. `run_rotation` triggers real Base Sepolia transactions.

---

## 5. Phase 5 — `run_rotation`

The Phase 5 tool that bridges Claude Desktop to the on-chain KeeperHub workflow.
It POSTs to `KEEPERHUB_BASE_URL/api/workflow/<id>/execute` with `{ input: { runtimeIds } }`,
then registers the returned runId with the local apps/keeperhub poller-server
(`POLLER_BASE_URL/poller/register`) so transaction hashes mirror to the
Operator's LogBus automatically.

### Required env (additions on top of the Phase 4 vars)

| Var                       | Purpose                                                                                        | M-NN  |
| ------------------------- | ---------------------------------------------------------------------------------------------- | ----- |
| `KEEPERHUB_API_TOKEN`     | Bearer for the KeeperHub run-trigger endpoint (same value used by `apps/keeperhub`).            | M-01  |
| `KEEPERHUB_WORKFLOW_ID`   | Captured from `pnpm --filter @sonar/keeperhub publish:workflow` stdout.                         | M-06  |
| `KEEPERHUB_WEBHOOK_SECRET`| MUST match `apps/operator` AND `apps/keeperhub`. Strict-required — boot fails if unset (D-18). | M-04  |
| `POLLER_BASE_URL`         | Local apps/keeperhub poller-server (default `http://localhost:8788`).                           | —     |

### Required runtime services before invoking the tool

1. **`apps/operator`** running (`pnpm --filter @sonar/operator dev` or `pnpm dev:fleet`) — M-07.
2. **`apps/keeperhub` poller-server + long poller** running
   (`pnpm --filter @sonar/keeperhub start`). Confirm with
   `curl -sf http://localhost:8788/healthz` → `{"status":"ok"}`.
3. **KeeperHub Turnkey wallet funded** with Base Sepolia ETH — M-03 / M-09.
4. **KeeperHub workflow published** at the id in `KEEPERHUB_WORKFLOW_ID` — M-06.

### M-08 — Refreshing Claude Desktop after install

Phase 4 already added the Sonar MCP server entry to `claude_desktop_config.json`.
Phase 5 adds `run_rotation` as a NEW tool on the SAME server, so Claude Desktop
must be restarted to discover it:

1. Edit `claude_desktop_config.json` and ensure the `env` block contains the four
   Phase 5 vars listed above (the snippet at the top of this README is the canonical
   shape).
2. **Quit Claude Desktop fully** (Cmd-Q on macOS — closing the window leaves the
   menu-bar process running with the old tool list).
3. Relaunch Claude Desktop.
4. Open the tools menu (or ask Claude `What tools do you have?`). You should now
   see four Sonar tools: `list_runtimes`, `revoke`, `get_workflow_log`, `run_rotation`.
5. Smoke run prompt: *"Use run_rotation to rotate alpha, beta, gamma."* Claude
   surfaces a destructive-tool confirmation; approve to trigger the on-chain run.

---

## 6. Troubleshooting

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
