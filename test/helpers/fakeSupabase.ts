/**
 * A local stand-in for a Supabase project, for tests only. Nothing here reaches the network.
 *
 * PostgREST RPC calls run against PGlite (real Postgres compiled to WASM) with the real migration
 * applied, so the SQL functions under test are the ones that will run in production. Storage and Auth
 * are small in-memory imitations of the endpoints the server uses.
 */
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';

const RPC_ARGUMENTS: Record<string, Record<string, string>> = {
  cc_put_documents: { p_rows: 'jsonb' },
  cc_documents_since: { p_since: 'timestamptz', p_after_collection: 'text', p_after_id: 'text', p_limit: 'integer' },
  cc_otp_put: { p_key: 'text', p_code_hash: 'text', p_purpose: 'text', p_payload: 'jsonb', p_expires_at: 'timestamptz', p_cooldown_seconds: 'integer' },
  cc_otp_verify: { p_key: 'text', p_code_hash: 'text', p_purposes: 'text[]', p_max_attempts: 'integer' },
  cc_otp_delete: { p_key: 'text' },
  cc_rate_limit_hit: { p_key: 'text', p_limit: 'integer', p_window_seconds: 'integer' },
  cc_rate_limit_peek: { p_key: 'text', p_limit: 'integer' },
};

export interface FakeSupabase {
  url: string;
  db: PGlite;
  storage: Map<string, { bytes: Buffer; contentType: string }>;
  rpcCalls: Record<string, number>;
  /** While true, RPC calls fail as if the database were unreachable. */
  setDatabaseDown(down: boolean): void;
  stop(): Promise<void>;
}

export async function startFakeSupabase(repoRoot: string): Promise<FakeSupabase> {
  const db = new PGlite();
  const migration = fs.readFileSync(path.join(repoRoot, 'supabase', 'migrations', '20261105000000_serverless_persistence.sql'), 'utf-8');
  await db.exec(migration);

  const storage = new Map<string, { bytes: Buffer; contentType: string }>();
  const rpcCalls: Record<string, number> = {};
  let databaseDown = false;

  const readBody = (req: http.IncomingMessage) =>
    new Promise<Buffer>((resolve, reject) => {
      const chunks: Buffer[] = [];
      req.on('data', (c) => chunks.push(c));
      req.on('end', () => resolve(Buffer.concat(chunks)));
      req.on('error', reject);
    });

  const json = (res: http.ServerResponse, status: number, body: unknown) => {
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(body));
  };

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url || '/', 'http://fake');
    const body = await readBody(req);
    try {
      const rpc = /^\/rest\/v1\/rpc\/([a-z_]+)$/.exec(url.pathname);
      if (rpc) {
        const name = rpc[1];
        rpcCalls[name] = (rpcCalls[name] || 0) + 1;
        if (databaseDown) return json(res, 503, { message: 'database unavailable' });
        const types = RPC_ARGUMENTS[name];
        if (!types) return json(res, 404, { message: `unknown function ${name}` });
        const input = body.length ? JSON.parse(body.toString('utf-8')) : {};
        const names = Object.keys(types);
        const params = names.map((arg) => {
          const value = input[arg] ?? null;
          return types[arg] === 'jsonb' && value !== null ? JSON.stringify(value) : value;
        });
        const list = names.map((arg, i) => `${arg} => $${i + 1}::${types[arg]}`).join(', ');
        const result = await db.query(`SELECT * FROM public.${name}(${list})`, params);
        return json(res, 200, result.rows);
      }
      if (url.pathname.startsWith('/rest/v1/')) return json(res, req.method === 'GET' ? 200 : 201, []);

      if (url.pathname === '/auth/v1/user') return json(res, 401, { message: 'invalid token' });
      if (url.pathname === '/auth/v1/admin/users') {
        return json(res, req.method === 'GET' ? 200 : 422, req.method === 'GET' ? { users: [] } : { message: 'not supported in tests' });
      }
      if (url.pathname.startsWith('/auth/v1/')) return json(res, 400, { message: 'not supported in tests' });

      const signUpload = /^\/storage\/v1\/object\/upload\/sign\/([^/]+)\/(.+)$/.exec(url.pathname);
      if (signUpload) return json(res, 200, { url: `/object/upload/sign/${signUpload[1]}/${signUpload[2]}?token=fake-upload` });
      const sign = /^\/storage\/v1\/object\/sign\/([^/]+)\/(.+)$/.exec(url.pathname);
      if (sign && req.method === 'POST') {
        if (!storage.has(`${sign[1]}/${sign[2]}`)) return json(res, 400, { statusCode: '404', error: 'not_found', message: 'Object not found' });
        return json(res, 200, { signedURL: `/object/sign/${sign[1]}/${sign[2]}?token=fake-read` });
      }
      if (sign && req.method === 'GET') {
        const file = storage.get(`${sign[1]}/${sign[2]}`);
        if (!file || url.searchParams.get('token') !== 'fake-read') return json(res, 400, { message: 'invalid token' });
        res.writeHead(200, { 'Content-Type': file.contentType });
        return res.end(file.bytes);
      }
      const object = /^\/storage\/v1\/object\/([^/]+)\/(.+)$/.exec(url.pathname);
      if (object) {
        const key = `${object[1]}/${object[2]}`;
        if (req.method === 'POST' || req.method === 'PUT') {
          const contentType = String(req.headers['content-type'] || 'application/octet-stream');
          let bytes = body;
          // storage-js sends Blob bodies as multipart: keep only the file part
          const boundary = /boundary=(.+)$/.exec(contentType)?.[1];
          if (boundary) {
            const text = body.toString('latin1');
            const closing = text.lastIndexOf(`\r\n--${boundary}--`);
            const fileStart = text.lastIndexOf('\r\n\r\n', closing) + 4;
            bytes = Buffer.from(text.slice(fileStart, closing), 'latin1');
          }
          storage.set(key, { bytes, contentType });
          return json(res, 200, { Key: key, Id: key });
        }
        const file = storage.get(key);
        if (!file) return json(res, 400, { statusCode: '404', error: 'not_found', message: 'Object not found' });
        res.writeHead(200, { 'Content-Type': file.contentType });
        return res.end(file.bytes);
      }
      json(res, 404, { message: `no fake for ${req.method} ${url.pathname}` });
    } catch (err: any) {
      json(res, 500, { message: err?.message || String(err) });
    }
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as { port: number };

  return {
    url: `http://127.0.0.1:${port}`,
    db,
    storage,
    rpcCalls,
    setDatabaseDown: (down) => {
      databaseDown = down;
    },
    stop: async () => {
      await new Promise<void>((resolve) => server.close(() => resolve()));
      await db.close();
    },
  };
}
