# KeeperHub — UX Feedback

Notes from building Sonar's rotation pipeline on top of KeeperHub. Ordered roughly by friction encountered. Nothing here is a blocker — all of it is "I lost a few minutes figuring this out."

---

## Workflow editor

### 1. Wiring an HTTP block to the output of the previous block isn't discoverable

It's not obvious at a glance how to feed a previous block's output into the next HTTP block. After poking around I noticed the variables were linked — and eventually realized you trigger the variable picker by typing `@`. That `@` affordance is invisible until you happen to type it. A small inline hint ("type @ to reference a previous step") inside the input would save the discovery loop.

### 2. Right sidebar sometimes shows the wrong context when clicking a workflow

Sometimes clicking a workflow opens the right sidebar with the action options (as if an action were selected) instead of the workflow's properties. Hard to reproduce on demand but it happened multiple times.

### 3. New workflow → expanding the right sidebar collapses the layout awkwardly

Click "New workflow" → expand the right sidebar → the layout breaks. The sidebar pushes the canvas content in a way that overlaps or squishes the workflow editor area instead of resizing it cleanly.

### 4. Renaming workflows isn't obvious

Couldn't figure out how to rename a workflow from the editor. Ended up looking through menus — never found the obvious entry point.

### 5. The "delete workflow" icon should be red

I had to hunt for it. A destructive action deserves a red tint or at least a clear "Delete" label, not just an icon that blends with the rest.

---

## Workflow list

### 6. Pin / reorder favorite workflows

When you have many workflows, the ones you're actively iterating on get buried. Letting users drag-reorder or pin a workflow to the top would help a lot during heavy iteration days.

---

## Environment & networks

### 7. No easy view of available gas balance per network

I couldn't find a single screen showing the ETH I have available to spend on gas, broken down by network. I had to go to a block explorer and look up the funded EOA myself. A "Funds" or "Wallets" panel showing balance per network would shorten the loop a lot, especially right before triggering a workflow run.

### 8. Loading environment variables isn't documented in-product

I had to look around to figure out where env vars live and how a workflow reads them. A short inline help link or a "Variables" tab inside the workflow would make this obvious.

---

## Small annoyances

### 9. Browser-default tooltips take ~3s to show

A few icons / chips rely on the browser's native `title` tooltip. The OS-level tooltip takes about 3 seconds to appear, which means I never wait for it — I just guess. Either render the label inline or implement a custom tooltip that shows on hover with a sub-second delay.

---

## What worked well

For balance, a few things were great:

- The HTTP block + JSON path picker, **once you know about `@`**, is genuinely fast to wire.
- Webhook → workflow → callback to my endpoint worked first try.
- The retry semantics on transient downstream failures handled a few flaky moments during integration without me having to add anything.

Happy to expand on any of these or share repro steps. Sonar's full integration lives in `apps/keeperhub/` of this repo.
