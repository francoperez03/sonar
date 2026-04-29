import WebSocket from 'ws';

/**
 * Opens a WebSocket client connection to ws://127.0.0.1:<port>/runtime.
 * Resolves on 'open', rejects on 'error' or premature 'close'.
 */
export function connectRuntime(port: number): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}/runtime`);

    const onOpen = () => {
      cleanup();
      resolve(ws);
    };

    const onError = (err: Error) => {
      cleanup();
      reject(err);
    };

    const onClose = () => {
      cleanup();
      reject(new Error(`WebSocket closed before opening on port ${port}`));
    };

    const cleanup = () => {
      ws.off('open', onOpen);
      ws.off('error', onError);
      ws.off('close', onClose);
    };

    ws.on('open', onOpen);
    ws.on('error', onError);
    ws.on('close', onClose);
  });
}
