import * as net from 'node:net';
import * as os from 'node:os';
import * as crypto from 'node:crypto';

/**
 * Allocates a free ephemeral port by momentarily binding to port 0,
 * then closing the server and returning the assigned port number.
 */
export function allocPort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        server.close(() => reject(new Error('Failed to get port from server address')));
        return;
      }
      const port = address.port;
      server.close((err) => {
        if (err) reject(err);
        else resolve(port);
      });
    });
    server.on('error', reject);
  });
}

/**
 * Returns a unique temporary path for an ephemeral registry JSON file.
 * Each call returns a new UUID-suffixed path so tests don't collide.
 */
export function tempRegistryPath(): string {
  return os.tmpdir() + '/sonar-registry-' + crypto.randomUUID() + '.json';
}
