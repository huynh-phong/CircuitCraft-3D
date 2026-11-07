import type { IncomingMessage, ServerResponse } from 'node:http';
import app from './app.ts';

/**
 * Entry point of the Vercel Function. The route passes the requested path in `__path`, so the Express
 * routes receive the original URL whichever URL the platform presents after its rewrite.
 */
export default function handler(req: IncomingMessage, res: ServerResponse) {
  const url = new URL(req.url || '/', 'http://function.local');
  const originalPath = url.searchParams.get('__path');
  if (originalPath !== null) {
    url.searchParams.delete('__path');
    req.url = `/api${originalPath}${url.search}`;
  }
  return app(req as any, res as any);
}
