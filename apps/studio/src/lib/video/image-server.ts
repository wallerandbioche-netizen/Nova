import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';

export interface ServedImage {
  buffer: Buffer;
  contentType: string;
}

export interface ImageServer {
  /** Image id -> URL the headless browser can fetch. */
  urls: Record<string, string>;
  close: () => Promise<void>;
}

/**
 * Serves the photos of a single render over loopback.
 *
 * The headless browser cannot read `file://` from the bundle's origin, and the photos are
 * private — they must not be published to reach the renderer. A short-lived local server keeps
 * the bytes in the process that owns them: nothing is written to a public directory, and the
 * server dies with the render whatever the outcome.
 */
export async function serveImages(images: Record<string, ServedImage>): Promise<ImageServer> {
  const routes = new Map<string, ServedImage>();
  for (const [id, image] of Object.entries(images)) {
    routes.set(`/${encodeURIComponent(id)}`, image);
  }

  const server: Server = createServer((request, response) => {
    const pathname = (request.url ?? '').split('?')[0] ?? '';
    const image = routes.get(pathname);
    if (!image) {
      response.writeHead(404).end();
      return;
    }
    response.writeHead(200, {
      'content-type': image.contentType,
      'content-length': image.buffer.byteLength,
      'cache-control': 'no-store',
    });
    response.end(image.buffer);
  });

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });

  const { port } = server.address() as AddressInfo;
  const urls: Record<string, string> = {};
  for (const id of Object.keys(images)) {
    urls[id] = `http://127.0.0.1:${port}/${encodeURIComponent(id)}`;
  }

  return {
    urls,
    close: () =>
      new Promise<void>((resolve) => {
        server.closeAllConnections?.();
        server.close(() => resolve());
      }),
  };
}
