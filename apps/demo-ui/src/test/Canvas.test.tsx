import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, cleanup, act } from '@testing-library/react';

async function loadCanvas() {
  vi.resetModules();
  const storeMod = await import('../state/store.js');
  const CanvasMod = await import('../components/canvas/Canvas.js');
  return { store: storeMod.store, Canvas: CanvasMod.Canvas };
}

describe('Canvas', () => {
  beforeEach(() => {
    cleanup();
    vi.resetModules();
  });

  it('renders 4 runtime nodes (alpha, beta, gamma, alpha-clone)', async () => {
    const { Canvas } = await loadCanvas();
    render(<Canvas />);
    expect(screen.getByTestId('runtime-node-alpha')).toBeInTheDocument();
    expect(screen.getByTestId('runtime-node-beta')).toBeInTheDocument();
    expect(screen.getByTestId('runtime-node-gamma')).toBeInTheDocument();
    expect(screen.getByTestId('runtime-node-alpha-clone')).toBeInTheDocument();
  });

  it('renders operator as the live service chip and KeeperHub/Chain in the sequence row', async () => {
    const { Canvas } = await loadCanvas();
    render(<Canvas />);
    expect(screen.getByText('OPERATOR')).toBeInTheDocument();
    expect(screen.getByText('KeeperHub workflow')).toBeInTheDocument();
    expect(screen.getByText('chain deprecates')).toBeInTheDocument();
  });

  it("renders the idle hint when all runtimes are 'registered'", async () => {
    const { Canvas } = await loadCanvas();
    render(<Canvas />);
    expect(screen.getByText(/alpha, beta, and gamma are legitimate runtimes/i)).toBeInTheDocument();
  });

  it("after status_change to 'awaiting', alpha node has the awaiting class and idle hint disappears", async () => {
    const { store, Canvas } = await loadCanvas();
    render(<Canvas />);
    await act(async () => {
      store.receive({
        type: 'status_change',
        runtimeId: 'alpha',
        status: 'awaiting',
        timestamp: Date.now(),
      });
    });
    const alpha = screen.getByTestId('runtime-node-alpha');
    expect(alpha.className).toContain('awaiting');
    expect(screen.queryByText(/alpha, beta, and gamma are legitimate runtimes/i)).toBeNull();
  });

  it("after a 'Clone rejected:' log_entry, alpha-clone node has the clone-rejected class", async () => {
    const { store, Canvas } = await loadCanvas();
    render(<Canvas />);
    await act(async () => {
      store.receive({
        type: 'log_entry',
        runtimeId: 'alpha-clone',
        level: 'warn',
        message: 'Clone rejected: alpha-clone presented a copied pubkey; handshake denied.',
        timestamp: Date.now(),
      });
    });
    const ghost = screen.getByTestId('runtime-node-alpha-clone');
    expect(ghost.className).toContain('clone-rejected');
  });
});
